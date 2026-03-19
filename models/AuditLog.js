const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const AuditLog = sequelize.define("audit_log", {
  audit_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  business_partner_key: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  path: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  payload: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "audit_log",
  timestamps: false,
});

AuditLog.associate = (models) => {
  AuditLog.belongsTo(models.business_partner, {
    foreignKey: "business_partner_key",
    as: "user",
  });
};

module.exports = AuditLog;
