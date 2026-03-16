const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const BusinessPartnerContactPerson = sequelize.define(
  "business_partner_contact_person",
  {
    business_partner_contact_person_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    business_partner_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "business_partner", key: "business_partner_key" },
    },
    natural_person_firstname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    natural_person_lastname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    communication_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    user_ad: {
      type: DataTypes.STRING(128),
      allowNull: false,
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
    tableName: "business_partner_contact_person",
    timestamps: false,
  }
);

BusinessPartnerContactPerson.associate = (models) => {
  BusinessPartnerContactPerson.belongsTo(models.business_partner, { foreignKey: "business_partner_key", as: "partner" });
};

module.exports = BusinessPartnerContactPerson;
