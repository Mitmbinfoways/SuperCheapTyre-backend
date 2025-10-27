const express = require("express");
const BannerRoute = express.Router();
const {
  getAllBanners,
  createBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImages
} = require("../Controllers/Banner.controller");


// Routes for banner management
BannerRoute.get("/", getAllBanners);
BannerRoute.post("/", uploadBannerImages.fields([
  { name: 'laptopImage', maxCount: 10 },
  { name: 'mobileImage', maxCount: 10 }
]), createBanners);
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