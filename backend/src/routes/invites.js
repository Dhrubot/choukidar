// === backend/src/routes/invites.js ===
const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // For generating secure tokens
const User = require('../models/User');
const InviteToken = require('../models/InviteToken');
const AuditLog = require('../models/AuditLog'); // For logging sensitive actions
const { requireAdmin, requirePermission } = require('../middleware/roleBasedAccess');
// Correctly import named exports from userTypeDetection
const { userTypeDetection } = require('../middleware/userTypeDetection'); 
const emailService = require('../services/emailService'); // Import the email service

// Apply userTypeDetection to all routes in this router
router.use(userTypeDetection);

/**
 * Helper function to create an audit log entry for invite-related actions.
 */
const logInviteAction = async (actor, actionType, outcome, details = {}, severity = 'medium', target = {}) => {
  try {
    await AuditLog.create({ actor, actionType, outcome, details, severity, target });
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType}:`, error);
  }
};

// === INVITE GENERATION (ADMIN ONLY) ===
// POST /api/invites/generate - Generate a new registration invite token
router.post('/generate',
  requireAdmin, // Only authenticated admins can generate invites
  requirePermission('manage_admin_accounts'), // Admin permission to manage user accounts
  async (req, res) => {
    try {
      const {
        userType,
        email, // Required for targeted invites
        permissions = [], // Array of strings for admin permissions
        adminLevel, // Number, specific to admin
        policeAccessLevel, // String, specific to police
        researcherAccessLevel, // String, specific to researcher
        expiryDays = 7 // Default expiry in days
      } = req.body;

      const requestingAdmin = req.userContext.user;

      // --- Enforce highest admin only for sending invites ---
      // Check if the requesting admin has 'super_admin' permission OR adminLevel 10
      const isAdminSuperAdmin = requestingAdmin.roleData.admin.permissions.includes('super_admin');
      const isAdminHighestLevel = requestingAdmin.roleData.admin.adminLevel === 10;

      if (!isAdminSuperAdmin && !isAdminHighestLevel) {
        await logInviteAction(
          { userId: requestingAdmin._id, userType: 'admin', username: requestingAdmin.roleData.admin.username },
          'invite_token_generate',
          'failure',
          { reason: 'Insufficient permissions', userType, email },
          'high'
        );
        return res.status(403).json({ 
          success: false, 
          message: 'Only super admins or highest-level admins can generate and send invitations.' 
        });
      }
      // --- End highest admin check ---

      // Basic validation for required fields
      if (!userType || !['admin', 'police', 'researcher'].includes(userType)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid user type specified (must be admin, police, or researcher).' 
        });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { // Email is required for sending invites
        return res.status(400).json({ 
          success: false, 
          message: 'A valid email address is required to send an invitation.' 
        });
      }

      // Generate a strong, unique token
      const token = crypto.randomBytes(32).toString('hex'); // Generates a 64-character hex string
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      const inviteData = {
        token,
        userType,
        email, // Email is mandatory for the invite token
        expiresAt,
        createdBy: requestingAdmin._id // The admin who created this invite
      };

      // Add role-specific data based on userType with validation
      if (userType === 'admin') {
        // Ensure permissions are valid for admin
        const validAdminPermissions = ['moderation', 'analytics', 'user_management', 'safe_zones', 'security_monitoring', 'super_admin'];
        const filteredPermissions = permissions.filter(p => validAdminPermissions.includes(p));
        inviteData.permissions = filteredPermissions.length > 0 ? filteredPermissions : ['moderation']; // Default to moderation if none provided or invalid
        inviteData.adminLevel = adminLevel || 5; // Default admin level
      } else if (userType === 'police') {
        const validPoliceLevels = ['read_only', 'standard', 'supervisor', 'chief'];
        inviteData.policeAccessLevel = validPoliceLevels.includes(policeAccessLevel) ? policeAccessLevel : 'read_only';
      } else if (userType === 'researcher') {
        const validResearcherLevels = ['basic', 'full', 'api_access'];
        inviteData.researcherAccessLevel = validResearcherLevels.includes(researcherAccessLevel) ? researcherAccessLevel : 'basic';
      }

      const newInvite = new InviteToken(inviteData);
      await newInvite.save();

      // Construct the full registration link for the frontend
      const registrationLink = `${process.env.FRONTEND_URL}/register?token=${token}`;

      // --- Send the invitation email ---
      const emailResult = await emailService.sendInvitationEmail(email, registrationLink, userType);

      if (!emailResult.success) {
        // Log the email error but still return success for token generation
        // as the token is valid, just the email sending failed.
        console.error(`❌ Failed to send invitation email for ${email}: ${emailResult.error}`);
        
        await logInviteAction(
          { userId: requestingAdmin._id, userType: 'admin', username: requestingAdmin.roleData.admin.username },
          'invite_token_generate',
          'failure',
          { reason: 'Email sending failed', userType, email, expiryDays },
          'medium',
          { id: newInvite._id, type: 'InviteToken' }
        );
        
        // Optionally, you might want to delete the token if email is critical for invite delivery
        // await InviteToken.findByIdAndDelete(newInvite._id);
        return res.status(500).json({ 
          success: false, 
          message: 'Invite token generated, but failed to send invitation email. Please check email service configuration.' 
        });
      }
      // --- End email sending ---

      // --- Audit Log for successful generation ---
      await logInviteAction(
        { userId: requestingAdmin._id, userType: 'admin', username: requestingAdmin.roleData.admin.username },
        'invite_token_generate',
        'success',
        { userType, email, expiryDays, permissions: inviteData.permissions, adminLevel: inviteData.adminLevel },
        'medium',
        { id: newInvite._id, type: 'InviteToken' }
      );

      console.log(`✅ Invite token generated and email sent to ${email} for ${userType} by admin ${requestingAdmin.roleData.admin.username}: ${token}`);

      res.json({
        success: true,
        message: `Invite token generated and invitation email sent to ${email} for ${userType}.`,
        token,
        registrationLink,
        expiresAt,
        userType,
        inviteDetails: {
          userType: inviteData.userType,
          permissions: inviteData.permissions,
          adminLevel: inviteData.adminLevel,
          policeAccessLevel: inviteData.policeAccessLevel,
          researcherAccessLevel: inviteData.researcherAccessLevel
        }
      });

    } catch (error) {
      console.error('❌ Error generating invite token or sending email:', error);
      
      // Log audit failure
      if (req.userContext?.user) {
        await logInviteAction(
          { userId: req.userContext.user._id, userType: 'admin', username: req.userContext.user.roleData.admin.username },
          'invite_token_generate',
          'failure',
          { reason: error.message },
          'critical'
        );
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to generate invite token or send email.', 
        error: error.message 
      });
    }
  }
);

// === GET /api/invites/validate-token/:token - Validate an invite token ===
router.get('/validate-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await InviteToken.findOne({ token });

    if (!invite) {
      return res.status(404).json({ 
        success: false, 
        message: 'Invalid invitation token.' 
      });
    }
    
    if (invite.isUsed) {
      return res.status(409).json({ 
        success: false, 
        message: 'This invitation token has already been used.' 
      });
    }
    
    if (new Date() > invite.expiresAt) {
      // Mark as used if expired to prevent future attempts
      invite.isUsed = true;
      await invite.save();
      return res.status(410).json({ 
        success: false, 
        message: 'Invitation token has expired.' 
      });
    }

    // Return comprehensive details about the invite (excluding sensitive info like createdBy, usedBy)
    res.json({
      success: true,
      message: 'Invitation token is valid.',
      invite: {
        userType: invite.userType,
        email: invite.email,
        permissions: invite.permissions, // Only for admin
        adminLevel: invite.adminLevel, // Only for admin
        policeAccessLevel: invite.policeAccessLevel, // Only for police
        researcherAccessLevel: invite.researcherAccessLevel, // Only for researcher
        expiresAt: invite.expiresAt
      }
    });

  } catch (error) {
    console.error('❌ Error validating invite token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to validate invitation token.', 
      error: error.message 
    });
  }
});

// === USER REGISTRATION VIA INVITE TOKEN ===
// POST /api/invites/register/:token - Register a new user using an invite token
router.post('/register/:token',
  // userTypeDetection middleware is already applied at the router level
  async (req, res) => {
    try {
      const { token } = req.params;
      const { 
        username, 
        email, 
        password, 
        // Police-specific fields
        badgeNumber, 
        department, 
        rank, 
        division, 
        district, 
        thana, 
        phoneNumber, 
        // Researcher-specific fields
        institution, 
        researchArea, 
        academicTitle, 
        researchProposal, 
        ethicsApproval, 
        supervisorContact, 
        expectedDuration 
      } = req.body;
      
      const deviceFingerprint = req.userContext.deviceFingerprint?.fingerprintId; // Get device fingerprint from userTypeDetection

      // 1. Basic input validation
      if (!username || !email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: 'Username, email, and password are required.' 
        });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid email format.' 
        });
      }
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          message: 'Password must be at least 6 characters long.' 
        });
      }

      // 2. Validate the invite token (re-validate here for security, even if frontend pre-validated)
      const invite = await InviteToken.findOne({ token });

      if (!invite) {
        return res.status(404).json({ 
          success: false, 
          message: 'Invalid invitation token.' 
        });
      }
      if (invite.isUsed) {
        return res.status(409).json({ 
          success: false, 
          message: 'This invitation token has already been used.' 
        });
      }
      if (new Date() > invite.expiresAt) {
        // Mark as used if expired to prevent future attempts
        invite.isUsed = true;
        await invite.save();
        return res.status(410).json({ 
          success: false, 
          message: 'Invitation token has expired.' 
        });
      }

      // 3. Check for existing user with this username/email/phone
      const existingUser = await User.findOne({
        $or: [
          { 'roleData.admin.username': username },
          { 'roleData.admin.email': email },
          { 'roleData.police.phoneNumber': phoneNumber }, // Assuming phone number is unique for police
          { 'roleData.researcher.email': email }
        ]
      });

      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: 'A user with this username, email, or phone number already exists.' 
        });
      }

      // 4. Create the new user based on invite details
      const newUserId = `${invite.userType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser = new User({
        userId: newUserId,
        userType: invite.userType,
        securityProfile: {
          primaryDeviceFingerprint: deviceFingerprint // Associate device fingerprint on signup
        }
      });

      // Populate role-specific data based on invite.userType
      if (invite.userType === 'admin') {
        newUser.roleData.admin = {
          username,
          email,
          permissions: invite.permissions,
          adminLevel: invite.adminLevel,
          loginAttempts: 0,
          accountLocked: false,
          twoFactorEnabled: false,
          emailVerified: false // Set email as unverified initially
        };
        await newUser.setPassword(password); // Hash password for admin
        
        // --- Generate and send email verification token ---
        const verificationToken = crypto.randomBytes(32).toString('hex');
        newUser.roleData.admin.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        await emailService.sendVerificationEmail(email, verificationLink);
        
      } else if (invite.userType === 'police') {
        // Police-specific fields from request body
        newUser.roleData.police = {
          badgeNumber,
          department,
          rank,
          division,
          district,
          thana,
          phoneNumber,
          email, // Police also have email
          accessLevel: invite.policeAccessLevel,
          verificationStatus: 'pending' // Requires admin approval
        };
        // If police also need a password, uncomment and adapt:
        // await newUser.setPassword(password);
      } else if (invite.userType === 'researcher') {
        // Researcher-specific fields from request body
        newUser.roleData.researcher = {
          institution,
          researchArea,
          academicTitle,
          researchProposal,
          ethicsApproval,
          supervisorContact,
          expectedDuration,
          email, // Researcher also have email
          accessLevel: invite.researcherAccessLevel,
          dataUsageAgreement: false, // Will be set true after review
          verificationStatus: 'pending' // Requires admin approval
        };
        // If researcher also need a password, uncomment and adapt:
        // await newUser.setPassword(password);
      }

      await newUser.save();

      // 5. Mark invite as used
      invite.isUsed = true;
      invite.usedBy = newUser._id;
      await invite.save();

      // --- Audit Log for successful registration ---
      await logInviteAction(
        { userId: newUser._id, userType: newUser.userType, username },
        'invite_token_use',
        'success',
        { inviteId: invite._id, userType: invite.userType },
        'high',
        { id: newUser._id, type: 'User' }
      );

      console.log(`✅ New ${invite.userType} user registered: ${username} (via invite token: ${token})`);

      // Construct response message based on user type
      let responseMessage = `Account created successfully for ${invite.userType}.`;
      if (invite.userType === 'admin') {
        responseMessage += ' Please check your email to verify your account before logging in.';
      } else {
        responseMessage += ' Your account is pending admin approval. You will be notified when approved.';
      }

      res.status(201).json({
        success: true,
        message: responseMessage,
        user: {
          userId: newUser.userId,
          userType: newUser.userType,
          email: email,
          verificationRequired: invite.userType === 'admin',
          approvalRequired: invite.userType !== 'admin'
        }
      });

    } catch (error) {
      console.error('❌ Error registering user with invite token:', error);
      
      // Log audit failure if we have enough context
      if (req.body.username) {
        await logInviteAction(
          { username: req.body.username, ipAddress: req.ip },
          'invite_token_use',
          'failure',
          { reason: error.message },
          'critical'
        );
      }
      
      res.status(500).json({ 
        success: false, 
        message: 'Registration failed.', 
        error: error.message 
      });
    }
  }
);

module.exports = router;