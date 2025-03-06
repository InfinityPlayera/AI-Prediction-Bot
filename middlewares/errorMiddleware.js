const { Error } = require('mongoose');
const { TelegramError }= require('telegraf');

module.exports = async(err, ctx) => {
    if (err instanceof TelegramError && err?.response?.error_code === 403) {
        err = new Error(`predictionBettingBot was blocked by ${ctx.from.id}`);
    }

	if (err instanceof Error.CastError) {
		err = new Error(`🆘 Resource Not Found: ${err.path}`);
	}

    if(err.name === 'ValidationError') {
        Object.keys(err.errors).forEach((key) => {
            err = new Error(err.errors[key].message);
        });
    }

    if (err.code === 11000) {
        err = new Error(`Duplicate ${Object.keys(err.keyValue)} entered`);
    }

    console.error('‼️ Error Middleware:', err);
    console.log(err.stack);
}