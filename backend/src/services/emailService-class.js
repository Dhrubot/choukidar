// === backend/src/services/emailService.js ===
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

// Configure the email transporter
// We can use an SMTP server or a service like SendGrid, Mailgun, etc.
// Examples below for different setups. Choose one and fill in the details.

// --- Example 1: Using Gmail (less secure for production, requires "App Passwords") ---
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER, // Your Gmail address
//     pass: process.env.EMAIL_PASS, // Your Gmail App Password
//   },
// });

// --- Example 2: Using a generic SMTP server ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // e.g., 'smtp.sendgrid.net', 'smtp.mailgun.org'
  port: process.env.SMTP_PORT, // e.g., 587 (TLS) or 465 (SSL)
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // SMTP username
    pass: process.env.SMTP_PASS, // SMTP password
  },
  tls: {
    // Do not fail on invalid certs (use only in development if necessary)
    rejectUnauthorized: false
  }
});

// --- Example 3: Using AWS SES (requires AWS SDK, more complex setup) ---
// const AWS = require('aws-sdk');
// AWS.config.update({
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   region: process.env.AWS_REGION,
// });
// const ses = new AWS.SES({ apiVersion: '2010-12-01' });
// const transporter = nodemailer.createTransport({
//   SES: { ses, aws: AWS },
// });

class EmailService {
  async sendVerificationEmail(email, verificationLink) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'no-reply@safestreets.bd',
      to: email,
      subject: 'SafeStreets Bangladesh - Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #006A4E;">SafeStreets Bangladesh</h2>
          <p>Please verify your email address to complete your account setup.</p>
          <p>Click the link below to verify your email:</p>
          <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #006A4E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Verify Email Address
          </a>
          <p>If you didn't create this account, please ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error sending verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(email, resetLink) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'no-reply@safestreets.bd',
      to: email,
      subject: 'SafeStreets Bangladesh - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #006A4E;">SafeStreets Bangladesh</h2>
          <p>You requested a password reset for your account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #006A4E; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Reset Password
          </a>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }
/**
 * Sends an invitation email to a new user.
 * @param {string} toEmail - The recipient's email address.
 * @param {string} registrationLink - The unique registration link.
 * @param {string} userType - The type of user being invited (admin, police, researcher).
 * @returns {Promise<object>} - Information about the sent email.
 */
  async sendInvitationEmail(toEmail, registrationLink, userType) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'no-reply@Choukidar.bd', // our sender email address
    to: toEmail,
    subject: `Choukidar: Your Invitation to Register as a ${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
    html: `
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
    `,
    text: `
      Dear Valued User,

      You have been invited to register as a ${userType.charAt(0).toUpperCase() + userType.slice(1)} on the Choukidar platform.

      To complete your registration, please click on the link below:
      ${registrationLink}

      This invitation link is valid for ${process.env.INVITE_EXPIRY_DAYS || 7} days. Please register before it expires.

      If you did not expect this invitation, please ignore this email or contact us immediately.

      Thank you for joining us in making Choukidar a reality.

      Choukidar Team
      © ${new Date().getFullYear()} Choukidar. All rights reserved.
      This is an automated email, please do not reply.
    `,
  };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error sending invitation email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendAccountUnlockedEmail(email, username) {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'no-reply@safestreets.bd',
      to: email,
      subject: 'SafeStreets Bangladesh - Account Unlocked',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #006A4E;">SafeStreets Bangladesh</h2>
          <p>Your account has been unlocked by an administrator.</p>
          <p><strong>Username:</strong> ${username}</p>
          <p>You can now log in to your account.</p>
          <p>If you didn't request this unlock, please contact support immediately.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('Error sending account unlocked email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();