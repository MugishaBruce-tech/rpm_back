const jwt = require("jsonwebtoken");
const BusinessPartner = require("../models/BusinessPartner");
const Profil = require("../models/Profil");
const Permission = require("../models/Permission");
const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

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

      const user = await BusinessPartner.findOne({
        where: { business_partner_key: decoded.business_partner_key, business_partner_status: "active" },
        include: [
          { 
            model: Profil, 
            as: "profil",
            include: [{ model: Permission, as: "permissions" }]
          }
        ],
      });

      if (!user) {
        return res.status(RESPONSE_CODES.UNAUTHORIZED).json({
          statusCode: RESPONSE_CODES.UNAUTHORIZED,
          httpStatus: RESPONSE_STATUS.UNAUTHORIZED,
          message: "User not found or inactive",
        });
      }

      req.user = user.toJSON();
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
