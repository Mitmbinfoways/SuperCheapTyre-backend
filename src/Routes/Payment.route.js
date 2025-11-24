const express = require("express");
const router = express.Router();
const { payment, getSessionStatus } = require("../Controllers/Payment.controller");

router.post("/", payment);
router.get("/status", getSessionStatus);


module.exports = router;