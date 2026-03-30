const AuditLog = require("../models/AuditLog");

const auditLogger = async (req, res, next) => {
  const method = req.method;
  const path = req.originalUrl;
  
  // Filter out technical noise (assets, internal status checks, etc.)
  const isTechnicalNoise = 
    path.startsWith("/public") || 
    path.includes("favicon") || 
    path === "/";
    
  if (isTechnicalNoise) return next();

  // We log all mutations (POST, PUT, DELETE, PATCH)
  // And meaningful GET requests (viewing data)
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
  
  // Define what GET requests are "meaningful" to avoid bloating the logs
  const isMeaningfulGet = 
    method === "GET" && (
      path.startsWith("/inventory") || 
      path.startsWith("/loans") || 
      path.startsWith("/user/list") || 
      path.startsWith("/audit") || 
      path.startsWith("/dashboard") ||
      path.includes("/auth/profile")
    );

  if (!isMutation && !isMeaningfulGet) {
    return next();
  }

  // Generate a human-readable action message
  const getHumanAction = (method, path) => {
    // Auth mapping
    if (path.includes("/auth/login")) return "Requested login credentials (OTP)";
    if (path.includes("/auth/verify-otp")) return "Logged into the system";
    if (path.includes("/auth/mfa/verify")) return "Verified MFA security";
    if (path.includes("/auth/logout")) return "Logged out of the system";
    if (path.includes("/auth/google/callback")) return "Logged in via Google";
    
    if (path.startsWith("/user")) {
      if (method === "POST") return "Created a new user";
      if (method === "PUT") return "Updated user information";
      if (method === "DELETE") return "Deleted a user record";
      return "Viewed user directory";
    }
    
    if (path.startsWith("/inventory")) {
      if (method === "POST") return "Adjusted stock levels";
      if (path.includes("/materials")) return "Viewed materials inventory list";
      if (path.includes("/distribution")) return "Viewed regional inventory distribution";
      return "Viewed stock inventory";
    }

    if (path.startsWith("/loans")) {
      if (method === "POST") return "Created a loan request";
      if (method === "PUT") return "Modified loan/transfer status";
      if (path.includes("/history")) return "Viewed loan transaction history";
      return "Viewed loans and transfers";
    }

    if (path.startsWith("/dashboard")) return "Viewed dashboard analytics";
    if (path.startsWith("/audit")) return "Accessed system audit logs";
    if (path.startsWith("/sales")) return "Recorded a sales transaction";

    // Fallback
    const cleanPath = path.split('?')[0];
    return `${method} action on ${cleanPath}`;
  };

  res.on("finish", () => {
    // Fire-and-forget: Don't await, don't block the connection pool
    // The response has already been sent to client, so audit logging can happen asynchronously
    if (req.user) {
      setImmediate(async () => {
        try {
          const finalAction = req.audit_info || getHumanAction(method, path);
          
          await AuditLog.create({
            business_partner_key: req.user.business_partner_key,
            action: finalAction,
            method: method,
            path: path,
            payload: isMutation ? JSON.stringify(req.body) : null,
            ip_address: req.ip || req.connection.remoteAddress,
            status_code: res.statusCode,
          });
        } catch (err) {
          console.error("Audit log error:", err.message);
        }
      });
    }
  });

  next();
};

module.exports = auditLogger;
