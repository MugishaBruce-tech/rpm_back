const sequelize = require("./utils/sequelize");

const migrate = async () => {
  try {
    console.log("Starting migration: Adding adjustment_reason to empties_stock...");
    await sequelize.query("ALTER TABLE empties_stock ADD COLUMN adjustment_reason TEXT NULL;");
    console.log("Migration successful!");
    process.exit(0);
  } catch (error) {
    if (error.message.includes("Duplicate column name")) {
        console.log("Column adjustment_reason already exists. Skipping.");
        process.exit(0);
    }
    console.error("Migration failed:", error.message);
    process.exit(1);
  }
};

migrate();
