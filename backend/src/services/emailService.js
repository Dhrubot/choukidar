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

module.exports = {
  sendInvitationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};