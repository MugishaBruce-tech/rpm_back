const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const BusinessPartner = sequelize.define(
  "business_partner",
  {
    business_partner_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    legal_entity_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "legal_entity", key: "legal_entity_key" },
    },
    business_partner_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    business_partner_type: {
      type: DataTypes.ENUM("customer", "vendor", "TEST"),
      allowNull: false,
    },
    customer_channel: {
      type: DataTypes.ENUM("sub-distributor"),
      allowNull: false,
    },
    business_partner_status: {
      type: DataTypes.ENUM("active", "inactive", "blocked"),
      allowNull: false,
      defaultValue: "active",
    },
    user_ad: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    region: {
      type: DataTypes.ENUM("North", "South", "West", "Est"),
      allowNull: false,
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },
    mfa_secret: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_mfa_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    profil_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "profil", key: "PROFIL_ID" },
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
    otp_code: {
      type: DataTypes.STRING(6),
      allowNull: true,
    },
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "business_partner",
    timestamps: false,
  }
);

BusinessPartner.associate = (models) => {
  BusinessPartner.belongsTo(models.legal_entity, { foreignKey: "legal_entity_key", as: "legal_entity" });
  BusinessPartner.belongsTo(models.profil, { foreignKey: "profil_id", as: "profil" });
  BusinessPartner.hasMany(models.audit_log, { foreignKey: "business_partner_key", as: "audit_logs" });
  BusinessPartner.hasMany(models.businesspartnertokens, { foreignKey: "business_partner_key", as: "tokens" });
};

module.exports = BusinessPartner;
