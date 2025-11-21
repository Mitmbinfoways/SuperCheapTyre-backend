const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const payment = async (req, res) => {
  try {
    const { Product } = req.body;

    console.log("run");

    if (!Product || !Array.isArray(Product) || Product.length === 0) {
      return res.status(400).json({ error: "Invalid product data" });
    }

    const lineItems = Product.map((product) => {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
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
    });
  } catch (error) {
    console.error("Payment error:", error);
    res
      .status(500)
      .json({ error: error.message || "Payment processing failed" });
  }
};

module.exports = { payment };
