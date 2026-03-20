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

    // Send Email Notification if it's a peer-to-peer loan (pending)
    const material = await Material.findByPk(finalMaterialKey);
    const lender = finalLenderKey ? await BusinessPartner.findByPk(finalLenderKey) : null;
    const borrower = finalBorrowerKey ? await BusinessPartner.findByPk(finalBorrowerKey) : null;

    // If it's an external loan (starts as 'open'), update stock immediately
    const StockService = require("../../services/stock.service");
    if ((EXTERNAL_PARTY_NAME || external_party_name)) {
      // Check if it's explicitly marked as an external receiving action
      const isReceiving = req.body.is_external || req.body.direction === 'RECEIVING' || req.body.direction === 'RECEIVE';
      const qty = parseFloat(QUANTITY || bp_loan_qty_in_base_uom);

      if (finalLenderKey && !finalBorrowerKey) {
        // If receiving, add to stock. If giving (default lender behavior), subtract from stock.
        const finalQty = isReceiving ? qty : -qty;
        await StockService.updateStock(finalLenderKey, finalMaterialKey, finalQty, USER_AD);
      } else if (finalBorrowerKey && !finalLenderKey) {
        await StockService.updateStock(finalBorrowerKey, finalMaterialKey, qty, USER_AD);
      }
    }

    if (loan.bp_loan_status === "pending") {
      const recipientPartner = lenderKey ? lender : borrower;
      const requesterName = req.user.name || req.user.business_partner_name || "A user";

      if (recipientPartner && recipientPartner.user_ad) {
        const MailService = require("../../services/mail.service");
        MailService.sendLoanNotificationEmail(
          recipientPartner.user_ad,
          recipientPartner.business_partner_name,
          requesterName,
          material?.material_name2 || material?.material_description || "Material",
          QUANTITY || bp_loan_qty_in_base_uom
        ).catch(err => console.error("Async Mail Error:", err));
      }
    }

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

      if (loan.external_party_name) {
        // For external transactions, we only enforce that the internal participating point is in the manager's region
        const internalRegion = loan.bp_loaned_to_business_partner_key ? borrowerRegion : lenderRegion;
        if (internalRegion !== req.conditions.region) {
          return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied: The internal party must be in your region" });
        }
      } else {
        // For fully internal peer-to-peer loans, both must belong to the manager's region
        if (lenderRegion !== req.conditions.region || borrowerRegion !== req.conditions.region) {
          return res.status(RESPONSE_CODES.FORBIDDEN).json({ message: "Access denied: Both lender and borrower must be in your region" });
        }
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
      const returnQty = req.body.returnQty ? parseFloat(req.body.returnQty) : parseFloat(loan.bp_loan_qty_in_base_uom);

      if (returnQty <= 0) {
        return res.status(RESPONSE_CODES.BAD_REQUEST).json({ message: "Invalid return quantity" });
      }
      if (returnQty > parseFloat(loan.bp_loan_qty_in_base_uom)) {
        return res.status(RESPONSE_CODES.BAD_REQUEST).json({ message: "Return quantity exceeds loan balance" });
      }

      // Transfer back for the returned amount
      if (!loan.bp_loaned_to_business_partner_key && loan.external_party_name) {
        // External Transaction Return: User returning stock TO the external party (deduct their stock)
        await StockService.updateStock(loan.business_partner_key, loan.material_key, -returnQty, USER_AD, null, t);
      } else {
        // Internal Transaction Return
        if (loan.bp_loaned_to_business_partner_key) {
          await StockService.updateStock(loan.bp_loaned_to_business_partner_key, loan.material_key, -returnQty, USER_AD, null, t);
        }
        await StockService.updateStock(loan.business_partner_key, loan.material_key, returnQty, USER_AD, null, t);
      }

      // Update loan quantity or close it
      const newQty = parseFloat(loan.bp_loan_qty_in_base_uom) - returnQty;
      if (newQty <= 0) {
        loan.bp_loan_status = "closed";
      } else {
        loan.bp_loan_qty_in_base_uom = newQty;
        loan.bp_loan_status = "open"; // Keep it open
      }
    } else {
      // Normal status update
      loan.bp_loan_status = targetStatus;
    }

    loan.bp_loan_status_date_time = new Date();
    await loan.save({ transaction: t });

    const material = await Material.findByPk(loan.material_key, { transaction: t });
    const lenderName = loan.lender?.business_partner_name || 'Unknown';
    const borrowerName = loan.borrower?.business_partner_name || (loan.external_party_name || 'Unknown');

    req.audit_info = `Updated Loan #${loan.bp_loan_key} Status to ${loan.bp_loan_status.toUpperCase()}: ${loan.bp_loan_qty_in_base_uom} ${material?.material_description} (${lenderName} → ${borrowerName})`;

    await t.commit();
    res.status(RESPONSE_CODES.OK).json({ result: loan });

  } catch (error) {
    if (t) await t.rollback();
    console.error("Update Loan Status Error:", error);

    // Check if it's a stock error from StockService
    if (error.message?.includes('Insufficient stock')) {
      return res.status(RESPONSE_CODES.BAD_REQUEST).json({ message: error.message });
    }

    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({ message: "Error updating loan status: " + error.message });
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
        { model: Material, as: "material", attributes: ["material_key", "global_material_id", "material_description", "material_name2"] },
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
