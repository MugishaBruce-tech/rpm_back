const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const ProfilPermission = sequelize.define(
  "profil_permission",
  {
    profil_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "profil",
        key: "PROFIL_ID",
      },
    },
    permission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "permission",
        key: "id",
      },
    },
  },
  {
    freezeTableName: true,
    tableName: "profil_permission",
    timestamps: false,
  }
);

module.exports = ProfilPermission;
