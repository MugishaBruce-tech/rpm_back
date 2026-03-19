const express = require("express");
const audit_controller = require("../../controllers/audit/audit.controller");
const requireAuth = require("../../middleware/requireAuth");
const authorize = require("../../middleware/authorize");
const audit_routes = express.Router();

// Only those with AUDIT_VIEW (MD_AGENT by default) can see these
audit_routes.get("/list", requireAuth, authorize('AUDIT_VIEW'), audit_controller.getAuditLogs);

module.exports = audit_routes;
