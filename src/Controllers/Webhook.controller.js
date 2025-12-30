const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../Models/Order.model");
const Appointment = require("../Models/Appointment.model");
const Product = require("../Models/Product.model");
const Service = require("../Models/Service.model");
const TempOrder = require("../Models/TempOrder.model");
const ContactInfo = require("../Models/ContactInfo.model");
const sendMail = require("../Utils/Nodemailer");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");

// Helper function to find logo path (works on both local and server)
const getLogoPath = () => {
  const possiblePaths = [
    path.join(__dirname, "..", "..", "public", "logo_light.png"),
    path.join(process.cwd(), "public", "logo_light.png"),
    path.join(__dirname, "public", "logo_light.png"),
  ];

  for (const logoPath of possiblePaths) {
    if (fs.existsSync(logoPath)) {
      console.log(`✅ Logo found at: ${logoPath}`);
      return logoPath;
    }
  }

  console.error(`❌ Logo file not found. Searched paths:`);
  possiblePaths.forEach(p => console.error(`   - ${p}`));
  return null;
};

// Copy of generateOrderConfirmationEmail from Order.controller.js because it wasn't exported
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
    charges = 0,
  } = order;

  const paymentInfo = Array.isArray(payment) ? payment[0] || {} : payment || {};

  // Use backend URL for logo to avoid attachment delivery issues
  const backendUrl = process.env.BACKEND_APP_URL || "https://api.supercheaptyres.com.au";
  const logoUrl = `${backendUrl}/logo_light.png`;

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

      const clampText = (text = "", maxChars = 150) => {
        if (!text) return "Service";
        return text.length > maxChars ? text.substring(0, maxChars) + "..." : text;
      };


      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
            <div style="display: inline-block; vertical-align: middle;">
              <strong>${item.name || "Unnamed Service"}</strong><br>
              <span style="color: #666; font-size: 12px;">
                ${clampText(item.description, 155)}
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

  const formattedSubtotal = Number(subtotal + order.charges).toFixed(2);
  const formattedTotal = Number(total).toFixed(2);
  const taxAmountVal = Number(order.taxAmount || 0);
  const taxAmount = taxAmountVal.toFixed(2);
  const taxName = order.taxName || "Tax";
  const paidAmount = Number(paymentInfo.amount || 0);
  const unpaidAmount = (Number(subtotal) + Number(order.charges || 0) - paidAmount).toFixed(2);


  // Format date properly
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return dayjs(dateStr).format("dddd, D MMMM YYYY");
  };

  const dateObj = new Date(order.createdAt || new Date());
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  const idSuffix = order._id?.toString()?.slice(-6)?.toUpperCase() || "000000";
  const invoiceNum = `INV-${dateStr}-${idSuffix}`;
  const invoiceDate = dayjs(dateObj).format("MMM D, YYYY");

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
        <td style="text-align: right; color: #333;">AU$${(Number(subtotal) - taxAmountVal).toFixed(2)}</td>
      </tr>

      <tr>
        <td style="text-align: right; color: #666;"><strong>${taxName}:</strong></td>
        <td style="text-align: right; color: #333;">AU$${taxAmount}</td>
      </tr>

      ${charges ? `
      <tr>
        <td style="text-align: right; color: #666;"><strong>Transaction Fees:</strong></td>
        <td style="text-align: right; color: #333;">AU$${Number(charges).toFixed(2)}</td>
      </tr>` : ''}

      <tr>
        <td style="text-align: right; color: #666;"><strong>Paid Amount:</strong></td>
        <td style="text-align: right; color: #4CAF50; font-weight: bold;">AU$${paidAmount.toFixed(2)}</td>
      </tr>

      <tr>
        <td style="text-align: right; color: #666;"><strong>Balance Due:</strong></td>
        <td style="text-align: right; color: #ef4444; font-weight: bold;">AU$${unpaidAmount}</td>
      </tr>

      <tr>
        <td style="text-align: right; color: #666; border-top: 2px solid #4CAF50; padding-top: 10px;">
          <strong>Total:</strong>
        </td>
        <td style="text-align: right; color: #333333; font-size: 18px; font-weight: bold; border-top: 2px solid #4CAF50; padding-top: 10px;">
          AU$${formattedSubtotal}
        </td>
      </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px; text-align: center; border-top: 1.5px solid #e2e8f0;">
                  <div style="margin-bottom: 20px; border-bottom: 1px solid #e0e0e0; padding-bottom: 15px; text-align: left;">
                    <p style="margin: 0 0 5px; color: #333; font-size: 10px; font-weight: bold;">NO RETURN NO REFUND POLICY.</p>
                    <p style="margin: 0 0 5px; color: #555; font-size: 9px;">12 Months Pro-Rata manufacturing faults Warranty subjected to Wheel Alignment and Tyre Rotation every 10,000 KM.</p>
                    <p style="margin: 0 0 5px; color: #555; font-size: 9px;"># Must Keep Alignment Report.</p>
                    <p style="margin: 0 0 5px; color: #555; font-size: 9px;">Cheques and Card payment over the phone not Accepted.</p>
                    <p style="margin: 0 0 5px; color: #555; font-size: 9px;">SUPERCHEAP TYRES DANDENONG IS NOT RESPONSIBLE FOR ANY ALTERNATIVE TYRE SIZES SELECTED AND FITTED TO CUSTOMER'S CAR.</p>
                    <p style="margin: 0; color: #555; font-size: 9px;">FLAT DRIVEN TYRES NOT COVERED UNDER WARRANTY</p>
                    <p style="margin: 0; color: #555; font-size: 9px;">Note: Wait time may vary according to workshop load.</p>
                  </div>

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


const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};
    let orderId = session.client_reference_id || metadata.orderId;

    try {
      // ---------------------------------------------------------
      // CASE 1: Updating an Existing Order (Legacy or Admin created)
      // ---------------------------------------------------------
      if (orderId) {
        const order = await Order.findById(orderId);
        if (!order) {
          console.error(`Order not found: ${orderId}`);
          return res.json({ received: true });
        }
        if (order.payment && order.payment[0] && order.payment[0].status === 'full') {
          console.log('Order already confirmed');
          return res.json({ received: true });
        }

        const paymentType = metadata.paymentType || 'full';
        const paymentUpdate = {
          ...order.payment[0].toObject(),
          transactionId: session.payment_intent,
          providerPayload: session
        };
        paymentUpdate.status = paymentType;

        await Order.findByIdAndUpdate(orderId, {
          $set: { "payment.0": paymentUpdate }
        });

        if (order.appointment && order.appointment.id) {
          await Appointment.findByIdAndUpdate(order.appointment.id, { status: 'confirmed' });
        }

        // Send Email logic for existing order
        const productIds = order.items.map(i => i.id);
        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const contactInfo = await ContactInfo.findOne().lean();
        const updatedOrder = await Order.findById(orderId).lean();
        const emailHTML = generateOrderConfirmationEmail(updatedOrder, products, contactInfo);

        if (updatedOrder.appointment && updatedOrder.appointment.email) {
          try {
            await sendMail(updatedOrder.appointment.email, "Order Confirmation - Your Appointment is Confirmed!", emailHTML);
            console.log(`✅ Customer email sent to: ${updatedOrder.appointment.email}`);
          } catch (emailErr) {
            console.error(`❌ FAILED TO SEND EMAIL to ${updatedOrder.appointment.email}:`, emailErr.message);
            console.error(`Error details:`, emailErr);
          }
        }

      }
      // ---------------------------------------------------------
      // CASE 2: Creating New Order (Stripe-First Flow)
      // ---------------------------------------------------------
      else {
        console.log("Creating new order from Webhook Metadata");

        // 1. Parse Data (From Database or Metadata Logic)
        let appointmentData = {};
        let itemsSimple = [];
        let serviceItemsSimple = [];
        let paymentOption = 'full';
        let charges = 0;
        let paymentAmount = 0;

        if (metadata.tempOrderId) {
          console.log("Fetching details from TempOrder:", metadata.tempOrderId);
          const tempOrder = await TempOrder.findById(metadata.tempOrderId);
          if (tempOrder && tempOrder.data) {
            const d = tempOrder.data;
            appointmentData = d.appointment || {};
            // Ensure items are mapped correctly
            itemsSimple = (d.items || []).map(i => ({ id: i.id, quantity: i.quantity }));
            serviceItemsSimple = (d.serviceItems || []).map(i => ({ id: i.id, quantity: i.quantity }));
            paymentOption = d.paymentOption || 'full';
            charges = Number(d.charges || 0);
            paymentAmount = Number(d.paymentAmount || 0);
          } else {
            console.error("CRITICAL: TempOrder found but data missing or doc expired:", metadata.tempOrderId);
          }
        } else {
          // Legacy Fallback (for older pending transactions)
          appointmentData = JSON.parse(metadata.appointment || '{}');
          itemsSimple = JSON.parse(metadata.items || '[]');
          serviceItemsSimple = JSON.parse(metadata.serviceItems || '[]');
          paymentOption = metadata.paymentOption || 'full';
          charges = Number(metadata.charges || 0);
          paymentAmount = Number(metadata.paymentAmount || 0);
        }

        if (!appointmentData.email) {
          console.error("Missing appointment data (email) in webhook processing");
          return res.json({ received: true });
        }

        // Self-Heal: If Time string is missing but Slot ID exists (timeSlotId or slotId), fetch it
        const lookupSlotId = appointmentData.timeSlotId || appointmentData.slotId;
        console.log(`Checking Time Healing: Time='${appointmentData.time}', SlotId='${lookupSlotId}'`);

        if (!appointmentData.time && lookupSlotId) {
          try {
            const TimeSlot = require("../Models/TimeSlot.model");
            const timeSlot = await TimeSlot.findById(lookupSlotId);
            if (timeSlot && timeSlot.time) {
              appointmentData.time = timeSlot.time;
              console.log(`Self-healed missing time: ${appointmentData.time}`);
            } else {
              console.log("TimeSlot found but no time, or not found");
            }
          } catch (err) {
            console.error("Failed to self-heal time:", err.message);
          }
        }

        // 2. Create Appointment
        const appointmentDoc = await Appointment.create({
          firstname: appointmentData.firstName,
          lastname: appointmentData.lastName,
          phone: appointmentData.phone,
          email: appointmentData.email,
          date: appointmentData.date,
          slotId: appointmentData.slotId,
          timeSlotId: appointmentData.timeSlotId,
          time: appointmentData.time,
          notes: appointmentData.remarks,
          status: "confirmed", // Confirmed immediately
        });

        // 3. Process Items & Inventory
        let subtotal = 0;
        const enrichedItems = [];
        const enrichedServiceItems = [];

        // Products
        for (const item of itemsSimple) {
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
            // Decrement Stock
            await Product.findByIdAndUpdate(item.id, { $inc: { stock: -item.quantity } });
          }
        }

        // Services
        for (const item of serviceItemsSimple) {
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

        // 4. Calculate Taxes & Totals
        // (Assuming you have access to Tax model, imported in file head? If not, need to check imports)
        // Note: The original file didn't import Tax. I need to make sure I add Tax import if used, 
        // or just hardcode tax logic if Tax model import is missing status. 
        // Checking imports: Order, Appointment, Product, ContactInfo are imported. Tax is likely NOT imported.
        // I will dynamically require Tax or use hardcoded default for safety inside this block.

        let taxPercentage = 10;
        let taxName = "GST";
        try {
          const Tax = require("../Models/Tax.model");
          const taxDoc = await Tax.findOne().lean();
          if (taxDoc) {
            taxPercentage = taxDoc.percentage;
            taxName = taxDoc.name;
          }
        } catch (e) { console.log("Tax model load failed, using default"); }

        const taxAmount = subtotal * (taxPercentage / 100);
        const totalOrderValue = subtotal + charges;

        // 5. Create Order
        const orderDoc = await Order.create({
          items: enrichedItems,
          serviceItems: enrichedServiceItems,
          subtotal: subtotal,
          total: totalOrderValue,
          charges: charges,
          taxName: taxName,
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
            time: appointmentDoc.time,
            timeSlotId: appointmentDoc.timeSlotId
          },
          customer: {
            name: `${appointmentData.firstName} ${appointmentData.lastName}`,
            phone: appointmentData.phone,
            email: appointmentData.email
          },
          payment: [{
            method: "stripe",
            status: paymentOption, // 'full' or 'partial'
            amount: paymentAmount,
            transactionId: session.payment_intent,
            // providerPayload: session,
            currency: "AU$"
          }],
          stripeSessionId: session.id, // Enforce Uniqueness
        });

        console.log(`New Order Created via Webhook: ${orderDoc._id}`);
        orderId = orderDoc._id; // Set for email logic

        // 6. Delete TempOrder if it exists
        if (metadata.tempOrderId) {
          await TempOrder.findByIdAndDelete(metadata.tempOrderId);
          console.log("Deleted TempOrder:", metadata.tempOrderId);
        }

        // 6. Send Email
        const products = await Product.find({ _id: { $in: itemsSimple.map(i => i.id) } }).lean();
        const contactInfo = await ContactInfo.findOne().lean();
        const emailHTML = generateOrderConfirmationEmail(orderDoc.toObject(), products, contactInfo);

        try {
          await sendMail(appointmentData.email, "Order Confirmation - Your Appointment is Confirmed!", emailHTML);
          console.log("Customer Email sent successfully");

          // Send Admin Email

          const adminHTML = `
                <h2>New Appointment & Order Received</h2>
                <p><strong>Customer:</strong> ${appointmentData.firstName} ${appointmentData.lastName}</p>
                <p><strong>Phone:</strong> ${appointmentData.phone}</p>
                <p><strong>Email:</strong> ${appointmentData.email}</p>
                <p><strong>Date:</strong> ${appointmentData.date}</p>
                <p><strong>Time:</strong> ${appointmentData.time || "N/A"}</p>
                <p><strong>Order ID:</strong> ${orderDoc._id}</p>
                <p><strong>Total:</strong> AU$${(orderDoc.total || 0).toFixed(2)}</p>
                <br/>
                <p>Check Admin Dashboard for full details.</p>
            `;
          await sendMail(contactInfo.email, "New Order & Appointment Received", adminHTML);
          console.log("Admin Email sent successfully");


        } catch (emailErr) {
          console.error("FAILED TO SEND EMAIL:", emailErr.message);
        }
      }

    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }

  res.json({ received: true });
};

module.exports = { handleWebhook };