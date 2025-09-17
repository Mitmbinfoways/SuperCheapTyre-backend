const express = require("express");
const TimeSlotRoute = express.Router();
const {
  getAllTimeSlots,
  getTimeSlotById,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getTimeSlotSlots,
} = require("../Controllers/TimeSlot.controller");

TimeSlotRoute.get("/", getAllTimeSlots);
TimeSlotRoute.post("/", createTimeSlot);
TimeSlotRoute.put("/", updateTimeSlot);
TimeSlotRoute.delete("/:id", deleteTimeSlot);

module.exports = TimeSlotRoute;
