const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    epoch: {
        type: String,
        required: true
    },
    userAddress: {
        type: String,
        required: true
    },
    claimed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Claim', claimSchema);
