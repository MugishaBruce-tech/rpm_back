const path = require("path");
// Add backend node_modules to require path
module.paths.push(path.join(__dirname, "backend", "node_modules"));

const bcrypt = require("bcrypt");
const BrarudiUser = require("./models/BrarudiUser");
const BusinessPartner = require("./models/BusinessPartner");
const BusinessPartnerTokens = require("./models/BusinessPartnerTokens");
const Profil = require("./models/Profil");
const LegalEntity = require("./models/LegalEntity");
const sequelize = require("./utils/sequelize");

async function setup() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const profils = await Profil.findAll();
    const legalEntities = await LegalEntity.findAll();

    const mdProfil = profils.find(p => p.CODE_PROFIL === "MD_AGENT");
    const subDProfil = profils.find(p => p.CODE_PROFIL === "SUB_D");
    const legalEntity = legalEntities[0];

    if (!mdProfil || !subDProfil || !legalEntity) {
      console.error("Missing required metadata (Profiles or Legal Entity)");
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash("Test@123", 10);

    // Disable foreign key checks for truncation
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // 0. Delete all tokens
    console.log("Deleting all existing tokens...");
    await BusinessPartnerTokens.destroy({ where: {}, truncate: true });

    // 1. Delete all business partners
    console.log("Deleting all existing business partners...");
    await BusinessPartner.destroy({ where: {}, truncate: true });

    // Re-enable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    // 2. Create new test business partner
    console.log("Creating test business partner...");
    const testPartner = await BusinessPartner.create({
      business_partner_name: "Test Distributor",
      business_partner_type: "customer",
      customer_channel: "distributor",
      user_ad: "test.distributor@brarudi.bi",
      password: hashedPassword,
      region: "North",
      legal_entity_key: legalEntity.legal_entity_key,
      profil_id: subDProfil.PROFIL_ID,
      business_partner_status: "active",
    });

    // 3. Handle BrarudiUser
    console.log("Cleaning up test admin user if exists...");
    await BrarudiUser.destroy({ where: { email: "test.admin@brarudi.bi" } });

    console.log("Creating test internal user (MD Agent)...");
    const testAdmin = await BrarudiUser.create({
      name: "Global Test Admin",
      email: "test.admin@brarudi.bi",
      password: hashedPassword,
      region: null,
      profil_id: mdProfil.PROFIL_ID,
      status: "active",
    });

    console.log("Test setup complete!");
    console.log("--- TEST CREDENTIALS ---");
    console.log("Internal User (MD): test.admin@brarudi.bi / Test@123");
    console.log("Business Partner: test.distributor@brarudi.bi / Test@123");
    console.log("------------------------");

    process.exit(0);
  } catch (error) {
    console.error("Setup error:", error);
    process.exit(1);
  }
}

setup();
