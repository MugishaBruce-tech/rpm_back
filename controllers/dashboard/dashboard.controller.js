const { Op } = require("sequelize");
const sequelize = require("../../utils/sequelize");
const EmptiesStock = require("../../models/EmptiesStock");
const BusinessPartnerEmptiesLoan = require("../../models/BusinessPartnerEmptiesLoan");
const BusinessPartner = require("../../models/BusinessPartner");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");

/**
 * Get core dashboard stats.
 * Scoped by partnerKey or region if provided.
 */
const getDashboardStats = async (req, res) => {
  try {
    const { business_partner_key: currentPartnerKey } = req.user;
    const partnerKeyParam = parseInt(req.query.partnerKey, 10);
    const regionParam = req.query.region;
    const isGlobal = req.query.global === 'true';

    let targetPartnerKeys = [];
    
    // 1. Determine Scope
    if (!isNaN(partnerKeyParam)) {
      targetPartnerKeys = [partnerKeyParam];
    } else if (regionParam) {
      // If locked by req.conditions.region (DDM): enforce it.
      // If not locked (OPCO/Admin): allow override via ?region= query param.
      if (req.conditions.region && req.conditions.region !== regionParam) {
        return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied to this region" });
      }

      const partners = await BusinessPartner.findAll({
        where: { region: regionParam, business_partner_status: 'active' },
        attributes: ['business_partner_key']
      });
      targetPartnerKeys = partners.map(p => p.business_partner_key);
    } else if (isGlobal) {
      const partners = await BusinessPartner.findAll({
        where: { ...req.conditions, business_partner_status: 'active' },
        attributes: ['business_partner_key']
      });
      targetPartnerKeys = partners.map(p => p.business_partner_key);
    } else {
      targetPartnerKeys = [currentPartnerKey];
    }

    if (targetPartnerKeys.length === 0) {
      return res.status(RESPONSE_CODES.OK).json({
        statusCode: RESPONSE_CODES.OK,
        httpStatus: RESPONSE_STATUS.OK,
        result: {
          physicalStockUnits: 0,
          totalLoanItems: 0,
          inventoryTrend: 0
        }
      });
    }

    // 2. Fetch Aggregated Physical Stock
    const [stockResults] = await sequelize.query(`
      SELECT SUM(stock_qty_in_base_uom) as total_physical
      FROM (
        SELECT stock_qty_in_base_uom, 
               ROW_NUMBER() OVER(PARTITION BY business_partner_key, material_key ORDER BY date_time DESC) as rn
        FROM empties_stock
        WHERE business_partner_key IN (:targetPartnerKeys)
      ) as t
      WHERE t.rn = 1
    `, { replacements: { targetPartnerKeys } });

    // 3. Fetch Aggregated Loans (Lent Out)
    const [loanResults] = await sequelize.query(`
      SELECT SUM(bp_loan_qty_in_base_uom) as total_lent
      FROM business_partner_empties_loan
      WHERE bp_loan_status = 'open'
      AND business_partner_key IN (:targetPartnerKeys)
    `, { replacements: { targetPartnerKeys } });

    // 4. Calculate Trend (Mock for now, or calculate as diff from 7 days ago)
    const inventoryTrend = 0; 

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: {
        physicalStockUnits: parseFloat(stockResults[0]?.total_physical || 0),
        totalLoanItems: parseFloat(loanResults[0]?.total_lent || 0),
        inventoryTrend
      }
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Error fetching dashboard stats" });
  }
};

/**
 * Get activity trend (transaction counts per day)
 */
const getActivityTrend = async (req, res) => {
  try {
    const { business_partner_key: currentPartnerKey } = req.user;
    const partnerKeyParam = parseInt(req.query.partnerKey, 10);
    const regionParam = req.query.region;

    let targetPartnerKeys = [];
    
    if (!isNaN(partnerKeyParam)) {
      targetPartnerKeys = [partnerKeyParam];
    } else if (regionParam) {
      const partners = await BusinessPartner.findAll({
        where: { region: regionParam, business_partner_status: 'active' },
        attributes: ['business_partner_key']
      });
      targetPartnerKeys = partners.map(p => p.business_partner_key);
    } else {
      const partners = await BusinessPartner.findAll({
        where: { ...req.conditions, business_partner_status: 'active' },
        attributes: ['business_partner_key']
      });
      targetPartnerKeys = partners.map(p => p.business_partner_key);
    }

    // Count loans created in the last 14 days
    const results = await BusinessPartnerEmptiesLoan.findAll({
      where: {
        [Op.or]: [
          { business_partner_key: { [Op.in]: targetPartnerKeys } },
          { bp_loaned_to_business_partner_key: { [Op.in]: targetPartnerKeys } }
        ],
        created_at: {
          [Op.gte]: new Date(new Date().setDate(new Date().getDate() - 14))
        }
      },
      attributes: ['created_at'],
      raw: true
    });

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: results
    });
  } catch (error) {
    console.error("Activity Trend Error:", error);
    res.status(500).json({ message: "Error fetching activity trend" });
  }
};

/**
 * Get all available distinct regions.
 * Used by OPCO dashboard to populate region selector.
 */
const getRegions = async (req, res) => {
  try {
    const regions = await BusinessPartner.findAll({
      where: { business_partner_status: 'active' },
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('region')), 'region']],
      raw: true
    });

    const regionList = regions
      .map(r => r.region)
      .filter(Boolean)
      .sort();

    res.status(RESPONSE_CODES.OK).json({
      statusCode: RESPONSE_CODES.OK,
      httpStatus: RESPONSE_STATUS.OK,
      result: regionList
    });
  } catch (error) {
    console.error("Get Regions Error:", error);
    res.status(500).json({ message: "Error fetching regions" });
  }
};

module.exports = {
  getDashboardStats,
  getActivityTrend,
  getRegions
};
