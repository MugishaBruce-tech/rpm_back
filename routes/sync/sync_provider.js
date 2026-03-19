
const express = require("express");
const router = express.Router();
const SyncController = require("../../controllers/sync/sync.controller");
const requireAuth = require("../../middleware/requireAuth");

router.post("/", requireAuth, SyncController.batchSync);

module.exports = router;
