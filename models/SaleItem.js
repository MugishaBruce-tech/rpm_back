const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const SaleItem = sequelize.define(
  "sale_item",
  {
    SALE_ITEM_ID: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    SALE_ID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "sale", key: "SALE_ID" },
    },
    material_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "material", key: "material_key" },
    },
    QUANTITY: {
      type: DataTypes.DECIMAL(18, 3),
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: "sale_item",
    timestamps: false,
  }
);

SaleItem.associate = (models) => {
  SaleItem.belongsTo(models.sale, { foreignKey: "SALE_ID", as: "sale" });
  SaleItem.belongsTo(models.material, { foreignKey: "material_key", as: "material" });
};

module.exports = SaleItem;
