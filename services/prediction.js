const ClaimEpoch = require('../models/claimModel');

async function getCurrentEpoch(txContract) {
    try {
        return await txContract.currentEpoch();
    } catch(error) {
        console.error("Error fetching current epoch:", error);
    }
}

async function placeBullBet(epoch, amount, txContract, address) {
    try {
        console.log('before placebullbet');
        const tx = await txContract.betBull(epoch, {
            value: amount,
            gasLimit: 500000
        });
        console.log('bet bulling');
        const receipt = await tx.wait();
        console.log('waiting tx...');

        if(receipt.status === 0) {
            console.error('Transaction failed:', receipt);
        }

        await ClaimEpoch.create({
            epoch: epoch.toString(),
            userAddress: address,
            claimed: false
        });

        const message = `Successfully placing bull bet on ${epoch}`;
        console.log(message);
        return message;
    } catch (error) {
        const errorMsg = `Error placing bull bet on ${epoch}: ${error.message}`;
        console.error(errorMsg);
        return errorMsg;
    }
}

async function placeBearBet(epoch, amount, txContract, address) {
    try {
        console.log('before placebearbet');
        const tx = await txContract.betBear(epoch, {
            value: amount,
            gasLimit: 500000
        });
        console.log('bet bearing');
        const receipt = await tx.wait();
        console.log('waiting tx...');

        if(receipt.status === 0) {
            console.error('Transaction failed:', receipt);
        }

        await ClaimEpoch.create({
            epoch: epoch.toString(),
            userAddress: address,
            claimed: false
        });

        const message = `Successfully placing bear bet on ${epoch}`;
        console.log(message);
        return message;
    } catch (error) {
        const errorMsg = `Error placing bear bet on ${epoch}: ${error.message}`;
        console.error(errorMsg);
        return errorMsg;
    }
}

async function claimRewards(txContract, address) {
    try {
        // Get unclaimed bets from MongoDB
        const unclaimedBets = await ClaimEpoch.find({
            userAddress: address,
            claimed: false
        });

        if (unclaimedBets.length === 0) {
            await this.sendTelegramMessage('No unclaimed bets found');
            return;
        }

        // Filter epochs that have closed and have rewards
        const currentTimestamp = Math.floor(Date.now() / 1000); // Convert to seconds
        const claimableEpochs = [];
        const skippedEpochs = {
            notClosed: [],
            noRewards: []
        };

        const epochsToDelete = []; // Track epochs to delete

        for (const bet of unclaimedBets) {
            try {
                const round = await txContract.rounds(BigInt(bet.epoch));
                // Check if round is closed
                if (currentTimestamp <= Number(round.closeTimestamp)) {
                    skippedEpochs.notClosed.push(BigInt(bet.epoch));
                    continue;
                }
                // Check if user has rewards for this epoch
                const isClaimable = await txContract.claimable(BigInt(bet.epoch), bet.userAddress);

                if (isClaimable) {
                    claimableEpochs.push(BigInt(bet.epoch));
                } else {
                    skippedEpochs.noRewards.push(BigInt(bet.epoch));
                    // Delete epochs with no rewards instead of updating them
                    epochsToDelete.push(bet.epoch);
                }
            } catch (error) {
                console.error(`Error checking round ${bet.epoch}:`, error);
            }
        }

        // Delete epochs with no rewards
        if (epochsToDelete.length > 0) {
            await ClaimEpoch.deleteMany({
                epoch: { $in: epochsToDelete },
                userAddress: address
            });
        }

        // Prepare status message
        let statusMessage = '';
        if (skippedEpochs.notClosed.length > 0) {
            statusMessage += `Rounds not yet closed: ${skippedEpochs.notClosed.join(', ')}\n`;
        }
        if (skippedEpochs.noRewards.length > 0) {
            statusMessage += `Rounds with no rewards (deleted): ${skippedEpochs.noRewards.join(', ')}\n`;
        }

        if (claimableEpochs.length === 0) {
            statusMessage = 'No claimable rewards found.\n' + statusMessage;
            return statusMessage.trim();
        }

        // Call the claim function on the smart contract for epochs with rewards
        try {
            const tx = await txContract.claim(claimableEpochs);
            await tx.wait();
        } catch (error) {
            console.error('Claim Error: ', error);
            return error.message;
        }

        // Delete claimed epochs instead of updating them
        await ClaimEpoch.deleteMany({
            epoch: { $in: claimableEpochs.map(e => e.toString()) },
            userAddress: address
        });

        const successMessage = `Successfully claimed rewards for epochs: ${claimableEpochs.join(', ')}\n\n${statusMessage}`;
        console.log(successMessage);
        return successMessage.trim();
    } catch (error) {
        const errorMsg = `Error claiming rewards: ${error.message}`;
        console.error(errorMsg);
        return errorMsg;
    }
}

module.exports = {
    getCurrentEpoch,
    placeBullBet,
    placeBearBet,
    claimRewards
}