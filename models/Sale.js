const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const Sale = sequelize.define(
  "sale",
  {
    SALE_ID: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    BUSINESS_PARTNER_ID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "business_partner", key: "business_partner_key" },
    },
    SALE_TYPE: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
    },
    TARGET_NAME: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    NOTES: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    DATE_SALE: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    USER_AD: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    CLIENT_ID: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "sale",
    timestamps: true,
    createdAt: "DATE_SALE",
    updatedAt: "updated_at",
  }
);

Sale.associate = (models) => {
  Sale.belongsTo(models.business_partner, { foreignKey: "BUSINESS_PARTNER_ID", as: "partner" });
  Sale.hasMany(models.sale_item, { foreignKey: "SALE_ID", as: "items" });
};

module.exports = Sale;
