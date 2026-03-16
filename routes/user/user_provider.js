const express = require("express");
const user_routes = require("./user.routes");
const user_provider = express.Router();

user_provider.use("/", user_routes);

module.exports = user_provider;
