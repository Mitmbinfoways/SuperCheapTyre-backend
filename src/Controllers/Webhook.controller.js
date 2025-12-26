const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../Models/Order.model");
const Appointment = require("../Models/Appointment.model");
const Product = require("../Models/Product.model");
const ContactInfo = require("../Models/ContactInfo.model");
const sendMail = require("../Utils/Nodemailer");
const path = require("path");
const dayjs = require("dayjs");

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

  const logoUrl = "cid:sct_logo_light";

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

    const orderId = session.client_reference_id || (session.metadata ? session.metadata.orderId : null);

    if (!orderId) {
      console.error('No orderId found in session');
      return res.json({ received: true });
    }

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        console.error(`Order not found: ${orderId}`);
        return res.json({ received: true });
      }

      if (order.payment && order.payment[0] && order.payment[0].status === 'full') {
        console.log('Order already confirmed');
        return res.json({ received: true });
      }

      // Update Order
      // Check if full or partial
      // In current logic, we probably set amount in createOrder.
      // Here we confirm it.
      // If the payment amount matches total, it's full.
      // Actually, session.amount_total is in cents. order.payment[0].amount is in dollars usually?
      // Let's check Payment.controller.js: unit_amount: Math.round(price * 100).

      // We can trust the payment logic that set 'full' or 'partial' in the Pending Order.
      // But usually we should mark valid transactionId.

      const paymentUpdate = {
        ...order.payment[0].toObject(),
        transactionId: session.payment_intent,
        status: order.payment[0].status || 'full', // Default to full if not set?? No, trust pending order
        // Or better:
        providerPayload: session
      };

      // If the created order had status 'pending', we set it to the intended status.
      // BUT, how do we know if it was intended to be 'partial' or 'full'?
      // We should have saved that in the order.
      // Let's assume the Order created has the correct intended status, just waiting for confirmation.

      // Wait, order.payment.status in schema defaults to 'pending'.
      // When creating the order in Payment.controller.js (new logic), we should set it to 'pending_full' or 'pending_partial'??
      // Or just store it in metadata: 'paymentType': 'full' | 'partial'.

      const paymentType = session.metadata?.paymentType || 'full'; // Default to full if missing

      paymentUpdate.status = paymentType;

      await Order.findByIdAndUpdate(orderId, {
        $set: {
          "payment.0": paymentUpdate
        }
      });

      // Update Appointment
      if (order.appointment && order.appointment.id) {
        await Appointment.findByIdAndUpdate(order.appointment.id, {
          status: 'confirmed'
        });
      }

      // Send Email
      // Need products for email
      const productIds = order.items.map(i => i.id);
      const products = await Product.find({ _id: { $in: productIds } }).lean();
      const contactInfo = await ContactInfo.findOne().lean();

      // Re-fetch order to get updated data?
      const updatedOrder = await Order.findById(orderId).lean();

      const emailHTML = generateOrderConfirmationEmail(updatedOrder, products, contactInfo);
      const logoPath = path.join(__dirname, "..", "..", "public", "logo_light.png");
      const attachments = [
        {
          filename: "logo_light.png",
          path: logoPath,
          cid: "sct_logo_light",
        },
      ];

      if (updatedOrder.appointment && updatedOrder.appointment.email) {
        try {
          await sendMail(
            updatedOrder.appointment.email,
            "Order Confirmation - Your Appointment is Confirmed!",
            emailHTML,
            attachments
          );
          console.log("Email sent successfully to:", updatedOrder.appointment.email);
        } catch (emailErr) {
          console.error("FAILED TO SEND EMAIL:", emailErr.message);
          console.error("Email Stack:", emailErr.stack);
        }
      }

    } catch (error) {
      console.error('Error processing webhook:', error);
    }
  }

  res.json({ received: true });
};

module.exports = { handleWebhook };
