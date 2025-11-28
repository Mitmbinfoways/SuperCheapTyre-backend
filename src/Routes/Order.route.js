const express = require("express");
const {
  createOrder,
  getAllOrders,
  DownloadPDF,
  updateOrder, // Add this import
  getOrderById,
} = require("../Controllers/Order.controller");
const OrderRoute = express.Router();

OrderRoute.get("/", getAllOrders);
OrderRoute.post("/", createOrder);
OrderRoute.get("/download/:orderId", DownloadPDF);
OrderRoute.get("/:orderId", getOrderById);
OrderRoute.put("/:orderId", updateOrder); // Add this route

module.exports = OrderRoute;