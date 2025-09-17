const express = require("express");
const HolidayRoute = express.Router();
const {
  createHoliday,
  getHolidays,
  deleteHoliday,
} = require("../Controllers/Holiday.controller");

HolidayRoute.post("/", createHoliday);
HolidayRoute.get("/", getHolidays);
HolidayRoute.delete("/:id", deleteHoliday);

module.exports = HolidayRoute;