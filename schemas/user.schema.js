const { z } = require("zod");

const createUserSchema = z.object({
  business_partner_name: z.string().min(2, "Name must be at least 2 characters"),
  business_partner_type: z.enum(["customer", "vendor", "TEST", "INTERNAL"]).optional(),
  customer_channel: z.enum(["sub-distributor", "distributor", "SYSTEM"]).optional(),
  user_ad: z.string().email("Invalid email/AD format"),
  region: z.preprocess(
    (val) => (val === '' ? null : val),
    z.enum(["North", "South", "West", "Est"]).nullable().optional()
  ),
  legal_entity_key: z.coerce.number().int().optional(),
  profil_id: z.coerce.number().int().min(1, "Profile ID is required"),
});

const updateUserSchema = createUserSchema.partial(); // All fields optional for update

module.exports = {
  createUserSchema,
  updateUserSchema,
};
