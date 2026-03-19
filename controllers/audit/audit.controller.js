const AuditLog = require("../../models/AuditLog");
const BusinessPartner = require("../../models/BusinessPartner");
const Profil = require("../../models/Profil");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const { Op } = require("sequelize");

const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { startDate, endDate, userKey, region } = req.query;
    
    // Build filter conditions
    const where = {
      [Op.or]: [
        { method: { [Op.in]: ["POST", "PUT", "PATCH", "DELETE"] } },
        { path: { [Op.like]: "%export%" } },
        { action: { [Op.like]: "%Export%" } },
        { action: { [Op.like]: "%Login%" } },
        { action: { [Op.like]: "%Logged in%" } }
      ]
    };
    const userWhere = {};
    
    // Filter out simple views that might still be POST (if any)
    where[Op.and] = [
       { action: { [Op.notLike]: "Viewed%" } }
    ];

    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate + " 23:59:59")]
      };
    } else if (startDate) {
      where.created_at = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.created_at = { [Op.lte]: new Date(endDate + " 23:59:59") };
    }

    if (userKey) {
      where.business_partner_key = userKey;
    }

    if (region) {
      userWhere.region = region;
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: BusinessPartner,
          as: "user",
          attributes: ["business_partner_name", "user_ad", "region"],
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined,
          required: Object.keys(userWhere).length > 0, // Inner join if filtering by region
          include: [{ model: Profil, as: "profil", attributes: ["CODE_PROFIL"] }],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    const totalPages = Math.ceil(count / limit);

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: {
        logs: rows,
        pagination: {
          total: count,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get Audit Logs Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

module.exports = { getAuditLogs };
