const express = require("express");
const {
  createMasterFilter,
  updateMasterFilter,
  getAllMasterFilters,
  deleteMasterFilter,
} = require("../Controllers/MasterFilter.controller");
const MasterFilterRoute = express.Router();

MasterFilterRoute.post("/", createMasterFilter);
MasterFilterRoute.get("/", getAllMasterFilters);
MasterFilterRoute.patch("/:id", updateMasterFilter);
MasterFilterRoute.delete("/:id", deleteMasterFilter);

module.exports = MasterFilterRoute;