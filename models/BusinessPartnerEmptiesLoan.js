const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const BusinessPartnerEmptiesLoan = sequelize.define(
  "business_partner_empties_loan",
  {
    business_partner_empties_loan_key: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    material_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "material", key: "material_key" },
    },
    business_partner_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "business_partner", key: "business_partner_key" },
    },
    bp_loan_qty_in_base_uom: {
      type: DataTypes.DECIMAL(18, 3),
      allowNull: false,
    },
    bp_loaned_to_business_partner_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "business_partner", key: "business_partner_key" },
    },
    bp_loan_status: {
      type: DataTypes.ENUM("pending", "open", "closed", "cancelled", "overdue"),
      allowNull: false,
      defaultValue: "pending",
    },
    bp_loan_status_date_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    external_party_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    user_ad: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    CLIENT_ID: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    freezeTableName: true,
    tableName: "business_partner_empties_loan",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

BusinessPartnerEmptiesLoan.associate = (models) => {
  BusinessPartnerEmptiesLoan.belongsTo(models.business_partner, { foreignKey: "business_partner_key", as: "lender" });
  BusinessPartnerEmptiesLoan.belongsTo(models.business_partner, { foreignKey: "bp_loaned_to_business_partner_key", as: "borrower" });
  BusinessPartnerEmptiesLoan.belongsTo(models.material, { foreignKey: "material_key", as: "material" });
};

module.exports = BusinessPartnerEmptiesLoan;
