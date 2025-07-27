// === backend/src/services/emailService.js ===
// Handles all outgoing email services for SafeStreets Bangladesh

const nodemailer = require('nodemailer');

// Create a reusable transporter object using SMTP transport
// You must configure these environment variables with your email provider's details
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,       // e.g., 'smtp.gmail.com' or your provider's SMTP server
  port: process.env.EMAIL_PORT || 587, // 587 for TLS, 465 for SSL
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,     // Your email address
    pass: process.env.EMAIL_PASS,     // Your email password or app-specific password
  },
  tls: {
    rejectUnauthorized: false // Necessary for some local testing environments like localhost
  }
});

// Verify connection configuration on startup
// transporter.verify(function(error, success) {
//   if (error) {
//     console.error('❌ Email transporter configuration error:', error);
//   } else {
//     console.log('✅ Email transporter is configured and ready to send emails.');
//   }
// });

/**
 * Sends an invitation email to a new user.
 * @param {string} to - The recipient's email address.
 * @param {string} registrationLink - The unique link for registration.
 * @param {string} userType - The type of user being invited ('admin', 'police', 'researcher').
 * @returns {object} - { success: boolean, error: string|null }
 */
const sendInvitationEmail = async (to, registrationLink, userType) => {
  const subject = `Choukidar: Your Invitation to Register as a ${userType.charAt(0).toUpperCase() + userType.slice(1)}`;
  const html = `
      <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://placehold.co/60x60/006A4E/ffffff?text=SS" alt="Choukidar Logo" style="width: 60px; height: 60px; border-radius: 12px; margin-bottom: 10px;">
          <h1 style="color: #006A4E; font-size: 24px; font-weight: 700;">Choukidar</h1>
          <p style="color: #64748B; font-size: 14px;">Ensuring safer communities, together.</p>
        </div>
        <p>Dear Valued User,</p>
        <p>You have been invited to register as a <strong>${userType.charAt(0).toUpperCase() + userType.slice(1)}</strong> on the Choukidar platform.</p>
        <p>To complete your registration, please click on the link below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${registrationLink}" style="display: inline-block; padding: 12px 25px; background-color: #006A4E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Complete Registration
          </a>
        </p>
        <p>This invitation link is valid for <strong>${process.env.INVITE_EXPIRY_DAYS || 7} days</strong>. Please register before it expires.</p>
        <p>If you did not expect this invitation, please ignore this email or contact us immediately.</p>
        <p>Thank you for joining us in making Choukidar a reality.</p>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94A3B8;">
          <p>&copy; ${new Date().getFullYear()} Choukidar. All rights reserved.</p>
          <p>This is an automated email, please do not reply.</p>
        </div>
      </div>
    `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets Bangladesh" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    console.log(`✅ Invitation email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending invitation email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a password reset email.
 * @param {string} to - The recipient's email address.
 * @param {string} resetLink - The unique link for resetting the password.
 * @returns {object} - { success: boolean, error: string|null }
 */
const sendPasswordResetEmail = async (to, resetLink) => {
  const subject = `Reset Your Password for SafeStreets Bangladesh`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Password Reset Request</h2>
      <p>We received a request to reset the password for your account.</p>
      <p>Please click the link below to set a new password. This link is valid for 1 hour.</p>
      <p style="margin: 20px 0;">
        <a href="${resetLink}" style="background-color: #dc3545; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
      <hr>
      <p><em>SafeStreets Bangladesh Team</em></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets Bangladesh" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    console.log(`✅ Password reset email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending password reset email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Sends an email verification link to a new admin.
 * @param {string} to - The recipient's email address.
 * @param {string} verificationLink - The unique link for verifying the email.
 * @returns {object} - { success: boolean, error: string|null }
 */
const sendVerificationEmail = async (to, verificationLink) => {
  const subject = `Verify Your Email for SafeStreets Bangladesh`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Welcome to SafeStreets Bangladesh!</h2>
      <p>Thank you for registering. Please verify your email address to activate your account.</p>
      <p>Click the link below to complete the verification:</p>
      <p style="margin: 20px 0;">
        <a href="${verificationLink}" style="background-color: #28a745; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Verify Email Address</a>
      </p>
      <p>If you did not register for an account, you can safely ignore this email.</p>
      <hr>
      <p><em>SafeStreets Bangladesh Team</em></p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets Bangladesh" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
    console.log(`✅ Verification email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending verification email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send emergency alert email to administrators
 */
const sendEmergencyAlertEmail = async (to, reportData) => {
  const subject = `🚨 EMERGENCY ALERT: ${reportData.type} - SafeStreets Bangladesh`;

  const html = `
    <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 2px solid #dc2626; border-radius: 8px; background-color: #fef2f2;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="background-color: #dc2626; color: white; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🚨 EMERGENCY ALERT</h1>
        </div>
        <h2 style="color: #dc2626; font-size: 20px; margin: 0;">SafeStreets Bangladesh</h2>
      </div>
      
      <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="color: #dc2626; margin-top: 0;">Emergency Report Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Report ID:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.reportId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Type:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Severity:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">
              <span style="background-color: ${reportData.severity >= 4 ? '#dc2626' : '#f59e0b'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${reportData.severity}/5
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Location:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.location}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Time:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${new Date(reportData.timestamp).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Security Score:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">
              <span style="background-color: ${reportData.securityScore >= 70 ? '#dc2626' : reportData.securityScore >= 50 ? '#f59e0b' : '#10b981'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${reportData.securityScore}/100
              </span>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/admin/reports/${reportData.reportId}" style="display: inline-block; padding: 12px 25px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Report Details
        </a>
      </div>
      
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600; color: #856404;">⚠️ IMMEDIATE ACTION REQUIRED</p>
        <p style="margin: 5px 0 0 0; color: #856404; font-size: 14px;">This emergency report requires immediate attention and response.</p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748B;">
        <p>🚨 Emergency Alert System - SafeStreets Bangladesh</p>
        <p>Received at: ${new Date().toLocaleString()}</p>
        <p style="color: #dc2626; font-weight: 600;">This is an automated emergency notification</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets Emergency System" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      html: html,
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    });
    console.log(`🚨 Emergency alert email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending emergency alert email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send fallback alert email (when main systems fail)
 */
const sendFallbackAlertEmail = async (to, reportData) => {
  const subject = `⚠️ SYSTEM FALLBACK: Emergency Report Processed - SafeStreets`;

  const html = `
    <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 2px solid #f59e0b; border-radius: 8px; background-color: #fffbeb;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="background-color: #f59e0b; color: white; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">⚠️ SYSTEM FALLBACK ALERT</h1>
        </div>
        <h2 style="color: #f59e0b; font-size: 18px; margin: 0;">SafeStreets Bangladesh</h2>
      </div>
      
      <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="color: #f59e0b; margin-top: 0;">Emergency Report Processed via Fallback</h3>
        <p style="margin-bottom: 15px; color: #7c2d12;">The main emergency processing system experienced issues, but the report was successfully processed via our fallback system.</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Report ID:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.reportId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Type:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.type}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Timestamp:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${new Date(reportData.timestamp).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Fallback Reason:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${reportData.fallbackReason}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600; color: #92400e;">🔧 SYSTEM STATUS CHECK RECOMMENDED</p>
        <p style="margin: 5px 0 0 0; color: #92400e; font-size: 14px;">Please check the main emergency processing system for any issues.</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/admin/reports/${reportData.reportId}" style="display: inline-block; padding: 12px 25px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Review Report
        </a>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748B;">
        <p>⚠️ Fallback System Alert - SafeStreets Bangladesh</p>
        <p>Processed at: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets Fallback System" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      html: html,
      priority: 'normal'
    });
    console.log(`⚠️ Fallback alert email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending fallback alert email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send system recovery notification
 */
const sendSystemRecoveryEmail = async (to, recoveryData) => {
  const subject = `✅ SYSTEM RECOVERED: Emergency Processing Restored - SafeStreets`;

  const html = `
    <div style="font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 20px; border: 2px solid #10b981; border-radius: 8px; background-color: #f0fdf4;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="background-color: #10b981; color: white; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 700;">✅ SYSTEM RECOVERED</h1>
        </div>
        <h2 style="color: #10b981; font-size: 18px; margin: 0;">SafeStreets Bangladesh</h2>
      </div>
      
      <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="color: #10b981; margin-top: 0;">Emergency Processing System Restored</h3>
        <p>The emergency processing system has been fully restored and is operating normally.</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Recovery Time:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${new Date().toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Downtime Duration:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${recoveryData.downtimeDuration || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5; font-weight: 600;">Reports Processed via Fallback:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e5e5;">${recoveryData.fallbackReports || 0}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #dcfce7; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600; color: #166534;">✅ ALL SYSTEMS OPERATIONAL</p>
        <p style="margin: 5px 0 0 0; color: #166534; font-size: 14px;">Emergency processing has returned to normal operation.</p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748B;">
        <p>✅ Recovery Notification - SafeStreets Bangladesh</p>
        <p>System restored at: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"SafeStreets System Monitor" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`✅ System recovery email sent to ${to}`);
    return { success: true, error: null };
  } catch (error) {
    console.error(`❌ Error sending recovery email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmergencyAlertEmail,
  sendFallbackAlertEmail,
  sendSystemRecoveryEmail
};