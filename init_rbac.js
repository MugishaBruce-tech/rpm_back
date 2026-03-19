const sequelize = require("./utils/sequelize");
const Permission = require("./models/Permission");
const Profil = require("./models/Profil");
const ProfilPermission = require("./models/ProfilPermission");

const PERMISSIONS = [
  // Dashboard access
  { code: 'DASHBOARD_GLOBAL_VIEW', description: 'View global statistics and dashboard', category: 'dashboard' },
  { code: 'DASHBOARD_REGIONAL_VIEW', description: 'View regional statistics and dashboard', category: 'dashboard' },
  { code: 'DASHBOARD_SELF_VIEW', description: 'View own statistics and dashboard', category: 'dashboard' },
  
  // Stock permissions
  { code: 'STOCK_VIEW_GLOBAL', description: 'View stock of all users globally', category: 'stock' },
  { code: 'STOCK_VIEW_REGIONAL', description: 'View stock of users in own region', category: 'stock' },
  { code: 'STOCK_VIEW_SELF', description: 'View own stock', category: 'stock' },
  { code: 'STOCK_EDIT_SELF', description: 'Manually adjust own stock levels', category: 'stock' },
  { code: 'STOCK_ADJUST_GLOBAL', description: 'Adjust stock for any user', category: 'stock' },
  
  // User Management permissions
  { code: 'USER_VIEW_ALL', description: 'View all users globally', category: 'user' },
  { code: 'USER_VIEW_REGION', description: 'View users in own region', category: 'user' },
  { code: 'USER_CREATE_ALL', description: 'Create users in any region/profile', category: 'user' },
  { code: 'USER_EDIT_ALL', description: 'Edit any user in the system', category: 'user' },
  { code: 'USER_DELETE_ALL', description: 'Delete any user in the system', category: 'user' },
  { code: 'USER_CREATE_REGION', description: 'Create SUB_D users in own region', category: 'user' },
  { code: 'USER_EDIT_REGION', description: 'Edit SUB_D users in own region', category: 'user' },
  { code: 'USER_DELETE_REGION', description: 'Delete SUB_D users in own region', category: 'user' },
  
  // Loan permissions
  { code: 'LOAN_VIEW_GLOBAL', description: 'View all loans globally', category: 'loan' },
  { code: 'LOAN_VIEW_REGIONAL', description: 'View loans within own region', category: 'loan' },
  { code: 'LOAN_VIEW_SELF', description: 'View own loans', category: 'loan' },
  { code: 'LOAN_MANAGE_ALL', description: 'Approve/Reject any loan', category: 'loan' },
  { code: 'LOAN_MANAGE_REGION', description: 'Approve/Reject loans in own region', category: 'loan' },
  { code: 'LOAN_REQUEST_SELF', description: 'Request personal loans', category: 'loan' },
  { code: 'LOAN_MANAGE_SELF', description: 'Approve/Reject own provided loans', category: 'loan' },
  
  // Settings
  { code: 'SETTINGS_MANAGE', description: 'Manage system settings and colors', category: 'settings' },
  
  // Audit Logs
  { code: 'AUDIT_VIEW', description: 'View user activity and audit logs', category: 'audit' }
];

const ROLE_PERMISSIONS = {
  'MD_AGENT': PERMISSIONS.map(p => p.code),
  'OPCO_USER': [
    'DASHBOARD_REGIONAL_VIEW', 
    'STOCK_VIEW_REGIONAL', 
    'USER_VIEW_REGION',
    'LOAN_VIEW_REGIONAL'
  ],
  'DDM': [
    'DASHBOARD_REGIONAL_VIEW', 
    'STOCK_VIEW_REGIONAL', 
    'USER_VIEW_REGION',
    'USER_CREATE_REGION', 
    'USER_EDIT_REGION', 
    'USER_DELETE_REGION', 
    'LOAN_VIEW_REGIONAL', 
    'LOAN_MANAGE_REGION'
  ],
  'SUB_D': [
    'DASHBOARD_SELF_VIEW', 
    'STOCK_VIEW_SELF', 
    'STOCK_EDIT_SELF', 
    'USER_VIEW_REGION',
    'LOAN_VIEW_SELF',
    'LOAN_REQUEST_SELF',
    'LOAN_MANAGE_SELF'
  ]
};

async function initRBAC() {
  try {
    console.log("Starting RBAC Initialization...");
    
    // Sync the new tables
    await Permission.sync();
    await ProfilPermission.sync();
    
    console.log("Tables created/synced.");

    // 1. Upsert Permissions
    for (const p of PERMISSIONS) {
      await Permission.findOrCreate({
        where: { code: p.code },
        defaults: p
      });
    }
    console.log("Permissions seeded.");

    // 2. Assign Permissions to Roles
    const allProfiles = await Profil.findAll();
    
    for (const profile of allProfiles) {
      const allowedCodes = ROLE_PERMISSIONS[profile.CODE_PROFIL] || [];
      
      const permissions = await Permission.findAll({
        where: {
          code: allowedCodes
        }
      });
      
      if (permissions.length > 0) {
        // Remove existing associations first to ensure a clean state
        await ProfilPermission.destroy({ where: { profil_id: profile.PROFIL_ID } });
        
        // Add new associations
        const associations = permissions.map(p => ({
          profil_id: profile.PROFIL_ID,
          permission_id: p.id
        }));
        
        await ProfilPermission.bulkCreate(associations);
        console.log(`Assigned ${permissions.length} permissions to ${profile.CODE_PROFIL}`);
      }
    }

    console.log("RBAC Initialization completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error during RBAC initialization:", error);
    process.exit(1);
  }
}

initRBAC();
