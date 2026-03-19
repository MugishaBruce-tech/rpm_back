const { Op } = require("sequelize");
const sequelize = require("../../utils/sequelize");
const EmptiesStock = require("../../models/EmptiesStock");
const BusinessPartnerEmptiesLoan = require("../../models/BusinessPartnerEmptiesLoan");
const Material = require("../../models/Material");
const BusinessPartner = require("../../models/BusinessPartner");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const StockService = require("../../services/stock.service");

/**
 * Get Inventory data. 
 * Respects req.conditions from authorize middleware.
 */
const getInventory = async (req, res) => {
  try {
    const { business_partner_key: currentPartnerKey } = req.user;
    
    // Determine target partner.
    // Allow override via query param ONLY if user has permission (handled by fact that req.conditions will be empty for global/admin)
    const partnerKeyParam = parseInt(req.query.partnerKey, 10);
    let targetPartnerKey = !isNaN(partnerKeyParam) ? partnerKeyParam : currentPartnerKey;

    // Apply security scoping from middleware
    // If req.conditions.business_partner_key exists, force it.
    if (req.conditions.business_partner_key) {
      targetPartnerKey = req.conditions.business_partner_key;
    }

    // Aggregation case: If user wants a regional or global view
    const isAggregatedRequest = (req.query.global === 'true' || req.query.region) && !req.conditions.business_partner_key;

    if (isAggregatedRequest) {
      return await getAggregatedInventory(req, res);
    }

    // Standard single-partner inventory logic
    const partnerWhere = { business_partner_key: targetPartnerKey, ...req.conditions };
    
    // Fetch partner info for verification and details
    const partner = await BusinessPartner.findOne({
      where: partnerWhere,
      attributes: ["business_partner_key", "business_partner_name", "region"],
    });

    if (!partner && targetPartnerKey !== currentPartnerKey) {
       return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this partner's data" });
    }

    const materials = await Material.findAll();

    const stockRecords = await EmptiesStock.findAll({
      where: { business_partner_key: targetPartnerKey },
      order: [["date_time", "DESC"]],
    });
    
    const stockMap = {};
    stockRecords.forEach((record) => {
      const mk = record.material_key;
      if (stockMap[mk] === undefined) {
        stockMap[mk] = parseFloat(record.stock_qty_in_base_uom);
      }
    });

    const activeLoans = await BusinessPartnerEmptiesLoan.findAll({
      where: {
        bp_loan_status: "open",
        [Op.or]: [
          { business_partner_key: targetPartnerKey },
          { bp_loaned_to_business_partner_key: targetPartnerKey },
        ],
      },
    });
    
    const lentMap = {};
    const borrowedMap = {};
    activeLoans.forEach((loan) => {
      const mk = loan.material_key;
      const qty = parseFloat(loan.bp_loan_qty_in_base_uom);
      if (loan.business_partner_key === targetPartnerKey) {
        lentMap[mk] = (lentMap[mk] || 0) + qty;
      }
      if (loan.bp_loaned_to_business_partner_key === targetPartnerKey) {
        borrowedMap[mk] = (borrowedMap[mk] || 0) + qty;
      }
    });

    const result = materials.map((m) => {
      const physicalQty = stockMap[m.material_key] ?? 0;
      const lentQty = lentMap[m.material_key] ?? 0;
      const borrowedQty = borrowedMap[m.material_key] ?? 0;
      return {
        partnerKey: targetPartnerKey,
        partnerName: partner ? partner.business_partner_name : "Self",
        region: partner ? partner.region : null,
        materialKey: m.material_key,
        sku: m.global_material_id,
        materialDescription: m.material_description,
        material_name2: m.material_name2,
        physicalQty,
        lentQty,
        borrowedQty,
        netOwned: physicalQty + lentQty - borrowedQty,
      };
    });

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result,
    });
  } catch (error) {
    console.error("Get Inventory Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({ message: "Error fetching inventory data" });
  }
};

/**
 * Aggregated Inventory for OPCO/Global dashboards
 */
const getAggregatedInventory = async (req, res) => {
  try {
    const requestedRegion = req.query.region;

    let whereClause = { ...req.conditions };

    if (requestedRegion) {
      if (!req.conditions.region) {
        // No region lock from middleware — user is free to request any region (OPCO with global perms)
        whereClause = { region: requestedRegion };
      } else if (req.conditions.region === requestedRegion) {
        // Region matches the locked scope — allow
        whereClause.region = requestedRegion;
      } else {
        // Region mismatch against locked scope (DDM trying to peek cross-region)
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }
    }

    // Get all valid partners for this scope
    const partners = await BusinessPartner.findAll({
       where: { ...whereClause, business_partner_status: 'active' },
       attributes: ['business_partner_key', 'business_partner_name', 'region']
    });

    const partnerKeys = partners.map(p => p.business_partner_key);
    console.log(`[DEBUG] getAggregatedInventory: Found ${partnerKeys.length} partners for scope: ${JSON.stringify(whereClause)}`);

    // Use the requested region label, not the user's own region
    const activeRegion = requestedRegion || req.user.region || 'REGION';
    const labelName = `${activeRegion} REGION DASHBOARD`;
    
    if (partnerKeys.length === 0) {
      return res.status(RESPONSE_CODES.OK).json({ result: [], label: labelName });
    }

    const materials = await Material.findAll();
    
    // Aggregated stock
    const [stockResults] = await sequelize.query(`
      SELECT material_key, SUM(stock_qty_in_base_uom) as total_physical
      FROM (
        SELECT material_key, stock_qty_in_base_uom, 
               ROW_NUMBER() OVER(PARTITION BY business_partner_key, material_key ORDER BY date_time DESC) as rn
        FROM empties_stock
        WHERE business_partner_key IN (:partnerKeys)
      ) as t
      WHERE t.rn = 1
      GROUP BY material_key
    `, { replacements: { partnerKeys } });

    const [loanResults] = await sequelize.query(`
      SELECT material_key, 
             SUM(CASE WHEN business_partner_key IN (:partnerKeys) THEN bp_loan_qty_in_base_uom ELSE 0 END) as total_lent,
             SUM(CASE WHEN bp_loaned_to_business_partner_key IN (:partnerKeys) THEN bp_loan_qty_in_base_uom ELSE 0 END) as total_borrowed
      FROM business_partner_empties_loan
      WHERE bp_loan_status = 'open'
      GROUP BY material_key
    `, { replacements: { partnerKeys } });

    const stockMap = {};
    stockResults.forEach(r => stockMap[r.material_key] = parseFloat(r.total_physical));
    
    const lentMap = {};
    const borrowedMap = {};
    loanResults.forEach(r => {
      lentMap[r.material_key] = parseFloat(r.total_lent);
      borrowedMap[r.material_key] = parseFloat(r.total_borrowed);
    });

    const result = materials.map(m => {
      const physicalQty = stockMap[m.material_key] ?? 0;
      const lentQty = lentMap[m.material_key] ?? 0;
      const borrowedQty = borrowedMap[m.material_key] ?? 0;
      return {
        materialKey: m.material_key,
        sku: m.global_material_id,
        materialDescription: m.material_description,
        material_name2: m.material_name2,
        physicalQty,
        lentQty,
        borrowedQty,
        netOwned: physicalQty + lentQty - borrowedQty,
        partnerName: labelName,
        region: activeRegion
      };
    });

    res.status(RESPONSE_CODES.OK).json({ 
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result, 
      label: labelName 
    });
  } catch (error) {
    console.error("Get Aggregated Inventory Error:", error);
    res.status(500).json({ message: "Error calculating global inventory" });
  }
};

/**
 * Returns total stock per partner for the current user's scope.
 * Used for regional distribution charts.
 */
const getInventoryDistribution = async (req, res) => {
  try {
    const requestedRegionDist = req.query.region;
    const isGlobal = req.query.global === 'true';
    let whereClause = { ...req.conditions };

    // If global view requested and user has permission (OPCO or higher)
    if (isGlobal) {
      // Clear region lock to get all regions
      whereClause = { business_partner_status: 'active' };
    } else if (requestedRegionDist) {
      if (!req.conditions.region) {
        // No region lock — OPCO can freely switch regions
        whereClause = { region: requestedRegionDist };
      } else if (req.conditions.region === requestedRegionDist) {
        // Matches locked scope — allow
        whereClause.region = requestedRegionDist;
      } else {
        // Cross-region attempt for locked user (DDM)
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }
    }

    // Aggregation case: Global overview grouped by region
    if (isGlobal) {
      const [regionalResults] = await sequelize.query(`
        SELECT bp.region, SUM(t.stock_qty_in_base_uom) as total_physical
        FROM business_partner bp
        JOIN (
          SELECT business_partner_key, material_key, stock_qty_in_base_uom, 
                 ROW_NUMBER() OVER(PARTITION BY business_partner_key, material_key ORDER BY date_time DESC) as rn
          FROM empties_stock
        ) t ON bp.business_partner_key = t.business_partner_key
        WHERE t.rn = 1 AND bp.business_partner_status = 'active'
        GROUP BY bp.region
      `);

      const finalResults = regionalResults.map(r => ({
        region: r.region || 'Unknown',
        totalStock: parseFloat(r.total_physical || 0)
      }));

      return res.status(RESPONSE_CODES.OK).json({ 
        statusCode: RESPONSE_CODES.OK,
        httpStatus: RESPONSE_STATUS.OK,
        result: finalResults 
      });
    }

    // Get all valid partners for this scope
    const partners = await BusinessPartner.findAll({
       where: { ...whereClause, business_partner_status: 'active' },
       attributes: ['business_partner_key', 'business_partner_name', 'region']
    });
    
    const partnerKeys = partners.map(p => p.business_partner_key);
    
    if (partnerKeys.length === 0) {
      return res.status(RESPONSE_CODES.OK).json({ result: [] });
    }

    const [results] = await sequelize.query(`
      SELECT business_partner_key, SUM(stock_qty_in_base_uom) as total_physical
      FROM (
        SELECT business_partner_key, material_key, stock_qty_in_base_uom, 
               ROW_NUMBER() OVER(PARTITION BY business_partner_key, material_key ORDER BY date_time DESC) as rn
        FROM empties_stock
        WHERE business_partner_key IN (:partnerKeys)
      ) as t
      WHERE t.rn = 1
      GROUP BY business_partner_key
    `, { replacements: { partnerKeys } });

    const finalResults = partners.map(p => {
      const stockRecord = results.find(r => r.business_partner_key === p.business_partner_key);
      return {
        partnerKey: p.business_partner_key,
        partnerName: p.business_partner_name || `Partner ${p.business_partner_key}`,
        totalStock: stockRecord ? parseFloat(stockRecord.total_physical) : 0
      };
    });

    res.status(RESPONSE_CODES.OK).json({ 
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: finalResults 
    });
  } catch (error) {
    console.error("Get Inventory Distribution Error:", error);
    res.status(500).json({ message: "Error calculating partner distribution" });
  }
};

const getMaterials = async (req, res) => {
  try {
    const materials = await Material.findAll();
    res.status(RESPONSE_CODES.OK).json({ result: materials });
  } catch (error) {
    res.status(500).json({ message: "Error fetching materials" });
  }
};

const adjustStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { business_partner_key: currentPartnerKey, user_ad: userAd } = req.user;
    const { adjustments, reason, partnerKey } = req.body;

    let targetKey = currentPartnerKey;
    if (partnerKey && !req.conditions.business_partner_key) {
      targetKey = partnerKey;
    }

    const auditDetails = [];

    for (const adj of adjustments) {
      // Fetch current stock to calculate delta for audit log
      const current = await EmptiesStock.findOne({
        where: { business_partner_key: targetKey, material_key: adj.material_key },
        order: [["date_time", "DESC"]],
        transaction: t
      });

      const oldQty = current ? parseFloat(current.stock_qty_in_base_uom) : 0;
      const newQty = parseFloat(adj.quantity);
      const delta = newQty - oldQty;
      
      if (delta !== 0) {
        const material = await Material.findByPk(adj.material_key, { transaction: t });
        const actionText = delta > 0 ? "Increased" : "Decreased";
        auditDetails.push(`${actionText} ${material?.material_description || 'items'} from ${oldQty} to ${newQty}`);
      }

      await StockService.setStock(targetKey, adj.material_key, adj.quantity, userAd, reason, t);
    }

    // Attach info for the audit logger middleware
    if (auditDetails.length > 0) {
      req.audit_info = `Stock Adjustment: ${auditDetails.join(', ')}`;
    } else {
      req.audit_info = "Stock Adjustment: No net change";
    }

    await t.commit();
    res.status(RESPONSE_CODES.OK).json({ message: "Stock adjusted successfully" });
  } catch (error) {
    if (t) await t.rollback();
    console.error("Stock adjustment error:", error);
    res.status(500).json({ message: "Error adjusting stock" });
  }
};

module.exports = {
  getInventory,
  getInventoryDistribution,
  getMaterials,
  adjustStock
};
