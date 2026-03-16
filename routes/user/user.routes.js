const express = require("express");
const user_controller = require("../../controllers/user/user.controller");
const requireAuth = require("../../middleware/requireAuth");
const authorize = require("../../middleware/authorize");
const user_routes = express.Router();

// OPCO_USER, MD_AGENT can see all users (filtered by region for DDM)
user_routes.get("/list", requireAuth, authorize(['USER_VIEW_ALL', 'USER_VIEW_REGION']), user_controller.getUsers);

user_routes.get("/:id/logs", requireAuth, authorize(['USER_EDIT_ALL', 'USER_EDIT_REGION']), user_controller.getUserLogs);

// Metadata needed for user creation forms
user_routes.get("/metadata", requireAuth, authorize(['USER_CREATE_ALL', 'USER_CREATE_REGION']), user_controller.getMetadata);

// Management routes
user_routes.post("/create", requireAuth, authorize(['USER_CREATE_ALL', 'USER_CREATE_REGION']), user_controller.createUser);
user_routes.put("/:id", requireAuth, authorize(['USER_EDIT_ALL', 'USER_EDIT_REGION']), user_controller.updateUser);
user_routes.delete("/:id", requireAuth, authorize(['USER_DELETE_ALL', 'USER_DELETE_REGION']), user_controller.deleteUser);

module.exports = user_routes;
