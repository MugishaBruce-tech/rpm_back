const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const Material = sequelize.define(
  "material",
  {
    material_key: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    material_description: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    global_material_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    base_uom_description: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    material_name2: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    freezeTableName: true,
    tableName: "material",
    timestamps: false,
  }
);

module.exports = Material;
