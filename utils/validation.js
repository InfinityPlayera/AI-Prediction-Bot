const { escape } = require('./format');
const { privateChatOnly, notAdmin } = require('../locales/errors');

const isBotAdmin = async (ctx, next) => {
	if (Number(process.env.BOT_ADMIN_ID) !== ctx.from.id) {
		return ctx.replyWithMarkdownV2(escape(notAdmin));
	}

	return next();
};

const isPrivateChat = (ctx, next) => {
	if (ctx.chat.type !== 'private') {
		return ctx.replyWithMarkdownV2(escape(privateChatOnly));
	}

	return next();
};


module.exports = {
	isBotAdmin,
	isPrivateChat
};
