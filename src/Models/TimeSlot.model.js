const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format validation
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format validation
    },
    breakTime: {
      start: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
      },
      end: {
        type: String,
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
      },
    },
    duration: {
      type: Number,
      required: true,
      min: 15, 
      max: 480,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    generatedSlots: [
      {
        slotId: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        isBreak: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

// Index for efficient queries
timeSlotSchema.index({ isActive: 1 });

module.exports = mongoose.model("TimeSlot", timeSlotSchema);
