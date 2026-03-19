const express = require("express");
const audit_routes = require("./audit.routes");
const audit_provider = express.Router();

audit_provider.use("/", audit_routes);

module.exports = audit_provider;
