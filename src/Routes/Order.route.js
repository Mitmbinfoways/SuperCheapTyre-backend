const express = require("express");
const {
  createOrder,
  getAllOrders,
  DownloadPDF,
} = require("../Controllers/Order.controller");
const OrderRoute = express.Router();

OrderRoute.get("/", getAllOrders);
OrderRoute.post("/", createOrder);
OrderRoute.get("/download/:orderId", DownloadPDF);

module.exports = OrderRoute;
