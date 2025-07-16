// === backend/src/routes/auth.js ===
// Authentication Routes for SafeStreets Bangladesh
// Handles admin login, user type switching, and session management

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const userTypeDetection = require('../middleware/userTypeDetection');
const { requireAdmin, requirePermission } = require('../middleware/roleBasedAccess');

// Apply user type detection to all auth routes
router.use(userTypeDetection);

// === ADMIN AUTHENTICATION ===

// POST /api/auth/admin/login - Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password, deviceFingerprint } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Find admin user
    const adminUser = await User.findOne({
      userType: 'admin',
      'roleData.admin.username': username
    });
    
    if (!adminUser) {
      console.log(`❌ Admin login attempt with invalid username: ${username}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if account is locked
    if (adminUser.roleData.admin.accountLocked) {
      const lockUntil = adminUser.roleData.admin.lockUntil;
      if (lockUntil && lockUntil > new Date()) {
        const minutesLeft = Math.ceil((lockUntil - new Date()) / (1000 * 60));
        console.log(`🔒 Admin login attempt for locked account: ${username}`);
        return res.status(423).json({
          success: false,
          message: `Account locked. Try again in ${minutesLeft} minutes.`,
          lockUntil: lockUntil
        });
      } else {
        // Lock expired, reset
        adminUser.roleData.admin.accountLocked = false;
        adminUser.roleData.admin.lockUntil = null;
        adminUser.roleData.admin.loginAttempts = 0;
      }
    }
    
    // Verify password
    const isValidPassword = await adminUser.comparePassword(password);
    
    if (!isValidPassword) {
      console.log(`❌ Invalid password for admin: ${username}`);
      
      // Increment login attempts
      adminUser.incrementLoginAttempts();
      await adminUser.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        attemptsRemaining: Math.max(0, 5 - adminUser.roleData.admin.loginAttempts)
      });
    }
    
    // Successful login
    adminUser.resetLoginAttempts();
    
    // Update device fingerprint association
    if (deviceFingerprint) {
      if (!adminUser.securityProfile.primaryDeviceFingerprint) {
        adminUser.securityProfile.primaryDeviceFingerprint = deviceFingerprint;
      }
      
      // Add to associated devices if not already present
      const existingDevice = adminUser.securityProfile.associatedDevices.find(
        device => device.fingerprintId === deviceFingerprint
      );
      
      if (!existingDevice) {
        adminUser.securityProfile.associatedDevices.push({
          fingerprintId: deviceFingerprint,
          deviceType: req.userContext?.deviceFingerprint?.networkProfile?.deviceType || 'unknown',
          lastUsed: new Date(),
          trustLevel: 'trusted',
          isPrimary: !adminUser.securityProfile.primaryDeviceFingerprint
        });
      } else {
        existingDevice.lastUsed = new Date();
      }
    }
    
    // Log security event
    adminUser.addSecurityEvent(
      'admin_login',
      `Admin login from ${req.ip || 'unknown IP'}`,
      'low'
    );
    
    await adminUser.save();
    
    // Generate session token (in production, use proper JWT)
    const sessionToken = `admin_${adminUser._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`✅ Admin login successful: ${username}`);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: sessionToken,
      user: {
        id: adminUser._id,
        username: adminUser.roleData.admin.username,
        email: adminUser.roleData.admin.email,
        permissions: adminUser.roleData.admin.permissions,
        adminLevel: adminUser.roleData.admin.adminLevel,
        lastLogin: adminUser.roleData.admin.lastLogin
      },
      securityContext: {
        trustScore: adminUser.securityProfile.overallTrustScore,
        riskLevel: adminUser.securityProfile.securityRiskLevel,
        quarantined: adminUser.securityProfile.quarantineStatus
      }
    });
    
  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// POST /api/auth/admin/logout - Admin logout
router.post('/admin/logout', requireAdmin, async (req, res) => {
  try {
    const adminUser = req.userContext.user;
    
    // Log security event
    adminUser.addSecurityEvent(
      'admin_logout',
      `Admin logout from ${req.ip || 'unknown IP'}`,
      'low'
    );
    
    await adminUser.save();
    
    console.log(`✅ Admin logout: ${adminUser.roleData.admin.username}`);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
    
  } catch (error) {
    console.error('❌ Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
});

// GET /api/auth/admin/profile - Get admin profile
router.get('/admin/profile', requireAdmin, async (req, res) => {
  try {
    const adminUser = req.userContext.user;
    
    res.json({
      success: true,
      user: {
        id: adminUser._id,
        username: adminUser.roleData.admin.username,
        email: adminUser.roleData.admin.email,
        permissions: adminUser.roleData.admin.permissions,
        adminLevel: adminUser.roleData.admin.adminLevel,
        lastLogin: adminUser.roleData.admin.lastLogin,
        createdAt: adminUser.createdAt
      },
      securityContext: {
        trustScore: adminUser.securityProfile.overallTrustScore,
        riskLevel: adminUser.securityProfile.securityRiskLevel,
        quarantined: adminUser.securityProfile.quarantineStatus,
        associatedDevices: adminUser.securityProfile.associatedDevices.length,
        lastSecurityCheck: adminUser.securityProfile.lastSecurityCheck
      },
      activityProfile: {
        totalSessions: adminUser.activityProfile.totalSessions,
        totalActiveTime: adminUser.activityProfile.totalActiveTime,
        featureUsage: adminUser.activityProfile.featureUsage
      }
    });
    
  } catch (error) {
    console.error('❌ Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// === USER TYPE DETECTION & SWITCHING ===

// GET /api/auth/user/context - Get current user context
router.get('/user/context', async (req, res) => {
  try {
    const { userContext } = req;
    
    res.json({
      success: true,
      userContext: {
        userType: userContext.userType,
        userId: userContext.user?.userId,
        permissions: userContext.permissions,
        securityContext: userContext.securityContext,
        deviceFingerprint: userContext.deviceFingerprint?.fingerprintId,
        temporary: userContext.user?.temporary || false
      },
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
      message: 'Failed to get user context',
      error: error.message
    });
  }
});

// POST /api/auth/user/update-preferences - Update user preferences
router.post('/user/update-preferences', async (req, res) => {
  try {
    const { userContext } = req;
    const { preferences } = req.body;
    
    if (userContext.user?.temporary) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update preferences for temporary users'
      });
    }
    
    const user = await User.findById(userContext.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update preferences
    if (preferences.language) user.preferences.language = preferences.language;
    if (preferences.theme) user.preferences.theme = preferences.theme;
    if (preferences.notifications) {
      Object.assign(user.preferences.notifications, preferences.notifications);
    }
    if (preferences.mapSettings) {
      Object.assign(user.preferences.mapSettings, preferences.mapSettings);
    }
    if (preferences.femaleSafetyMode) {
      Object.assign(user.preferences.femaleSafetyMode, preferences.femaleSafetyMode);
    }
    
    await user.save();
    
    console.log(`✅ Updated preferences for user: ${user.userId}`);
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
    
  } catch (error) {
    console.error('❌ Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

// === FUTURE: POLICE/RESEARCHER AUTHENTICATION ===

// POST /api/auth/police/register - Police officer registration (Future)
router.post('/police/register', async (req, res) => {
  // Future implementation for police officer registration
  res.status(501).json({
    success: false,
    message: 'Police registration not yet implemented',
    plannedFeatures: [
      'Badge number verification',
      'Department authentication',
      'Document upload',
      'Admin approval workflow'
    ]
  });
});

// POST /api/auth/researcher/register - Researcher registration (Future)
router.post('/researcher/register', async (req, res) => {
  // Future implementation for researcher registration
  res.status(501).json({
    success: false,
    message: 'Researcher registration not yet implemented',
    plannedFeatures: [
      'Institution verification',
      'Research proposal review',
      'Ethics approval',
      'Data usage agreement'
    ]
  });
});

// === SECURITY & MONITORING ===

// GET /api/auth/security/insights - Security insights for admins
router.get('/security/insights', requireAdmin, requirePermission('view_security_dashboard'), async (req, res) => {
  try {
    // Get security insights
    const userInsights = await User.getSecurityInsights();
    const deviceInsights = await DeviceFingerprint.find({
      'securityProfile.riskLevel': { $in: ['high', 'critical'] }
    }).limit(10);
    
    // Get recent security events
    const recentEvents = await User.find({
      'securityProfile.securityEvents': { $exists: true, $ne: [] }
    })
    .select('securityProfile.securityEvents userId userType')
    .limit(20);
    
    const allEvents = [];
    recentEvents.forEach(user => {
      user.securityProfile.securityEvents.forEach(event => {
        allEvents.push({
          ...event.toObject(),
          userId: user.userId,
          userType: user.userType
        });
      });
    });
    
    // Sort by timestamp
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      insights: {
        userTypeDistribution: userInsights,
        highRiskDevices: deviceInsights.length,
        recentSecurityEvents: allEvents.slice(0, 20),
        summary: {
          totalUsers: await User.countDocuments(),
          totalDevices: await DeviceFingerprint.countDocuments(),
          quarantinedUsers: await User.countDocuments({ 'securityProfile.quarantineStatus': true }),
          quarantinedDevices: await DeviceFingerprint.countDocuments({ 'securityProfile.quarantineStatus': true })
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Security insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security insights',
      error: error.message
    });
  }
});

module.exports = router;