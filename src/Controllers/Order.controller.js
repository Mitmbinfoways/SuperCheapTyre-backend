const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const Product = require("../Models/Product.model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");

const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { "customer.name": searchRegex },
        { "customer.phone": searchRegex },
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const productIds = [
      ...new Set(orders.flatMap((order) => order.items.map((i) => i.id))),
    ];

    const products = await Product.find({ _id: { $in: productIds } })
      .select("name price images sku")
      .lean();

    const enrichedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        productDetails:
          products.find((p) => p._id.toString() === item.id.toString()) || null,
      })),
    }));

    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const pagination = {
      totalItems,
      totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { orders: enrichedOrders, pagination },
          "Orders fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const createOrder = async (req, res) => {
  try {
    const { items, subtotal, total, appointment, customer, payment } = req.body;

    if (!items || !Array.isArray(items) || !items.length) {
      return res
        .status(400)
        .json(new ApiError(400, "Order items are required"));
    }
    for (const item of items) {
      if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              null,
              "Each item must have a valid id and quantity"
            )
          );
      }
    }

    if (typeof subtotal !== "number" || typeof total !== "number") {
      return res
        .status(400)
        .json(new ApiError(400, "Subtotal and total must be numbers"));
    }
    if (total < subtotal) {
      return res
        .status(400)
        .json(new ApiError(400, "Total cannot be less than subtotal"));
    }

    if (
      !appointment ||
      !appointment.date ||
      !appointment.slotId ||
      !appointment.timeSlotId
    ) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            null,
            "Appointment with date, slotId, and timeSlotId is required"
          )
        );
    }

    if (!customer || !customer.name || !customer.phone) {
      return res
        .status(400)
        .json(new ApiError(400, "Customer information is required"));
    }

    const paymentData = payment || {};
    if (typeof paymentData.amount !== "number") paymentData.amount = 0;
    if (!paymentData.method) paymentData.method = "";
    if (!paymentData.status) paymentData.status = "pending";

    const order = await Order.create({
      items,
      subtotal,
      total,
      appointment,
      customer,
      payment: paymentData,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, order, "Order created successfully"));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to create order"));
  }
};

module.exports = { createOrder, getAllOrders };
