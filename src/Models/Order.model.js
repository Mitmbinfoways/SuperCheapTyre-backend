const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  brand: { type: String },
  sku: { type: String },
  category: { type: String },
  image: { type: String, default: "" },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
});

const paymentSchema = new mongoose.Schema({
  method: { type: String, default: "" },
  status: { type: String, default: "pending" },
  transactionId: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  currency: { type: String, default: "AU$" },
  providerPayload: { type: Object },
  note: { type: String, default: "" },
  paidAt: { type: Date, default: "" },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: "" },
});

const appointmentSchema = new mongoose.Schema({
  id: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  phone: { type: String },
  email: { type: String },
  date: { type: String },
  time: { type: String },
  slotId: { type: String },
  timeSlotId: { type: String },
});

const orderServiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    name: { type: String, },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    image: { type: String, default: "" },
  },
);

const orderSchema = new mongoose.Schema(
  {
    items: { type: [orderItemSchema] },
    serviceItems: { type: [orderServiceSchema] },
    subtotal: { type: Number },
    taxName: { type: String, default: "" },
    tax: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number },
    appointment: { type: appointmentSchema },
    customer: { type: customerSchema },
    payment: { type: [paymentSchema] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);