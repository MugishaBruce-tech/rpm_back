const express = require("express");
const loans_controller = require("../../controllers/loans/loans.controller");
const requireAuth = require("../../middleware/requireAuth");
const authorize = require("../../middleware/authorize");
const loans_routes = express.Router();

// Get loans (Global for MD/OPCO, Regional for DDM, Self for SUB_D)
loans_routes.get("/", requireAuth, authorize(['LOAN_VIEW_GLOBAL', 'LOAN_VIEW_REGIONAL', 'LOAN_VIEW_SELF']), loans_controller.getLoans);

// Create loan (restricted to self-create usually or admin-on-behalf)
loans_routes.post("/", requireAuth, authorize(['LOAN_REQUEST_SELF', 'LOAN_MANAGE_ALL', 'LOAN_MANAGE_REGION']), loans_controller.createLoan);

// Update status (Approval/Denial)
loans_routes.patch("/:id/status", requireAuth, authorize(['LOAN_MANAGE_SELF', 'LOAN_MANAGE_ALL', 'LOAN_MANAGE_REGION']), loans_controller.updateLoanStatus);

module.exports = loans_routes;
