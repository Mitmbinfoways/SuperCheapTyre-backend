const express = require("express");
const path = require("path");
const multer = require("multer");
const BrandRoute = express.Router();
const {
  getAllBrands,
  createBrand,
  deleteBrand,
  getBrandById,
  updateBrand,
} = require("../Controllers/Brand.controller");

// Multer setup for brand images
const brandStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/Brand"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "brand-" + uniqueSuffix + ext);
  },
});

const uploadBrandImage = multer({ storage: brandStorage });

BrandRoute.get("/", getAllBrands);
BrandRoute.get("/:id", getBrandById);
BrandRoute.post("/", uploadBrandImage.single("image"), createBrand);
BrandRoute.patch("/:id", uploadBrandImage.single("image"), updateBrand);
BrandRoute.delete("/:id", deleteBrand);

module.exports = BrandRoute;