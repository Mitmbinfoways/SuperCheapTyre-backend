const mongoose = require('mongoose');

const tempOrderSchema = new mongoose.Schema({
    data: {
        type: Object,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // Documents expire after 1 hour (3600 seconds)
    }
}, { timestamps: true });

const TempOrder = mongoose.model('TempOrder', tempOrderSchema);

module.exports = TempOrder;
