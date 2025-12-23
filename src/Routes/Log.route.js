const express = require("express");
const { getLogs, createManualLog } = require("../Controllers/Log.controller");

const LogRoute = express.Router();

LogRoute.get("/", getLogs);
LogRoute.post("/", createManualLog);

module.exports = LogRoute;
