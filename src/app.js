const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const ProductRoute = require("./Routes/Product.route");
const AdminRoute = require("./Routes/Admin.route");
const AppointmentRoute = require("./Routes/Appointment.route");
const HolidayRoute = require("./Routes/Holiday.route");
const TimeSlotRoute = require("./Routes/TimeSlot.route");
const TechnicianRoute = require("./Routes/Technician.route");
const ContactRoute = require("./Routes/Contact.route");
const OrderRoute = require("./Routes/Order.route");
const BlogRoute = require("./Routes/Blog.route");
const BrandRoute = require("./Routes/Brand.route");
const PaymentRoute = require("./Routes/Payment.route");
const MasterFilterRoute = require("./Routes/MasterFilter.route");
const GoogleRoute = require("./Routes/GoogleRoute.route");
const BannerRoute = require("./Routes/Banner.route");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/v1/product", ProductRoute);
app.use("/api/v1/admin", AdminRoute);
app.use("/api/v1/appointment", AppointmentRoute);
app.use("/api/v1/holiday", HolidayRoute);
app.use("/api/v1/timeslot", TimeSlotRoute);
app.use("/api/v1/technician", TechnicianRoute);
app.use("/api/v1/contact", ContactRoute);
app.use("/api/v1/order", OrderRoute);
app.use("/api/v1/blog", BlogRoute);
app.use("/api/v1/brand", BrandRoute);
app.use("/api/payment", PaymentRoute);
app.use("/api/v1/masterFilter", MasterFilterRoute);
app.use("/api/v1/google", GoogleRoute);
app.use("/api/v1/banner", BannerRoute);

module.exports = app;
