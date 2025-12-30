const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    firstname: { type: String },
    lastname: { type: String },
    phone: { type: String },
    email: { type: String },
    date: { type: String, required: true },
    slotId: { type: String, required: true },
    status: { type: String },
    timeSlotId: { type: String },
    time: { type: String },
    Employee: { type: String },
    notes: { type: String },
    isDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appointmentSchema.index({ date: 1, slotId: 1, status: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
