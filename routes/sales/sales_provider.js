const express = require("express");
const sales_routes = require("./sales.routes");
const sales_provider = express.Router();

sales_provider.use("/", sales_routes);

module.exports = sales_provider;
