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
    return nodemailer.createTransport({
      host: process.env.MAIL_HOST || "82.208.23.214",
      port: parseInt(process.env.MAIL_PORT) || 587,
      secure: false, 
      auth: {
        user: process.env.MAIL_USERNAME || "noreply@mediabox.bi",
        pass: process.env.MAIL_PASSWORD || "-B1s2s-fmS&tB]W_",
      },
      tls: {
        rejectUnauthorized: false
      }
    });
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
      from: `"BRARUDI RPM Tracker" <${process.env.MAIL_FROM || "noreply@mediabox.bi"}>`,
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
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  /**
   * Send OTP to user for login verification
   */
  async sendOTPEmail(to, name, otp) {
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.MAIL_FROM || "noreply@mediabox.bi"}>`,
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
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error("Error sending OTP email:", error);
      throw error;
    }
  }

  /**
   * Send loan request notification
   */
  async sendLoanNotificationEmail(to, name, requesterName, materialName, quantity) {
    const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.MAIL_FROM || "noreply@mediabox.bi"}>`,
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
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log(`Loan Notification Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("Error sending loan notification email:", error);
      throw error;
    }
  }

  /**
   * Send password reset confirmation
   */
  async sendPasswordResetEmail(to, name, newPassword) {
    const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    
    const mailOptions = {
      from: `"BRARUDI RPM Tracker" <${process.env.MAIL_FROM || "noreply@mediabox.bi"}>`,
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
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  }
}

module.exports = new MailService();
