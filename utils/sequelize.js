const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: String(process.env.DB_PASSWORD || ""),
  database: process.env.DB_NAME || "brarudi_rpm",
  port: process.env.DB_PORT || 3306,
};

/**
 * Ensures the database exists before connecting with Sequelize
 */
const createDatabaseIfNotExists = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await connection.end();
    console.log(`Database status checked for: ${dbConfig.database}`);
  } catch (error) {
    console.error("Error ensuring database exists:", error.message);
  }
};

const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: "mysql",
  logging: false,
  define: {
    freezeTableName: true,
    timestamps: false,
  },
});

/**
 * Recursively imports all models from the models directory
 */
const models = {};
const importModelsRecursive = (directory) => {
  const files = fs.readdirSync(directory);
  files.forEach((file) => {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      importModelsRecursive(fullPath);
    } else if (file.endsWith(".js") && file !== "index.js") {
      try {
        const model = require(fullPath);
        if (model && model.name) {
          models[model.name] = model;
          console.log(`Loaded model: ${model.name}`);
        }
      } catch (err) {
        console.error(`Error loading model ${file}:`, err.message);
      }
    }
  });
};

/**
 * Main sync function to be called from server.js
 */
const syncDatabase = async () => {
  try {
    await createDatabaseIfNotExists();

    const modelsDir = path.join(__dirname, "../models");
    if (fs.existsSync(modelsDir)) {
      importModelsRecursive(modelsDir);
    }

    // Apply associations
    Object.keys(models).forEach((modelName) => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });

    // Use alter: false to prevent unintended schema changes
    await sequelize.sync({ alter: false });
    console.log("Database & tables synchronized successfully.");
  } catch (error) {
    console.error("Critical error during database sync:", error.message);
  }
};

sequelize.syncDatabase = syncDatabase;

module.exports = sequelize;
