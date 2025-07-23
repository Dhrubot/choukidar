// === backend/src/routes/auth.js ===
// Enhanced Authentication Routes with All New Features

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const TokenManager = require('../middleware/tokenManager');
const RoleMiddleware = require('../middleware/roleSpecificMiddleware');
const EmailService = require('../services/emailService');
const { requireEmailVerification, requireEmailVerificationForLogin } = require('../middleware/emailVerification');
const { loginLimiter, passwordResetLimiter, twoFactorLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { userTypeDetection } = require('../middleware/userTypeDetection');

router.use(userTypeDetection);

// Audit logging helper
const logAuthAction = async (actor, actionType, outcome, details = {}, severity = 'low', target = null) => {
  try {
    const auditData = { 
      actor, 
      actionType, 
      outcome, 
      details, 
      severity 
    };
    
    // Only add target if it's a valid string
    if (target && typeof target === 'string') {
      auditData.target = target;
    }
    
    await AuditLog.create(auditData);
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType}:`, error);
  }
};

// POST /api/auth/admin/login - Enhanced admin login with email verification
router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password, deviceFingerprint } = req.body;
    const actor = { username, ipAddress: req.ip };
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    const adminUser = await User.findOne({
      userType: 'admin',
      'roleData.admin.username': username
    });
    
    if (!adminUser) {
      await logAuthAction(actor, 'admin_login', 'failure', { reason: 'Invalid username' }, 'medium');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    actor.userId = adminUser._id;
    actor.userType = 'admin';
    
    // Check account lock status
    if (adminUser.roleData.admin.accountLocked) {
      const lockUntil = adminUser.roleData.admin.lockUntil;
      if (lockUntil && lockUntil > new Date()) {
        await logAuthAction(actor, 'admin_login', 'failure', { reason: 'Account locked' }, 'high');
        return res.status(423).json({
          success: false,
          message: 'Account is locked. Please contact an administrator.',
          accountLocked: true
        });
      } else {
        // Reset expired lock
        adminUser.roleData.admin.accountLocked = false;
        adminUser.roleData.admin.lockUntil = null;
        adminUser.roleData.admin.loginAttempts = 0;
      }
    }
    
    // Verify password
    const isValidPassword = await adminUser.comparePassword(password);
    if (!isValidPassword) {
      adminUser.incrementLoginAttempts();
      await adminUser.save();
      await logAuthAction(actor, 'admin_login', 'failure', { reason: 'Invalid password' }, 'medium');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check email verification
    const emailVerification = requireEmailVerificationForLogin(adminUser);
    if (!emailVerification.verified) {
      await logAuthAction(actor, 'admin_login', 'failure', { reason: 'Email not verified' }, 'medium');
      return res.status(403).json({
        success: false,
        message: emailVerification.message,
        emailVerificationRequired: true
      });
    }
    
    // Reset login attempts
    adminUser.resetLoginAttempts();
    
    // 2FA Check
    if (adminUser.roleData.admin.twoFactorEnabled) {
      const preAuthToken = TokenManager.generateAccessToken({
        userId: adminUser._id,
        preAuth: true,
        purpose: '2fa'
      });
      
      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        preAuthToken,
        message: 'Please enter your 2FA code'
      });
    }
    
    // Update device association
    if (deviceFingerprint) {
      adminUser.addDeviceAssociation(deviceFingerprint, 'admin-device', true);
    }
    
    // Generate token pair
    const { accessToken, refreshToken } = await TokenManager.generateTokenPair(adminUser);
    
    // Log successful login
    await logAuthAction(actor, 'admin_login', 'success', {}, 'low', `${adminUser.roleData.admin.username} (ID: ${adminUser._id})`);
    
    await adminUser.save();
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: adminUser._id,
        username: adminUser.roleData.admin.username,
        email: adminUser.roleData.admin.email,
        permissions: adminUser.roleData.admin.permissions,
        adminLevel: adminUser.roleData.admin.adminLevel,
        emailVerified: adminUser.roleData.admin.emailVerified,
        twoFactorEnabled: adminUser.roleData.admin.twoFactorEnabled
      }
    });
    
  } catch (error) {
    console.error('❌ Admin login error:', error);
    await logAuthAction(
      { username: req.body.username, ipAddress: req.ip },
      'admin_login',
      'failure',
      { reason: error.message },
      'critical'
    );
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// POST /api/auth/admin/2fa/verify-login - Enhanced 2FA verification
router.post('/admin/2fa/verify-login', twoFactorLimiter, async (req, res) => {
  try {
    const { preAuthToken, twoFaCode } = req.body;
    
    const decoded = await TokenManager.verifyAccessToken(preAuthToken);
    if (!decoded.preAuth) {
      return res.status(401).json({
        success: false,
        message: 'Invalid pre-auth token'
      });
    }
    
    const adminUser = await User.findById(decoded.userId);
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // TODO: Implement actual 2FA verification
    const isValid = true; // Placeholder
    
    if (!isValid) {
      await logAuthAction(
        { userId: adminUser._id, userType: 'admin' },
        'admin_login',
        'failure',
        { reason: 'Invalid 2FA code' },
        'high'
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code'
      });
    }
    
    // Generate full token pair
    const { accessToken, refreshToken } = await TokenManager.generateTokenPair(adminUser);
    
    // Blacklist the pre-auth token
    await TokenManager.blacklistToken(preAuthToken);
    
    await logAuthAction(
      { userId: adminUser._id, userType: 'admin' },
      'admin_login',
      'success',
      { via: '2FA' },
      'low'
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: adminUser._id,
        username: adminUser.roleData.admin.username,
        email: adminUser.roleData.admin.email,
        permissions: adminUser.roleData.admin.permissions,
        adminLevel: adminUser.roleData.admin.adminLevel,
        emailVerified: adminUser.roleData.admin.emailVerified,
        twoFactorEnabled: adminUser.roleData.admin.twoFactorEnabled
      }
    });
    
  } catch (error) {
    console.error('❌ 2FA verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired 2FA token'
    });
  }
});

// POST /api/auth/token/refresh - Token refresh endpoint
router.post('/token/refresh', refreshLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required'
      });
    }
    
    const { accessToken } = await TokenManager.refreshAccessToken(refreshToken);
    
    res.json({
      success: true,
      accessToken
    });
    
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
});

// POST /api/auth/admin/logout - Enhanced logout with token blacklisting
router.post('/admin/logout', RoleMiddleware.apply(RoleMiddleware.adminOnly), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    // Blacklist both tokens
    if (accessToken) {
      await TokenManager.blacklistToken(accessToken);
    }
    if (refreshToken) {
      await TokenManager.revokeRefreshToken(refreshToken);
    }
    
    await logAuthAction(
      { 
        userId: req.userContext.user._id,
        userType: 'admin',
        ipAddress: req.ip
      },
      'admin_logout',
      'success'
    );
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
    
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// POST /api/auth/admin/unlock/:userId - Admin account unlock mechanism
router.post('/admin/unlock/:userId', RoleMiddleware.apply(RoleMiddleware.superAdminOnly), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const actingAdmin = req.userContext.user;
    
    const targetUser = await User.findById(userId);
    if (!targetUser || targetUser.userType !== 'admin') {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Unlock the account
    targetUser.roleData.admin.accountLocked = false;
    targetUser.roleData.admin.lockUntil = null;
    targetUser.roleData.admin.loginAttempts = 0;
    
    // Log security event
    targetUser.addSecurityEvent(
      'account_unlocked',
      `Account unlocked by ${actingAdmin.roleData.admin.username}: ${reason}`,
      'medium'
    );
    
    await targetUser.save();
    
    // Send email notification
    await EmailService.sendAccountUnlockedEmail(
      targetUser.roleData.admin.email,
      targetUser.roleData.admin.username
    );
    
    await logAuthAction(
      { 
        userId: actingAdmin._id,
        userType: 'admin',
        username: actingAdmin.roleData.admin.username
      },
      'admin_account_unlock',
      'success',
      { 
        targetUserId: userId,
        reason: reason || 'Manual unlock'
      },
      'high',
      `${targetUser.roleData.admin.username} (ID: ${userId})`
    );
    
    console.log(`🔓 Account unlocked: ${targetUser.roleData.admin.username} by ${actingAdmin.roleData.admin.username}`);
    
    res.json({
      success: true,
      message: 'Account unlocked successfully',
      user: {
        id: targetUser._id,
        username: targetUser.roleData.admin.username,
        accountLocked: false
      }
    });
    
  } catch (error) {
    console.error('❌ Account unlock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlock account'
    });
  }
});

// POST /api/auth/request-password-reset - Enhanced password reset with rate limiting
router.post('/request-password-reset', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const actor = { email, ipAddress: req.ip };
    
    const user = await User.findOne({ 
      'roleData.admin.email': email, 
      userType: 'admin' 
    });
    
    if (!user) {
      await logAuthAction(actor, 'password_reset_request', 'failure', { reason: 'User not found' }, 'low');
      // Always return success to prevent email enumeration
      return res.json({
        success: true,
        message: 'If a user with that email exists, a password reset link has been sent.'
      });
    }
    
    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.roleData.admin.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.roleData.admin.passwordResetExpires = Date.now() + 3600000; // 1 hour
    
    await user.save();
    
    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await EmailService.sendPasswordResetEmail(email, resetLink);
    
    await logAuthAction(
      { userId: user._id, userType: user.userType },
      'password_reset_request',
      'success',
      {},
      'medium'
    );
    
    res.json({
      success: true,
      message: 'If a user with that email exists, a password reset link has been sent.'
    });
    
  } catch (error) {
    console.error('❌ Password reset request error:', error);
    await logAuthAction(
      { email: req.body.email, ipAddress: req.ip },
      'password_reset_request',
      'failure',
      { reason: error.message },
      'critical'
    );
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
});

// POST /api/auth/reset-password - Password reset completion
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      'roleData.admin.passwordResetToken': hashedToken,
      'roleData.admin.passwordResetExpires': { $gt: Date.now() }
    });
    
    if (!user) {
      await logAuthAction(
        { ipAddress: req.ip },
        'password_reset_complete',
        'failure',
        { reason: 'Invalid or expired token' },
        'medium'
      );
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }
    
    // Update password and clear reset tokens
    await user.setPassword(password);
    user.roleData.admin.passwordResetToken = undefined;
    user.roleData.admin.passwordResetExpires = undefined;
    user.roleData.admin.loginAttempts = 0;
    user.roleData.admin.accountLocked = false;
    
    // Revoke all existing tokens for security
    await TokenManager.revokeAllUserTokens(user._id);
    
    await user.save();
    
    await logAuthAction(
      { userId: user._id, userType: user.userType },
      'password_reset_complete',
      'success',
      {},
      'high'
    );
    
    res.json({
      success: true,
      message: 'Password has been successfully reset. Please log in with your new password.'
    });
    
  } catch (error) {
    console.error('❌ Password reset error:', error);
    await logAuthAction(
      { ipAddress: req.ip },
      'password_reset_complete',
      'failure',
      { reason: error.message },
      'critical'
    );
    res.status(500).json({
      success: false,
      message: 'An error occurred'
    });
  }
});

// GET /api/auth/verify-email/:token - Email verification
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      'roleData.admin.emailVerificationToken': hashedToken
    });
    
    if (!user) {
      await logAuthAction(
        { ipAddress: req.ip },
        'email_verification_complete',
        'failure',
        { reason: 'Invalid token' },
        'medium'
      );
      return res.status(400).send('<h1>Email verification failed. Invalid or expired link.</h1>');
    }
    
    // Mark email as verified
    user.roleData.admin.emailVerified = true;
    user.roleData.admin.emailVerificationToken = undefined;
    await user.save();
    
    await logAuthAction(
      { userId: user._id, userType: user.userType },
      'email_verification_complete',
      'success',
      {},
      'medium'
    );
    
    res.redirect(`${process.env.FRONTEND_URL}/email-verified`);
    
  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).send('<h1>An error occurred during email verification.</h1>');
  }
});

// GET /api/auth/user/context - Enhanced user context with verification status
router.get('/user/context', async (req, res) => {
  try {
    const { userContext } = req;
    
    // Enhanced context with verification status
    const enhancedContext = {
      userType: userContext.userType,
      userId: userContext.user?.userId,
      permissions: userContext.permissions,
      securityContext: userContext.securityContext,
      deviceFingerprint: userContext.deviceFingerprint?.fingerprintId,
      temporary: userContext.user?.temporary || false,
      // Add verification status
      emailVerified: userContext.user?.roleData?.admin?.emailVerified ?? true,
      accountLocked: userContext.user?.roleData?.admin?.accountLocked ?? false,
      twoFactorEnabled: userContext.user?.roleData?.admin?.twoFactorEnabled ?? false
    };
    
    res.json({
      success: true,
      userContext: enhancedContext,
      user: userContext.user?.temporary ? null : {
        id: userContext.user?._id,
        activityProfile: userContext.user?.activityProfile,
        preferences: userContext.user?.preferences
      }
    });
    
  } catch (error) {
    console.error('❌ Get user context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user context'
    });
  }
});

// GET /api/auth/admin/sessions - Get user's active sessions
router.get('/admin/sessions', RoleMiddleware.apply(RoleMiddleware.adminOnly), async (req, res) => {
  try {
    const userId = req.userContext.user._id;
    const sessions = await TokenManager.getUserRefreshTokens(userId);
    
    res.json({
      success: true,
      sessions: sessions.map(session => ({
        tokenId: session.tokenId,
        createdAt: session.createdAt,
        isCurrentSession: false // Could be enhanced to detect current session
      }))
    });
    
  } catch (error) {
    console.error('❌ Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active sessions'
    });
  }
});

// DELETE /api/auth/admin/sessions - Revoke all sessions
router.delete('/admin/sessions', RoleMiddleware.apply(RoleMiddleware.adminOnly), async (req, res) => {
  try {
    const userId = req.userContext.user._id;
    await TokenManager.revokeAllUserTokens(userId);
    
    await logAuthAction(
      { userId, userType: 'admin' },
      'admin_sessions_revoked',
      'success',
      { reason: 'User requested session revocation' },
      'medium'
    );
    
    res.json({
      success: true,
      message: 'All sessions revoked successfully'
    });
    
  } catch (error) {
    console.error('❌ Revoke sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke sessions'
    });
  }
});

module.exports = router;