const express = require("express");
const {
  deleteTechnician,
  getAllTechnician,
  createTechnician,
} = require("../Controllers/Technician.controller");
const TechnicianRoute = express.Router();

TechnicianRoute.get("/", getAllTechnician);
TechnicianRoute.post("/", createTechnician);
TechnicianRoute.delete("/:id", deleteTechnician);

module.exports = TechnicianRoute;
