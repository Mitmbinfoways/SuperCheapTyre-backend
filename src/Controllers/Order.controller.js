const Order = require("../Models/Order.model");
const Appointment = require("../Models/Appointment.model"); // if you have Appointment model
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const createOrder = async (req, res) => {
  try {
    const { items, subtotal, total, appointment, customer, payment } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || !items.length) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Order items are required"));
    }

    for (const item of items) {
      if (!item.id || !item.name || !item.price || !item.quantity) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              null,
              "Each item must have id, name, price, and quantity"
            )
          );
      }
    }

    // Validate subtotal & total
    if (typeof subtotal !== "number" || typeof total !== "number") {
      return res
        .status(400)
        .json(new ApiError(400, null, "Subtotal and total must be numbers"));
    }

    if (total < subtotal) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Total cannot be less than subtotal"));
    }

    // Validate appointment
    if (!appointment) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Appointment ID is required"));
    }

    const appointmentExists = await Appointment.findById(appointment);
    if (!appointmentExists) {
      return res
        .status(404)
        .json(new ApiError(404, null, "Appointment not found"));
    }

    // Validate customer
    if (!customer || !customer.fullName || !customer.phone) {
      return res
        .status(400)
        .json(new ApiError(400, null, "Customer information is required"));
    }

    // Optional: Validate payment if provided
    if (payment) {
      if (typeof payment.amount !== "number") payment.amount = 0;
      if (!payment.method) payment.method = "";
      if (!payment.status) payment.status = "pending";
    }

    const order = await Order.create({
      items,
      subtotal,
      total,
      appointment,
      customer,
      payment,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, order, "Order created successfully"));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(new ApiError(500, null, "Failed to create order", error.message));
  }
};

module.exports = { createOrder };
