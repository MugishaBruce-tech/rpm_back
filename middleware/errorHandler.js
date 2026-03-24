const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

/**
 * Global Error Handling Middleware:
 * This should be the LAST middleware added to server.js.
 * It catches any error that was thrown (or passed via next(err))
 * and returns a generic response instead of exposing internal details.
 */
const errorHandler = (err, req, res, next) => {
  // 1. Log the full error on the server for developers to see
  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.error(err.stack || err.message);

  // 2. Determine the status code (default to 500)
  const statusCode = err.statusCode || RESPONSE_CODES.INTERNAL_SERVER_ERROR;
  const httpStatus = err.httpStatus || RESPONSE_STATUS.INTERNAL_SERVER_ERROR;

  // 3. Return a clean, user-friendly response
  // We NEVER send err.stack to the client in production.
  res.status(statusCode).json({
    statusCode,
    httpStatus,
    message: process.env.NODE_ENV === "production" 
      ? "An unexpected error occurred. Our team has been notified." 
      : err.message || "Internal server error",
    // We add more details ONLY if NOT in production
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
};

module.exports = errorHandler;
