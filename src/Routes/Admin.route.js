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
} = require("../Controllers/Admin.controller");
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
AdminRoute.patch("/update",upload.single("avatar"), UpdateProfile);
AdminRoute.get("/:id", GetAdminById);

module.exports = AdminRoute;
