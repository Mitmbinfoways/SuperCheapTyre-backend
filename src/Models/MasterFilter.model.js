const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema({
  name: { type: String, required: true },
});

const tyreSpecificationSchema = new mongoose.Schema({
  pattern: [{ type: optionSchema }],
  width: [{ type: optionSchema }],
  profile: [{ type: optionSchema }],
  diameter: [{ type: optionSchema }],
  loadRating: [{ type: optionSchema }],
  speedRating: [{ type: optionSchema }],
});

const wheelSpecificationSchema = new mongoose.Schema({
  size: [{ type: optionSchema }],
  color: [{ type: optionSchema }],
  diameter: [{ type: optionSchema }],
  fitments: [{ type: optionSchema }],
  staggeredOptions: [{ type: optionSchema }],
});

const masterFilterSchema = new mongoose.Schema(
  {
    tyres: { type: tyreSpecificationSchema, required: true },
    wheels: { type: wheelSpecificationSchema, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MasterFilterSchema", masterFilterSchema);
