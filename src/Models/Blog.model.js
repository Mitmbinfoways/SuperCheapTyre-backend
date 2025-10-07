const mongoose = require("mongoose");

const cardItemSchema = new mongoose.Schema(
  {
    image: { type: String, trim: true, required: true },
    content: { type: String, trim: true, required: true },
  },
  { _id: false }
);

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    formate: {
      type: String,
      enum: ["carousel", "card", "alternative"],
      required: true,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          if (this.formate === "carousel") {
            return Array.isArray(v) && v.every((i) => typeof i === "string");
          }
          return true;
        },
        message: "For carousel, images must be an array of strings",
      },
    },
    content: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (this.formate === "carousel") {
            return typeof v === "string" && v.length > 0;
          }
          return true;
        },
        message: "For carousel, content is required",
      },
    },
    items: {
      type: [cardItemSchema],
      default: [],
      validate: {
        validator: function (v) {
          if (["card", "alternative"].includes(this.formate)) {
            return Array.isArray(v) && v.every((i) => i.image && i.content);
          }
          return true;
        },
        message:
          "For card/alternative, items must be an array of { image, content } objects",
      },
    },
    tags: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BlogSchema.pre("save", function (next) {
  if (this.formate === "carousel") {
    this.items = [];
  } else if (["card", "alternative"].includes(this.formate)) {
    this.images = [];
    this.content = "";
  }
  next();
});

module.exports = mongoose.model("Blog", BlogSchema);
