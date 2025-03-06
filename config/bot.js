const mongoose = require('mongoose');
const { Scenes, session, Telegraf } = require('telegraf');
const rateLimit = require('telegraf-ratelimit');
const { Mongo } = require('@telegraf/session/mongodb');

const errorMiddleware = require('../middlewares/errorMiddleware');
const statusMiddleware = require('../middlewares/statusMiddleware');
const { rateLimitBan } = require('../utils/helpers');

const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage();

const client = mongoose.connection.getClient();
const store = Mongo({ client });

bot.use(session({ store }));
bot.use(stage.middleware());
bot.use(statusMiddleware);
bot.use(rateLimit({
	window: 2000,
	limit: 1,
	onLimitExceeded: rateLimitBan
}));
bot.catch(errorMiddleware);

module.exports = bot;