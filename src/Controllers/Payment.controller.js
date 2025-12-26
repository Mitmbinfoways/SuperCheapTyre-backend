const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const Appointment = require("../Models/Appointment.model");
const Product = require("../Models/Product.model");
const Service = require("../Models/Service.model");
const Tax = require("../Models/Tax.model");
const TimeSlot = require("../Models/TimeSlot.model");

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

    let orderId = null;

    // 2. Create Pending Order if Details provided
    if (OrderDetails) {
      const { appointment, customer, items, serviceItems, paymentOption, charges } = OrderDetails;

      // Create Appointment
      const appointmentDoc = await Appointment.create({
        firstname: appointment.firstName,
        lastname: appointment.lastName,
        phone: appointment.phone,
        email: appointment.email,
        date: appointment.date, // YYYY-MM-DD
        slotId: appointment.slotId, // The time slot ID e.g. "09:00"
        timeSlotId: appointment.timeSlotId, // The DB ID of the timeslot document
        time: appointment.time,
        notes: appointment.remarks,
        status: "pending", // Initially pending until payment confirmed
      });

      // Fetch TimeSlot info
      let slotInfo = null;
      if (appointment.slotId) {
        // Try to find the timeslot to get start/end time
        // Implementation similar to Order.controller.js
        const timeSlotDoc = await TimeSlot.findOne({
          "generatedSlots.slotId": appointment.slotId,
        }).lean();
        if (timeSlotDoc) {
          const matchedSlot = timeSlotDoc.generatedSlots.find(s => s.slotId === appointment.slotId);
          if (matchedSlot) slotInfo = { startTime: matchedSlot.startTime, endTime: matchedSlot.endTime };
        }
      }

      // Calculate totals
      let subtotal = 0;
      const enrichedItems = [];
      const enrichedServiceItems = [];

      // Process Items
      for (const item of items || []) {
        const product = await Product.findById(item.id).lean();
        if (product) {
          subtotal += (product.price * item.quantity);
          enrichedItems.push({
            id: item.id,
            quantity: item.quantity,
            name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.price,
            image: product.images?.[0] || "",
            sku: product.sku || ""
          });
          // Decrement stock? Maybe wait for webhook. But let's decrement to be safe vs overselling.
          await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
        }
      }

      // Process Services
      for (const item of serviceItems || []) {
        const service = await Service.findById(item.id).lean();
        if (service) {
          subtotal += (service.price * item.quantity);
          enrichedServiceItems.push({
            id: item.id,
            quantity: item.quantity,
            name: service.name,
            description: service.description,
            price: service.price,
            image: service.images?.[0] || ""
          });
        }
      }

      const taxDoc = await Tax.findOne().lean();
      const taxPercentage = taxDoc?.percentage ?? 10;
      const taxAmount = subtotal * (taxPercentage / 100);

      // Total calculation logic
      // The amount user pays via Stripe (totalAmount) includes partial logic.
      // But 'total' field in Order usually means the Full Value of the order.
      // 'payment' field tracks how much was paid.
      // OrderDetails.totalAmount passed from frontend is the amount being paid NOW.

      const totalOrderValue = subtotal + (charges || 0);
      // Note: `charges` (transaction fee) is usually added to the amount user pays.

      const paymentAmount = OrderDetails.paymentAmount; // Amount being paid in this session

      const orderDoc = await Order.create({
        items: enrichedItems,
        serviceItems: enrichedServiceItems,
        subtotal: subtotal,
        total: totalOrderValue, // Total value of goods
        charges: charges || 0,
        taxName: taxDoc?.name || "GST",
        tax: taxPercentage,
        taxAmount: taxAmount,
        appointment: {
          id: appointmentDoc._id,
          firstName: appointmentDoc.firstname,
          lastName: appointmentDoc.lastname,
          phone: appointmentDoc.phone,
          email: appointmentDoc.email,
          date: appointmentDoc.date,
          slotId: appointmentDoc.slotId,
          time: slotInfo ? `${slotInfo.startTime}-${slotInfo.endTime}` : appointmentDoc.time,
          timeSlotId: appointmentDoc.timeSlotId
        },
        customer: {
          name: `${appointment.firstName} ${appointment.lastName}`,
          phone: appointment.phone,
          email: appointment.email
        },
        payment: [{
          method: "stripe",
          status: "pending", // Pending confirmation
          amount: paymentAmount,
          currency: "AU$"
        }]
      });

      orderId = orderDoc._id;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId || ''}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: orderId ? {
        orderId: orderId.toString(),
        paymentType: OrderDetails?.paymentOption || 'full'
      } : {},
      client_reference_id: orderId ? orderId.toString() : undefined,
    });

    const sessions = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["payment_intent"],
    });

    res.json({
      id: session.id,
      url: session.url,
      transactionId: sessions.payment_intent?.id || null,
      status: sessions.payment_status,
      amount_total: sessions.amount_total,
      currency: sessions.currency,
      orderId: orderId,
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

module.exports = { payment, getSessionStatus, checkPaymentStatus };
