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

const MasterFilter = require("../Models/MasterFilter.model");

productSchema.pre("save", async function (next) {
  try {
    // Helper to resolve value: if it's an ID, fetch from MasterFilter, else return as is.
    // We cache fetches to avoid duplicate queries if multiple fields use same ID (unlikely but good practice)
    // Actually, simple sequential fetch is fine for this scale, or parallel.

    // We need to resolve all relevant fields before generating SKU
    // Fields for Tyre: width, profile, pattern, diameter, loadRating, speedRating
    // Fields for Wheel: size, color, diameter, fitments, staggeredOptions

    const resolveValue = async (val) => {
      if (!val) return "";
      if (mongoose.Types.ObjectId.isValid(val)) {
        const filter = await MasterFilter.findById(val);
        return filter ? filter.values : val;
      }
      return val;
    };

    let skuParts = [];
    // Start with Brand
    skuParts.push(this.brand || "");

    if (this.category === "tyre" && this.tyreSpecifications) {
      const w = await resolveValue(this.tyreSpecifications.width);
      const p = await resolveValue(this.tyreSpecifications.profile);
      const pattern = await resolveValue(this.tyreSpecifications.pattern);
      const d = await resolveValue(this.tyreSpecifications.diameter);
      const lr = await resolveValue(this.tyreSpecifications.loadRating);
      const sr = await resolveValue(this.tyreSpecifications.speedRating);

      // SKU Format: Brand-Width/Profile-Pattern-Diameter-LoadRatingSpeedRating
      // Using logic similar to frontend:
      // `${formData.brand}-${width || ""}/${profile || ""}-${pattern || ""}-${diameter || ""}-${loadRating || ""}${speedRating || ""}`

      let specPart = "";
      if (w) specPart += w;
      if (p) specPart += "/" + p;
      if (pattern) specPart += "-" + pattern;
      if (d) specPart += "-" + d;
      if (lr) specPart += "-" + lr;
      if (sr) specPart += sr; // Speed rating usually attached to load rating

      skuParts.push(specPart);
      this.sku = `${this.brand}-${specPart}`;
    } else if (this.category === "wheel" && this.wheelSpecifications) {
      const s = await resolveValue(this.wheelSpecifications.size);
      const c = await resolveValue(this.wheelSpecifications.color);
      const d = await resolveValue(this.wheelSpecifications.diameter);
      const f = await resolveValue(this.wheelSpecifications.fitments);
      const stag = await resolveValue(this.wheelSpecifications.staggeredOptions);

      // SKU Format: Brand-Size-Color-Diameter-Fitments-Staggered
      let specPart = [s, c, d, f, stag].filter(x => x).join("-");
      this.sku = `${this.brand}-${specPart}`;
    } else {
      // Fallback for other categories if any
      if (!this.sku) {
        this.sku = `${(this.brand || "").slice(0, 10)}-${Date.now().toString().slice(-6)}`;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Product", productSchema);
