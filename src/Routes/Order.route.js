const express = require("express");
const {
  createOrder,
  getAllOrders,
  DownloadPDF,
  createLocalOrder,
} = require("../Controllers/Order.controller");
const OrderRoute = express.Router();

OrderRoute.get("/", getAllOrders);
OrderRoute.post("/", createOrder);
OrderRoute.get("/download/:orderId", DownloadPDF);
OrderRoute.post("/local", createLocalOrder);

module.exports = OrderRoute;
