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

    // Color palette
    const brandColor = "#0f172a"; // Dark blue-gray
    const accentColor = "#3b82f6"; // Bright blue
    const successColor = "#10b981"; // Green
    const warningColor = "#f59e0b"; // Orange
    const dangerColor = "#ef4444"; // Red
    const textPrimary = "#1e293b"; // Dark gray
    const textSecondary = "#64748b"; // Medium gray
    const borderColor = "#e2e8f0"; // Light gray
    const bgLight = "#f8fafc"; // Very light gray

    // ==================== HEADER SECTION ====================
    // Gradient header background
    doc.rect(0, 0, doc.page.width, 200).fill(brandColor);

    // Add decorative shapes
    doc.opacity(0.5);
    doc.circle(500, 50, 80).fill("#1e293b");
    doc.circle(520, 120, 60).fill("#334155");
    doc.opacity(1);

    // Logo placeholder
    doc.roundedRect(50, 40, 60, 60, 8).fill("#ffffff");
    doc
      .fontSize(24)
      .fillColor(accentColor)
      .font("Helvetica-Bold")
      .text("YB", 58, 60, { width: 44, align: "center" });
    doc
      .fontSize(8)
      .fillColor(textSecondary)
      .text("YOUR BRAND", 50, 105, { width: 60, align: "center" });

    // Company info
    doc.fontSize(10).fillColor("#ffffff").font("Helvetica");
    doc.text("Super Cheap Tyres", 130, 50);
    doc.fontSize(8).fillColor("#cbd5e1");
    doc.text("123 Business Street, Suite 100", 130, 68);
    doc.text("City, State 12345", 130, 82);
    doc.text("Phone: (555) 123-4567", 130, 96);
    doc.text("Email: info@yourcompany.com", 130, 110);

    // Invoice title and info (right aligned)
    doc
      .fontSize(32)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text("INVOICE", 350, 50, { align: "right", width: 200 });

    doc.fontSize(10).fillColor("#cbd5e1").font("Helvetica");
    doc.text(
      `Invoice #: INV-${order._id.toString().slice(-8).toUpperCase()}`,
      350,
      95,
      {
        align: "right",
        width: 200,
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
    doc.text(`Date: ${formattedDate}`, 350, 110, {
      align: "right",
      width: 200,
    });

    // Status badge
    const statusColor =
      order.payment?.status === "completed"
        ? successColor
        : order.payment?.status === "pending"
        ? warningColor
        : dangerColor;
    const statusText = order.payment?.status?.toUpperCase() || "PENDING";

    doc.roundedRect(445, 135, 105, 25, 12).fill(statusColor);
    doc
      .fontSize(10)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text(statusText, 445, 143, { align: "center", width: 105 });

    // ==================== BILL TO / SHIP TO SECTION ====================
    let yPos = 240;

    // Bill To section
    doc.fillOpacity(0.02);
    doc.roundedRect(50, yPos, 240, 140, 8).fill(accentColor);
    doc.fillOpacity(1);
    doc.roundedRect(50, yPos, 240, 140, 8).lineWidth(1.5).stroke(borderColor);

    doc
      .fontSize(11)
      .fillColor(textSecondary)
      .font("Helvetica-Bold")
      .text("BILL TO", 65, yPos + 20);

    doc
      .fontSize(13)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(order.customer.name, 65, yPos + 45);

    doc.fontSize(9).fillColor(textSecondary).font("Helvetica");
    doc.text(order.customer.phone, 65, yPos + 68);
    doc.text(order.customer.email || "N/A", 65, yPos + 85);

    // Ship To / Appointment section
    doc.fillOpacity(0.02);
    doc.roundedRect(310, yPos, 240, 140, 8).fill(accentColor);
    doc.fillOpacity(1);
    doc.roundedRect(310, yPos, 240, 140, 8).lineWidth(1.5).stroke(borderColor);

    doc
      .fontSize(11)
      .fillColor(textSecondary)
      .font("Helvetica-Bold")
      .text("APPOINTMENT DETAILS", 325, yPos + 20);

    doc
      .fontSize(13)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(
        `${order.appointment.firstName} ${order.appointment.lastName}`,
        325,
        yPos + 45
      );

    doc.fontSize(9).fillColor(textSecondary).font("Helvetica");
    doc.text(order.appointment.phone, 325, yPos + 68);
    doc.text(order.appointment.email, 325, yPos + 85);

    // Appointment date/time with icon
    doc.circle(330, 110 + yPos, 3).fill(accentColor);
    doc
      .fontSize(9)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(
        `${order.appointment.date} • ${order.appointment.time}`,
        340,
        yPos + 105
      );

    // ==================== ITEMS TABLE ====================
    yPos = 420;

    doc
      .fontSize(14)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("Items & Description", 50, yPos);

    yPos += 35;

    // Table header with gradient effect
    doc.rect(50, yPos, 500, 30).fill(brandColor);

    // Subtle highlight line
    doc.rect(50, yPos, 500, 3).fill(accentColor);

    doc.fontSize(9).fillColor("#ffffff").font("Helvetica-Bold");
    doc.text("ITEM DESCRIPTION", 65, yPos + 11);
    doc.text("QTY", 320, yPos + 11, { width: 40, align: "center" });
    doc.text("UNIT PRICE", 380, yPos + 11, { width: 70, align: "right" });
    doc.text("AMOUNT", 470, yPos + 11, { width: 65, align: "right" });

    yPos += 30;

    // Table rows
    let rowIndex = 0;
    order.items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku;
      const rowHeight = hasDetails ? 50 : 35;

      // Alternating row background
      if (rowIndex % 2 === 1) {
        doc.rect(50, yPos, 500, rowHeight).fill(bgLight);
      }

      // Item name
      doc
        .fontSize(10)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(item.name, 65, yPos + 10, { width: 230, lineBreak: false });

      // Brand and SKU details
      if (hasDetails) {
        doc.fontSize(8).fillColor(textSecondary).font("Helvetica");
        const details = [];
        if (item.brand) details.push(item.brand);
        if (item.sku) details.push(`SKU: ${item.sku}`);
        doc.text(details.join(" • "), 65, yPos + 27, { width: 230 });
      }

      // Quantity
      doc
        .fontSize(10)
        .fillColor(textPrimary)
        .font("Helvetica")
        .text(item.quantity.toString(), 320, yPos + 10, {
          width: 40,
          align: "center",
        });

      // Unit price
      doc.text(`$${item.price.toFixed(2)}`, 380, yPos + 10, {
        width: 70,
        align: "right",
      });

      // Total
      doc
        .font("Helvetica-Bold")
        .text(`$${itemTotal.toFixed(2)}`, 470, yPos + 10, {
          width: 65,
          align: "right",
        });

      // Bottom border
      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(50, yPos + rowHeight)
        .lineTo(550, yPos + rowHeight)
        .stroke();

      yPos += rowHeight;
      rowIndex++;

      // Add new page if needed
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
        rowIndex = 0;
      }
    });

    // ==================== SUMMARY SECTION ====================
    yPos += 30;

    // Summary box with shadow effect
    const summaryBoxX = 330;
    const summaryBoxY = yPos;

    // Shadow
    doc.opacity(0.1);
    doc
      .roundedRect(summaryBoxX + 3, summaryBoxY + 3, 220, 110, 8)
      .fill("#000000");
    doc.opacity(1);

    // Main box
    doc
      .roundedRect(summaryBoxX, summaryBoxY, 220, 110, 8)
      .lineWidth(1)
      .strokeColor(borderColor)
      .fillColor("#ffffff")
      .fillAndStroke();

    // Subtotal
    yPos += 20;
    doc
      .fontSize(10)
      .fillColor(textSecondary)
      .font("Helvetica")
      .text("Subtotal:", summaryBoxX + 20, yPos);
    doc
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(`$${order.subtotal.toFixed(2)}`, summaryBoxX + 20, yPos, {
        width: 180,
        align: "right",
      });

    // Tax (if applicable)
    if (order.tax) {
      yPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Tax:", summaryBoxX + 20, yPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${order.tax.toFixed(2)}`, summaryBoxX + 20, yPos, {
          width: 180,
          align: "right",
        });
    }

    // Divider
    yPos += 25;
    doc
      .strokeColor(borderColor)
      .lineWidth(1)
      .moveTo(summaryBoxX + 20, yPos)
      .lineTo(summaryBoxX + 200, yPos)
      .stroke();

    // Total with accent background
    yPos += 15;
    doc.opacity(0.1);
    doc.roundedRect(summaryBoxX + 15, yPos - 8, 190, 32, 6).fill(accentColor);
    doc.opacity(1);
    doc
      .roundedRect(summaryBoxX + 15, yPos - 8, 190, 32, 6)
      .lineWidth(1)
      .strokeColor(accentColor)
      .stroke();

    doc
      .fontSize(12)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("TOTAL:", summaryBoxX + 25, yPos);
    doc
      .fontSize(16)
      .fillColor(accentColor)
      .text(`$${order.total.toFixed(2)}`, summaryBoxX + 25, yPos, {
        width: 170,
        align: "right",
      });

    // ==================== PAYMENT INFO ====================
    if (order.payment) {
      yPos += 60;

      doc
        .fontSize(12)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text("Payment Information", 50, yPos);

      yPos += 25;

      // Payment details box
      doc
        .roundedRect(50, yPos, 280, 70, 8)
        .lineWidth(1)
        .strokeColor(borderColor)
        .fillColor(bgLight)
        .fillAndStroke();

      doc
        .fontSize(9)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Method:", 70, yPos + 18);
      doc
        .fontSize(10)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(order.payment.method || "N/A", 180, yPos + 18);

      doc
        .fontSize(9)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Status:", 70, yPos + 38);

      const paymentStatusColor =
        order.payment.status === "completed"
          ? successColor
          : order.payment.status === "pending"
          ? warningColor
          : dangerColor;
      doc
        .fontSize(10)
        .fillColor(paymentStatusColor)
        .font("Helvetica-Bold")
        .text(order.payment.status.toUpperCase(), 180, yPos + 38);

      if (order.payment.transactionId) {
        doc
          .fontSize(8)
          .fillColor(textSecondary)
          .font("Helvetica")
          .text(
            `Transaction ID: ${order.payment.transactionId}`,
            70,
            yPos + 55
          );
      }
    }

    // ==================== FOOTER ====================
    const footerY = doc.page.height - 100;

    // Footer divider
    doc
      .strokeColor(borderColor)
      .lineWidth(1)
      .moveTo(50, footerY)
      .lineTo(550, footerY)
      .stroke();

    // Thank you message
    doc
      .fontSize(11)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("Thank you for your business!", 50, footerY + 20, {
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
        footerY + 40,
        {
          align: "center",
          width: 500,
        }
      );

    doc
      .fontSize(8)
      .fillColor(textSecondary)
      .text(
        "info@yourcompany.com • (555) 123-4567 • www.yourcompany.com",
        50,
        footerY + 58,
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
        .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 50, {
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
