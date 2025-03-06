// config/constants.js
const WSS_ENDPOINTS_CALL = process.env.WSS_ENDPOINTS_CALL;
const RPC_ENDPOINTS_TX = process.env.RPC_ENDPOINTS_TX;
const PREDICTION_CONTRACT = process.env.PREDICTION_CONTRACT;
const BNB_KLINES_URL = process.env.BNB_KLINES_URL;
const CRYPTO_COMPARE_URL = process.env.CRYPTO_COMPARE_URL;

// Add validation
if (!WSS_ENDPOINTS_CALL) {
    throw new Error('WSS_ENDPOINTS_CALL is not defined in environment variables');
}

if (!RPC_ENDPOINTS_TX) {
    throw new Error('RPC_ENDPOINTS_TX is not defined in environment variables');
}

if (!PREDICTION_CONTRACT) {
    throw new Error('PREDICTION_CONTRACT is not defined in environment variables');
}

if (!BNB_KLINES_URL) {
    throw new Error('BNB_KLINES_URL is not defined in environment variables');
}

if (!CRYPTO_COMPARE_URL) {
    throw new Error('CRYPTO_COMPARE_URL is not defined in environment variables');
}

module.exports = {
    WSS_ENDPOINTS_CALL,
    RPC_ENDPOINTS_TX,
    PREDICTION_CONTRACT,
    BNB_KLINES_URL,
    CRYPTO_COMPARE_URL
};
