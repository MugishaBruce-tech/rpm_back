const bcrypt = require("bcrypt");
const crypto = require("crypto");
const BusinessPartner = require("../../models/BusinessPartner");
const BusinessPartnerTokens = require("../../models/BusinessPartnerTokens");
const Profil = require("../../models/Profil");
const LegalEntity = require("../../models/LegalEntity");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const mailService = require("../../services/mail.service");

/**
 * Get all business partners (users) with pagination and filtering
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

    // Build filter conditions
    const where = { ...req.conditions };
    if (search) {
      const sequelize = require("sequelize");
      where[sequelize.Op.or] = [
        { business_partner_name: { [sequelize.Op.like]: `%${search}%` } },
        { user_ad: { [sequelize.Op.like]: `%${search}%` } },
      ];
    }
    // Region filtering:
    // - If locked by req.conditions.region (DDM): only show that region.
    // - If not locked (OPCO/Admin): allow override via ?region= query param.
    if (region) {
      if (!req.conditions.region || req.conditions.region === region) {
        where.region = region;
      } else {
        // Locked to a different region — forbidden
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }
    } else if (req.conditions.region) {
      where.region = req.conditions.region;
    }
    if (type) where.business_partner_type = type;
    if (status) where.business_partner_status = status;

    const { count, rows } = await BusinessPartner.findAndCountAll({
      where,
      attributes: [
        'business_partner_key',
        'business_partner_name',
        'user_ad',
        'region',
        'business_partner_type',
        'customer_channel',
        'business_partner_status',
        'last_login_at',
      ],
      limit,
      offset,
      order: [['business_partner_key', 'DESC']],
    });

    const totalPages = Math.ceil(count / limit);

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: {
        users: rows,
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
    const profils = await Profil.findAll();
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
 * Create a new business partner (user)
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

    if (!business_partner_name || !user_ad || !legal_entity_key) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "Missing required fields",
      });
    }

    // Check if user already exists
    const existingUser = await BusinessPartner.findOne({ where: { user_ad } });
    if (existingUser) {
      return res.status(RESPONSE_CODES.CONFLICT).json({
        statusCode: RESPONSE_CODES.CONFLICT,
        httpStatus: RESPONSE_STATUS.CONFLICT,
        message: "User already exists",
      });
    }

    // Generate random password
    const generatedPassword = crypto.randomBytes(8).toString("hex");
    console.log(`Generated password for ${user_ad}: ${generatedPassword}`);

    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // For DDMs, force their region and only allow creating SUB_D profiles
    const userRole = req.user.profil.CODE_PROFIL;
    let finalRegion = region;
    let finalProfilId = profil_id;

    if (userRole === "DDM") {
      finalRegion = req.user.region;
      // Find the SUB_D profile ID to ensure they don't create another Admin
      const subDProfil = await Profil.findOne({ where: { CODE_PROFIL: 'SUB_D' } });
      if (subDProfil) finalProfilId = subDProfil.PROFIL_ID;
    }

    const newUser = await BusinessPartner.create({
      business_partner_name,
      business_partner_type: business_partner_type || "customer",
      customer_channel: customer_channel || "distributor",
      user_ad,
      password: hashedPassword,
      region: finalRegion,
      legal_entity_key,
      profil_id: finalProfilId,
      business_partner_status: "active",
    });

    // Send credentials via email (Asynchronous, don't block response)
    mailService.sendWelcomeEmail(
      newUser.user_ad, 
      newUser.business_partner_name, 
      newUser.user_ad, 
      generatedPassword
    ).catch(err => console.error("Could not send welcome email:", err));

    res.status(RESPONSE_CODES.CREATED).json({
      statusCode: RESPONSE_CODES.CREATED,
      httpStatus: RESPONSE_STATUS.CREATED,
      message: "User created successfully",
      result: {
        id: newUser.business_partner_key,
        user_ad: newUser.user_ad,
        password: generatedPassword, // Returning the plaintext password once
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
    const {
      business_partner_name,
      business_partner_type,
      customer_channel,
      region,
      legal_entity_key,
      profil_id,
      business_partner_status,
    } = req.body;

    if (!id) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "User ID is required",
      });
    }

    // Enforce scoping: find only if it matches req.conditions
    const user = await BusinessPartner.findOne({ 
      where: { 
        business_partner_key: id,
        ...req.conditions 
      } 
    });

    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        statusCode: RESPONSE_CODES.NOT_FOUND,
        httpStatus: RESPONSE_STATUS.NOT_FOUND,
        message: "User not found or access denied",
      });
    }

    // For DDMs, prevent them from changing the region to something else or upgrading profiles
    const userRole = req.user.profil.CODE_PROFIL;
    let finalRegion = region || user.region;
    let finalProfilId = profil_id || user.profil_id;

    if (userRole === "DDM") {
      finalRegion = user.region; // Forbid region change
      finalProfilId = user.profil_id; // Forbid profile change
    }

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

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "User updated successfully",
      result: user,
    });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
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

    if (!id) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "User ID is required",
      });
    }

    const user = await BusinessPartner.findOne({ 
      where: { 
        business_partner_key: id,
        ...req.conditions 
      } 
    });
    
    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        statusCode: RESPONSE_CODES.NOT_FOUND,
        httpStatus: RESPONSE_STATUS.NOT_FOUND,
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
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
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

module.exports = {
  getUsers,
  getMetadata,
  createUser,
  updateUser,
  deleteUser,
  getUserLogs,
};
