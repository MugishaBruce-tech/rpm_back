const { z } = require("zod");

const loginSchema = z.object({
  USER_AD: z.string().email("Please provide a valid email/AD address"),
  PASSWORD: z.string().min(1, "Password is required"),
});

const otpSchema = z.object({
  token: z.string().length(6, "The verification code must be exactly 6 digits"),
  mfa_token: z.string().min(1, "Verification session token is missing"),
});

const mfaVerifySchema = z.object({
  token: z.string().length(6, "The MFA code must be exactly 6 digits"),
  mfa_token: z.string().optional(),
});

module.exports = {
  loginSchema,
  otpSchema,
  mfaVerifySchema,
};
