const express = require("express");
const AppointmentRoute = express.Router();
const {
  getAllAppointments,
  getAvailableSlots,
  createAppointment,
} = require("../Controllers/Appointment.controller");

AppointmentRoute.get("/", getAllAppointments);
AppointmentRoute.get("/slots", getAvailableSlots);
AppointmentRoute.post("/", createAppointment);

module.exports = AppointmentRoute;
