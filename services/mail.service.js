const nodemailer = require("nodemailer");
const path = require("path");

/**
 * Mail Service to handle automated email communications
 */
class MailService {
  constructor() {
    this.logoPath = path.join(__dirname, "../assets/logo.png");
  }

  getTransporter() {
    // Debug: Log configuration
    console.log("[MAIL DEBUG] Transporter Config:", {
      host: process.env.EMAIL_HOST || "MISSING",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      user: process.env.EMAIL_USERNAME ? "***" : "MISSING",
      password: process.env.EMAIL_PASSWORD ? "***" : "MISSING",
      from: process.env.EMAIL_FROM || "MISSING"
    });

    const config = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true", 
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    };

    // Validate required fields
    if (!config.auth.user || !config.auth.pass || !config.host) {
      console.error("[MAIL ERROR] Missing email configuration:", {
        hasHost: !!config.host,
        hasUser: !!config.auth.user,
        hasPass: !!config.auth.pass
      });
    }

    return nodemailer.createTransport(config);
  }

  getLogoAttachment() {
    // Attachment removed to prevent "logo chips" in email previews
    return null;
  }

  /**
   * Send credentials to a new user
   */
  async sendWelcomeEmail(to, name, username, password) {
    const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.EMAIL_FROM}>`,
      to,
      subject: "Welcome to BRARUDI RPM Tracker - Your Account Credentials",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #216730; padding: 25px; text-align: center;">
            <div style="color: white; font-weight: 900; font-size: 28px; letter-spacing: 2px; text-transform: uppercase;">BRARUDI</div>
            <div style="color: rgba(255,255,255,0.7); font-size: 12px; font-weight: bold; margin-top: 5px; letter-spacing: 4px;">RPM TRACKER</div>
          </div>
          <div style="padding: 40px; background-color: #ffffff; color: #1e293b;">
            <h2 style="color: #1e293b; margin-top: 0;">Account Created Successfully</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your account for the <strong>BRARUDI RPM Tracker</strong> has been created. You can now log in using the credentials below:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 30px 0; border: 1px solid #f1f5f9;">
              <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #E30613;">${password}</code></p>
            </div>
            
            <p style="margin-bottom: 30px;">For security reasons, we recommend that you change your password after your first login.</p>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" style="background-color: #216730; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Login to Dashboard</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">
            <p>&copy; 2026 BRARUDI All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: []
    };

    try {
      console.log("[MAIL DEBUG] Preparing to send welcome email to:", to);
      const transporter = this.getTransporter();
      
      console.log("[MAIL DEBUG] Attempting sendMail...");
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`[MAIL SUCCESS] Email sent successfully: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("[MAIL ERROR] Failed to send welcome email to:", to);
      console.error("[MAIL ERROR] Error details:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send OTP to user for login verification
   */
  async sendOTPEmail(to, name, otp) {
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.EMAIL_FROM}>`,

      to,
      subject: "Security Verification Code - RPM Tracker",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #216730; padding: 20px; text-align: center;">
            <div style="color: white; font-weight: 900; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">BRARUDI</div>
            <h1 style="color: rgba(255,255,255,0.7); margin: 0; font-size: 14px; letter-spacing: 3px;">VERIFICATION REQUIRED</h1>
          </div>
          <div style="padding: 30px; background-color: #ffffff; color: #1e293b; text-align: center;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>To complete your login, please enter the following verification code:</p>
            
            <div style="margin: 25px 0;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #216730; background: #f0fdf4; padding: 10px 20px; border-radius: 8px; border: 2px dashed #216730;">${otp}</span>
            </div>
            
            <p style="font-size: 13px; color: #64748b;">This code is valid for <strong>30 minutes</strong>.</p>
          </div>
          <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #f1f5f9;">
            <p>&copy; 2026 BRARUDI All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: []
    };

    try {
      console.log("[MAIL DEBUG] Preparing to send OTP email to:", to);
      const transporter = this.getTransporter();
      
      console.log("[MAIL DEBUG] Attempting sendMail for OTP...");
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`[MAIL SUCCESS] OTP email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("[MAIL ERROR] Failed to send OTP email to:", to);
      console.error("[MAIL ERROR] Error details:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send loan request notification
   */
  async sendLoanNotificationEmail(to, name, requesterName, materialName, quantity) {
    const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.EMAIL_FROM}>`,

      to,
      subject: "New Loan Request - Action Required",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #216730; padding: 25px; text-align: center;">
            <div style="color: white; font-weight: 900; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">BRARUDI</div>
            <h1 style="color: rgba(255,255,255,0.7); margin: 0; font-size: 16px; letter-spacing: 1px;">NEW LOAN REQUEST</h1>
          </div>
          <div style="padding: 40px; background-color: #ffffff; color: #1e293b;">
            <h2 style="color: #1e293b; margin-top: 0;">Loan Approval Pending</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>You have received a new loan request for material in <strong>BRARUDI RPM Tracker</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 25px; border-radius: 6px; margin: 30px 0; border: 1px solid #f1f5f9;">
              <p style="margin: 0 0 10px 0;"><strong>Requester:</strong> ${requesterName}</p>
              <p style="margin: 0 0 10px 0;"><strong>Material:</strong> ${materialName}</p>
              <p style="margin: 0;"><strong>Quantity:</strong> <span style="font-weight: bold; color: #216730;">${quantity} Units</span></p>
            </div>
            
            <p style="margin-bottom: 30px;">Please log in to your dashboard to approve or reject this request.</p>
            
            <div style="text-align: center;">
              <a href="${loginUrl}/loans" style="background-color: #216730; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Request in Dashboard</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">
            <p>&copy; 2026 BRARUDI All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: []
    };

    try {
      console.log("[MAIL DEBUG] Preparing to send loan notification to:", to);
      const transporter = this.getTransporter();
      
      console.log("[MAIL DEBUG] Attempting sendMail for loan notification...");
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`[MAIL SUCCESS] Loan notification email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("[MAIL ERROR] Failed to send loan notification email to:", to);
      console.error("[MAIL ERROR] Error details:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send password reset confirmation
   */
  async sendPasswordResetEmail(to, name, newPassword) {
    const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.EMAIL_FROM}>`,

      to,
      subject: "Password Updated - BRARUDI RPM Tracker",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #D71921; padding: 30px; text-align: center;">
            <img src="cid:heineken_logo" alt="logo" style="height: 60px; margin-bottom: 10px;" />
            <h1 style="color: white; margin: 0; font-size: 24px;">RPM Tracker</h1>
          </div>
          <div style="padding: 40px; background-color: #ffffff; color: #1e293b;">
            <h2 style="color: #1e293b; margin-top: 0;">Password Successfully Updated</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your password for the <strong>BRARUDI RPM Tracker</strong> has been updated. Your new temporary credentials are:</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 30px 0; border: 1px solid #f1f5f9;">
              <p style="margin: 0;"><strong>New Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #D71921;">${newPassword}</code></p>
            </div>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" style="background-color: #D71921; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Login to Dashboard</a>
            </div>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9;">
            <p>&copy; 2026 BRARUDI All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: [this.getLogoAttachment()]
    };

    try {
      console.log("[MAIL DEBUG] Preparing to send password reset email to:", to);
      const transporter = this.getTransporter();
      
      console.log("[MAIL DEBUG] Attempting sendMail for password reset...");
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`[MAIL SUCCESS] Password reset email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("[MAIL ERROR] Failed to send password reset email to:", to);
      console.error("[MAIL ERROR] Error details:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Test mail connection (useful for debugging)
   */
  async testConnection() {
    console.log("[MAIL TEST] Starting connection test...");
    try {
      const transporter = this.getTransporter();
      console.log("[MAIL TEST] Verifying SMTP connection...");
      const verified = await transporter.verify();
      
      if (verified) {
        console.log("[MAIL TEST] ✓ SMTP connection successful!");
        return { success: true, message: "SMTP connection verified" };
      }
    } catch (error) {
      console.error("[MAIL TEST] ✗ Connection failed!");
      console.error("[MAIL TEST] Error details:", {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response
      });
      throw error;
    }
  }
}

module.exports = new MailService();
