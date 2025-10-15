const express = require("express");
const {
  updateMasterFilter,
  getAllMasterFilters,
  deleteMasterFilter,
} = require("../Controllers/MasterFilter.controller");
const MasterFilterRoute = express.Router();

MasterFilterRoute.get("/", getAllMasterFilters);
MasterFilterRoute.patch("/:id", updateMasterFilter);
MasterFilterRoute.delete("/:id", deleteMasterFilter);

module.exports = MasterFilterRoute;
