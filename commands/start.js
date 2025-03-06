/**
 * Handle /start command for the Telegram bot
 * Located at: ./commands/start.js
 */

module.exports = async (ctx) => {
    try {
        const user = ctx.from;
        const isAdmin = user.id.toString() === process.env.BOT_ADMIN_ID;
        
        // Log who used the start command
        console.log(`User ${user.id} (${user.username || 'no username'}) started the bot. Admin: ${isAdmin}`);
        
        // Welcome message for all users
        let welcomeMessage = `
👋 Welcome to PredictionCopier Bot!

This bot tracks and copies bets from a specific address on a prediction contract.
`;

        // Additional information for admin
        if (isAdmin) {
            welcomeMessage += `
🔐 Admin access granted.

🎯 Currently monitoring: ${process.env.TARGET_ADDRESS}
💰 Copying bets at 1/${process.env.BET_DIVISOR || '10'} of the original amount
🤖 Bot is active and running

You'll receive notifications when:
• Target address places a bet
• This bot copies the bet
• Rewards are claimed
`;
        } else {
            welcomeMessage += `
⚠️ This bot is currently in private mode and only accessible to authorized administrators.

If you should have access, please contact the bot owner.
`;
        }
        
        // Send the welcome message
        await ctx.reply(welcomeMessage);
        
        // For admins, also send a status update
        if (isAdmin) {
            await ctx.reply('✅ System is active and monitoring for bets');
        }
        
    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('❌ An error occurred while processing your request.');
    }
};
