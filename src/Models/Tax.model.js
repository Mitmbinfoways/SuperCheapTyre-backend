const mongoose = require("mongoose");

const taxSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            default: "GST",
        },
        percentage: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Tax", taxSchema);
