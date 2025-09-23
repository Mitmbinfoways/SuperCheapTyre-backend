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

const cors = require("cors");

const allowedOrigins = [
  "https://super-cheap-tyre-admin-5gnixgjzt-mitmbinfoways-projects.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser tools
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Important: handle preflight
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));

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

module.exports = app;
