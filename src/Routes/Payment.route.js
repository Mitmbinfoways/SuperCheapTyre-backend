const express = require("express");
const router = express.Router();
const { payment, getSessionStatus } = require("../Controllers/Payment.controller");

router.post("/", payment);
router.get("/status", getSessionStatus);
router.get("/check-status/:orderId", require("../Controllers/Payment.controller").checkPaymentStatus);
router.get("/check-session/:sessionId", require("../Controllers/Payment.controller").checkPaymentStatusBySession);


module.exports = router;