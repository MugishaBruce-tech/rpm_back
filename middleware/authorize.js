const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

/**
 * Middleware to check if the user has the required permission
 * @param {string|string[]} requiredPermission - The permission code(s) required
 */
const authorize = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.profil || !req.user.profil.permissions) {
      return res.status(RESPONSE_CODES.FORBIDDEN).json({
        statusCode: RESPONSE_CODES.FORBIDDEN,
        httpStatus: RESPONSE_STATUS.FORBIDDEN,
        message: "Access denied: Permissions not found",
      });
    }

    const userPermissions = req.user.profil.permissions.map((p) => p.code);
    const permissionsArray = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

    const hasPermission = permissionsArray.some((p) => userPermissions.includes(p));

    if (!hasPermission) {
      return res.status(RESPONSE_CODES.FORBIDDEN).json({
        statusCode: RESPONSE_CODES.FORBIDDEN,
        httpStatus: RESPONSE_STATUS.FORBIDDEN,
        message: `Access denied: Missing required permission [${permissionsArray.join(", ")}]`,
      });
    }

    // --- AUTOMATIC SCOPING LOGIC ---
    // Inject scope filters into req.conditions for controllers to use
    req.conditions = {};
    
    const userRole = req.user.profil.CODE_PROFIL;
    
    // 1. SUB_D Scoping
    if (userRole === "SUB_D") {
      // If the route specifically requests regional view (e.g., USER_VIEW_REGION),
      // we only lock them to their region so they can see peers for loan requests.
      const isRequestingRegionalView = permissionsArray.some(p => p.endsWith('_REGION'));
      
      if (isRequestingRegionalView && req.user.region) {
        let region = req.user.region;
        if (region.toLowerCase() === 'west') region = 'West';
        if (region.toLowerCase() === 'north') region = 'North';
        if (region.toLowerCase() === 'south') region = 'South';
        if (region.toLowerCase() === 'est' || region.toLowerCase() === 'east') region = 'Est';
        req.conditions.region = region;
      } else {
        // Default: Lock to their own business partner key (for Stock/Loans)
        req.conditions.business_partner_key = req.user.business_partner_key;
      }
    }
    // 2. Regional Scoping
    else if (userRole === "DDM" || userRole === "OPCO_USER") {
      // DDM is always locked to their designated region.
      // OPCO_USER is allowed to switch regions (handled by controllers if req.conditions.region is empty).
      const shouldLockToRegion = userRole === "DDM";

      if (shouldLockToRegion && req.user.region) {
        let region = req.user.region;
        if (region.toLowerCase() === 'west') region = 'West';
        if (region.toLowerCase() === 'north') region = 'North';
        if (region.toLowerCase() === 'south') region = 'South';
        if (region.toLowerCase() === 'est' || region.toLowerCase() === 'east') region = 'Est';
        req.conditions.region = region;
      }
    }
    
    // Exception: If the specific permission requested is a "Self" permission, force self-scope
    if (permissionsArray.every(p => p.endsWith('_SELF'))) {
      req.conditions.business_partner_key = req.user.business_partner_key;
    }

    next();
  };
};

module.exports = authorize;
