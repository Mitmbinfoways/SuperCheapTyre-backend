const express = require("express");
const TimeSlotRoute = express.Router();
const {
  getAllTimeSlots,
  getTimeSlotById,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
} = require("../Controllers/TimeSlot.controller");

TimeSlotRoute.get("/", getAllTimeSlots);
TimeSlotRoute.get("/:id", getTimeSlotById); 
TimeSlotRoute.post("/", createTimeSlot);
TimeSlotRoute.patch("/:id", updateTimeSlot);
TimeSlotRoute.delete("/:id", deleteTimeSlot);

module.exports = TimeSlotRoute;
