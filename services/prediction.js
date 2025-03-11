// prediction.js
const ClaimEpoch = require('../models/claimModel');
const { handleHttpReconnection } = require('../utils/httpProvider');

async function getCurrentEpoch(txContract, bot) {
    try {
        return await txContract.currentEpoch();
    } catch(error) {
        console.error("Error fetching current epoch:", error);
        if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
            await handleHttpReconnection('Error in getCurrentEpoch', bot);
            return await txContract.currentEpoch();
        }
        throw error;
    }
}

async function placeBullBet(epoch, amount, txContract, address, bot) {
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
        if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
            await handleHttpReconnection('Error in placeBullBet', bot);
            return await placeBullBet(epoch, amount, txContract, address, bot);
        }
        const errorMsg = `Error placing bull bet on ${epoch}: ${error.message}`;
        console.error(errorMsg);
        return errorMsg;
    }
}

async function placeBearBet(epoch, amount, txContract, address, bot) {
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
        if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
            await handleHttpReconnection('Error in placeBearBet', bot);
            return await placeBearBet(epoch, amount, txContract, address, bot);
        }
        const errorMsg = `Error placing bear bet on ${epoch}: ${error.message}`;
        console.error(errorMsg);
        return errorMsg;
    }
}

async function claimRewards(txContract, address, bot) {
    try {
        const unclaimedBets = await ClaimEpoch.find({
            userAddress: address,
            claimed: false
        });

        if (unclaimedBets.length === 0) {
            return 'No unclaimed bets found';
        }

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const claimableEpochs = [];
        const skippedEpochs = {
            notClosed: [],
            noRewards: []
        };

        const epochsToDelete = [];

        for (const bet of unclaimedBets) {
            try {
                const round = await txContract.rounds(BigInt(bet.epoch));
                if (currentTimestamp <= Number(round.closeTimestamp)) {
                    skippedEpochs.notClosed.push(BigInt(bet.epoch));
                    continue;
                }
                const isClaimable = await txContract.claimable(BigInt(bet.epoch), bet.userAddress);

                if (isClaimable) {
                    claimableEpochs.push(BigInt(bet.epoch));
                } else {
                    skippedEpochs.noRewards.push(BigInt(bet.epoch));
                    epochsToDelete.push(bet.epoch);
                }
            } catch (error) {
                if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
                    await handleHttpReconnection('Error checking round', bot);
                    return await claimRewards(txContract, address, bot);
                }
                console.error(`Error checking round ${bet.epoch}:`, error);
            }
        }

        if (epochsToDelete.length > 0) {
            await ClaimEpoch.deleteMany({
                epoch: { $in: epochsToDelete },
                userAddress: address
            });
        }

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

        try {
            const tx = await txContract.claim(claimableEpochs);
            await tx.wait();
        } catch (error) {
            if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
                await handleHttpReconnection('Error claiming rewards', bot);
                return await claimRewards(txContract, address, bot);
            }
            console.error('Claim Error: ', error);
            return error.message;
        }

        await ClaimEpoch.deleteMany({
            epoch: { $in: claimableEpochs.map(e => e.toString()) },
            userAddress: address
        });

        const successMessage = `Successfully claimed rewards for epochs: ${claimableEpochs.join(', ')}\n\n${statusMessage}`;
        console.log(successMessage);
        return successMessage.trim();
    } catch (error) {
        if (error.code === 'SERVER_ERROR' || error.message.includes('503')) {
            await handleHttpReconnection('Error in claimRewards', bot);
            return await claimRewards(txContract, address, bot);
        }
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
};
