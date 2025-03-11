// index.js
require('dotenv').config();
require('./config/database').connect();
const { ethers } = require('ethers');
const axios = require('axios');
const { CONTRACT_ABI } = require('./config/contract');
const { WSS_ENDPOINTS_CALL, RPC_ENDPOINTS_TX, PREDICTION_CONTRACT, BNB_KLINES_URL, CRYPTO_COMPARE_URL } = require('./config/constants');
const { getCurrentEpoch, placeBearBet, placeBullBet, claimRewards } = require('./services/prediction');
const httpProvider = require('./httpProvider');

// Import Telegram bot and command handlers
const bot = require('./config/bot');
const { isPrivateChat } = require('./utils/validation');
const startHandler = require('./commands/start');

// Register bot commands
bot.start(isPrivateChat, startHandler);

// Add error handler for the bot
bot.catch((error, ctx) => {
    console.error('Bot error:', error);
    ctx.reply(`❌ An error occurred: ${error.message}`).catch(console.error);
});

// Launch the Telegram bot
bot.launch().then(() => {
    console.log('🤖 Telegram Bot successfully launched');
}).catch((error) => {
    console.error('Failed to launch bot:', error);
});

// Initialize HTTP provider
httpProvider.initializeHttpProvider(bot).then(() => {
    console.log('Initial HTTP Provider setup completed');
}).catch(error => {
    console.error('Failed to initialize HTTP Provider:', error);
});

let bettingIndex = 0;
let listenerProvider = null;
let listenerContract = null;

const DEFAULT_BET_SIZE = ethers.parseEther('0.02');
const RSI_PERIOD = 14;
const DEFAULT_RSI_UPPER = 50;
const DEFAULT_RSI_LOWER = 50;

// Send Telegram messages to admin
const sendTelegramMessage = async (message) => {
    try {
        await bot.telegram.sendMessage(process.env.BOT_ADMIN_ID, message);
    } catch (error) {
        console.error('Error sending Telegram message: ', error);
    }
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const fetchBNBPricesFromBinance = async () => {
    try {
        const response = await axios.get(BNB_KLINES_URL, {
            params: {
                symbol: 'BNBUSDT',
                interval: '1m',
                limit: RSI_PERIOD + 1
            }
        });
        return response.data.map(kline => parseFloat(kline[4]));
    } catch (error) {
        if (error.response && error.response.status === 451) {
            console.error('Error fetching BNB prices from Binance: Request blocked due to regional restrictions.');
        } else {
            console.error('Error fetching BNB prices from Binance:', error.message);
        }
        return [];
    }
}

const fetchBNBPricesFromCryptoCompare = async () => {
    try {
        const response = await axios.get(CRYPTO_COMPARE_URL, {
            params: {
                fsym: 'BNB',
                tsym: 'USD',
                limit: RSI_PERIOD + 1
            }
        });
        return response.data.Data.Data.map(entry => entry.close);
    } catch (error) {
        console.error('Error fetching BNB prices from CryptoCompare:', error.message);
        return [];
    }
}

const fetchCombinedBNBPrices = async () => {
    const binancePrices = await fetchBNBPricesFromBinance();
    if (binancePrices.length >= RSI_PERIOD + 1) {
        console.log(binancePrices);
        return binancePrices;
    }

    console.log('Falling back to CryptoCompare...');
    const cryptoComparePrices = await fetchBNBPricesFromCryptoCompare();

    if (cryptoComparePrices.length >= RSI_PERIOD + 1) {
        console.log(cryptoComparePrices);
        return cryptoComparePrices;
    }

    console.error('Insufficient price data from both Binance and CryptoCompare.');
    return [];
}

const calculateRSI = (prices) => {
    if (prices.length < RSI_PERIOD + 1) {
        console.error('Not enough price data to calculate RSI');
        return null;
    }
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= RSI_PERIOD; i++) {
        const difference = prices[i] - prices[i - 1];
        if (difference > 0) {
            gains += difference;
        } else {
            losses += Math.abs(difference);
        }
    }

    const averageGain = gains / RSI_PERIOD;
    const averageLoss = losses / RSI_PERIOD;

    console.log(averageGain, averageLoss);

    if (averageLoss === 0) return 100;

    const rs = averageGain / averageLoss;
    const rsi = 100 - (100 / (1 + rs));
    return rsi;
}

const executeStrategy = async (currentEpoch) => {
    const prices = await fetchCombinedBNBPrices();
    if (prices.length === 0) {
        console.error('Could not fetch BNB prices, aborting...');
        return null;
    }

    const rsi = calculateRSI(prices);
    if (rsi === null) {
        console.error("Could not calculate RSI, aborting...");
        return null;
    }
    console.log('Current RSI: ', rsi);

    let betUp = null;
    if (rsi > DEFAULT_RSI_UPPER) {
        betUp = true;
        console.log(`Placing Bullbet for epoch ${currentEpoch.toString()} based on RSI > ${DEFAULT_RSI_UPPER}`);
    } else if (rsi < DEFAULT_RSI_LOWER) {
        betUp = false;
        console.log(`Placing Bearbet for epoch ${currentEpoch.toString()} based on RSI < ${DEFAULT_RSI_LOWER}`);
    }

    return betUp;
}

const handleStartRoundEvent = async (epoch) => {
    try {
        if (!epoch) {
            console.error('Missing required event data: epoch');
            return;
        }

        console.log('Waiting for 278 seconds...');
        await sleep(285 * 1000);
        console.log('285 second wait completed');

        const txContract = httpProvider.getTxContract();
        const wallet = httpProvider.getWallet();

        const currentEpoch = await getCurrentEpoch(txContract, bot);
        if (!currentEpoch) {
            console.error("Could not fetch current epoch, aborting...");
            return;
        }

        const bettingUp = await executeStrategy(currentEpoch);

        if (bettingUp === true) {
            let message = `
🟢 BULL BET Detected:
Epoch: ${currentEpoch.toString()}
Amount: ${ethers.formatEther(DEFAULT_BET_SIZE)} BNB
`;
            console.log(message);
            await sendTelegramMessage(message);
            message = await placeBullBet(currentEpoch, DEFAULT_BET_SIZE, txContract, wallet.address, bot);
            await sendTelegramMessage(message);
        } else if (bettingUp === false) {
            let message = `
🔴 BEAR BET Detected:
Epoch: ${currentEpoch.toString()}
Amount: ${ethers.formatEther(DEFAULT_BET_SIZE)} BNB
`;
            console.log(message);
            await sendTelegramMessage(message);
            message = await placeBearBet(currentEpoch, DEFAULT_BET_SIZE, txContract, wallet.address, bot);
            await sendTelegramMessage(message);
        } else {
            let message = `Can't calculate price...`;
            await sendTelegramMessage(message);
            return;
        }

        bettingIndex++;
        if (bettingIndex >= 5) {
            bettingIndex = 0;
            let message = await claimRewards(txContract, wallet.address, bot);
            await sendTelegramMessage(message);
        }

    } catch (error) {
        console.error('Error in StartRound listener:', error);
        await sendTelegramMessage(`❌ Error processing new round: ${error.message}`);
    }
};

// Set up event listeners
const setupEventListeners = (contract) => {
    contract.on(contract.filters.StartRound(), handleStartRoundEvent);
    console.log(`✅ Event listeners set up for StartRoundEvent`);
};

// WebSocket provider with auto-reconnection
function createReconnectingWebSocketProvider() {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let heartbeatInterval = null;

    const connect = async () => {
        try {
            if (listenerProvider) {
                console.log("Cleaning up existing WebSocket provider...");

                if (heartbeatInterval) {
                    clearInterval(heartbeatInterval);
                    heartbeatInterval = null;
                }

                try {
                    listenerProvider.removeAllListeners();
                    await listenerProvider.destroy();
                } catch (err) {
                    console.log("Error during cleanup:", err.message);
                }
            }

            console.log(`Connecting to WebSocket at ${WSS_ENDPOINTS_CALL}...`);
            listenerProvider = new ethers.WebSocketProvider(WSS_ENDPOINTS_CALL);
            listenerContract = new ethers.Contract(PREDICTION_CONTRACT, CONTRACT_ABI, listenerProvider);

            setupEventListeners(listenerContract);

            listenerProvider.on("error", (error) => {
                console.error(`WebSocket error:`, error);
                reconnect("WebSocket error occurred");
            });

            if (listenerProvider.websocket) {
                listenerProvider.websocket.on("close", () => {
                    console.log(`WebSocket connection closed`);
                    reconnect("WebSocket connection closed");
                });
            }

            heartbeatInterval = setInterval(async () => {
                try {
                    const blockNumber = await listenerProvider.getBlockNumber();
                    console.log(`Heartbeat: Connection alive, current block ${blockNumber}`);
                } catch (error) {
                    console.error("Heartbeat check failed:", error);
                    reconnect("Heartbeat check failed");
                }
            }, 30000);

            reconnectAttempts = 0;
            await sendTelegramMessage("🔄 WebSocket connection established successfully");
            console.log("WebSocket connection established successfully");

            return true;
        } catch (error) {
            console.error("WebSocket connection failed:", error);
            reconnect("Initial connection failed");
            return false;
        }
    };

    const reconnect = async (reason) => {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }

        if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
            await sendTelegramMessage("⚠️ WebSocket reconnection failed after maximum attempts! Bot may miss events. Please restart manually.");
            return;
        }

        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000);

        console.log(`WebSocket disconnected (${reason}). Attempting to reconnect in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
        await sendTelegramMessage(`⚠️ WebSocket disconnected (${reason}). Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

        setTimeout(() => {
            connect();
        }, delay);
    };

    const cleanup = async () => {
        console.log("Cleaning up WebSocket resources...");

        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }

        if (listenerProvider) {
            try {
                listenerProvider.removeAllListeners();
                await listenerProvider.destroy();
                console.log("WebSocket provider destroyed successfully");
            } catch (error) {
                console.error("Error destroying WebSocket provider:", error);
            }
        }
    };

    connect();

    return {
        reconnect,
        cleanup,
        getStatus: () => ({
            connected: !!(listenerProvider && listenerProvider.websocket && listenerProvider.websocket.readyState === 1),
            reconnectAttempts: reconnectAttempts
        })
    };
}

const wsManager = createReconnectingWebSocketProvider();

bot.command('status', async (ctx) => {
    if (!isPrivateChat(ctx)) return;

    const wsStatus = wsManager.getStatus();
    const httpStatus = await httpProvider.getHttpProviderStatus();

    const statusMessage = `
🤖 Bot Status:
- WebSocket: ${wsStatus.connected ? '✅ Connected' : '❌ Disconnected'}
- Reconnect Attempts (WS): ${wsStatus.reconnectAttempts}
- HTTP Provider: ${httpStatus.connected ? '✅ Connected' : '❌ Disconnected'}
- HTTP Reconnect Attempts: ${httpStatus.reconnectAttempts}
- Monitoring Address: ${process.env.TARGET_ADDRESS}
- Betting Index: ${bettingIndex}
    `;

    ctx.reply(statusMessage);
});

bot.command('reconnect', async (ctx) => {
    if (!isPrivateChat(ctx)) return;

    await ctx.reply('🔄 Manually reconnecting WebSocket...');
    wsManager.reconnect('Manual reconnection requested');
    await ctx.reply('Reconnection process started');
});

bot.command('reconnecthttp', async (ctx) => {
    if (!isPrivateChat(ctx)) return;

    await ctx.reply('🔄 Manually reconnecting HTTP Provider...');
    const success = await httpProvider.handleHttpReconnection('Manual reconnection requested', bot);
    
    if (success) {
        await ctx.reply('HTTP Provider reconnection successful');
    } else {
        await ctx.reply('HTTP Provider reconnection failed');
    }
});

process.once('SIGINT', async () => {
    console.log('Shutting down bot and closing connections...');
    bot.stop('SIGINT');

    try {
        console.log('Closing all connections...');
        await wsManager.cleanup();
        await httpProvider.cleanupHttpProvider();
        console.log('All connections closed successfully');
    } catch (error) {
        console.error('Error closing connections:', error);
    }

    console.log('Shutdown complete');
    process.exit(0);
});

process.once('SIGTERM', async () => {
    console.log('Shutting down bot and closing connections...');
    bot.stop('SIGTERM');

    try {
        console.log('Closing all connections...');
        await wsManager.cleanup();
        await httpProvider.cleanupHttpProvider();
        console.log('All connections closed successfully');
    } catch (error) {
        console.error('Error closing connections:', error);
    }

    console.log('Shutdown complete');
    process.exit(0);
});
