const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: {
        type: Number,
        require: true,
        trim: true,
        unique: true
    },
    fistName: String,
    username: {
        type: String,
        index: true,
        unique: true
    },
    photo: String,
    address: {
        type: String,
        index: true,
        validate: {
            validator: (address) => isAddress(address),
            message: 'Address must be a valid crypto address'
        },
        trim: true
    },
    privatekey: {
        type: String,
        index: true,
        trim: true
    },
    isAdmin: {
        type: Boolean,
        require: true,
        default: false
    },
    isBanned: {
        type: Boolean,
        require: true,
        default: false
    },
    lastSeen: {
        type: Date,
        require: true
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;