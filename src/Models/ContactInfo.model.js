const mongoose = require("mongoose");

const contactInfoSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    openingHours: [
      {
        day: { type: String, required: true }, // e.g., "Mon - Fri", "Sat"
        time: { type: String, required: true }, // e.g., "9:00am - 5pm", "Closed"
      },
    ],
    openingHoursNote: {
      type: String,
      default: "",
    },
    mapLocation: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactInfo", contactInfoSchema);
