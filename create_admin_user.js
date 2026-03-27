const bcrypt = require("bcrypt");
const BrarudiUser = require("./models/BrarudiUser");
const Profil = require("./models/Profil");
const sequelize = require("./utils/sequelize");

async function createAdminUser() {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    // Find the MD_AGENT profile
    const mdProfile = await Profil.findOne({ where: { CODE_PROFIL: "MD_AGENT" } });
    
    if (!mdProfile) {
      console.error("MD_AGENT profile not found. Please ensure profiles are seeded.");
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await BrarudiUser.findOne({ where: { email: "test.admin@brarudi.bi" } });
    
    if (existingUser) {
      console.log("User already exists:", existingUser.email);
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("11111111", 10);

    // Create user
    const newUser = await BrarudiUser.create({
      name: "Admin MD Agent",
      email: "test.admin@brarudi.bi",
      password: hashedPassword,
      region: null, // MD_AGENT has no region
      profil_id: mdProfile.PROFIL_ID,
      status: "active",
    });

    console.log("User created successfully:");
    console.log("Email:", newUser.email);
    console.log("Name:", newUser.name);
    console.log("Profile ID:", newUser.profil_id);
    console.log("Status:", newUser.status);

    process.exit(0);
  } catch (error) {
    console.error("Error creating user:", error.message);
    process.exit(1);
  }
}

createAdminUser();
