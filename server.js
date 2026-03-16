const express = require("express");
const http = require("http");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const passport = require("./config/passport");

// Environment Variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8082;

// Middleware
const allowedOrigins = [
  "http://localhost:5173"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(passport.initialize());
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

// 404 handler
app.all("*", (req, res) => {
  res.status(RESPONSE_CODES.NOT_FOUND).json({
    statusCode: RESPONSE_CODES.NOT_FOUND,
    httpStatus: RESPONSE_STATUS.NOT_FOUND,
    message: "Route not found",
  });
});

const server = http.createServer(app);

// Sync and Start
sequelize.syncDatabase().then(() => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
});
