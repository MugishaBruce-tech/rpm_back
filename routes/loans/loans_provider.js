const express = require("express");
const loans_routes = require("./loans.routes");
const loans_provider = express.Router();

loans_provider.use("/", loans_routes);

module.exports = loans_provider;
