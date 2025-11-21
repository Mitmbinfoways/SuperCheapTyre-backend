const express = require("express");
const router = express.Router();
const { payment } = require("../Controllers/Payment.controller");

router.post("/", payment);


module.exports = router;