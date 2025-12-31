const express = require("express");
const path = require("path");
const multer = require("multer");
const {
  RegiesterAdmin,
  AdminLogin,
  RequestReset,
  ForgotPassword,
  UpdateProfile,
  GetAdminById,
  Setup2FA,
  Verify2FASetup,
  Verify2FALogin,
  Disable2FA,
} = require("../Controllers/Admin.controller");
const VerifyAdmin = require("../Middlewares/Auth.middleware");
const AdminRoute = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/AdminProfile"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

AdminRoute.post("/regiester", upload.single("avatar"), RegiesterAdmin);
AdminRoute.post("/login", AdminLogin);
AdminRoute.post("/request-reset", RequestReset);
AdminRoute.post("/forgot-password", ForgotPassword);
AdminRoute.patch("/update", upload.single("avatar"), UpdateProfile);
AdminRoute.get("/:id", GetAdminById);

// 2FA Routes
AdminRoute.post("/2fa/setup", VerifyAdmin, Setup2FA);
AdminRoute.post("/2fa/verify-setup", VerifyAdmin, Verify2FASetup);
AdminRoute.post("/2fa/verify-login", Verify2FALogin);
AdminRoute.post("/2fa/disable", VerifyAdmin, Disable2FA);

module.exports = AdminRoute;
