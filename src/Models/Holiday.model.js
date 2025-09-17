const mongoose = require("mongoose");
const holidaySchema = new mongoose.Schema({
    date: { type: Date, required: true, unique: true },
    reason: { type: String, default: "Holiday" },
    createdBy: { type: String, default: "admin" },
  }, { timestamps: true });
  
  module.exports = mongoose.model("Holiday", holidaySchema);
  