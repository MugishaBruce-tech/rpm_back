const bcrypt = require("bcrypt");
const crypto = require("crypto");
const BusinessPartner = require("../../models/BusinessPartner");
const BrarudiUser = require("../../models/BrarudiUser");
const BusinessPartnerTokens = require("../../models/BusinessPartnerTokens");
const Profil = require("../../models/Profil");
const LegalEntity = require("../../models/LegalEntity");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const mailService = require("../../services/mail.service");
const { Op } = require("sequelize");

/**
 * Get all users from both tables with pagination and filtering
 */
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const region = req.query.region || '';
    const type = req.query.type || '';
    const status = req.query.status || '';
    const isInternalParam = req.query.is_internal;

    // Build filter conditions for BusinessPartner
    const bpWhere = { ...req.conditions };
    // Build filter conditions for BrarudiUser
    const buWhere = {};

    // Determine which tables to fetch from
    const fetchBP = isInternalParam === undefined || isInternalParam === 'false';
    const fetchBU = isInternalParam === undefined || isInternalParam === 'true';

    // Region filtering:
    if (region) {
      if (!req.conditions.region || req.conditions.region === region) {
        if (fetchBP) bpWhere.region = region;
        if (fetchBU) buWhere.region = region;
      } else {
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }
    } else if (req.conditions.region) {
      if (fetchBP) bpWhere.region = req.conditions.region;
      if (fetchBU) buWhere.region = req.conditions.region;
    }

    if (search) {
      if (fetchBP) {
        bpWhere[Op.or] = [
          { business_partner_name: { [Op.like]: `%${search}%` } },
          { user_ad: { [Op.like]: `%${search}%` } },
        ];
      }
      if (fetchBU) {
        buWhere[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }
    }

    if (type && fetchBP) bpWhere.business_partner_type = type;
    if (status) {
      if (fetchBP) bpWhere.business_partner_status = status;
      if (fetchBU) buWhere.status = status;
    }

    // Fetch from tables
    const [bpData, buData] = await Promise.all([
      fetchBP ? BusinessPartner.findAll({
        where: bpWhere,
        attributes: [
          ['business_partner_key', 'id'],
          ['business_partner_name', 'name'],
          ['user_ad', 'email'],
          'region',
          'business_partner_type',
          'customer_channel',
          ['business_partner_status', 'status'],
          'last_login_at',
          'profil_id',
        ],
        include: [{ model: Profil, as: 'profil', attributes: ['CODE_PROFIL'] }],
      }) : Promise.resolve([]),
      fetchBU ? BrarudiUser.findAll({
        where: buWhere,
        attributes: [
          'id',
          'name',
          'email',
          'region',
          ['status', 'status'],
          'last_login_at',
          'profil_id',
        ],
        include: [{ model: Profil, as: 'profil', attributes: ['CODE_PROFIL'] }],
      }) : Promise.resolve([])
    ]);

    // Format BrarudiUsers to match the UI expectation
    const formattedBU = buData.map(u => ({
      business_partner_key: u.id, // Keep key for UI mapping
      business_partner_name: u.name,
      user_ad: u.email,
      region: u.region,
      business_partner_type: 'INTERNAL',
      customer_channel: 'SYSTEM',
      business_partner_status: u.get('status'),
      last_login_at: u.last_login_at,
      profil_id: u.profil_id,
      profil: u.profil,
      is_internal: true
    }));

    const formattedBP = bpData.map(u => ({
      business_partner_key: u.get('id'),
      business_partner_name: u.get('name'),
      user_ad: u.get('email'),
      region: u.region,
      business_partner_type: u.business_partner_type,
      customer_channel: u.customer_channel,
      business_partner_status: u.get('status'),
      last_login_at: u.last_login_at,
      profil_id: u.profil_id,
      profil: u.profil,
      is_internal: false
    }));

    const allUsers = [...formattedBU, ...formattedBP].sort((a, b) => b.business_partner_key - a.business_partner_key);
    
    const count = allUsers.length;
    const totalPages = Math.ceil(count / limit);
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: {
        users: paginatedUsers,
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
    console.error("Get Users Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Get profiles and legal entities for user creation form
 */
const getMetadata = async (req, res) => {
  try {
    const profils = await Profil.findAll({
      attributes: ['PROFIL_ID', 'CODE_PROFIL']
    });
    const legalEntities = await LegalEntity.findAll();
    const sequelize = require("../../utils/sequelize");

    // Helper to extract ENUM values from DB schema
    const getEnumValues = async (column) => {
      try {
        const [results] = await sequelize.query(`DESCRIBE business_partner ${column}`);
        if (results && results[0] && results[0].Type) {
          const type = results[0].Type;
          const match = type.match(/^enum\((.*)\)$/);
          if (match && match[1]) {
            return match[1].split(',').map(v => v.replace(/'/g, "").trim());
          }
        }
        return [];
      } catch (err) {
        console.error(`Error fetching enum for ${column}:`, err);
        return [];
      }
    };

    // Fetch dynamic values directly from DB schema
    const dbRegions = await getEnumValues('region');
    const dbTypes = await getEnumValues('business_partner_type');
    const dbChannels = await getEnumValues('customer_channel');
    const dbStatuses = await getEnumValues('business_partner_status');

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: { 
        profils, 
        legalEntities,
        regions: dbRegions.length > 0 ? dbRegions : ["North", "South", "West", "Est"],
        businessPartnerTypes: dbTypes.length > 0 ? dbTypes : ["customer", "vendor", "TEST"],
        customerChannels: dbChannels.length > 0 ? dbChannels : ["sub-distributor", "distributor"],
        statuses: dbStatuses.length > 0 ? dbStatuses : ["active", "inactive", "blocked"]
      },
    });
  } catch (error) {
    console.error("Metadata Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Create a new user (BrarudiUser or BusinessPartner)
 */
const createUser = async (req, res) => {
  try {
    const {
      business_partner_name,
      business_partner_type, // 'customer' or 'vendor'
      customer_channel, // 'sub-distributor' or 'distributor'
      user_ad,
      region,
      legal_entity_key,
      profil_id,
    } = req.body;

    if (!business_partner_name || !user_ad) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "Missing required fields",
      });
    }

    // Check if user already exists in either table
    const [existingBP, existingBU] = await Promise.all([
      BusinessPartner.findOne({ where: { user_ad } }),
      BrarudiUser.findOne({ where: { email: user_ad } })
    ]);

    if (existingBP || existingBU) {
      return res.status(RESPONSE_CODES.CONFLICT).json({
        statusCode: RESPONSE_CODES.CONFLICT,
        httpStatus: RESPONSE_STATUS.CONFLICT,
        message: "User already exists",
      });
    }

    // Determine target table and final values
    const selectedProfile = await Profil.findByPk(profil_id);
    if (!selectedProfile) {
      return res.status(RESPONSE_CODES.BAD_REQUEST).json({ message: "Invalid profile ID" });
    }

    const internalProfiles = ['OPCO_USER', 'MD_AGENT', 'DDM'];
    const isInternal = internalProfiles.includes(selectedProfile.CODE_PROFIL);

    // Generate random password
    const generatedPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const currentUserRole = req.user.profil.CODE_PROFIL;
    let finalRegion = region;
    
    // Logic for regions: 
    // - Only DDM has a region. 
    // - MD_AGENT/OPCO_USER have no region (global).
    if (selectedProfile.CODE_PROFIL !== 'DDM' && isInternal) {
      finalRegion = null;
    }

    // If current user is DDM, force region
    if (currentUserRole === "DDM") {
      finalRegion = req.user.region;
    }

    let newUser;
    if (isInternal) {
      newUser = await BrarudiUser.create({
        name: business_partner_name,
        email: user_ad,
        password: hashedPassword,
        region: finalRegion,
        profil_id,
        status: "active",
      });
    } else {
      // For external users (BusinessPartner), also enforce DDM region restriction
      if (currentUserRole === "DDM" && !finalRegion) {
        finalRegion = req.user.region;
      }
      
      newUser = await BusinessPartner.create({
        business_partner_name,
        business_partner_type: business_partner_type || "customer",
        customer_channel: customer_channel || "distributor",
        user_ad,
        password: hashedPassword,
        region: finalRegion || 'North', // Business partners usually need a region
        legal_entity_key: legal_entity_key || 1, // Default or required
        profil_id,
        business_partner_status: "active",
      });
    }

    // Send credentials via email
    mailService.sendWelcomeEmail(
      user_ad, 
      business_partner_name, 
      user_ad, 
      generatedPassword
    ).catch(err => console.error("Could not send welcome email:", err));

    res.status(RESPONSE_CODES.CREATED).json({
      statusCode: RESPONSE_CODES.CREATED,
      httpStatus: RESPONSE_STATUS.CREATED,
      message: "User created successfully",
      result: {
        id: isInternal ? newUser.id : newUser.business_partner_key,
        user_ad: user_ad,
        password: generatedPassword,
      },
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Update an existing business partner (user)
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_internal } = req.query; // Expect is_internal flag in query
    const {
      business_partner_name,
      business_partner_type,
      customer_channel,
      region,
      legal_entity_key,
      profil_id,
      business_partner_status,
      status // For BrarudiUser
    } = req.body;

    if (!id) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        message: "User ID is required",
      });
    }

    let user;
    const isInternal = is_internal === 'true' || is_internal === true;

    // Filter conditions: 
    // If it's internal update, req.conditions.business_partner_key is invalid.
    // We only apply req.conditions if we're not an MD/Admin who has full scope.
    const queryConditions = { ...req.conditions };
    if (isInternal) {
      delete queryConditions.business_partner_key;
    }

    if (isInternal) {
      user = await BrarudiUser.findOne({
        where: { id, ...queryConditions }
      });
    } else {
      user = await BusinessPartner.findOne({ 
        where: { business_partner_key: id, ...queryConditions } 
      });
    }

    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        message: "User not found or access denied",
      });
    }

    // For DDMs, prevent them from changing the region to something else or upgrading profiles
    const currentUserRole = req.user.profil.CODE_PROFIL;
    let finalRegion = region || user.region;
    let finalProfilId = profil_id || user.profil_id;

    if (currentUserRole === "DDM") {
      finalRegion = user.region; // Forbid region change
      finalProfilId = user.profil_id; // Forbid profile change
    }

    if (isInternal) {
      // Logic for regions: only DDM has a region. 
      const selectedProfile = profil_id ? await Profil.findByPk(profil_id) : null;
      const profileCode = selectedProfile ? selectedProfile.CODE_PROFIL : (await user.getProfil())?.CODE_PROFIL;
      
      if (profileCode && profileCode !== 'DDM') {
        finalRegion = null;
      }

      await user.update({
        name: business_partner_name || user.name,
        region: finalRegion,
        profil_id: finalProfilId,
        status: status || business_partner_status || user.status,
      });
    } else {
      // Update fields
      await user.update({
        business_partner_name: business_partner_name || user.business_partner_name,
        business_partner_type: business_partner_type || user.business_partner_type,
        customer_channel: customer_channel || user.customer_channel,
        region: finalRegion,
        legal_entity_key: legal_entity_key || user.legal_entity_key,
        profil_id: finalProfilId,
        business_partner_status: business_partner_status || user.business_partner_status,
      });
    }

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "User updated successfully",
      result: user,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
    });
  }
};

/**
 * Delete a business partner (user)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_internal } = req.query;

    if (!id) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        message: "User ID is required",
      });
    }

    let user;
    const isInternal = is_internal === 'true' || is_internal === true;
    const queryConditions = { ...req.conditions };
    if (isInternal) {
      delete queryConditions.business_partner_key;
    }

    if (isInternal) {
      user = await BrarudiUser.findOne({
        where: { id, ...queryConditions }
      });
    } else {
      user = await BusinessPartner.findOne({ 
        where: { business_partner_key: id, ...queryConditions } 
      });
    }
    
    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        message: "User not found or access denied",
      });
    }

    await user.destroy();

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);

    // Handle foreign key constraint errors
    const dbError = error.original || error;
    if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2' || 
        dbError.errno === 1451 || dbError.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "This partner has active records and cannot be deleted.",
      });
    }

    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Unable to delete this partner. Please try again later.",
    });
  }
};

/**
 * Get user login logs (tracking info)
 */
const getUserLogs = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "User ID is required",
      });
    }

    const logs = await BusinessPartnerTokens.findAll({
      where: { 
        business_partner_key: id,
        // Optional: you could also restrict logs to req.conditions if needed
      },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: logs,
    });
  } catch (error) {
    console.error("Get User Logs Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Get users inactive for 24+ hours (haven't logged in in last 24 hours)
 */
const getInactiveUsers = async (req, res) => {
  try {
    const region = req.query.region || '';
    
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log('[getInactiveUsers] Query at:', new Date());
    console.log('[getInactiveUsers] 24h threshold:', twentyFourHoursAgo);
    console.log('[getInactiveUsers] req.conditions:', req.conditions);
    console.log('[getInactiveUsers] region param:', region);

    // Build filter conditions - only filter by region access, not status
    const where = {};
    
    // Only apply user restrictions from req.conditions if they're specific user filters (not role-based)
    if (req.conditions && req.conditions.business_partner_key) {
      where.business_partner_key = req.conditions.business_partner_key;
    }
    
    // Region filtering based on user's access level
    if (region) {
      if (!req.conditions.region || req.conditions.region === region) {
        where.region = region;
      } else {
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }
    } else if (req.conditions.region) {
      where.region = req.conditions.region;
    }

    console.log('[getInactiveUsers] Final where clause:', where);

    // Find users who either:
    // 1. Have never logged in (last_login_at is null)
    // 2. Last logged in more than 24 hours ago
    // Do NOT filter by status - we want to see all users (active, inactive, blocked) if they haven't logged in
    const { Op } = require("sequelize");

    const inactiveUsers = await BusinessPartner.findAll({
      where: {
        ...where,
        [Op.or]: [
          { last_login_at: { [Op.is]: null } },
          { last_login_at: { [Op.lt]: twentyFourHoursAgo } }
        ]
      },
      attributes: [
        'business_partner_key',
        'business_partner_name',
        'user_ad',
        'region',
        'business_partner_status',
        'last_login_at'
      ],
      order: [['last_login_at', 'ASC']]
    });

    console.log('[getInactiveUsers] Found', inactiveUsers.length, 'inactive users');

    // Count by region if global view
    let groupedByRegion = {};
    if (!req.conditions.region && !region) {
      groupedByRegion = inactiveUsers.reduce((acc, user) => {
        const r = user.region || 'Unknown';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
    }

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: {
        users: inactiveUsers,
        total: inactiveUsers.length,
        byRegion: groupedByRegion
      }
    });
  } catch (error) {
    console.error("Get Inactive Users Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Reset password for a user
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[resetPassword] ID:', id);
    console.log('[resetPassword] Body:', req.body);
    console.log('[resetPassword] Query:', req.query);

    const bodyPassword = req.body.new_password || req.body.newPassword;
    const queryPassword = req.query.new_password || req.query.newPassword;
    const isInternalParam = req.body.is_internal !== undefined ? req.body.is_internal : req.query.is_internal;
    
    const new_password = bodyPassword || queryPassword;
    console.log('[resetPassword] Extracted Password:', new_password ? 'REDACTED' : 'MISSING');

    if (!id || !new_password) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        message: "User ID and new password are required",
      });
    }

    const isInternal = isInternalParam === 'true' || isInternalParam === true;
    const queryConditions = { ...req.conditions };
    if (isInternal) {
      delete queryConditions.business_partner_key;
    }

    let user;
    if (isInternal) {
      user = await BrarudiUser.findOne({
        where: { id, ...queryConditions }
      });
    } else {
      user = await BusinessPartner.findOne({
        where: { business_partner_key: id, ...queryConditions }
      });
    }

    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        message: "User not found or access denied",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await user.update({
      password: hashedPassword,
    });

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getUsers,
  getMetadata,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getUserLogs,
  getInactiveUsers,
};
