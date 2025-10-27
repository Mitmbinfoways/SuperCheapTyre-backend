const express = require("express");
const BannerRoute = express.Router();
const {
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImages
} = require("../Controllers/Banner.controller");


BannerRoute.get("/", getAllBanners);
BannerRoute.post("/single", uploadBannerImages.fields([
  { name: 'laptopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), createBanner);
BannerRoute.patch("/:id", uploadBannerImages.fields([
  { name: 'laptopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), updateBanner);
BannerRoute.delete("/:id", deleteBanner);

module.exports = BannerRoute;