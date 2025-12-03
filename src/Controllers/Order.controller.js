const mongoose = require("mongoose");
const Order = require("../Models/Order.model");
const PDFDocument = require("pdfkit");
const Product = require("../Models/Product.model");
const Appointment = require("../Models/Appointment.model");
const TimeSlot = require("../Models/TimeSlot.model");
const Service = require("../Models/Service.model");
const ContactInfo = require("../Models/ContactInfo.model");
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

const generateOrderConfirmationEmail = (order, productsData = [], contactInfo = {}) => {
  if (!order) return "";
  const {
    items = [],
    serviceItems = [],
    subtotal = 0,
    total = 0,
    appointment = {},
    customer = {},
    payment = [],
  } = order;

  const paymentInfo = Array.isArray(payment) ? payment[0] || {} : payment || {};

  const logoUrl = `${process.env.BACKEND_APP_URL}/logo_light.png`;

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

  const servicesHTML = serviceItems
    .map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
            <div style="display: inline-block; vertical-align: middle;">
              <strong>${item.name || "Unnamed Service"}</strong><br>
              <span style="color: #666; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">
                ${item.description || "Service"}
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

  const dateObj = new Date(order.createdAt || new Date());
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  const idSuffix = order._id?.toString()?.slice(-6)?.toUpperCase() || "000000";
  const invoiceNum = `INV-${dateStr}-${idSuffix}`;
  const invoiceDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

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
                <td style="background-color: #0f172a; padding: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top;">
                        <img src="${logoUrl}" width="100" alt="SCT Logo" style="display: block; margin-bottom: 10px;" />
                        <div style="font-size: 11px; font-weight: bold; color: #ffffff; margin-bottom: 5px;">Super Cheap Tyres</div>
                        <div style="font-size: 8px; color: #cbd5e1; line-height: 1.4;">
                          ${contactInfo?.address || "114 Hammond Rd, Dandenong South VIC, 3175"}<br>
                          Phone: ${contactInfo?.phone || "(03) 9793 6190"}<br>
                          Email: ${contactInfo?.email || "goodwillmotors@hotmail.com"}
                        </div>
                      </td>
                      <td style="text-align: right; vertical-align: top;">
                        <div style="font-size: 34px; font-weight: bold; color: #ffffff; margin-bottom: 5px;">INVOICE</div>
                        <div style="font-size: 9px; color: #cbd5e1;">Invoice #: ${invoiceNum}</div>
                        <div style="font-size: 9px; color: #cbd5e1;">Date: ${invoiceDate}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 30px;">
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px;">
                    Hi <strong>${appointment.firstName || customer.name || "Customer"
    } ${appointment.lastName || ""}</strong>,
                  </p>
                  <p style="font-size: 16px; color: #333333; margin: 0;">
                    Thank you for your order! We've received it and are preparing for your appointment.
                  </p>
                </td>
              </tr>

              <!-- Appointment Details -->
              ${appointment?.date || appointment?.time || "-"
      ? `
              <tr>
                <td style="padding: 0 30px 30px;">
                  <h2 style="color: #333333; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
                    Appointment Details
                  </h2>
                  <table width="100%" cellpadding="8" cellspacing="0">
                    ${appointment.date
        ? `<tr><td style="color:#666;font-size:14px;width:40%;"><strong>Date:</strong></td><td>${formatDate(
          appointment.date || "-"
        )}</td></tr>`
        : "-"
      }
                    ${appointment.time
        ? `<tr><td style="color:#666;font-size:14px;"><strong>Time:</strong></td><td>${appointment.time}</td></tr>`
        : "-"
      }
                    ${appointment.phone
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
                    <tbody>${itemsHTML}${servicesHTML}</tbody>
                  </table>
                </td>
              </tr>

               <tr>
                <td style="padding: 0 30px 30px;">
                  <div style="
                    background-color: ${paymentInfo.status === "full" ? "#e8f5e9" : "#fff3e0"
    };
                    padding: 15px;
                    border-radius: 4px;
                    border-left: 4px solid ${paymentInfo.status === "full" ? "#4CAF50" : "#FF9800"
    };
                  ">
                    <p style="margin: 0; color: #333; font-size: 14px;">
                      <strong>Payment Status:</strong> ${paymentInfo.status === "full" ? "FULL PAID" : "PARTIAL PAID"}
                    </p>
                    ${paymentInfo.method ? `<p style="margin: 5px 0 0; color: #333; font-size: 14px;"><strong>Method:</strong> ${paymentInfo.method === "card" ? "Credit Card/Debit Card" : paymentInfo.method.toUpperCase()}</p>` : ""}
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
                <td style="padding: 30px; text-align: center; border-top: 1.5px solid #e2e8f0;">
                  <p style="margin: 0 0 10px; color: #1e293b; font-size: 11px; font-weight: bold;">Thank you for your business!</p>
                  <p style="margin: 0; color: #64748b; font-size: 8.5px;">If you have any questions about this invoice, please contact us</p>
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
    const { items: reqItems, serviceItems: reqServiceItems, subtotal, total, appointmentId, customer, payment } =
      req.body;

    const items = Array.isArray(reqItems) ? reqItems : [];
    const serviceItems = Array.isArray(reqServiceItems) ? reqServiceItems : [];

    if (items.length === 0 && serviceItems.length === 0) {
      return res
        .status(400)
        .json(new ApiError(400, "Order must contain at least one item or service item"));
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

    for (const item of serviceItems) {
      if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return res
          .status(400)
          .json(
            new ApiError(400, "Each service item must have a valid id and quantity")
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

    const validPaymentMethods = ["card", "cash", "online", "eftpos", "afterpay"];
    const validPaymentStatuses = ["partial", "full", "failed"];

    let paymentStatus =
      payment?.status && validPaymentStatuses.includes(payment.status)
        ? payment.status
        : "partial";

    const paymentAmount = typeof payment?.amount === "number" ? payment.amount : 0;

    if (paymentAmount >= Number(subtotal)) {
      paymentStatus = "full";
    }

    const paymentData = {
      amount: paymentAmount,
      method:
        payment?.method && validPaymentMethods.includes(payment.method)
          ? payment.method
          : "",
      status: paymentStatus,
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

    const serviceIds = serviceItems.map((item) => item.id);
    const services = await Service.find({
      _id: { $in: serviceIds },
    }).lean();

    if (services.length !== serviceItems.length) {
      return res
        .status(400)
        .json(new ApiError(400, "One or more services not found or inactive"));
    }

    const enrichedServiceItems = serviceItems.map((item) => {
      const service = services.find((s) => s._id.toString() === item.id);
      return {
        id: item.id,
        quantity: item.quantity,
        name: service.name,
        description: service.description || "",
        price: service.price,
        image:
          service.images && service.images.length > 0 ? service.images[0] : "",
      };
    });

    const order = await Order.create({
      items: enrichedItems,
      serviceItems: enrichedServiceItems,
      subtotal,
      total,
      appointment: {
        id: appointment._id,
        firstName: appointment.firstname,
        lastName: appointment.lastname,
        phone: appointment.phone,
        email: appointment.email,
        date: appointment.date,
        slotId: appointment.slotId,
        time: slotInfo ? `${slotInfo.startTime}-${slotInfo.endTime}` : "",
        timeSlotId: appointment.timeSlotId || "",
      },
      customer: customerData,
      payment: paymentData,
    });

    try {
      const contactInfo = await ContactInfo.findOne().lean();
      const customerHTML = generateOrderConfirmationEmail(order, [], contactInfo);
      await sendMail(
        appointment.email,
        "Order Confirmation - Your Appointment is Confirmed!",
        customerHTML,
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

    const contactInfo = await ContactInfo.findOne();
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
        contactInfo?.address || "114 Hammond Rd, Dandenong South VIC, 3175",
        logoX,
        logoBottom + addressSpacing + 14
      );
      doc.text(
        `Phone: ${contactInfo?.phone || "(03) 9793 6190"}`,
        logoX,
        logoBottom + addressSpacing + 25
      );
      doc.text(
        `Email: ${contactInfo?.email || "goodwillmotors@hotmail.com"}`,
        logoX,
        logoBottom + addressSpacing + 36
      );

      doc
        .fontSize(34)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("INVOICE", 320, 15, { align: "right", width: 230 });
      doc.fontSize(9).fillColor("#cbd5e1").font("Helvetica");
      const dateObj = new Date(order.createdAt);
      const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
      const idSuffix = order._id?.toString()?.slice(-6)?.toUpperCase();
      const invoiceNum = `INV-${dateStr}-${idSuffix}`;

      doc.text(
        `Invoice #: ${invoiceNum}`,
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

    // Helper to strip HTML tags
    const stripHtml = (html) => {
      if (!html) return "";
      return html.replace(/<[^>]*>?/gm, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    };

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
    const allItems = [...(order.items || []), ...(order.serviceItems || [])];

    if (allItems.length >= 4 || allItems.length > itemsPerPageEstimate) {
      itemsWillNeedNewPage = true;
    }

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku || item.description;
      const rowHeight = hasDetails ? 48 : 35;

      if (itemsEndYPos + rowHeight > pageHeight) {
        // This item will go to next page
        itemsWillNeedNewPage = true;
        itemsEndYPos = startYAfterHeader + tableTitleHeight + tableHeaderHeight;
      }

      itemsEndYPos += rowHeight;
    }

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const itemTotal = item.price * item.quantity;
      const hasDetails = item.brand || item.sku || item.description;
      const rowHeight = hasDetails ? 48 : 35;

      if (yPos + rowHeight > pageHeight) {
        renderFooter();
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
        if (item.description) details.push(stripHtml(item.description));
        doc.text(details.join(" • "), 58, yPos + 26, {
          width: 260,
          height: 20,
          ellipsis: true,
        });
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

    const { paymentId } = req.query;

    if (
      order.payment &&
      Array.isArray(order.payment) &&
      order.payment.length > 0
    ) {
      if (paymentId) {
        paymentToDisplay = order.payment.find(
          (p) => p._id?.toString() === paymentId || p.id === paymentId
        );
      }

      if (!paymentToDisplay) {
        // Check if any payment entry has status 'full'
        const fullPayment = order.payment.find((p) => p.status === "full");
        if (fullPayment) {
          paymentToDisplay = fullPayment;
        } else {
          // If no 'full' payment, use the first payment entry
          paymentToDisplay = order.payment[0];
        }
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
      allItems.length >= 4 ||
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

      let statusText = paymentToDisplay?.status?.toUpperCase() || "N/A";

      // Fix: If payment amount covers the total, force status to FULL
      if (paymentToDisplay.amount >= order.total - 0.01) {
        statusText = "FULL";
      }

      if (statusText === "PARTIAL" || statusText === "FULL") {
        statusText += " PAID";
      }

      doc
        .fontSize(10)
        .fillColor(paymentStatusColor)
        .font("Helvetica-Bold")
        .text(
          statusText,
          leftBoxX + 18,
          paymentBoxY + 36
        );

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

    // Calculate dynamic height based on fields to show
    let summaryBoxHeight = 100; // Base height for Subtotal + Total

    // Logic to determine payment amounts
    let previousPaidAmount = 0;
    let currentPaidAmount = 0;
    let totalPaidSoFar = 0;
    let isFirstPayment = true;

    if (order.payment && Array.isArray(order.payment)) {
      if (paymentToDisplay) {
        // Find index of current payment
        const currentIndex = order.payment.findIndex(
          (p) =>
            (p._id && p._id.toString() === paymentToDisplay._id?.toString()) ||
            (p.id && p.id === paymentToDisplay.id)
        );

        if (currentIndex !== -1) {
          // Calculate previous paid amount (sum of payments before this one)
          previousPaidAmount = order.payment
            .slice(0, currentIndex)
            .reduce((sum, p) => sum + (p.amount || 0), 0);

          currentPaidAmount = paymentToDisplay.amount || 0;
          totalPaidSoFar = previousPaidAmount + currentPaidAmount;
          isFirstPayment = currentIndex === 0;
        } else {
          // Fallback if payment not found in list (shouldn't happen)
          currentPaidAmount = paymentToDisplay.amount || 0;
          totalPaidSoFar = currentPaidAmount;
        }
      } else {
        // No specific payment displayed, assume total
        totalPaidSoFar = order.payment.reduce((sum, p) => sum + (p.amount || 0), 0);
        currentPaidAmount = totalPaidSoFar;
      }
    } else if (order.payment && typeof order.payment === 'object') {
      // Legacy single payment object
      currentPaidAmount = order.payment.amount || 0;
      totalPaidSoFar = currentPaidAmount;
    }

    const unpaidAmount = Math.max(0, order.subtotal - totalPaidSoFar);


    // Determine fields to show
    // Always show Subtotal
    // If first payment: Paid Amount, Unpaid Amount
    // If subsequent payment: Previous Paid Amount, Paid Amount, Unpaid Amount
    // Always show Total

    if (isFirstPayment) {
      summaryBoxHeight += 44; // Paid Amount + Unpaid Amount
    } else {
      summaryBoxHeight += 66; // Previous Paid + Paid Amount + Unpaid Amount
    }

    if (order.tax) summaryBoxHeight += 22;

    // Adjust rightBoxHeight to fit content
    const finalRightBoxHeight = Math.max(rightBoxHeight, summaryBoxHeight + 20);

    doc.opacity(0.08);
    doc
      .roundedRect(
        summaryBoxX + 3,
        yPos + 3,
        summaryBoxWidth,
        finalRightBoxHeight,
        8
      )
      .fill("#000000");
    doc.opacity(1);
    doc
      .roundedRect(summaryBoxX, yPos, summaryBoxWidth, finalRightBoxHeight, 8)
      .fillColor("#ffffff")
      .fillAndStroke();

    let summaryYPos = yPos + 18;

    // 1. Subtotal
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

    // 2. Payment Fields
    if (isFirstPayment) {
      // First Payment Logic
      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Paid Amount:", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${currentPaidAmount.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
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

    } else {
      // Subsequent Payment Logic
      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Previous Paid Amount:", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${previousPaidAmount.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
          width: summaryBoxWidth - 40,
          align: "right",
        });

      summaryYPos += 22;
      doc
        .fontSize(10)
        .fillColor(textSecondary)
        .font("Helvetica")
        .text("Paid Amount:", summaryBoxX + 20, summaryYPos);
      doc
        .fillColor(textPrimary)
        .font("Helvetica-Bold")
        .text(`$${currentPaidAmount.toFixed(2)}`, summaryBoxX + 20, summaryYPos, {
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

    // 3. Total
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

    let totalLabel = "TOTAL:";
    // Always show the Total Paid So Far as the "TOTAL" at the bottom of the receipt
    let totalValue = totalPaidSoFar;

    doc
      .fontSize(12)
      .fillColor(textPrimary)
      .font("Helvetica-Bold")
      .text(totalLabel, summaryBoxX + 24, summaryYPos + 1);

    doc
      .fontSize(16)
      .fillColor(accentColor)
      .text(`$${totalValue.toFixed(2)}`, summaryBoxX + 24, summaryYPos, {
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
    const {
      method,
      amount,
      status,
      note,
      items,
      serviceItems,
      subtotal,
      total,
    } = req.body;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json(new ApiError(400, "Invalid Order ID"));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json(new ApiError(404, "Order not found"));
    }

    // 1. Handle Items and Stock
    if (items && Array.isArray(items)) {
      // Revert stock for old items
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          // Find product by ID (item.id matches product._id)
          await Product.findByIdAndUpdate(item.id, {
            $inc: { stock: item.quantity },
          });
        }
      }

      // Deduct stock for new items and prepare new items array
      const newItems = [];
      for (const item of items) {
        const product = await Product.findById(item.id);
        if (!product) {
          throw new Error(`Product not found: ${item.id}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }

        await Product.findByIdAndUpdate(item.id, {
          $inc: { stock: -item.quantity },
        });

        newItems.push({
          id: product._id.toString(),
          name: product.name,
          brand: product.brand,
          sku: product.sku,
          category: product.category,
          image: product.images && product.images[0] ? product.images[0] : "",
          price: product.price,
          quantity: item.quantity,
        });
      }
      order.items = newItems;
    }

    // 2. Handle Service Items
    if (serviceItems && Array.isArray(serviceItems)) {
      order.serviceItems = serviceItems;
    }

    // 3. Update Totals
    if (subtotal !== undefined) order.subtotal = subtotal;
    if (total !== undefined) order.total = total;

    // 4. Handle Payment
    // Only add payment if amount is provided and valid
    if (amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
      // Ensure order.payment is an array
      let currentPayments = [];
      if (Array.isArray(order.payment)) {
        currentPayments = order.payment;
      } else if (order.payment) {
        currentPayments = [order.payment];
      }

      const existingPaid = currentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const paymentAmount = parseFloat(amount);
      const invoiceTotal = order.total;

      const newPayment = {
        method: method || "cash",
        amount: paymentAmount,
        status: (existingPaid + paymentAmount) >= invoiceTotal ? "full" : "partial" || status,
        currency: "AU$",
        transactionId: "",
        note: note?.trim() || "",
        paidAt: new Date(),
      };

      order.payment = [...currentPayments, newPayment];
    }

    // 5. Recalculate Payment Status
    const totalPaid = Array.isArray(order.payment)
      ? order.payment.reduce((sum, p) => sum + (p.amount || 0), 0)
      : 0;

    // Use the updated order.total (or existing) to check status
    const invoiceTotal = order.total || order.subtotal;

    order.status = totalPaid >= invoiceTotal ? "full" : "partial";

    // Also update totalPaid field if it exists in schema (it wasn't in schema but was used in previous code)
    // The schema doesn't have totalPaid, but previous code used it. We'll skip it to be safe or check schema.
    // Schema has 'payment' array.

    await order.save();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          order,
          totalPaid,
          remainingBalance: Math.max(0, invoiceTotal - totalPaid),
        },
        "Order updated successfully"
      )
    );
  } catch (error) {
    console.error("Error updating order:", error);
    return res
      .status(500)
      .json(new ApiError(500, error.message || "Failed to update order"));
  }
};

const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json(new ApiError(400, "Invalid Order ID"));
    }

    // Fetch the order by ID
    const order = await Order.findById(orderId).lean();

    if (!order) {
      return res.status(404).json(new ApiError(404, "Order not found"));
    }

    // Collect product IDs from order items
    const productIds = order.items.map((item) => item.id);

    // Fetch product details
    const products =
      productIds.length > 0
        ? await Product.find({ _id: { $in: productIds } })
          .select("name price images sku")
          .lean()
        : [];

    const productMap = Object.fromEntries(
      products.map((p) => [p._id.toString(), p])
    );

    // Enrich order items with product details
    const enrichedOrder = {
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
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { order: enrichedOrder },
          "Order fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json(new ApiError(500, "Failed to fetch order"));
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  DownloadPDF,
  updateOrder,
  getOrderById,
};
