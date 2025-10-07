const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  quantity: { type: Number, required: true },
});

const paymentSchema = new mongoose.Schema({
  method: { type: String, default: "" },
  status: { type: String, default: "pending" },
  transactionId: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "GBP" },
  providerPayload: { type: Object },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: "" },
});

const appointmentSchema = new mongoose.Schema({
  date: { type: String, required: true },
  slotId: { type: String, required: true },
  timeSlotId: { type: String, required: true },
});

const orderSchema = new mongoose.Schema(
  {
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    appointment: { type: appointmentSchema, required: true },
    customer: { type: customerSchema, required: true },
    payment: { type: paymentSchema },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
