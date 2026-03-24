const sequelize = require("../../utils/sequelize");
const BusinessPartnerEmptiesLoan = require("../../models/BusinessPartnerEmptiesLoan");
const BusinessPartner = require("../../models/BusinessPartner");
const Material = require("../../models/Material");
const StockService = require("../../services/stock.service");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");
const { Op } = require("sequelize");

const createLoan = async (req, res) => {
  try {
    const { business_partner_key: requesterPartnerKey, user_ad: USER_AD } = req.user;
    const { 
      TO_PARTNER_KEY, MATERIAL_KEY, QUANTITY, EXTERNAL_PARTY_NAME,
      material_key, bp_loaned_to_business_partner_key, bp_loan_qty_in_base_uom, external_party_name,
      business_partner_key: lenderKey, CLIENT_ID
    } = req.body;

    if (CLIENT_ID) {
      const existingLoan = await BusinessPartnerEmptiesLoan.findOne({ where: { CLIENT_ID } });
      if (existingLoan) {
        return res.status(RESPONSE_CODES.OK).json({
          statusCode: RESPONSE_CODES.OK,
          httpStatus: RESPONSE_STATUS.OK,
          message: "Loan already exists (idempotent)",
          result: existingLoan
        });
      }
    }

    // Validate material_key
    const finalMaterialKey = MATERIAL_KEY || material_key;
    if (!finalMaterialKey) {
      return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
        statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
        httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
        message: "material_key is required",
      });
    }

    // Use lenderKey if provided (requester is borrower), otherwise requester is lender
    const finalLenderKey = lenderKey || requesterPartnerKey;
    const finalBorrowerKey = lenderKey ? requesterPartnerKey : (TO_PARTNER_KEY || bp_loaned_to_business_partner_key);

    // Security check for SUB_D: Must be either party
    if (req.conditions.business_partner_key) {
        if (finalLenderKey !== req.conditions.business_partner_key && 
            finalBorrowerKey !== req.conditions.business_partner_key) {
            return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied: You can only create loans involving yourself" });
        }
    }

    const loan = await BusinessPartnerEmptiesLoan.create({
      business_partner_key: finalLenderKey,
      bp_loaned_to_business_partner_key: finalBorrowerKey || null,
      material_key: finalMaterialKey,
      bp_loan_qty_in_base_uom: QUANTITY || bp_loan_qty_in_base_uom,
      external_party_name: EXTERNAL_PARTY_NAME || external_party_name,
      bp_loan_status: (EXTERNAL_PARTY_NAME || external_party_name) ? "open" : "pending",
      user_ad: USER_AD,
      CLIENT_ID: CLIENT_ID || null
    });

    // If it's an external loan (starts as 'open'), update stock immediately
    if ((EXTERNAL_PARTY_NAME || external_party_name)) {
       if (finalLenderKey && !finalBorrowerKey) {
          await StockService.updateStock(finalLenderKey, finalMaterialKey, -parseFloat(QUANTITY || bp_loan_qty_in_base_uom), USER_AD);
       } else if (finalBorrowerKey && !finalLenderKey) {
          await StockService.updateStock(finalBorrowerKey, finalMaterialKey, parseFloat(QUANTITY || bp_loan_qty_in_base_uom), USER_AD);
       }
    }

    const material = await Material.findByPk(finalMaterialKey);
    const lender = finalLenderKey ? await BusinessPartner.findByPk(finalLenderKey) : null;
    const borrower = finalBorrowerKey ? await BusinessPartner.findByPk(finalBorrowerKey) : null;
    
    if (EXTERNAL_PARTY_NAME || external_party_name) {
      req.audit_info = `External Transaction: ${QUANTITY || bp_loan_qty_in_base_uom} of ${material?.material_description} involving ${EXTERNAL_PARTY_NAME || external_party_name}`;
    } else {
      req.audit_info = `Created Loan Request: ${QUANTITY || bp_loan_qty_in_base_uom} of ${material?.material_description} from ${lender?.business_partner_name || 'System'} to ${borrower?.business_partner_name || 'System'}`;
    }

    res.status(RESPONSE_CODES.CREATED).json({
      statusCode: RESPONSE_CODES.CREATED,
      httpStatus: RESPONSE_STATUS.CREATED,
      result: loan
    });
  } catch (error) {
    console.error("Create Loan Error:", error);
    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({ message: "Error creating loan request" });
  }
};

const updateLoanStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id: loanId } = req.params;
    const { STATUS, status: lowerStatus } = req.body; 
    const { user_ad: USER_AD } = req.user;

    const targetStatus = STATUS || lowerStatus;

    // Find loan and verify permission (implicitly handled via conditions if we joined lender/borrower)
    const loan = await BusinessPartnerEmptiesLoan.findByPk(loanId, { 
       include: [
         { model: BusinessPartner, as: "lender" },
         { model: BusinessPartner, as: "borrower" }
       ],
       transaction: t 
    });

    if (!loan) {
      return res.status(RESPONSE_CODES.NOT_FOUND).json({ message: "Loan record not found" });
    }

    // Check if the user has permission to manage this specific loan (Region/Partner check)
    if (req.conditions.business_partner_key) {
       // SUB_D: Must be either the lender or the borrower
       if (loan.business_partner_key !== req.conditions.business_partner_key && 
           loan.bp_loaned_to_business_partner_key !== req.conditions.business_partner_key) {
          return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied: You can only manage your own loans" });
       }
    } else if (req.conditions.region) {
       const lenderRegion = loan.lender?.region;
       const borrowerRegion = loan.borrower?.region;
       // DDM can only manage loans where BOTH parties are in their region
       if (lenderRegion !== req.conditions.region || borrowerRegion !== req.conditions.region) {
          return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied: Both lender and borrower must be in your region" });
       }
    }

    const previousStatus = loan.bp_loan_status;
    
    if (targetStatus === "open" && previousStatus === "pending") {
       await StockService.updateStock(loan.business_partner_key, loan.material_key, -parseFloat(loan.bp_loan_qty_in_base_uom), USER_AD, null, t);
       if (loan.bp_loaned_to_business_partner_key) {
         await StockService.updateStock(loan.bp_loaned_to_business_partner_key, loan.material_key, parseFloat(loan.bp_loan_qty_in_base_uom), USER_AD, null, t);
       }
    }
    
    if (targetStatus === "closed" && previousStatus === "open") {
       if (loan.bp_loaned_to_business_partner_key) {
         await StockService.updateStock(loan.bp_loaned_to_business_partner_key, loan.material_key, -parseFloat(loan.bp_loan_qty_in_base_uom), USER_AD, null, t);
       }
       await StockService.updateStock(loan.business_partner_key, loan.material_key, parseFloat(loan.bp_loan_qty_in_base_uom), USER_AD, null, t);
    }

    loan.bp_loan_status = targetStatus;
    loan.bp_loan_status_date_time = new Date();
    await loan.save({ transaction: t });

    const material = await Material.findByPk(loan.material_key, { transaction: t });
    const lenderName = loan.lender?.business_partner_name || 'Unknown';
    const borrowerName = loan.borrower?.business_partner_name || (loan.external_party_name || 'Unknown');
    
    req.audit_info = `Updated Loan #${loan.bp_loan_key} Status to ${targetStatus.toUpperCase()}: ${loan.bp_loan_qty_in_base_uom} ${material?.material_description} (${lenderName} → ${borrowerName})`;

    await t.commit();
    res.status(RESPONSE_CODES.OK).json({ result: loan });

  } catch (error) {
    if (t) await t.rollback();
    console.error("Update Loan Status Error:", error);
    res.status(500).json({ message: error.message || "Error updating loan status" });
  }
};

const getLoans = async (req, res) => {
  try {
    const { business_partner_key: currentPartnerKey } = req.user;
    
    let whereClause = {};

    // 0. Handle specific partner filtering (requested via query)
    const partnerKeyQuery = req.query.partnerKey;
    
    // 1. If restricted to SELF
    if (req.conditions.business_partner_key) {
       whereClause[Op.or] = [
         { business_partner_key: req.conditions.business_partner_key },
         { bp_loaned_to_business_partner_key: req.conditions.business_partner_key }
       ];
    } 
    // 2. If restricted to REGION
    else if (req.conditions.region) {
       whereClause = {
          [Op.or]: [
             { '$lender.region$': req.conditions.region },
             { '$borrower.region$': req.conditions.region }
          ]
       };

       // If a specific partner is requested, add that to the filter
       if (partnerKeyQuery) {
         whereClause[Op.and] = {
           [Op.or]: [
             { business_partner_key: partnerKeyQuery },
             { bp_loaned_to_business_partner_key: partnerKeyQuery }
           ]
         };
       }
    }
    // 3. Global - but still allow specific partner filtering
    else if (partnerKeyQuery) {
      whereClause[Op.or] = [
        { business_partner_key: partnerKeyQuery },
        { bp_loaned_to_business_partner_key: partnerKeyQuery }
      ];
    }
    // 3. Global - no whereClause filter (beyond generic Op.or self-view which we override here)

    const loans = await BusinessPartnerEmptiesLoan.findAll({
      where: whereClause,
      include: [
        { model: Material, as: "material", attributes: ["material_key", "global_material_id", "material_description"] },
        { model: BusinessPartner, as: "lender", attributes: ["business_partner_key", "business_partner_name", "region"] },
        { model: BusinessPartner, as: "borrower", attributes: ["business_partner_key", "business_partner_name", "region"] },
      ],
      order: [["created_at", "DESC"]]
    });

    res.status(RESPONSE_CODES.OK).json({ result: loans });
  } catch (error) {
    console.error("Get Loans Error:", error);
    res.status(500).json({ message: "Error fetching loans" });
  }
};

module.exports = {
  createLoan,
  updateLoanStatus,
  getLoans
};
