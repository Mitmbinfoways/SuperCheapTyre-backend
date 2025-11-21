const express = require("express");
const {
  createOrder,
  getAllOrders,
  DownloadPDF,
  createLocalOrder,
  updateOrder, // Add this import
} = require("../Controllers/Order.controller");
const OrderRoute = express.Router();

OrderRoute.get("/", getAllOrders);
OrderRoute.post("/", createOrder);
OrderRoute.get("/download/:orderId", DownloadPDF);
OrderRoute.post("/local", createLocalOrder);
OrderRoute.put("/:orderId", updateOrder); // Add this route

module.exports = OrderRoute;