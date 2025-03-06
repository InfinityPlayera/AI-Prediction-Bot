const rateLimitExceeded = `‼️ *Rate Limit Exceeded* ‼️

You've reached the request limit. Please try again later.`;

const statusFetchFail = ' *Failed to fetch bot status* '

const userBanned = '🚫 *You\'ve been permanently banned from using predictionBettingBot* 🚫';

const privateChatOnly = '⚠️ *This command can only be used in private chat* ⚠️';

const notAdmin = '🚫 *This command is only available to bot administrators* 🚫';

module.exports = { 
    rateLimitExceeded,
    statusFetchFail,
    userBanned,
    privateChatOnly,
    notAdmin
};