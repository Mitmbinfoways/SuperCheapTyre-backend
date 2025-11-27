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
const path = require("path");
const fs = require("fs");

const getAllOrders = async (req, res) => {
  try {
    let { page, limit, search } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$or = [
        { "customer.name": searchRegex },
        { "customer.phone": searchRegex },
        { "customer.email": searchRegex },
      ];
    }

    const isPaginated = page && limit;

    const pageNumber = isPaginated ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNumber = isPaginated
      ? Math.min(100, Math.max(1, parseInt(limit, 10)))
      : 0;

    const skip = isPaginated ? (pageNumber - 1) * limitNumber : 0;

    // Fetch orders
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber || undefined) // <-- IMPORTANT: undefined removes limit
      .lean();

    // Collect product IDs
    const productIds = [
      ...new Set(orders.flatMap((order) => order.items.map((item) => item.id))),
    ];

    const products =
      productIds.length > 0
        ? await Product.find({ _id: { $in: productIds } })
            .select("name price images sku")
            .lean()
        : [];

    const productMap = Object.fromEntries(
      products.map((p) => [p._id.toString(), p])
    );

    const enrichedOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) => ({
        ...item,
        productDetails: productMap[item.id] || {
          name: "Product Not Found",
          price: item.price,
          images: [item.image || ""],
          sku: item.sku || "N/A",
        },
      })),
    }));

    let pagination = null;

    if (isPaginated) {
      const totalItems = await Order.countDocuments(filter);
      pagination = {
        totalItems,
        totalPages: Math.ceil(totalItems / limitNumber),
        currentPage: pageNumber,
        pageSize: limitNumber,
      };
    }

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
    return res.status(500).json(new ApiError(500, "Failed to fetch orders"));
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
              <span style="color: #4CAF50; font-weight: bold;">AU$${price.toFixed(
                2
              )}</span>
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">
            ${quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">
            AU$${(price * quantity).toFixed(2)}
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
                appointment?.date || appointment?.time || "-"
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
                            appointment.date || "-"
                          )}</td></tr>`
                        : "-"
                    }
                    ${
                      appointment.time
                        ? `<tr><td style="color:#666;font-size:14px;"><strong>Time:</strong></td><td>${appointment.time}</td></tr>`
                        : "-"
                    }
                    ${
                      appointment.phone
                        ? `<tr><td style="color:#666;font-size:14px;"><strong>Phone:</strong></td><td>${appointment.phone}</td></tr>`
                        : "-"
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
                        payment.status || "partial"
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
                      <td style="text-align: right; color: #333;">AU$${formattedSubtotal}</td>
                    </tr>
                    <tr>
                      <td style="text-align: right; color: #666; border-top: 2px solid #4CAF50; padding-top: 10px;">
                        <strong>Total:</strong>
                      </td>
                      <td style="text-align: right; color: #4CAF50; font-size: 18px; font-weight: bold; border-top: 2px solid #4CAF50; padding-top: 10px;">
                        AU$${formattedTotal}
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

const generateAdminAppointmentEmail = (appointment, slotInfo) => {
  return `
    <h2>New Appointment Created</h2>

    <p><strong>Name:</strong> ${appointment.firstname} ${
    appointment.lastname
  }</p>
    <p><strong>Phone:</strong> ${appointment.phone}</p>
    <p><strong>Email:</strong> ${appointment.email}</p>

    <p><strong>Date:</strong> ${appointment.date}</p>
    <p><strong>Time Slot:</strong> ${
      slotInfo ? `${slotInfo.startTime} - ${slotInfo.endTime}` : "N/A"
    }</p>

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
      transactionId: payment?.transactionId || null,
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

    try {
      const customerHTML = generateOrderConfirmationEmail(order);
      const adminHTML = generateAdminAppointmentEmail(appointment, slotInfo);

      await sendMail(
        appointment.email,
        "Order Confirmation - Your Appointment is Confirmed!",
        customerHTML
      );
      await sendMail(
        process.env.SMTP_USER,
        "New Appointment Created",
        adminHTML
      );
    } catch (emailError) {
      console.error("Email Error:", emailError);
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
    const brandColor = "#0f172a";
    const accentColor = "#3b82f6";
    const successColor = "#10b981";
    const warningColor = "#f59e0b";
    const dangerColor = "#ef4444";
    const textPrimary = "#1e293b";
    const textSecondary = "#64748b";
    const borderColor = "#e2e8f0";
    const bgLight = "#f8fafc";

    // ==================== HELPER FUNCTIONS ====================

    // Helper function to render page header on new pages
    const renderPageHeader = () => {
      doc.rect(0, 0, doc.page.width, 140).fill(brandColor);
      doc.opacity(0.4);
      doc.circle(500, 30, 70).fill("#1e293b");
      doc.circle(515, 85, 55).fill("#334155");
      doc.opacity(1);

      try {
        const possiblePaths = [
          path.join(__dirname, "..", "..", "public", "logo_light.png"),
          path.join(process.cwd(), "public", "logo_light.png"),
          path.join(__dirname, "..", "..", "..", "public", "logo_light.png"),
        ];

        let logoPath = null;
        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            logoPath = possiblePath;
            break;
          }
        }

        if (logoPath && fs.existsSync(logoPath)) {
          doc.image(logoPath, 30, 15, { width: 100 });
        } else {
          throw new Error(`Logo file not found`);
        }
      } catch (err) {
        doc.roundedRect(35, 25, 70, 70, 10).fill("#ffffff");
        doc
          .fontSize(22)
          .fillColor(accentColor)
          .font("Helvetica-Bold")
          .text("SCT", 35, 45, { width: 70, align: "center" });
      }

      const logoX = 35;
      const logoBottom = 30 + 20;
      const addressSpacing = 7;
      doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("Super Cheap Tyres", logoX, logoBottom + addressSpacing);
      doc.fontSize(8).fillColor("#cbd5e1").font("Helvetica");
      doc.text(
        "114 Hammond Rd, Dandenong South VIC, 3175",
        logoX,
        logoBottom + addressSpacing + 14
      );
      doc.text(
        "Phone: (03) 9793 6190",
        logoX,
        logoBottom + addressSpacing + 25
      );
      doc.text(
        "Email: goodwillmotors@hotmail.com",
        logoX,
        logoBottom + addressSpacing + 36
      );

      doc
        .fontSize(34)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("INVOICE", 320, 15, { align: "right", width: 230 });
      doc.fontSize(9).fillColor("#cbd5e1").font("Helvetica");
      doc.text(
        `Invoice #: INV-${order._id?.toString()?.slice(-8)?.toUpperCase()}`,
        320,
        52,
        { align: "right", width: 230 }
      );

      const formattedDate = new Date(order.createdAt).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
      doc.text(`Date: ${formattedDate}`, 320, 68, {
        align: "right",
        width: 230,
      });
    };

    // Helper function to render footer
    const renderFooter = () => {
      const footerY = doc.page.height - 90; // Position from bottom

      doc
        .strokeColor(borderColor)
        .lineWidth(1.5)
        .moveTo(40, footerY)
        .lineTo(555, footerY)
        .stroke();

      doc
        .fontSize(11)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text("Thank you for your business!", 40, footerY + 18, {
          align: "center",
          width: 515,
        });

      doc
        .fontSize(8.5)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text(
          "If you have any questions about this invoice, please contact us",
          40,
          footerY + 34,
          { align: "center", width: 515 }
        );
    };

    // ==================== PAGE 1: HEADER & CUSTOMER INFO ====================
    renderPageHeader();

    const logoX = 35;
    const logoBottom = 30 + 20;
    const addressSpacing = 7;

    // ==================== CUSTOMER DETAILS SECTION ====================
    let yPos = 160;
    doc.opacity(0.03);
    doc.roundedRect(40, yPos, 245, 110, 8).fill(accentColor);
    doc.opacity(1);
    doc.roundedRect(40, yPos, 245, 110, 8).lineWidth(1.5).stroke(borderColor);

    doc
      .fontSize(9)
      .fillColor(textSecondary)
      .font("Helvetica-Bold")
      .text("BILL TO", 58, yPos + 15);
    doc
      .fontSize(13)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(order.customer.name, 58, yPos + 35);
    doc.fontSize(9).fillColor(textSecondary).font("Helvetica");
    doc.text(order.customer.phone, 58, yPos + 55);
    doc.text(order.customer.email || "N/A", 58, yPos + 70);

    if (
      order.appointment.firstName &&
      order.appointment.lastName &&
      order.appointment.firstName.trim() !== "" &&
      order.appointment.lastName.trim() !== ""
    ) {
      doc.opacity(0.03);
      doc.roundedRect(295, yPos, 260, 110, 8).fill(accentColor);
      doc.opacity(1);
      doc
        .roundedRect(295, yPos, 260, 110, 8)
        .lineWidth(1.5)
        .stroke(borderColor);
      doc
        .fontSize(9)
        .fillColor(textSecondary)
        .font("Helvetica-Bold")
        .text("APPOINTMENT DETAILS", 313, yPos + 15);
      doc
        .fontSize(13)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(
          `${order.appointment.firstName} ${order.appointment.lastName}`,
          313,
          yPos + 35
        );
      doc.fontSize(9).fillColor(textSecondary).font("Helvetica");
      doc.text(order.appointment.phone, 313, yPos + 55);
      doc.text(order.appointment.email, 313, yPos + 70);

      doc.circle(318, yPos + 88, 3).fill(accentColor);
      const formattedAppointmentDate = order.appointment.date
        ? new Date(order.appointment.date).toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";
      doc
        .fontSize(9)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(
          `${formattedAppointmentDate} ${order.appointment.time}`,
          328,
          yPos + 85
        );
    }

    // ==================== ITEMS TABLE ====================
    const pageHeight = doc.page.height - 120; // Reserve space for footer
    const tableHeaderHeight = 28;
    const tableTitleHeight = 28;
    const headerHeight = 140;
    const startYAfterHeader = 160;
    yPos = 290;

    const renderTableHeader = () => {
      doc.rect(40, yPos, 515, tableHeaderHeight).fill(brandColor);
      doc.rect(40, yPos, 515, 2.5).fill(accentColor);
      doc.fontSize(8.5).fillColor("#ffffff").font("Helvetica-Bold");
      doc.text("ITEM DESCRIPTION", 58, yPos + 11);
      doc.text("QTY", 340, yPos + 11, { width: 30, align: "center" });
      doc.text("UNIT PRICE", 390, yPos + 11, { width: 65, align: "right" });
      doc.text("AMOUNT", 475, yPos + 11, { width: 60, align: "right" });
      yPos += tableHeaderHeight;
    };

    // Always start items on first page
    doc
      .fontSize(14)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("Items & Description", 40, yPos);
    yPos += tableTitleHeight;

    renderTableHeader();

    let rowIndex = 0;

    // Calculate if we need to move summary box to second page
    // Alternative approach: Pre-calculate space needed for items
    let itemsEndYPos = yPos;
    let itemsWillNeedNewPage = false;
    let currentPageItemsCount = 0;
    let itemsPerPageEstimate = Math.floor((pageHeight - yPos) / 35); // Estimate with minimum row height

    // If we have 4 or more items, or if items likely won't fit with summary box
    if (order.items.length >= 4 || order.items.length > itemsPerPageEstimate) {
      itemsWillNeedNewPage = true;
    }

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku;
      const rowHeight = hasDetails ? 48 : 35;

      if (itemsEndYPos + rowHeight > pageHeight) {
        // This item will go to next page
        itemsWillNeedNewPage = true;
        itemsEndYPos = startYAfterHeader + tableTitleHeight + tableHeaderHeight;
      }

      itemsEndYPos += rowHeight;
    }

    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku;
      const rowHeight = hasDetails ? 48 : 35;

      if (yPos + rowHeight > pageHeight) {
        renderFooter(); // Add footer before new page
        doc.addPage();
        yPos = startYAfterHeader;
        rowIndex = 0;

        renderPageHeader();

        doc
          .fontSize(14)
          .fillColor(textPrimary)
          .font("Helvetica-Bold")
          .text("Items & Description (Continued)", 40, yPos);
        yPos += tableTitleHeight;
        renderTableHeader();
      }

      if (rowIndex % 2 === 1) {
        doc.rect(40, yPos, 515, rowHeight).fill(bgLight);
      }

      doc
        .fontSize(10)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(item.name, 58, yPos + 10, { width: 260, lineBreak: false });

      if (hasDetails) {
        doc.fontSize(7.5).fillColor(textSecondary).font("Helvetica");
        const details = [];
        if (item.brand) details.push(item.brand);
        if (item.sku) details.push(`SKU: ${item.sku}`);
        doc.text(details.join(" • "), 58, yPos + 26, { width: 260 });
      }

      doc
        .fontSize(10)
        .fillColor(textPrimary)
        .font("Helvetica")
        .text(item.quantity.toString(), 340, yPos + 10, {
          width: 30,
          align: "center",
        });

      doc.text(`${item.price.toFixed(2)}`, 390, yPos + 10, {
        width: 65,
        align: "right",
      });

      doc
        .font("Helvetica-Bold")
        .text(`${itemTotal.toFixed(2)}`, 475, yPos + 10, {
          width: 60,
          align: "right",
        });

      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .moveTo(40, yPos + rowHeight)
        .lineTo(555, yPos + rowHeight)
        .stroke();

      yPos += rowHeight;
      rowIndex++;
    }

    // ==================== PAYMENT INFO & SUMMARY SIDE BY SIDE ====================
    yPos += 25;

    // Find the appropriate payment entry to display
    let paymentToDisplay = null;
    let isPaymentPending = false;

    if (
      order.payment &&
      Array.isArray(order.payment) &&
      order.payment.length > 0
    ) {
      // Check if any payment entry has status 'full'
      const fullPayment = order.payment.find((p) => p.status === "full");
      if (fullPayment) {
        paymentToDisplay = fullPayment;
      } else {
        // If no 'full' payment, use the first payment entry
        paymentToDisplay = order.payment[0];
      }

      // Check if any payment entry has status 'partial'
      isPaymentPending = order.payment.some((p) => p.status === "partial");
    }

    const leftBoxHeight = 85;
    const rightBoxHeight = isPaymentPending ? 145 : 100;
    const maxBoxHeight = Math.max(leftBoxHeight, rightBoxHeight);
    const summaryAndFooterHeight = maxBoxHeight + 150;

    // Alternative approach: Move summary box to second page if there are 4 or more products
    // or if items table likely forced a new page
    if (
      order.items.length >= 4 ||
      itemsWillNeedNewPage ||
      yPos + summaryAndFooterHeight > pageHeight
    ) {
      renderFooter(); // Add footer before new page
      doc.addPage();
      yPos = startYAfterHeader;
      renderPageHeader();
    }

    // Left side - Payment Information
    if (paymentToDisplay) {
      const leftBoxX = 40;
      const leftBoxWidth = 250;

      doc
        .fontSize(12)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text("Payment Information", leftBoxX, yPos);

      const paymentBoxY = yPos + 22;
      doc
        .roundedRect(leftBoxX, paymentBoxY, leftBoxWidth, leftBoxHeight, 8)
        .lineWidth(1.5)
        .strokeColor(borderColor)
        .fillColor(bgLight)
        .fillAndStroke();

      doc
        .fontSize(9)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Status:", leftBoxX + 18, paymentBoxY + 18);

      const paymentStatusColor =
        paymentToDisplay.status === "completed"
          ? successColor
          : paymentToDisplay.status === "partial"
          ? warningColor
          : paymentToDisplay.status === "full"
          ? successColor
          : dangerColor;

      doc
        .fontSize(10)
        .fillColor(paymentStatusColor)
        .font("Helvetica-Bold")
        .text(
          paymentToDisplay?.status?.toUpperCase() || "N/A",
          leftBoxX + 18,
          paymentBoxY + 36
        );

      if (paymentToDisplay.transactionId) {
        doc
          .fontSize(8)
          .fillColor(textSecondary)
          .font("Helvetica")
          .text(
            `Transaction ID: ${paymentToDisplay.transactionId}`,
            leftBoxX + 18,
            paymentBoxY + 58,
            { width: leftBoxWidth - 36 }
          );
      }
    } else if (order.payment) {
      // Handle case where payment exists but is empty array or invalid
      const leftBoxX = 40;
      const leftBoxWidth = 250;

      doc
        .fontSize(12)
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text("Payment Information", leftBoxX, yPos);

      const paymentBoxY = yPos + 22;
      doc
        .roundedRect(leftBoxX, paymentBoxY, leftBoxWidth, leftBoxHeight, 8)
        .lineWidth(1.5)
        .strokeColor(borderColor)
        .fillColor(bgLight)
        .fillAndStroke();

      doc
        .fontSize(9)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Payment Status:", leftBoxX + 18, paymentBoxY + 18);

      doc
        .fontSize(10)
        .fillColor(dangerColor)
        .font("Helvetica-Bold")
        .text("N/A", leftBoxX + 18, paymentBoxY + 36);
    }

    // Right side - Summary Box
    const summaryBoxX = 305;
    const summaryBoxWidth = 250;

    doc.opacity(0.08);
    doc
      .roundedRect(
        summaryBoxX + 3,
        yPos + 3,
        summaryBoxWidth,
        rightBoxHeight,
        8
      )
      .fill("#000000");
    doc.opacity(1);
    doc
      .roundedRect(summaryBoxX, yPos, summaryBoxWidth, rightBoxHeight, 8)
      .fillColor("#ffffff")
      .fillAndStroke();

    let summaryYPos = yPos + 18;

    doc
      .fontSize(10)
      .fillColor(textSecondary)
      .font("Helvetica")
      .text("Subtotal:", summaryBoxX + 20, summaryYPos);
    doc
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(`$${order.subtotal.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
        width: summaryBoxWidth - 40,
        align: "right",
      });

    if (order.tax) {
      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Tax:", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${order.tax.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
          width: summaryBoxWidth - 40,
          align: "right",
        });
    }

    if (isPaymentPending) {
      // Calculate the actual paid amount by summing all payments in the array
      let paidAmount = 0;
      if (order.payment && Array.isArray(order.payment)) {
        paidAmount = order.payment.reduce(
          (sum, payment) => sum + (payment.amount || 0),
          0
        );
      }
      const unpaidAmount = order.subtotal - paidAmount;

      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Paid Amount :", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${paidAmount.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
          width: summaryBoxWidth - 40,
          align: "right",
        });

      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Unpaid Amount:", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${unpaidAmount.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
          width: summaryBoxWidth - 40,
          align: "right",
        });
    }

    summaryYPos += 24;
    doc
      .strokeColor(borderColor)
      .lineWidth(1.5)
      .moveTo(summaryBoxX + 20, summaryYPos)
      .lineTo(summaryBoxX + summaryBoxWidth - 20, summaryYPos)
      .stroke();

    summaryYPos += 14;
    doc.opacity(0.08);
    doc
      .roundedRect(
        summaryBoxX + 16,
        summaryYPos - 8,
        summaryBoxWidth - 32,
        32,
        6
      )
      .fill(accentColor);
    doc.opacity(1);

    doc
      .fontSize(12)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text("TOTAL:", summaryBoxX + 24, summaryYPos + 1);
    doc
      .fontSize(16)
      .fillColor(accentColor)
      .text(`$${order.total.toFixed(2)}`, summaryBoxX + 24, summaryYPos, {
        width: summaryBoxWidth - 48,
        align: "right",
      });

    // ==================== ADD FOOTER & PAGE NUMBERS TO ALL PAGES ====================
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);

      // Add footer to each page
      renderFooter();

      // Add page number to each page
      doc
        .fontSize(7.5)
        .fillColor(textSecondary)
        .text(`Page ${i + 1} of ${range.count}`, 0, doc.page.height - 25, {
          align: "center",
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

const updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { method = "cash", amount, status, note } = req.body;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json(new ApiError(400, "Invalid Order ID"));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json(new ApiError(404, "Order not found"));
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json(new ApiError(400, "Valid payment amount is required"));
    }

    const validStatuses = ["partial", "full"];
    if (!status || !validStatuses.includes(status)) {
      return res
        .status(400)
        .json(
          new ApiError(
            400,
            `Payment status must be one of: ${validStatuses.join(", ")}`
          )
        );
    }

    let currentPayments = [];
    if (Array.isArray(order.payment)) {
      currentPayments = order.payment;
    } else if (order.payment && typeof order.payment === "object") {
      currentPayments = [order.payment];
      console.log(`Fixed non-array payment field for order ${orderId}`);
    }

    const newPayment = {
      method,
      amount,
      status,
      currency: "AU$",
      transactionId: "",
      note: note?.trim() || "",
      paidAt: new Date(),
    };

    const updatedPayments = [...currentPayments, newPayment];

    const totalPaid = updatedPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    const amountToMatch = order.subtotal;

    const isFullyPaid = totalPaid >= amountToMatch;
    const finalOrderStatus = isFullyPaid ? "full" : "partial";

    // Auto-correct status if this payment completes the full amount
    if (isFullyPaid && newPayment.status !== "full") {
      newPayment.status = "full";
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          payment: updatedPayments,
          totalPaid: totalPaid, // optional field — good to have
          status: finalOrderStatus,
          total: totalPaid, // Update the order's total field based on sum of payments
        },
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          order: updatedOrder,
          addedPayment: newPayment,
          totalPaid,
          remainingBalance: Math.max(0, amountToMatch - totalPaid),
          fullyPaid: isFullyPaid,
        },
        isFullyPaid
          ? "Order fully paid with this payment"
          : "Partial payment added successfully"
      )
    );
  } catch (error) {
    console.error("Error adding cash payment:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to add cash payment"));
  }
};

const createLocalOrder = async (req, res) => {
  try {
    const { items, subtotal, total, customer, payment, appointment } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json(new ApiError(400, "Order items are required"));
    }

    for (const item of items) {
      if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res
          .status(400)
          .json(
            new ApiError(400, "Each item must have a valid id and quantity > 0")
          );
      }
    }

    if (
      !customer ||
      !customer.firstName ||
      !customer.lastName ||
      !customer.phone
    ) {
      return res
        .status(400)
        .json(new ApiError(400, "Customer name and phone are required"));
    }

    const fullName =
      `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim();

    const customerData = {
      name: fullName,
      phone: customer.phone,
      email: customer.email || "",
    };

    const validPaymentMethods = ["card", "cash", "online", "bank_transfer"];
    const validPaymentStatuses = ["partial", "full"];

    const paymentData = {
      amount: typeof payment?.amount === "number" ? payment.amount : total || 0,
      method:
        payment?.method && validPaymentMethods.includes(payment.method)
          ? payment.method
          : "cash", // default for walk-in
      status:
        payment?.status && validPaymentStatuses.includes(payment.status)
          ? payment.status
          : "partial",
      currency: payment?.currency || "AU$",
      transactionId: payment?.transactionId || "",
      providerPayload: payment?.providerPayload || null,
      note: payment?.note || "",
      paidAt: payment?.paidAt ? new Date(payment.paidAt) : null,
    };

    const productIds = items.map((item) => item.id);
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    if (products.length !== items.length) {
      return res
        .status(400)
        .json(new ApiError(400, "One or more products not found or inactive"));
    }

    for (const item of items) {
      const product = products.find((p) => p._id.toString() === item.id);
      if (!product || product.stock < item.quantity) {
        return res
          .status(400)
          .json(
            new ApiError(
              400,
              `Insufficient stock for "${
                product?.name || "product"
              }". Available: ${product?.stock || 0}, Requested: ${
                item.quantity
              }`
            )
          );
      }
    }

    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.id,
        { $inc: { stock: -item.quantity } },
        { new: true, runValidators: true }
      );
    }

    const updatedProducts = await Product.find({
      _id: { $in: productIds },
    }).lean();

    const enrichedItems = items.map((item) => {
      const product = updatedProducts.find((p) => p._id.toString() === item.id);
      return {
        id: item.id,
        name: product.name,
        brand: product.brand || "",
        sku: product.sku || "",
        category: product.category || "",
        image: product.images?.[0] || "",
        price: product.price,
        quantity: item.quantity,
      };
    });

    const appointmentData = appointment
      ? {
          id: appointment.id || null,
          firstName: appointment.firstName || "",
          lastName: appointment.lastName || "",
          phone: appointment.phone || "",
          email: appointment.email || "",
          date: appointment.date || "",
          time: appointment.time || "",
          slotId: appointment.slotId || "",
          timeSlotId: appointment.timeSlotId || "",
        }
      : {
          id: null,
          firstName: customerData.firstName || "",
          lastName: customerData.lastName || "",
          phone: customerData.phone || "",
          email: customerData.email || "",
          date: "",
          time: "Offline",
          slotId: "",
          timeSlotId: "",
        };

    const order = await Order.create({
      items: enrichedItems,
      subtotal: Number(subtotal),
      total: Number(total),
      customer: customerData,
      appointment: appointmentData,
      payment: [paymentData],
    });

    if (customerData.email) {
      try {
        console.log(
          `Order confirmation email would be sent to ${customerData.email}`
        );
      } catch (emailError) {
        console.error("Failed to send order confirmation email:", emailError);
      }
    }

    return res
      .status(201)
      .json(new ApiResponse(201, order, "Local order created successfully"));
  } catch (error) {
    console.error("Error creating local order:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to create local order"));
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  DownloadPDF,
  updateOrder,
  createLocalOrder,
};
