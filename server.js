const express = require("express");
// Triggering nodemon restart for metadata sync
const http = require("http");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const passport = require("./config/passport");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

// Environment Variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8082;
const auditLogger = require("./middleware/auditLogger");
const { globalLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Required if sharing resources like images across domains
}));
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  process.env.VITE_FRONT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow if origin is in list, or is missing (like local requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS Blocked for origin:', origin);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(passport.initialize());
app.use(auditLogger); // Global logging (will only log authenticated actions via req.user)
app.use(globalLimiter); // Protect API from general abuse
app.use("/public", express.static(path.join(__dirname, "public")));

// Constants
const RESPONSE_CODES = require("./constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("./constants/RESPONSE_STATUS");

// Database
const sequelize = require("./utils/sequelize");

// Route Providers
const auth_provider = require("./routes/auth/auth_provider");
const inventory_provider = require("./routes/inventory/inventory_provider");
const sales_provider = require("./routes/sales/sales_provider");
const loans_provider = require("./routes/loans/loans_provider");
const user_provider = require("./routes/user/user_provider");
const dashboard_provider = require("./routes/dashboard/dashboard_provider");
const audit_provider = require("./routes/audit/audit_provider");
const sync_provider = require("./routes/sync/sync_provider");
const external_distributors_provider = require("./routes/external_distributors/external_distributors_provider");

// Base Route
app.get("/", (req, res) => {
  res.json({ message: "RPM Tracker API is running" });
});

// Calling Routes
app.use("/auth", auth_provider);
app.use("/inventory", inventory_provider);
app.use("/sales", sales_provider);
app.use("/loans", loans_provider);
app.use("/user", user_provider);
app.use("/dashboard", dashboard_provider);
app.use("/audit", audit_provider);
app.use("/sync", sync_provider);
app.use("/external-distributors", external_distributors_provider);

// 404 handler
app.all("*", (req, res) => {
  res.status(RESPONSE_CODES.NOT_FOUND).json({
    statusCode: RESPONSE_CODES.NOT_FOUND,
    httpStatus: RESPONSE_STATUS.NOT_FOUND,
    message: "Route not found",
  });
});

// Global error handler (must be last!)
app.use(errorHandler);

const server = http.createServer(app);

// Sync and Start
sequelize.syncDatabase().then(() => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
});
