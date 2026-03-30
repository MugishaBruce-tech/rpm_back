const jwt = require("jsonwebtoken");
const BusinessPartner = require("../models/BusinessPartner");
const BrarudiUser = require("../models/BrarudiUser");
const Profil = require("../models/Profil");
const Permission = require("../models/Permission");
const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

const requireAuth = async (req, res, next) => {
  try {
    // 1. Try to get token from cookies (Our new secure way)
    // 2. Fallback to Authorization header (For backward compatibility / legacy)
    const token = req.cookies?.accessToken || 
                 (req.headers.authorization && req.headers.authorization.split(" ")[1]);

    if (!token) {
      return res.status(RESPONSE_CODES.UNAUTHORIZED).json({
        statusCode: RESPONSE_CODES.UNAUTHORIZED,
        httpStatus: RESPONSE_STATUS.UNAUTHORIZED,
        message: "Access token missing",
      });
    }

    jwt.verify(token, process.env.JWT_PRIVATE_KEY, async (err, decoded) => {
      if (err) {
        return res.status(RESPONSE_CODES.FORBIDDEN).json({
          statusCode: RESPONSE_CODES.FORBIDDEN,
          httpStatus: RESPONSE_STATUS.FORBIDDEN,
          message: "Invalid or expired token",
        });
      }

      const { userId, is_internal, business_partner_key } = decoded;
      
      let user;
      const finalUserId = userId || business_partner_key;
      const isInternal = is_internal === true || is_internal === 'true';

      try {
        if (isInternal) {
          user = await BrarudiUser.findOne({
            where: { id: finalUserId, status: "active" },
            include: [{ 
              model: Profil, 
              as: "profil",
              include: [{ model: Permission, as: "permissions" }]
            }],
            raw: false,
            logging: false,
          });
        } else {
          user = await BusinessPartner.findOne({
            where: { business_partner_key: finalUserId, business_partner_status: "active" },
            include: [{ 
              model: Profil, 
              as: "profil",
              include: [{ model: Permission, as: "permissions" }]
            }],
            raw: false,
            logging: false,
          });
        }
      } catch (dbErr) {
        console.error("Database query timeout in requireAuth:", dbErr.message);
        return res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
          statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
          httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
          message: "Database connection error. Please try again.",
        });
      }

      if (!user) {
        return res.status(RESPONSE_CODES.UNAUTHORIZED).json({
          statusCode: RESPONSE_CODES.UNAUTHORIZED,
          httpStatus: RESPONSE_STATUS.UNAUTHORIZED,
          message: "User not found or inactive",
        });
      }

      req.user = { ...user.toJSON(), is_internal: isInternal, userId: finalUserId };
      next();
    });
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Authentication error",
    });
  }
};

module.exports = requireAuth;
