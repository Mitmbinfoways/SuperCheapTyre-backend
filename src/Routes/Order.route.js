const express = require("express");
const { createOrder, getAllOrders } = require("../Controllers/Order.controller");

const OrderRoute = express.Router();

OrderRoute.get("/", getAllOrders);
OrderRoute.post("/", createOrder);

module.exports = OrderRoute;
