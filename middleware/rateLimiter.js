const rateLimit = require("express-rate-limit");
const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

/**
 * General API Limiter:
 * Prevents overall server abuse by limiting common requests.
 * 100 requests every 15 minutes per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    statusCode: RESPONSE_CODES.TOO_MANY_REQUESTS || 429,
    httpStatus: RESPONSE_STATUS.TOO_MANY_REQUESTS || "Too Many Requests",
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});

/**
 * Strict Auth Limiter:
 * Designed for login, register, and OTP verification endpoints.
 * Very strict to prevent brute-force password/code guessing.
 * 5 attempts every 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: RESPONSE_CODES.TOO_MANY_REQUESTS || 429,
    httpStatus: RESPONSE_STATUS.TOO_MANY_REQUESTS || "Too Many Requests",
    message: "Too many login/verification attempts. Please try again after 15 minutes for security.",
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
};
