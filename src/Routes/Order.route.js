const express = require("express");
const { createOrder } = require("../Controllers/Order.controller");

const OrderRoute = express.Router();

OrderRoute.post("/", createOrder);

module.exports = OrderRoute;
