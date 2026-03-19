const { DataTypes } = require("sequelize");
const sequelize = require("../utils/sequelize");

const BrarudiUser = sequelize.define(
  "brarudi_user",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    region: {
      type: DataTypes.STRING(50),
      allowNull: true, // Only for DDM
    },
    profil_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "profil", key: "PROFIL_ID" },
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "blocked"),
      allowNull: false,
      defaultValue: "active",
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "brarudi_users",
    timestamps: false,
  }
);

BrarudiUser.associate = (models) => {
  BrarudiUser.belongsTo(models.profil, { foreignKey: "profil_id", as: "profil" });
  BrarudiUser.hasMany(models.businesspartnertokens, { foreignKey: "brarudi_user_id", as: "tokens" });
};

module.exports = BrarudiUser;
