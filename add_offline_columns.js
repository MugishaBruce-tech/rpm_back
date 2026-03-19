
const sequelize = require("./utils/sequelize");
const { QueryTypes } = require("sequelize");

async function migrate() {
  console.log("Starting migration to add offline support columns...");
  
  try {
    // 1. Add columns to 'sale' table
    console.log("Updating 'sale' table...");
    try {
      await sequelize.query("ALTER TABLE sale ADD COLUMN CLIENT_ID CHAR(36) UNIQUE AFTER USER_AD", { type: QueryTypes.RAW });
      console.log("- Added CLIENT_ID to sale");
    } catch (e) { console.log("- CLIENT_ID already exists in sale or error:", e.message); }

    try {
      await sequelize.query("ALTER TABLE sale ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", { type: QueryTypes.RAW });
      console.log("- Added updated_at to sale");
    } catch (e) { console.log("- updated_at already exists in sale or error:", e.message); }

    // 2. Add columns to 'business_partner_empties_loan' table
    console.log("Updating 'business_partner_empties_loan' table...");
    try {
      await sequelize.query("ALTER TABLE business_partner_empties_loan ADD COLUMN CLIENT_ID CHAR(36) UNIQUE AFTER user_ad", { type: QueryTypes.RAW });
      console.log("- Added CLIENT_ID to business_partner_empties_loan");
    } catch (e) { console.log("- CLIENT_ID already exists in business_partner_empties_loan or error:", e.message); }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
