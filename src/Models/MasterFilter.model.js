const mongoose = require("mongoose");

const masterFilterSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["tyre", "wheel"],
    },
    subCategory: {
      type: String,
      required: true,
    },
    values: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MasterFilter", masterFilterSchema);
