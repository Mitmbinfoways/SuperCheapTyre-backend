const express = require("express");
const AppointmentRoute = express.Router();
const {
  getAllAppointments,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
  getAppointmentById,
} = require("../Controllers/Appointment.controller");

AppointmentRoute.get("/", getAllAppointments);
AppointmentRoute.get("/slots", getAvailableSlots);
AppointmentRoute.get("/:id", getAppointmentById);
AppointmentRoute.post("/", createAppointment);
AppointmentRoute.patch("/:id", updateAppointment);

module.exports = AppointmentRoute;
