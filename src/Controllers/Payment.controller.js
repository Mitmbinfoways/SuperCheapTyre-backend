const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const Appointment = require("../Models/Appointment.model");
const Product = require("../Models/Product.model");
const Service = require("../Models/Service.model");
const Tax = require("../Models/Tax.model");
const TimeSlot = require("../Models/TimeSlot.model");
const TempOrder = require("../Models/TempOrder.model");

const payment = async (req, res) => {
  try {
    const { Product: productList, OrderDetails } = req.body;

    if (!productList || !Array.isArray(productList) || productList.length === 0) {
      return res.status(400).json({ error: "Invalid product data" });
    }

    // 1. Prepare Stripe Line Items
    const lineItems = productList.map((product) => {
      // Validate required fields
      if (!product.name || product.price === undefined || !product.quantity) {
        throw new Error("Missing required product fields");
      }

      // Ensure price is a number
      const price =
        typeof product.price === "string"
          ? parseFloat(product.price)
          : product.price;

      // Validate price
      if (isNaN(price) || price < 0) {
        throw new Error("Invalid product price");
      }

      return {
        price_data: {
          currency: "aud",
          product_data: {
            name: product.name,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: parseInt(product.quantity) || 1,
      };
    });

    // 2. Prepare Metadata for Webhook via TempOrder (Database Strategy)
    const metadata = {};

    if (OrderDetails) {
      // Save full details in TempOrder with 1h expiry
      const tempOrder = await TempOrder.create({
        data: OrderDetails
      });

      console.log(`Temp Order Created: ${tempOrder._id}`);
      metadata.tempOrderId = tempOrder._id.toString();
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`, // Removed order_id
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: metadata,
    });

    res.json({
      id: session.id,
      url: session.url,
      orderId: null // No order ID yet
    });
  } catch (error) {
    console.error("Payment error:", error);
    res
      .status(500)
      .json({ error: error.message || "Payment processing failed" });
  }
};

const getSessionStatus = async (req, res) => {
  const { session_id } = req.query;

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    res.json({
      status: session.payment_status,
      transactionId: session.payment_intent?.id || null,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    const order = await Order.findById(orderId).select("payment");
    if (!order) return res.status(404).json({ error: "Order not found" });

    const status = order.payment && order.payment[0] ? order.payment[0].status : "pending";
    res.json({ status });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const checkPaymentStatusBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ error: "Session ID is required" });

    // Find order by stripeSessionId (Robust method)
    const order = await Order.findOne({ stripeSessionId: sessionId }).select("payment");

    if (!order) return res.status(404).json({ error: "Order not found" });

    const status = order.payment && order.payment[0] ? order.payment[0].status : "pending";
    res.json({ status, orderId: order._id });
  } catch (error) {
    console.error("Error checking session status:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { payment, getSessionStatus, checkPaymentStatus, checkPaymentStatusBySession };
