// httpProvider.js
const { ethers } = require('ethers');
const { CONTRACT_ABI } = require('../config/contract');
const { RPC_ENDPOINTS_TX, PREDICTION_CONTRACT } = require('../config/constants');

let txProvider = null;
let wallet = null;
let txContract = null;
let httpReconnectAttempts = 0;
const MAX_HTTP_RECONNECT_ATTEMPTS = 10;

async function sendTelegramMessage(bot, message) {
    try {
        await bot.telegram.sendMessage(process.env.BOT_ADMIN_ID, message);
    } catch (error) {
        console.error('Error sending Telegram message: ', error);
    }
}

async function initializeHttpProvider(bot) {
    try {
        txProvider = new ethers.JsonRpcProvider(RPC_ENDPOINTS_TX);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, txProvider);
        txContract = new ethers.Contract(PREDICTION_CONTRACT, CONTRACT_ABI, wallet);
        
        // Test the connection
        await txProvider.getBlockNumber();
        
        console.log('HTTP Provider connected successfully');
        httpReconnectAttempts = 0;
        return true;
    } catch (error) {
        console.error('HTTP Provider connection failed:', error);
        return handleHttpReconnection('Initial connection failed', bot);
    }
}

async function handleHttpReconnection(reason, bot) {
    if (httpReconnectAttempts >= MAX_HTTP_RECONNECT_ATTEMPTS) {
        console.error(`Failed to reconnect HTTP Provider after ${MAX_HTTP_RECONNECT_ATTEMPTS} attempts`);
        await sendTelegramMessage(bot, "⚠️ HTTP Provider reconnection failed after maximum attempts!");
        return false;
    }

    httpReconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, httpReconnectAttempts), 60000);

    console.log(`HTTP Provider disconnected (${reason}). Attempting to reconnect in ${delay/1000}s (attempt ${httpReconnectAttempts}/${MAX_HTTP_RECONNECT_ATTEMPTS})...`);
    await sendTelegramMessage(bot, `⚠️ HTTP Provider disconnected (${reason}). Reconnecting in ${delay/1000}s (attempt ${httpReconnectAttempts}/${MAX_HTTP_RECONNECT_ATTEMPTS})`);

    return new Promise(resolve => {
        setTimeout(async () => {
            resolve(await initializeHttpProvider(bot));
        }, delay);
    });
}

async function getHttpProviderStatus() {
    try {
        await txProvider.getBlockNumber();
        return {
            connected: true,
            reconnectAttempts: httpReconnectAttempts
        };
    } catch (error) {
        return {
            connected: false,
            reconnectAttempts: httpReconnectAttempts
        };
    }
}

async function cleanupHttpProvider() {
    if (txProvider) {
        try {
            await txProvider.destroy();
            console.log('HTTP Provider cleaned up successfully');
        } catch (error) {
            console.error('Error cleaning up HTTP Provider:', error);
        }
    }
}

module.exports = {
    initializeHttpProvider,
    handleHttpReconnection,
    getHttpProviderStatus,
    cleanupHttpProvider,
    getTxContract: () => txContract,
    getWallet: () => wallet
};
