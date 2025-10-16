const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const Product = require("../Models/Product.model");
const Appointment = require("../Models/Appointment.model");
const TimeSlot= require("../Models/TimeSlot.model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const sendMail = require("../Utils/Nodemailer");

const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { "customer.name": searchRegex },
        { "customer.phone": searchRegex },
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const productIds = [
      ...new Set(orders.flatMap((order) => order.items.map((i) => i.id))),
    ];

    const products = await Product.find({ _id: { $in: productIds } })
      .select("name price images sku")
      .lean();

    const enrichedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        productDetails:
          products.find((p) => p._id.toString() === item.id.toString()) || null,
      })),
    }));

    const totalItems = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const pagination = {
      totalItems,
      totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { orders: enrichedOrders, pagination },
          "Orders fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json(new ApiError(500, "Internal Server Error"));
  }
};

const generateOrderConfirmationEmail = (order, productsData = []) => {
  if (!order) return "";
  const {
    items = [],
    subtotal = 0,
    total = 0,
    appointment = {},
    customer = {},
    payment = {},
  } = order;

  const itemsHTML = items
    .map((item) => {
      const product =
        productsData.find((p) => p._id?.toString() === item.id?.toString()) ||
        item;

      const price = Number(product.price) || 0;
      const quantity = Number(item.quantity) || 0;

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
            <div style="display: inline-block; vertical-align: middle;">
              <strong>${product.name || "Unnamed Product"}</strong><br>
              <span style="color: #666; font-size: 12px;">
                ${product.brand || "Unknown Brand"} | ${product.sku || "N/A"}
              </span><br>
              <span style="color: #4CAF50; font-weight: bold;">$${price.toFixed(
                2
              )}</span>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">
            ${quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">
            $${(price * quantity).toFixed(2)}
          </td>
        </tr>
      `;
    })
    .join("");

  const formattedSubtotal = Number(subtotal).toFixed(2);
  const formattedTotal = Number(total).toFixed(2);

  // Format date properly
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Order Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background-color: #4CAF50; padding: 30px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Order Confirmed!</h1>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 30px;">
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px;">
                    Hi <strong>${
                      appointment.firstName || customer.name || "Customer"
                    } ${appointment.lastName || ""}</strong>,
                  </p>
                  <p style="font-size: 16px; color: #333333; margin: 0;">
                    Thank you for your order! We've received it and are preparing for your appointment.
                  </p>
                </td>
              </tr>

              <!-- Appointment Details -->
              ${
                appointment?.date || appointment?.time
                  ? `
              <tr>
                <td style="padding: 0 30px 30px;">
                  <h2 style="color: #333333; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                    Appointment Details
                  </h2>
                  <table width="100%" cellpadding="8" cellspacing="0">
                    ${
                      appointment.date
                        ? `<tr><td style="color:#666;font-size:14px;width:40%;"><strong>Date:</strong></td><td>${formatDate(appointment.date)}</td></tr>`
                        : ""
                    }
                    ${
                      appointment.time
                        ? `<tr><td style="color:#666;font-size:14px;"><strong>Time:</strong></td><td>${appointment.time}</td></tr>`
                        : ""
                    }
                    ${
                      appointment.phone
                        ? `<tr><td style="color:#666;font-size:14px;"><strong>Phone:</strong></td><td>+${appointment.phone}</td></tr>`
                        : ""
                    }
                  </table>
                </td>
              </tr>`
                  : ""
              }

              <!-- Order Items -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <h2 style="color: #333333; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                    Order Items
                  </h2>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 4px;">
                    <thead>
                      <tr style="background-color: #f9f9f9;">
                        <th style="padding: 12px; text-align: left; color: #666; font-size: 14px;">Item</th>
                        <th style="padding: 12px; text-align: center; color: #666; font-size: 14px;">Qty</th>
                        <th style="padding: 12px; text-align: right; color: #666; font-size: 14px;">Price</th>
                      </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                  </table>
                </td>
              </tr>

              <!-- Order Summary -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #e0e0e0; border-radius: 4px; background-color: #f9f9f9;">
                    <tr>
                      <td style="text-align: right; color: #666;"><strong>Subtotal:</strong></td>
                      <td style="text-align: right; color: #333;">$${formattedSubtotal}</td>
                    </tr>
                    <tr>
                      <td style="text-align: right; color: #666; border-top: 2px solid #4CAF50; padding-top: 10px;">
                        <strong>Total:</strong>
                      </td>
                      <td style="text-align: right; color: #4CAF50; font-size: 18px; font-weight: bold; border-top: 2px solid #4CAF50; padding-top: 10px;">
                        $${formattedTotal}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Payment Info -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <div style="
                    background-color: ${
                      payment.status === "completed" ? "#e8f5e9" : "#fff3e0"
                    };
                    padding: 15px;
                    border-radius: 4px;
                    border-left: 4px solid ${
                      payment.status === "completed" ? "#4CAF50" : "#FF9800"
                    };
                  ">
                    <p style="margin: 0; color: #333; font-size: 14px;">
                      <strong>Payment Status:</strong> ${
                        payment.status || "pending"
                      } 
                      ${payment.method ? ` • Method: ${payment.method}` : ""}
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0; color: #666; font-size: 14px;">If you have any questions, please contact us.</p>
                  <p style="margin: 0; color: #999; font-size: 12px;">This is an automated email. Please do not reply.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const createOrder = async (req, res) => {
  try {
    const { items, subtotal, total, appointmentId, customer, payment } =
      req.body;

    if (!items || !Array.isArray(items) || !items.length) {
      return res
        .status(400)
        .json(new ApiError(400, "Order items are required"));
    }

    for (const item of items) {
      if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res
          .status(400)
          .json(
            new ApiError(400, "Each item must have a valid id and quantity")
          );
      }
    }

    if (typeof subtotal !== "number" || typeof total !== "number") {
      return res
        .status(400)
        .json(new ApiError(400, "Subtotal and total must be numbers"));
    }

    if (total < subtotal) {
      return res
        .status(400)
        .json(new ApiError(400, "Total cannot be less than subtotal"));
    }

    // Validate appointmentId
    if (!appointmentId || !mongoose.isValidObjectId(appointmentId)) {
      return res
        .status(400)
        .json(new ApiError(400, "Valid appointmentId is required"));
    }

    // Fetch appointment
    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) {
      return res.status(404).json(new ApiError(404, "Appointment not found"));
    }

    console.log(appointment)

    // Fetch time slot information if slotId exists
    let slotInfo = null;
    if (appointment.slotId) {
      const timeSlotDoc = await TimeSlot.findOne({
        "generatedSlots.slotId": appointment.slotId,
      }).lean();

      if (timeSlotDoc) {
        const matchedSlot = timeSlotDoc.generatedSlots.find(
          (s) => s.slotId === appointment.slotId
        );
        if (matchedSlot) {
          slotInfo = {
            startTime: matchedSlot.startTime,
            endTime: matchedSlot.endTime,
            isBreak: matchedSlot.isBreak,
          };
        }
      }
    }

    if (!customer || !customer.name || !customer.phone) {
      return res
        .status(400)
        .json(new ApiError(400, "Customer name and phone are required"));
    }

    // Normalize customer email
    const customerData = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "", // Align with schema default
    };

    // Validate and normalize payment data
    const validPaymentMethods = ["card", "cash", "online"];
    const validPaymentStatuses = ["pending", "completed", "failed"];
    const paymentData = {
      amount: typeof payment?.amount === "number" ? payment.amount : 0,
      method:
        payment?.method && validPaymentMethods.includes(payment.method)
          ? payment.method
          : "",
      status:
        payment?.status && validPaymentStatuses.includes(payment.status)
          ? payment.status
          : "pending",
      currency: payment?.currency || "AU$",
    };

    const productIds = items.map((item) => item.id);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true,
      isDelete: false,
    }).lean();

    if (products.length !== items.length) {
      return res
        .status(400)
        .json(new ApiError(400, "One or more products not found or inactive"));
    }

    const enrichedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.id);
      return {
        id: item.id,
        quantity: item.quantity,
        name: product.name,
        brand: product.brand || "", // Ensure schema alignment
        category: product.category || "", // Ensure schema alignment
        price: product.price,
        image:
          product.images && product.images.length > 0 ? product.images[0] : "",
        sku: product.sku || "", // Ensure schema alignment
      };
    });

    // Create order
    const order = await Order.create({
      items: enrichedItems,
      subtotal,
      total,
      appointment: {
        id: appointment._id,
        firstName: appointment.firstname, // Align with Appointment schema
        lastName: appointment.lastname, // Align with Appointment schema
        phone: appointment.phone,
        email: appointment.email,
        date: appointment.date,
        slotId: appointment.slotId,
        time: slotInfo ? `${slotInfo.startTime}-${slotInfo.endTime}` : "", // Convert to string for schema
        timeSlotId: appointment.timeSlotId || "", // Ensure schema alignment
      },
      customer: customerData,
      payment: paymentData,
    });

    // Send confirmation email
    try {
      const emailHTML = generateOrderConfirmationEmail(order);
      await sendMail(
        appointment.email,
        "Order Confirmation - Your Appointment is Confirmed!",
        emailHTML
      );
      console.log(`Confirmation email sent to ${appointment.email}`);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    return res
      .status(201)
      .json(new ApiResponse(201, order, "Order created successfully"));
  } catch (error) {
    console.error("Error creating order:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to create order"));
  }
};

const DownloadPDF = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=order-${orderId}.pdf`
    );

    doc.pipe(res);

    // Add content to PDF
    // Header
    doc.fontSize(20).text("Order Invoice", { align: "center" });
    doc.moveDown();

    // Order Details
    doc.fontSize(12).text(`Order ID: ${order._id}`, { continued: false });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.moveDown();

    // Customer Information
    doc.fontSize(14).text("Customer Information", { underline: true });
    doc.fontSize(10);
    doc.text(`Name: ${order.customer.name}`);
    doc.text(`Phone: ${order.customer.phone}`);
    doc.text(`Email: ${order.customer.email || "N/A"}`);
    doc.moveDown();

    // Appointment Information
    doc.fontSize(14).text("Appointment Details", { underline: true });
    doc.fontSize(10);
    doc.text(
      `Name: ${order.appointment.firstName} ${order.appointment.lastName}`
    );
    doc.text(`Phone: ${order.appointment.phone}`);
    doc.text(`Email: ${order.appointment.email}`);
    doc.text(`Date: ${order.appointment.date}`);
    doc.text(`Time: ${order.appointment.time}`);
    doc.moveDown();

    // Order Items Table Header
    doc.fontSize(14).text("Order Items", { underline: true });
    doc.moveDown(0.5);

    // Table headers
    const tableTop = doc.y;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Item", 50, tableTop, { width: 150 });
    doc.text("Qty", 220, tableTop, { width: 50 });
    doc.text("Price", 280, tableTop, { width: 80, align: "right" });
    doc.text("Total", 380, tableTop, { width: 80, align: "right" });

    doc
      .moveTo(50, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();
    doc.moveDown();

    // Table rows
    doc.font("Helvetica");
    let yPosition = tableTop + 25;

    order.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;

      doc.text(item.name, 50, yPosition, { width: 150 });
      doc.text(item.quantity.toString(), 220, yPosition, { width: 50 });
      doc.text(`$${item.price.toFixed(2)}`, 280, yPosition, {
        width: 80,
        align: "right",
      });
      doc.text(`$${itemTotal.toFixed(2)}`, 380, yPosition, {
        width: 80,
        align: "right",
      });

      if (item.brand || item.sku) {
        yPosition += 12;
        doc.fontSize(8).fillColor("#666");
        doc.text(
          `${item.brand || ""} ${item.sku ? "| SKU: " + item.sku : ""}`,
          50,
          yPosition,
          { width: 150 }
        );
        doc.fontSize(10).fillColor("#000");
      }

      yPosition += 20;

      // Add new page if needed
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
    });

    // Summary
    doc.moveDown();
    yPosition = doc.y + 10;
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

    yPosition += 15;
    doc.fontSize(10);
    doc.text("Subtotal:", 380, yPosition, { width: 100 });
    doc.text(`$${order.subtotal.toFixed(2)}`, 480, yPosition, {
      width: 70,
      align: "right",
    });

    yPosition += 20;
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text("Total:", 380, yPosition, { width: 100 });
    doc.text(`$${order.total.toFixed(2)}`, 480, yPosition, {
      width: 70,
      align: "right",
    });

    // Payment Information
    if (order.payment) {
      yPosition += 30;
      doc
        .fontSize(14)
        .text("Payment Information", 50, yPosition, { underline: true });
      yPosition += 20;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Method: ${order.payment.method || "N/A"}`, 50, yPosition);
      yPosition += 15;
      doc.text(`Status: ${order.payment.status}`, 50, yPosition);
      if (order.payment.transactionId) {
        yPosition += 15;
        doc.text(
          `Transaction ID: ${order.payment.transactionId}`,
          50,
          yPosition
        );
      }
    }
    doc.fontSize(8).fillColor("#666");
    doc.text("Thank you for your order!", 50, doc.page.height - 50, {
      align: "center",
    });
    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json(new ApiError(500, error.message, "Error generating PDF"));
    }
  }
};

module.exports = { createOrder, getAllOrders, DownloadPDF };
