const { statusFetchFail, userBanned } = require('../locales/errors');
const User = require('../models/userModel');
const { escape } = require('../utils/format');

module.exports = async (ctx, next) => {
    try {
        let user;
        if ( ctx.chat.type === 'private') {
            const ctxUser = await ctx.telegram.getChat(ctx.from.id);
            const photo = await ctx.telegram.getFileLink(ctxUser.photo.big_file_id);
            const update = {
                $set: {
                    id: ctx.from.id,
                    firstName: ctx.from.first_name || null,
                    username: ctx.from.username || null,
                    photo: photo.href,
                    lastSeen: new Date()
                }
            };
            const options = {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            };

            user = await User.findOneAndUpdate({ id: ctx.from.id }, update, options);
        } else {
            user = await User.findOne({ id: ctx.from.id });
        }

        if (!user) {
            return next(); // Add proper support for groups
        }

        if (user.isBanned) {
            return ctx.replyWithMarkdown(escape(userBanned));
        }

        ctx.session.isAdmin = user.isAdmin;
        return next();
    } catch(error) {
        console.log('❌ Status Error: ' + error);
        await ctx.replyWithMarkdownV2(escape(statusFetchFail));
    }
}