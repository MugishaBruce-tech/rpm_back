const express = require("express");
const inventory_controller = require("../../controllers/inventory/inventory.controller");
const requireAuth = require("../../middleware/requireAuth");
const authorize = require("../../middleware/authorize");
const inventory_routes = express.Router();

// General view of stock (Global for MD/OPCO, Regional for DDM, Self for SUB_D)
inventory_routes.get("/", requireAuth, authorize(['STOCK_VIEW_GLOBAL', 'STOCK_VIEW_REGIONAL', 'STOCK_VIEW_SELF']), inventory_controller.getInventory);

// Material list is generally read-only for anyone authenticated
inventory_routes.get("/materials", requireAuth, inventory_controller.getMaterials);

// Distribution breakdown by partner
inventory_routes.get("/distribution", requireAuth, authorize(['STOCK_VIEW_GLOBAL', 'STOCK_VIEW_REGIONAL']), inventory_controller.getInventoryDistribution);

// Stock adjustment (Global for MD, Self for SUB_D)
inventory_routes.post("/adjust", requireAuth, authorize(['STOCK_ADJUST_GLOBAL', 'STOCK_EDIT_SELF']), inventory_controller.adjustStock);

module.exports = inventory_routes;
