const express = require("express");
const dashboard_routes = require("./dashboard.routes");
const dashboard_provider = express.Router();

dashboard_provider.use("/", dashboard_routes);

module.exports = dashboard_provider;
