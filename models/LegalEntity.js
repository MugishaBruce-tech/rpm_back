const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const LegalEntity = sequelize.define(
  "legal_entity",
  {
    legal_entity_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    legal_entity_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "legal_entity",
    timestamps: false,
  }
);

module.exports = LegalEntity;
