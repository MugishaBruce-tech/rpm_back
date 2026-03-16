const express = require("express");
const inventory_routes = require("./inventory.routes");
const inventory_provider = express.Router();

inventory_provider.use("/", inventory_routes);

module.exports = inventory_provider;
