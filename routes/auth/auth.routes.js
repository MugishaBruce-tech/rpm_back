const express = require("express");
const passport = require("passport");
const auth_controller = require("../../controllers/auth/auth.controller");
const requireAuth = require("../../middleware/requireAuth");
const { authLimiter } = require("../../middleware/rateLimiter");
const validate = require("../../middleware/validate");
const { loginSchema, otpSchema, mfaVerifySchema } = require("../../schemas/auth.schema");
const auth_routes = express.Router();

auth_routes.post("/login", authLimiter, validate(loginSchema), auth_controller.login);
// public distributor list (used by frontend before login)
const authorize = require("../../middleware/authorize");
auth_routes.get("/distributors", requireAuth, authorize(['USER_VIEW_ALL', 'USER_VIEW_REGION']), auth_controller.listDistributors);
auth_routes.post("/logout", requireAuth, auth_controller.logout);
auth_routes.get("/profile", requireAuth, auth_controller.getProfile);

// Google OAuth
auth_routes.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
auth_routes.get("/google/callback", passport.authenticate("google", { session: false }), auth_controller.googleCallback);

// MFA
auth_routes.get("/mfa/setup", requireAuth, auth_controller.setupMFA);
auth_routes.post("/mfa/verify", authLimiter, validate(mfaVerifySchema), auth_controller.verifyMFA);
auth_routes.post("/verify-otp", authLimiter, validate(otpSchema), auth_controller.verifyEmailOTP);
auth_routes.post("/resend-otp", authLimiter, auth_controller.resendOTP);

// DEBUG: Test email connection (remove in production)
auth_routes.get("/debug/test-mail", async (req, res) => {
  try {
    const mailService = require("../../services/mail.service");
    console.log("[DEBUG] Testing mail connection...");
    const result = await mailService.testConnection();
    res.status(200).json({ success: true, message: result });
  } catch (error) {
    console.error("[DEBUG] Mail connection test failed:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code,
      response: error.response 
    });
  }
});

module.exports = auth_routes;
