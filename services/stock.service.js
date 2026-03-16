const EmptiesStock = require("../models/EmptiesStock");

/**
 * Stock Service
 * Centralized logic for updating stock levels
 */
const updateStock = async (partnerKey, materialKey, quantityChange, userAd, reason = null, transaction = null) => {
  try {
    // 1. Get current stock
    const currentStockRecord = await EmptiesStock.findOne({
      where: { business_partner_key: partnerKey, material_key: materialKey },
      order: [["date_time", "DESC"]],
      transaction
    });


    const currentQty = currentStockRecord ? parseFloat(currentStockRecord.stock_qty_in_base_uom) : 0;
    const newQty = currentQty + quantityChange;

    if (newQty < 0) {
      throw new Error(`Insufficient stock. Current: ${currentQty}, Change: ${quantityChange}`);
    }

    // 2. Create new snapshot
    await EmptiesStock.create({
      business_partner_key: partnerKey,
      material_key: materialKey,
      stock_qty_in_base_uom: newQty,
      date_time: new Date(),
      user_ad: userAd,
      adjustment_reason: reason
    }, { transaction });


    return newQty;
  } catch (error) {
    console.error("Update Stock Error:", error);
    throw error;
  }
};

const setStock = async (partnerKey, materialKey, newQty, userAd, reason = null, transaction = null) => {
  try {
    await EmptiesStock.create({
      business_partner_key: partnerKey,
      material_key: materialKey,
      stock_qty_in_base_uom: newQty,
      date_time: new Date(),
      user_ad: userAd,
      adjustment_reason: reason
    }, { transaction });


    return newQty;
  } catch (error) {
    console.error("Set Stock Error:", error);
    throw error;
  }
};

module.exports = {
  updateStock,
  setStock
};
