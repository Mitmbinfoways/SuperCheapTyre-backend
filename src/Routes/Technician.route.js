const express = require("express");
const {
  deleteTechnician,
  getAllTechnician,
  createTechnician,
  updateTechnician,
} = require("../Controllers/Technician.controller");
const TechnicianRoute = express.Router();

TechnicianRoute.get("/", getAllTechnician);
TechnicianRoute.post("/", createTechnician);
TechnicianRoute.patch("/", updateTechnician);
TechnicianRoute.delete("/:id", deleteTechnician);

module.exports = TechnicianRoute;
