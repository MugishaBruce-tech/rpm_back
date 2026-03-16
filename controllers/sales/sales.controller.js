const sequelize = require("../../utils/sequelize");
const Sale = require("../../models/Sale");
const SaleItem = require("../../models/SaleItem");
const StockService = require("../../services/stock.service");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");

const addSale = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { business_partner_key: currentPartnerKey, user_ad: USER_AD } = req.user;
    const { SALE_TYPE, TARGET_NAME, NOTES, items } = req.body;

    if (!items || items.length === 0) {
        return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
            statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
            httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
            message: "No items provided for the sale",
        });
    }

    const sale = await Sale.create({
        BUSINESS_PARTNER_ID: currentPartnerKey, // Kept this as BUSINESS_PARTNER_ID for consistency with my Sale.js unless told otherwise
        SALE_TYPE,
        TARGET_NAME,
        NOTES,
        USER_AD: USER_AD
    }, { transaction: t });

    for (const item of items) {
        await SaleItem.create({
            SALE_ID: sale.SALE_ID,
            material_key: item.material_key,
            QUANTITY: item.QUANTITY
        }, { transaction: t });

        const qtyChange = SALE_TYPE === "IN" ? parseFloat(item.QUANTITY) : -parseFloat(item.QUANTITY);
        await StockService.updateStock(currentPartnerKey, item.material_key, qtyChange, USER_AD, null, t);
    }

    await t.commit();

    res.status(RESPONSE_CODES.CREATED).json({
        statusCode: RESPONSE_CODES.CREATED,
        httpStatus: RESPONSE_STATUS.CREATED,
        message: "Sale recorded and stock updated successfully",
        result: sale
    });

  } catch (error) {
    await t.rollback();
    console.error("Add Sale Error:", error);
    
    const errorMessage = error.message.includes("Insufficient stock") 
      ? error.message 
      : "Error recording sale";

    res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
      statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
      httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
      message: errorMessage,
    });
  }
};

const getSales = async (req, res) => {
    try {
        const { business_partner_key: currentPartnerKey } = req.user;
        
        // 1. Handle partnerKey override if allowed (admin/opco)
        const partnerKeyParam = parseInt(req.query.partnerKey, 10);
        let targetPartnerKey = !isNaN(partnerKeyParam) ? partnerKeyParam : null;

        // Security check: if restricted to SELF, override the param
        if (req.conditions.business_partner_key) {
            targetPartnerKey = req.conditions.business_partner_key;
        }

        const isGlobalRequest = req.query.global === 'true' && !req.conditions.business_partner_key;

        const whereClause = {};
        if (!isGlobalRequest) {
            whereClause.BUSINESS_PARTNER_ID = targetPartnerKey || currentPartnerKey;
        }

        const sales = await Sale.findAll({
            where: whereClause,
            include: [
                { 
                    model: SaleItem, 
                    as: "items",
                    include: [{ model: require("../../models/Material"), as: "material" }]
                },
                {
                    model: require("../../models/BusinessPartner"),
                    as: "partner",
                    attributes: ['region'],
                    where: req.conditions
                }
            ],
            order: [["DATE_SALE", "DESC"]]
        });

        res.status(RESPONSE_CODES.OK).json({
            statusCode: RESPONSE_CODES.OK,
            httpStatus: RESPONSE_STATUS.OK,
            result: sales
        });
    } catch (error) {
        console.error("Get Sales Error:", error);
        res.status(RESPONSE_CODES.INTERNAL_SERVER_ERROR).json({
            statusCode: RESPONSE_CODES.INTERNAL_SERVER_ERROR,
            httpStatus: RESPONSE_STATUS.INTERNAL_SERVER_ERROR,
            message: "Error fetching sales history",
        });
    }
};

module.exports = {
  addSale,
  getSales
};
