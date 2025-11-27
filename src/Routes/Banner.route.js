const express = require("express");
const BannerRoute = express.Router();
const {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  uploadBannerImages,
  updateBannerSequence
} = require("../Controllers/Banner.controller");


BannerRoute.get("/", getAllBanners);
BannerRoute.get("/:id", getBannerById);
BannerRoute.post("/single", uploadBannerImages.fields([
  { name: 'laptopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), createBanner);
BannerRoute.patch("/:id", uploadBannerImages.fields([
  { name: 'laptopImage', maxCount: 1 },
  { name: 'mobileImage', maxCount: 1 }
]), updateBanner);
BannerRoute.delete("/:id", deleteBanner);
BannerRoute.put("/sequence", updateBannerSequence);

module.exports = BannerRoute;