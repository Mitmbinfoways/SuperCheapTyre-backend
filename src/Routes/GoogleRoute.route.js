const express = require("express");
const { GoogleReview } = require("../Controllers/Google.controller");

const GoogleRoute = express.Router();

GoogleRoute.get("/", GoogleReview);

module.exports = GoogleRoute;