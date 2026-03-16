const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const Permission = sequelize.define(
  "permission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "general",
    },
  },
  {
    freezeTableName: true,
    tableName: "permission",
    timestamps: false,
  }
);

Permission.associate = (models) => {
  Permission.belongsToMany(models.profil, {
    through: "profil_permission",
    foreignKey: "permission_id",
    otherKey: "profil_id",
    as: "profiles",
  });
};

module.exports = Permission;
