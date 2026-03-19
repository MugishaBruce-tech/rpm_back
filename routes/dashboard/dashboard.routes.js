const express = require("express");
const dashboard_controller = require("../../controllers/dashboard/dashboard.controller");
const requireAuth = require("../../middleware/requireAuth");
const authorize = require("../../middleware/authorize");
const dashboard_routes = express.Router();

dashboard_routes.get("/stats", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), dashboard_controller.getDashboardStats);
dashboard_routes.get("/activity", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), dashboard_controller.getActivityTrend);
dashboard_routes.get("/regions", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), dashboard_controller.getRegions);
dashboard_routes.get("/users-by-region", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), dashboard_controller.getUsersByRegion);
dashboard_routes.get("/users-by-channel", requireAuth, authorize(['DASHBOARD_GLOBAL_VIEW', 'DASHBOARD_REGIONAL_VIEW', 'DASHBOARD_SELF_VIEW']), dashboard_controller.getUsersByChannel);

module.exports = dashboard_routes;
