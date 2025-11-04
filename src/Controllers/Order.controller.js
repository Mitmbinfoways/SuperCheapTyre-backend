const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const PDFDocument = require("pdfkit");
const Product = require("../Models/Product.model");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");
const ApiResponse = require("../Utils/ApiResponse");
const ApiError = require("../Utils/ApiError");
const sendMail = require("../Utils/Nodemailer");
const dayjs = require("dayjs");

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
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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
                        ? `<tr><td style="color:#666;font-size:14px;width:40%;"><strong>Date:</strong></td><td>${formatDate(
                            appointment.date
                          )}</td></tr>`
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

    // if (typeof subtotal !== "number" || typeof total !== "number") {
    //   return res
    //     .status(400)
    //     .json(new ApiError(400, "Subtotal and total must be numbers"));
    // }

    // if (total < subtotal) {
    //   return res
    //     .status(400)
    //     .json(new ApiError(400, "Total cannot be less than subtotal"));
    // }

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

    const customerData = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
    };

    const validPaymentMethods = ["card", "cash", "online"];
    const validPaymentStatuses = ["partial", "full", "failed"];
    const paymentData = {
      amount: typeof payment?.amount === "number" ? payment.amount : 0,
      method:
        payment?.method && validPaymentMethods.includes(payment.method)
          ? payment.method
          : "",
      status:
        payment?.status && validPaymentStatuses.includes(payment.status)
          ? payment.status
          : "partial",
      currency: payment?.currency || "AU$",
    };

    const productIds = items.map((item) => item.id);
    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    if (products.length !== items.length) {
      return res
        .status(400)
        .json(new ApiError(400, "One or more products not found or inactive"));
    }

    for (const item of items) {
      const product = products.find((p) => p._id.toString() === item.id);

      if (product.stock < item.quantity) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              `Insufficient stock for product: ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`
            )
          );
      }
    }

    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.id,
        { $inc: { stock: -item.quantity } },
        { runValidators: true }
      );
    }

    const updatedProducts = await Product.find({
      _id: { $in: productIds },
    }).lean();

    const enrichedItems = items.map((item) => {
      const product = updatedProducts.find((p) => p._id.toString() === item.id);
      return {
        id: item.id,
        quantity: item.quantity,
        name: product.name,
        brand: product.brand || "",
        category: product.category || "",
        price: product.price,
        image:
          product.images && product.images.length > 0 ? product.images[0] : "",
        sku: product.sku || "",
      };
    });

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
    // try {
    //   const emailHTML = generateOrderConfirmationEmail(order);
    //   await sendMail(
    //     appointment.email,
    //     "Order Confirmation - Your Appointment is Confirmed!",
    //     emailHTML
    //   );
    //   console.log(`Confirmation email sent to ${appointment.email}`);
    // } catch (emailError) {
    //   console.error("Failed to send confirmation email:", emailError);
    // }

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

    const doc = new PDFDocument({
      margin: 0,
      size: "A4",
      bufferPages: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${orderId}.pdf`
    );

    doc.pipe(res);

    // Professional color palette
    const brandColor = "#0f172a"; // Dark slate
    const accentColor = "#3b82f6"; // Professional blue
    const successColor = "#10b981"; // Success green
    const warningColor = "#f59e0b"; // Warning orange
    const dangerColor = "#ef4444"; // Error red
    const textPrimary = "#1e293b"; // Dark text
    const textSecondary = "#64748b"; // Medium text
    const borderColor = "#e2e8f0"; // Subtle border
    const bgLight = "#f8fafc"; // Light background

    // ==================== HEADER SECTION ====================
    // Modern gradient header
    doc.rect(0, 0, doc.page.width, 180).fill(brandColor);

    // Subtle geometric accent
    doc.opacity(0.4);
    doc.circle(500, 40, 70).fill("#1e293b");
    doc.circle(515, 100, 55).fill("#334155");
    doc.opacity(1);

    // Company logo area
    doc.roundedRect(50, 35, 65, 65, 10).fill("#ffffff");
    doc
      .fontSize(28)
      .fillColor(accentColor)
      .font("Helvetica-Bold")
      .text("YB", 50, 53, { width: 65, align: "center" });
    doc
      .fontSize(7)
      .fillColor(textSecondary)
      .font("Helvetica")
      .text("YOUR BRAND", 50, 105, { width: 65, align: "center" });

    // Company information - left aligned
    doc.fontSize(12).fillColor("#ffffff").font("Helvetica-Bold");
    doc.text("Super Cheap Tyres", 135, 45);

    doc.fontSize(8.5).fillColor("#cbd5e1").font("Helvetica");
    doc.text("123 Business Street, Suite 100", 135, 66);
    doc.text("City, State 12345", 135, 80);
    doc.text("Phone: (555) 123-4567", 135, 94);
    doc.text("Email: info@yourcompany.com", 135, 108);

    // Invoice title - right aligned
    doc
      .fontSize(38)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text("INVOICE", 320, 42, { align: "right", width: 230 });

    // Invoice details - right aligned
    doc.fontSize(9.5).fillColor("#cbd5e1").font("Helvetica");
    doc.text(
      `Invoice #: INV-${order._id.toString().slice(-8).toUpperCase()}`,
      320,
      88,
      {
        align: "right",
        width: 230,
      }
    );

    const formattedDate = new Date(order.createdAt).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
    doc.text(`Date: ${formattedDate}`, 320, 103, {
      align: "right",
      width: 230,
    });

    // Payment status badge
    const statusColor =
      order.payment?.status === "completed"
        ? successColor
        : order.payment?.status === "pending"
        ? warningColor
        : dangerColor;
    const statusText = order.payment?.status?.toUpperCase() || "PENDING";

    doc.roundedRect(428, 130, 122, 30, 15).fill(statusColor);
    doc
      .fontSize(11)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text(statusText, 428, 140, { align: "center", width: 122 });

    // ==================== CUSTOMER DETAILS SECTION ====================
    let yPos = 220;

    // Bill To card
    doc.opacity(0.03);
    doc.roundedRect(50, yPos, 245, 130, 10).fill(accentColor);
    doc.opacity(1);
    doc.roundedRect(50, yPos, 245, 130, 10).lineWidth(1.5).stroke(borderColor);

    doc
      .fontSize(10)
      .fillColor(textSecondary)
      .font("Helvetica-Bold")
      .text("BILL TO", 70, yPos + 18);

    doc
      .fontSize(14)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(order.customer.name, 70, yPos + 42);

    doc.fontSize(9.5).fillColor(textSecondary).font("Helvetica");
    doc.text(order.customer.phone, 70, yPos + 66);
    doc.text(order.customer.email || "N/A", 70, yPos + 84);

    // Appointment Details card
    doc.opacity(0.03);
    doc.roundedRect(305, yPos, 245, 130, 10).fill(accentColor);
    doc.opacity(1);
    doc.roundedRect(305, yPos, 245, 130, 10).lineWidth(1.5).stroke(borderColor);

    doc
      .fontSize(10)
      .fillColor(textSecondary)
      .font("Helvetica-Bold")
      .text("APPOINTMENT DETAILS", 325, yPos + 18);

    doc
      .fontSize(14)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(
        `${order.appointment.firstName} ${order.appointment.lastName}`,
        325,
        yPos + 42
      );

    doc.fontSize(9.5).fillColor(textSecondary).font("Helvetica");
    doc.text(order.appointment.phone, 325, yPos + 66);
    doc.text(order.appointment.email, 325, yPos + 84);

    // Appointment date/time with icon
    doc.circle(330, yPos + 106, 3).fill(accentColor);
    
    // Format the appointment date properly
    const formattedAppointmentDate = order.appointment.date 
      ? new Date(order.appointment.date).toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric"
        })
      : "N/A";
      
    doc
      .fontSize(9.5)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(
        `${formattedAppointmentDate} • ${order.appointment.time}`,
        341,
        yPos + 102
      );

    // ==================== ITEMS TABLE ====================
    yPos = 390;

    doc
      .fontSize(15)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("Items & Description", 50, yPos);

    yPos += 32;

    // Table header
    doc.rect(50, yPos, 500, 32).fill(brandColor);
    doc.rect(50, yPos, 500, 3).fill(accentColor);

    doc.fontSize(9).fillColor("#ffffff").font("Helvetica-Bold");
    doc.text("ITEM DESCRIPTION", 70, yPos + 13);
    doc.text("QTY", 330, yPos + 13, { width: 35, align: "center" });
    doc.text("UNIT PRICE", 385, yPos + 13, { width: 70, align: "right" });
    doc.text("AMOUNT", 470, yPos + 13, { width: 65, align: "right" });

    yPos += 32;

    // Table rows
    let rowIndex = 0;
    order.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku;
      const rowHeight = hasDetails ? 52 : 38;

      // Alternating row colors
      if (rowIndex % 2 === 1) {
        doc.rect(50, yPos, 500, rowHeight).fill(bgLight);
      }

      // Item name
      doc
        .fontSize(10.5)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(item.name, 70, yPos + 11, { width: 235, lineBreak: false });

      // Brand and SKU
      if (hasDetails) {
        doc.fontSize(8).fillColor(textSecondary).font("Helvetica");
        const details = [];
        if (item.brand) details.push(item.brand);
        if (item.sku) details.push(`SKU: ${item.sku}`);
        doc.text(details.join(" • "), 70, yPos + 29, { width: 235 });
      }

      // Quantity
      doc
        .fontSize(10.5)
        .fillColor(textPrimary)
        .font("Helvetica")
        .text(item.quantity.toString(), 330, yPos + 11, {
          width: 35,
          align: "center",
        });

      // Unit price
      doc.text(`$${item.price.toFixed(2)}`, 385, yPos + 11, {
        width: 70,
        align: "right",
      });

      // Total amount
      doc
        .font("Helvetica-Bold")
        .text(`$${itemTotal.toFixed(2)}`, 470, yPos + 11, {
          width: 65,
          align: "right",
        });

      // Row border
      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPos + rowHeight)
        .lineTo(550, yPos + rowHeight)
        .stroke();

      yPos += rowHeight;
      rowIndex++;

      // New page if needed
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
        rowIndex = 0;
      }
    });

    // ==================== SUMMARY SECTION ====================
    yPos += 28;

    const summaryBoxX = 325;
    const summaryBoxY = yPos;

    // Shadow effect
    doc.opacity(0.08);
    doc
      .roundedRect(summaryBoxX + 3, summaryBoxY + 3, 225, 115, 10)
      .fill("#000000");
    doc.opacity(1);

    // Summary box
    doc
      .roundedRect(summaryBoxX, summaryBoxY, 225, 115, 10)
      .lineWidth(1.5)
      .strokeColor(borderColor)
      .fillColor("#ffffff")
      .fillAndStroke();

    // Subtotal
    yPos += 22;
    doc
      .fontSize(10.5)
      .fillColor(textSecondary)
      .font("Helvetica")
      .text("Subtotal:", summaryBoxX + 22, yPos);
    doc
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(`$${order.subtotal.toFixed(2)}`, summaryBoxX + 22, yPos, {
        width: 181,
        align: "right",
      });

    // Tax
    if (order.tax) {
      yPos += 24;
      doc
        .fontSize(10.5)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Tax:", summaryBoxX + 22, yPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${order.tax.toFixed(2)}`, summaryBoxX + 22, yPos, {
          width: 181,
          align: "right",
        });
    }

    // Divider line
    yPos += 26;
    doc
      .strokeColor(borderColor)
      .lineWidth(1.5)
      .moveTo(summaryBoxX + 22, yPos)
      .lineTo(summaryBoxX + 203, yPos)
      .stroke();

    // Total amount
    yPos += 16;
    doc.opacity(0.08);
    doc.roundedRect(summaryBoxX + 17, yPos - 9, 191, 34, 8).fill(accentColor);
    doc.opacity(1);
    doc
      .roundedRect(summaryBoxX + 17, yPos - 9, 191, 34, 8)
      .lineWidth(1.5)
      .strokeColor(accentColor)
      .stroke();

    doc
      .fontSize(13)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("TOTAL:", summaryBoxX + 27, yPos + 1);
    doc
      .fontSize(17)
      .fillColor(accentColor)
      .text(`$${order.total.toFixed(2)}`, summaryBoxX + 27, yPos, {
        width: 171,
        align: "right",
      });

    // ==================== PAYMENT INFORMATION ====================
    if (order.payment) {
      yPos += 58;

      doc
        .fontSize(13)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text("Payment Information", 50, yPos);

      yPos += 26;

      // Payment box
      doc
        .roundedRect(50, yPos, 290, 75, 10)
        .lineWidth(1.5)
        .strokeColor(borderColor)
        .fillColor(bgLight)
        .fillAndStroke();

      doc
        .fontSize(9.5)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Method:", 72, yPos + 20);
      doc
        .fontSize(10.5)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(order.payment.method || "N/A", 190, yPos + 20);

      doc
        .fontSize(9.5)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Status:", 72, yPos + 42);

      const paymentStatusColor =
        order.payment.status === "completed"
          ? successColor
          : order.payment.status === "pending"
          ? warningColor
          : dangerColor;
      doc
        .fontSize(10.5)
        .fillColor(paymentStatusColor)
        .font("Helvetica-Bold")
        .text(order.payment.status.toUpperCase(), 190, yPos + 42);

      if (order.payment.transactionId) {
        doc
          .fontSize(8.5)
          .fillColor(textSecondary)
          .font("Helvetica")
          .text(
            `Transaction ID: ${order.payment.transactionId}`,
            72,
            yPos + 58
          );
      }
    }

    // ==================== FOOTER ====================
    const footerY = doc.page.height - 95;

    // Footer divider
    doc
      .strokeColor(borderColor)
      .lineWidth(1.5)
      .moveTo(50, footerY)
      .lineTo(550, footerY)
      .stroke();

    // Thank you message
    doc
      .fontSize(12)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("Thank you for your business!", 50, footerY + 22, {
        align: "center",
        width: 500,
      });

    doc
      .fontSize(9)
      .fillColor(textSecondary)
      .font("Helvetica")
      .text(
        "If you have any questions about this invoice, please contact us",
        50,
        footerY + 42,
        {
          align: "center",
          width: 500,
        }
      );

    doc
      .fontSize(8.5)
      .fillColor(textSecondary)
      .text(
        "info@yourcompany.com • (555) 123-4567 • www.yourcompany.com",
        50,
        footerY + 60,
        {
          align: "center",
          width: 500,
        }
      );

    // Page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor(textSecondary)
        .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 48, {
          align: "center",
          width: 500,
        });
    }

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
