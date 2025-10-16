const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    laptopImage: { type: String, required: true },
    mobileImage: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", bannerSchema);
