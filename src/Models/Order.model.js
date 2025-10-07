const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  product: { type: String },
  name: { type: String, required: true },
  price: { type: Number, required: true },
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
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: "" },
});

const orderSchema = new mongoose.Schema(
  {
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    total: { type: Number, required: true },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    customer: { type: customerSchema, required: true },
    payment: { type: paymentSchema },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
