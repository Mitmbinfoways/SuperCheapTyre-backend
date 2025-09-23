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

// Robust CORS configuration with allowlist and preflight handling
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.ADMIN_URL,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  // Allow any Vercel preview/prod subdomain
  /\.vercel\.app$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or curl (no origin)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some((allowed) => {
      if (!allowed) return false;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
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
