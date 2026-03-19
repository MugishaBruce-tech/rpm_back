const sequelize = require("./utils/sequelize");
const BusinessPartner = require("./models/BusinessPartner");
const BusinessPartnerTokens = require("./models/BusinessPartnerTokens");
const EmptiesStock = require("./models/EmptiesStock");
const BusinessPartnerEmptiesLoan = require("./models/BusinessPartnerEmptiesLoan");
const Sale = require("./models/Sale");
const SaleItem = require("./models/SaleItem");
const Profil = require("./models/Profil");
const LegalEntity = require("./models/LegalEntity");
const bcrypt = require("bcrypt");
const { execSync } = require("child_process");

async function restartFromScratch() {
  try {
    console.log("--- SYSTEM RESET INITIATED ---");

    // 1. Identify tables to clean (Order is important for FK constraints)
    console.log("Cleaning transaction and user data...");
    
    // Disable check for a moment to allow clean truncate if needed, 
    // though bulk destroy is safer with Sequelize associations
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    await BusinessPartnerTokens.destroy({ where: {}, truncate: true });
    await BusinessPartnerEmptiesLoan.destroy({ where: {}, truncate: true });
    await EmptiesStock.destroy({ where: {}, truncate: true });
    await SaleItem.destroy({ where: {}, truncate: true });
    await Sale.destroy({ where: {}, truncate: true });
    await BusinessPartner.destroy({ where: {}, truncate: true });

    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log("✔ Transactional tables and user list cleared.");

    // 2. Ensure Foundation Data (Profiles & Entities)
    console.log("Verifying foundation data...");
    
    let [entity] = await LegalEntity.findOrCreate({
      where: { legal_entity_name: "Brasseries et Limonaderies du Burundi Brarudi S.A" },
      defaults: { legal_entity_name: "Brasseries et Limonaderies du Burundi Brarudi S.A" }
    });

    let [adminProfile] = await Profil.findOrCreate({
      where: { CODE_PROFIL: "MD_AGENT" },
      defaults: { CODE_PROFIL: "MD_AGENT", STATUT: "active" }
    });
    
    // Ensure other profiles exist too
    await Profil.findOrCreate({ where: { CODE_PROFIL: "OPCO_USER" }, defaults: { CODE_PROFIL: "OPCO_USER", STATUT: "active" } });
    await Profil.findOrCreate({ where: { CODE_PROFIL: "DDM" }, defaults: { CODE_PROFIL: "DDM", STATUT: "active" } });
    await Profil.findOrCreate({ where: { CODE_PROFIL: "SUB_D" }, defaults: { CODE_PROFIL: "SUB_D", STATUT: "active" } });

    console.log("✔ Profiles and Legal Entities verified.");

    // 3. Create Root Admin User
    console.log("Creating Root Admin account...");
    const hashedPassword = await bcrypt.hash("Admin123", 10);
    
    await BusinessPartner.create({
      business_partner_name: "System Administrator",
      user_ad: "admin@brarudi.com",
      password: hashedPassword,
      region: "North",
      business_partner_type: "vendor",
      customer_channel: "distributor",
      business_partner_status: "active",
      legal_entity_key: entity.legal_entity_key,
      profil_id: adminProfile.PROFIL_ID
    });

    console.log("✔ Root user created: admin@brarudi.com / Admin123!");

    // 4. Restore Permissions
    console.log("Restoring RBAC Permission hooks...");
    try {
      execSync("node init_rbac.js", { stdio: 'inherit' });
      console.log("✔ RBAC System re-initialized.");
    } catch (rbacErr) {
      console.error("⚠ Warning: init_rbac.js failed, you might need to run it manually.");
    }

    console.log("--- RESET COMPLETED SUCCESSFULLY ---");
    console.log("You can now login with: admin@brarudi.com / Admin123!");
    process.exit(0);

  } catch (error) {
    console.error("!!! RESET FAILED !!!");
    console.error(error);
    process.exit(1);
  }
}

restartFromScratch();
