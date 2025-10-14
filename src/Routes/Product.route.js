const express = require("express");
const path = require("path");
const multer = require("multer");
const ProductRoute = express.Router();
const {
  getAllProducts,
  CreateProduct,
  DeleteProduct,
  DashboardCount,
  UpdateProduct,
  getProductById,
  HomeData,
  getSimilarProducts,
} = require("../Controllers/Product.controller");

// Multer setup for product images
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../../public/Product"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "image-" + uniqueSuffix + ext);
  },
});

const uploadProductImages = multer({ storage: productStorage });

ProductRoute.get("/dashboard" ,DashboardCount)
ProductRoute.get("/homedata" ,HomeData)
ProductRoute.get("/", getAllProducts);
ProductRoute.get("/:id", getProductById);
ProductRoute.get("/:id/similar", getSimilarProducts);
ProductRoute.post("/", uploadProductImages.array("images", 5), CreateProduct);
ProductRoute.patch("/:id", uploadProductImages.array("images", 5), UpdateProduct);
ProductRoute.delete("/:id", DeleteProduct);

module.exports = ProductRoute;
