const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const EmptiesStock = sequelize.define(
  "empties_stock",
  {
    empties_stock_key: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    business_partner_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "business_partner", key: "business_partner_key" },
    },
    material_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "material", key: "material_key" },
    },
    stock_qty_in_base_uom: {
      type: DataTypes.DECIMAL(18, 3),
      allowNull: false,
      defaultValue: 0,
    },
    date_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    user_ad: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    adjustment_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    freezeTableName: true,
    tableName: "empties_stock",
    timestamps: false,
  }
);

EmptiesStock.associate = (models) => {
  EmptiesStock.belongsTo(models.business_partner, { foreignKey: "business_partner_key", as: "partner" });
  EmptiesStock.belongsTo(models.material, { foreignKey: "material_key", as: "material" });
};

module.exports = EmptiesStock;
