const express = require("express");
const { getAllTaxes, getTaxById, createTax, updateTax, deleteTax } = require("../Controllers/Tax.controller");
const TaxRoute = express.Router();

TaxRoute.get("/", getAllTaxes);
TaxRoute.get("/:id", getTaxById);
TaxRoute.post("/", createTax);
TaxRoute.patch("/:id", updateTax);
TaxRoute.delete("/:id", deleteTax);

module.exports = TaxRoute;
