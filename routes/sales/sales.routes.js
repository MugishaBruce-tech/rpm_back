const express = require("express");
const sales_controller = require("../../controllers/sales/sales.controller");
const requireAuth = require("../../middleware/requireAuth");
const sales_routes = express.Router();

const authorize = require("../../middleware/authorize");
sales_routes.get("/", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), sales_controller.getSales);
sales_routes.post("/", requireAuth, sales_controller.addSale);

module.exports = sales_routes;
