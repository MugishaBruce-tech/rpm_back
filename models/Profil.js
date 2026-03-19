const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const Profil = sequelize.define(
  "profil",
  {
    PROFIL_ID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    CODE_PROFIL: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    STATUT: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    freezeTableName: true,
    tableName: "profil",
    timestamps: false,
  }
);


Profil.associate = (models) => {
  Profil.belongsToMany(models.permission, {
    through: "profil_permission",
    foreignKey: "profil_id",
    otherKey: "permission_id",
    as: "permissions",
  });
  Profil.hasMany(models.brarudi_user, { foreignKey: "profil_id", as: "internal_users" });
  Profil.hasMany(models.business_partner, { foreignKey: "profil_id", as: "partners" });
};

module.exports = Profil;
