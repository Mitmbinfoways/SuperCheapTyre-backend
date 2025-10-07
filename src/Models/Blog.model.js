const mongoose = require("mongoose");

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    images: { type: [String], default: [] },
    content: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    formate: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", BlogSchema);
