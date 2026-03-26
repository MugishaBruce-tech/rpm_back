const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const BusinessPartner = require("../../models/BusinessPartner");
const BrarudiUser = require("../../models/BrarudiUser");
const BusinessPartnerTokens = require("../../models/BusinessPartnerTokens");
const Profil = require("../../models/Profil");
const Permission = require("../../models/Permission");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const mailService = require("../../services/mail.service");

const getTrackingInfo = (req) => {
  const ua = new UAParser(req.headers["user-agent"]);
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress || req.ip;
  const geo = geoip.lookup(ip);
  
  return {
    ip_address: ip,
    user_agent: req.headers["user-agent"],
    browser_name: ua.getBrowser().name,
    os_name: ua.getOS().name,
    device_type: ua.getDevice().type || "desktop",
    location: geo ? `${geo.city}, ${geo.country}` : "Unknown"
  };
};

const login = async (req, res) => {
  try {
    const { USER_AD, PASSWORD } = req.body;

    if (!USER_AD || !PASSWORD) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "Email/UserAD and Password are required",
      });
    }

    // Try BrarudiUser first (Internal)
    let userObject = await BrarudiUser.findOne({
      where: { email: USER_AD, status: "active" },
      include: [{ model: Profil, as: "profil" }],
    });

    let isInternal = !!userObject;

    // If not found, try BusinessPartner
    if (!userObject) {
      userObject = await BusinessPartner.findOne({
        where: { user_ad: USER_AD, business_partner_status: "active" },
        include: [{ model: Profil, as: "profil" }],
      });
    }

    if (!userObject) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({
        statusCode: RESPONSE_CODES.NOT_FOUND,
        httpStatus: RESPONSE_STATUS.NOT_FOUND,
        message: "Invalid email or password. Please try again.",
      });
    }

    const user = userObject.toJSON();
    const validPassword = await bcrypt.compare(PASSWORD, user.password);

    if (!validPassword) {
      return res.status(RESPONSE_CODES.UNAUTHORIZED).json({
        statusCode: RESPONSE_CODES.UNAUTHORIZED,
        httpStatus: RESPONSE_STATUS.UNAUTHORIZED,
        message: "Incorrect credentials",
      });
    }

    const userId = isInternal ? user.id : user.business_partner_key;
    const userName = isInternal ? user.name : user.business_partner_name;

    req.user = { ...user, is_internal: isInternal, userId }; // Attach user for audit logging

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    // Save OTP to correct table
    if (isInternal) {
      await BrarudiUser.update({ otp_code: otp, otp_expires_at: expiresAt }, { where: { id: userId } });
    } else {
      await BusinessPartner.update({ otp_code: otp, otp_expires_at: expiresAt }, { where: { business_partner_key: userId } });
    }
    
    console.log(`OTP [${otp}] saved for user [${USER_AD}]`);

    // Send OTP Email
    mailService.sendOTPEmail(
      USER_AD, 
      userName, 
      otp
    ).catch(err => console.error("Failed to send login OTP email:", err));

    // Return partial token
    const mfaToken = jwt.sign(
      { userId, is_internal: isInternal, otp_pending: true },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: "30m" }
    );

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "Security code sent to your email",
      result: {
        mfa_token: mfaToken,
        is_mfa_required: true,
        email: USER_AD
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

/**
 * Verify Email OTP and Issue Tokens
 */
const resendOTP = async (req, res) => {
  try {
    const { mfa_token } = req.body;
    if (!mfa_token) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({ 
        message: "Verification Token is required" 
      });
    }

    const decoded = jwt.verify(mfa_token, process.env.JWT_PRIVATE_KEY);
    const { userId, is_internal } = decoded;

    const user = is_internal 
      ? await BrarudiUser.findByPk(userId)
      : await BusinessPartner.findByPk(userId);

    if (!user) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({ message: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    await user.update({ otp_code: otp, otp_expires_at: expiresAt });
    
    const userName = is_internal ? user.name : user.business_partner_name;
    const userEmail = is_internal ? user.email : user.user_ad;

    mailService.sendOTPEmail(
      userEmail, 
      userName, 
      otp
    ).catch(err => console.error("Failed to resend login OTP email:", err));

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "Security code resent successfully",
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(RESPONSE_CODES.UNAUTHORIZED).json({ message: "Invalid or expired verification session" });
  }
};

const verifyEmailOTP = async (req, res) => {
  try {
    const { token, mfa_token } = req.body;
    
    if (!token || !mfa_token) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({ 
        message: "Code and Verification Token are required" 
      });
    }

    // Verify the temporary MFA token
    const decoded = jwt.verify(mfa_token, process.env.JWT_PRIVATE_KEY);
    const { userId, is_internal } = decoded;

    const user = is_internal 
      ? await BrarudiUser.findOne({
          where: { id: userId },
          include: [{ 
            model: Profil, 
            as: "profil", 
            include: [{ model: Permission, as: "permissions" }] 
          }]
        })
      : await BusinessPartner.findOne({
          where: { business_partner_key: userId },
          include: [{ 
            model: Profil, 
            as: "profil", 
            include: [{ model: Permission, as: "permissions" }] 
          }]
        });

    if (!user || user.otp_code !== token) {
      console.log(`OTP Mismatch: Received [${token}], Stored [${user?.otp_code}] for user [${userId}]`);
      return res.status(RESPONSE_CODES.UNAUTHORIZED).json({ message: "Invalid verification code" });
    }

    // Check expiration
    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(RESPONSE_CODES.UNAUTHORIZED).json({ message: "Verification code has expired" });
    }

    // Clear OTP after successful use
    await user.update({ otp_code: null, otp_expires_at: null });

    // Issue final tokens
    const tokenData = { userId, is_internal };
    const TOKEN = jwt.sign(tokenData, process.env.JWT_PRIVATE_KEY, { 
      expiresIn: parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600 
    });
    const REFRESH_TOKEN = jwt.sign(tokenData, process.env.JWT_REFRESH_PRIVATE_KEY, { 
      expiresIn: parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400 
    });

    await BusinessPartnerTokens.create({
      business_partner_key: is_internal ? null : userId,
      brarudi_user_id: is_internal ? userId : null,
      refresh_token: REFRESH_TOKEN,
      ...getTrackingInfo(req)
    });

    // Update last login
    await user.update({ last_login_at: new Date() });
    
    req.user = { ...user.toJSON(), is_internal, userId }; 
    
    const userData = user.toJSON();
    delete userData.password;

    // Normalize user data for frontend
    const resultUser = {
      ...userData,
      id: userId,
      name: is_internal ? userData.name : userData.business_partner_name,
      email: is_internal ? userData.email : userData.user_ad,
      role: userData.profil?.CODE_PROFIL,
      is_internal
    };

    // Cookie options - Updated for Cross-Domain support (Frontend + Render Backend)
    const cookieOptions = {
      httpOnly: true,
      secure: true, // MUST be true for SameSite: "None"
      sameSite: "None", // Required for cross-site cookie sharing
      path: "/",
    };

    const accessTokenMaxAge = (parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600) * 1000;
    const refreshTokenMaxAge = (parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400) * 1000;

    res.cookie("accessToken", TOKEN, { ...cookieOptions, maxAge: accessTokenMaxAge });
    res.cookie("refreshToken", REFRESH_TOKEN, { ...cookieOptions, maxAge: refreshTokenMaxAge });

    res.status(RESPONSE_CODES.OK).json({ 
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "Security verification successful",
      result: {
        ...resultUser,
        TOKEN,
        REFRESH_TOKEN
      }
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(RESPONSE_CODES.UNAUTHORIZED).json({ message: "Verification failed or expired" });
  }
};

const { otplib } = require("otplib");
const qrcode = require("qrcode");

/**
 * MFA Setup: Generate Secret and QR Code
 */
const setupMFA = async (req, res) => {
    try {
        const secret = otplib.authenticator.generateSecret();
        const user = await BusinessPartner.findByPk(req.user.business_partner_key);
        
        user.mfa_secret = secret;
        await user.save();

        const otpauth = otplib.authenticator.keyuri(user.user_ad, "RPM Tracker", secret);
        const qrCodeUrl = await qrcode.toDataURL(otpauth);

        res.status(RESPONSE_CODES.OK).json({
            statusCode: RESPONSE_CODES.OK,
            httpStatus: RESPONSE_STATUS.OK,
            result: { qrCodeUrl, secret }
        });
    } catch (error) {
        res.status(500).json({ message: "MFA Setup failed" });
    }
};

/**
 * MFA Verification
 */
const verifyMFA = async (req, res) => {
    try {
        const { token, mfa_token } = req.body;
        let userId;

        if (mfa_token) {
            const decoded = jwt.verify(mfa_token, process.env.JWT_PRIVATE_KEY);
            userId = decoded.business_partner_key;
        } else {
            userId = req.user.business_partner_key;
        }

        const user = await BusinessPartner.findOne({
          where: { business_partner_key: userId },
          include: [
            { 
              model: Profil, 
              as: "profil",
              include: [{ model: Permission, as: "permissions" }]
            }
          ]
        });
        const isValid = otplib.authenticator.check(token, user.mfa_secret);

        if (!isValid) {
            return res.status(RESPONSE_CODES.UNAUTHORIZED).json({ message: "Invalid MFA Code" });
        }

        // Enable MFA permanently if not already
        if (!user.is_mfa_enabled) {
            user.is_mfa_enabled = true;
            await user.save();
        }

        // Issue final tokens
        const tokenData = { business_partner_key: user.business_partner_key };
        const TOKEN = jwt.sign(tokenData, process.env.JWT_PRIVATE_KEY, { 
          expiresIn: parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600 
        });
        const REFRESH_TOKEN = jwt.sign(tokenData, process.env.JWT_REFRESH_PRIVATE_KEY, { 
          expiresIn: parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400 
        });

        await BusinessPartnerTokens.create({
          business_partner_key: user.business_partner_key,
          refresh_token: REFRESH_TOKEN,
          ...getTrackingInfo(req)
        });

        // Update last login
        await BusinessPartner.update(
          { last_login_at: new Date() },
          { where: { business_partner_key: user.business_partner_key } }
        );
        
        req.user = user.toJSON(); // Attach user for audit logging
        
        // Cookie options
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          path: "/",
        };

        const accessTokenMaxAge = (parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600) * 1000;
        const refreshTokenMaxAge = (parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400) * 1000;

        res.cookie("accessToken", TOKEN, { ...cookieOptions, maxAge: accessTokenMaxAge });
        res.cookie("refreshToken", REFRESH_TOKEN, { ...cookieOptions, maxAge: refreshTokenMaxAge });

        // Fix: Return user data so frontend doesn't crash
        const userData = user.toJSON();
        delete userData.password;
        
        const resultUser = {
          ...userData,
          id: user.business_partner_key,
          name: userData.business_partner_name,
          email: userData.user_ad,
          role: userData.profil?.CODE_PROFIL,
          is_internal: false
        };

        res.status(200).json({ 
          message: "MFA Verified",
          result: {
            ...resultUser,
            TOKEN,
            REFRESH_TOKEN
          }
        });
    } catch (error) {
        res.status(401).json({ message: "MFA Verification failed" });
    }
  };

const googleCallback = async (req, res) => {
  try {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const user = req.user; // Set by passport
    
    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
    }

    // If MFA is enabled, we don't issue the full token yet
    if (user.is_mfa_enabled) {
      const mfaToken = jwt.sign(
        { business_partner_key: user.business_partner_key, is_mfa_pending: true },
        process.env.JWT_PRIVATE_KEY,
        { expiresIn: "5m" }
      );
      return res.redirect(`${FRONTEND_URL}/login#mfa_token=${mfaToken}`);
    }

    const tokenData = { business_partner_key: user.business_partner_key };
    
    const TOKEN = jwt.sign(tokenData, process.env.JWT_PRIVATE_KEY, {
      expiresIn: parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600,
    });
    const REFRESH_TOKEN = jwt.sign(tokenData, process.env.JWT_REFRESH_PRIVATE_KEY, {
      expiresIn: parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400,
    });

    await BusinessPartnerTokens.create({
      business_partner_key: user.business_partner_key,
      refresh_token: REFRESH_TOKEN,
      ...getTrackingInfo(req)
    });

    // Update last login
    await BusinessPartner.update(
      { last_login_at: new Date() },
      { where: { business_partner_key: user.business_partner_key } }
    );

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
    };

    const accessTokenMaxAge = (parseInt(process.env.APP_ACCESS_TOKEN_MAX_AGE) || 3600) * 1000;
    const refreshTokenMaxAge = (parseInt(process.env.REFRESH_TOKEN_MAX_AGE) || 86400) * 1000;

    res.cookie("accessToken", TOKEN, { ...cookieOptions, maxAge: accessTokenMaxAge });
    res.cookie("refreshToken", REFRESH_TOKEN, { ...cookieOptions, maxAge: refreshTokenMaxAge });

    // Redirect to frontend without sensitive tokens in URL
    res.redirect(`${FRONTEND_URL}`);
  } catch (error) {
    console.error("Google Auth Error:", error);
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${FRONTEND_URL}/login?error=internal_server_error`);
  }
};

const logout = async (req, res) => {
  try {
    const { REFRESH_TOKEN } = req.body;
    if (REFRESH_TOKEN) {
      await BusinessPartnerTokens.update(
        { is_active: 0 },
        { where: { refresh_token: REFRESH_TOKEN } }
      );
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
};

const getProfile = async (req, res) => {
  res.status(RESPONSE_CODES.OK).json({
    statusCode: RESPONSE_CODES.OK,
    httpStatus: RESPONSE_STATUS.OK,
    result: req.user,
  });
};

// Public endpoint used by the frontend to obtain a list of available business
// partners/distributors. No authentication is required because this is only
// used for demo account selection prior to login. We return minimal fields
// and map the role based on the linked profil.
const listDistributors = async (req, res) => {
  try {
    const partners = await BusinessPartner.findAll({
      where: { 
        business_partner_status: 'active',
        ...req.conditions
      },
      attributes: ['business_partner_key', 'business_partner_name', 'region', 'business_partner_type'],
      include: [{ model: Profil, as: 'profil', attributes: ['CODE_PROFIL'] }]
    });

    const result = partners.map(p => {
      const obj = p.toJSON();
      return {
        id: obj.business_partner_key.toString(),
        name: obj.business_partner_name,
        region: obj.region,
        role: obj.profil?.CODE_PROFIL === 'ADMIN' ? 'ADMIN' : 'DISTRIBUTOR'
      };
    });

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result,
    });
  } catch (error) {
    console.error('Error listing distributors:', error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: 'Failed to retrieve distributor list',
    });
  }
};

module.exports = {
  login,
  logout,
  getProfile,
  setupMFA,
  verifyMFA,
  verifyEmailOTP,
  resendOTP,
  listDistributors,
  googleCallback
};
