const { rateLimitExceeded } = require('../locales/errors');
const { escape } = require('./format');


const rateLimitBan = async (ctx, next) => {
	if (ctx.session.isAdmin) {
		return next();
	}

	if (ctx.chat.type !== 'private') {
		return next();
	}

	ctx.session.counter = ctx.session.counter || 0;
	ctx.session.counter++;

	if (ctx.session.counter > 100) {
		const user = await User.findOne({ id: ctx.from.id });
		user.isBanned = true;
		await user.save();
	}

	return ctx.replyWithMarkdownV2(escape(rateLimitExceeded));
};

module.exports = rateLimitBan;