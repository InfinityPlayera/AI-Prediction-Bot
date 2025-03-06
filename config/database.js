require('dotenv').config();
const mongoose = require('mongoose').default;

exports.connect = () => {
	mongoose
		.connect(process.env.MONGO_URI, {
			family: 4
		})
		.then(() => {
			console.log('🦝 Successfully connected to MongoDB');
		})
		.catch((error) => {
			console.error(`⚠️ Database Error: ${error.message}`);
			process.exit(1);
		});
};
