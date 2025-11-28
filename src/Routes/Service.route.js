const express = require("express");
const ServiceRoute = express.Router();
const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  uploadServiceImages,
} = require("../Controllers/Service.controller");

ServiceRoute.get("/", getAllServices);
ServiceRoute.get("/:id", getServiceById);
ServiceRoute.post("/", uploadServiceImages.array("images", 5), createService);
ServiceRoute.patch("/:id", uploadServiceImages.array("images", 5), updateService);
ServiceRoute.delete("/:id", deleteService);

module.exports = ServiceRoute;
