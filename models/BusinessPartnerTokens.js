const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const BusinessPartnerTokens = sequelize.define("businesspartnertokens", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  business_partner_key: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "business_partner", key: "business_partner_key" },
  },
  brarudi_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "brarudi_users", key: "id" },
  },
  refresh_token: { type: DataTypes.TEXT, allowNull: false },
  is_active: { type: DataTypes.TINYINT, defaultValue: 1 },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  user_agent: { type: DataTypes.TEXT, allowNull: true },
  browser_name: { type: DataTypes.STRING(50), allowNull: true },
  os_name: { type: DataTypes.STRING(50), allowNull: true },
  device_type: { type: DataTypes.STRING(50), allowNull: true },
  location: { type: DataTypes.STRING(255), allowNull: true },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

BusinessPartnerTokens.associate = (models) => {
  BusinessPartnerTokens.belongsTo(models.business_partner, { foreignKey: "business_partner_key", as: "partner" });
  BusinessPartnerTokens.belongsTo(models.brarudi_user, { foreignKey: "brarudi_user_id", as: "internal_user" });
};

module.exports = BusinessPartnerTokens;
