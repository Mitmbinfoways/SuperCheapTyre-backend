const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String, default: "" },
    pricetext: { type: String, default: "" },
    images: { type: [String], default: [] },
    sku: { type: String },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    tyreSpecifications: {
      pattern: { type: String, trim: true },
      width: { type: String, trim: true },
      profile: { type: String, trim: true },
      diameter: { type: String, trim: true },
      loadRating: { type: String, trim: true },
      speedRating: { type: String, trim: true },
    },
    wheelSpecifications: {
      size: { type: String, trim: true },
      color: { type: String, trim: true },
      diameter: { type: String, trim: true },
      fitments: { type: String, trim: true },
      staggeredOptions: { type: String, trim: true },
    },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    isDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
