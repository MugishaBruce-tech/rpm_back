const express = require("express");
const auth_routes = require("./auth.routes");
const auth_provider = express.Router();

auth_provider.use("/", auth_routes);

module.exports = auth_provider;
