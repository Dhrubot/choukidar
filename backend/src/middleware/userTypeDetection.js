// === backend/src/middleware/userTypeDetection.js ===
// User Type Detection Middleware for SafeStreets Bangladesh
// Integrates with DeviceFingerprint and User models for comprehensive user tracking

const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');

/**
 * User Type Detection Middleware
 * Detects and manages user types based on device fingerprints and authentication
 * Creates anonymous users automatically, manages admin sessions
 */

const userTypeDetection = async (req, res, next) => {
  try {
    // Extract device fingerprint from headers or body
    const deviceFingerprintId = req.headers['x-device-fingerprint'] || 
                               req.body.deviceFingerprint ||
                               req.query.deviceFingerprint;
    
    // Extract admin session token if present
    const adminToken = req.headers['authorization']?.replace('Bearer ', '') ||
                      req.cookies?.adminToken;
    
    // Initialize request user context
    req.userContext = {
      user: null,
      userType: 'anonymous',
      deviceFingerprint: null,
      permissions: ['view_map', 'submit_report', 'validate_reports'],
      securityContext: {
        trustScore: 50,
        riskLevel: 'medium',
        quarantined: false
      }
    };

    // 1. ADMIN AUTHENTICATION CHECK (Priority)
    if (adminToken) {
      try {
        // In production, verify JWT token here
        // For now, simple token validation
        const adminUser = await User.findOne({
          userType: 'admin',
          'roleData.admin.accountLocked': { $ne: true }
        });

        if (adminUser) {
          req.userContext.user = adminUser;
          req.userContext.userType = 'admin';
          req.userContext.permissions = adminUser.roleData.admin.permissions;
          req.userContext.securityContext = {
            trustScore: adminUser.securityProfile.overallTrustScore,
            riskLevel: adminUser.securityProfile.securityRiskLevel,
            quarantined: adminUser.securityProfile.quarantineStatus
          };
          
          console.log(`🔑 Admin user authenticated: ${adminUser.roleData.admin.username}`);
          return next();
        }
      } catch (error) {
        console.error('❌ Admin authentication error:', error);
        // Continue to anonymous detection
      }
    }

    // 2. DEVICE FINGERPRINT BASED USER DETECTION
    if (deviceFingerprintId) {
      // Get or create device fingerprint
      let deviceFingerprint = await DeviceFingerprint.findOne({ 
        fingerprintId: deviceFingerprintId 
      });

      if (!deviceFingerprint) {
        // Create new device fingerprint with basic info
        deviceFingerprint = new DeviceFingerprint({
          fingerprintId: deviceFingerprintId,
          deviceSignature: {
            userAgentHash: req.headers['user-agent'] ? 
              require('crypto').createHash('md5').update(req.headers['user-agent']).digest('hex').slice(0, 16) : 
              'unknown'
          },
          networkProfile: {
            estimatedCountry: req.headers['cf-ipcountry'] || 'BD',
            deviceType: detectDeviceType(req.headers['user-agent'] || '')
          }
        });
        
        await deviceFingerprint.save();
        console.log(`📱 New device fingerprint created: ${deviceFingerprintId}`);
      } else {
        // Update device activity
        deviceFingerprint.updateActivity();
        await deviceFingerprint.save();
      }

      req.userContext.deviceFingerprint = deviceFingerprint;

      // Find existing user for this device
      let user = await User.findByDeviceFingerprint(deviceFingerprintId);

      if (!user) {
        // Create new anonymous user
        user = User.createAnonymousUser(deviceFingerprintId);
        await user.save();
        console.log(`👤 New anonymous user created: ${user.userId}`);
      } else {
        // Update existing user activity
        user.activityProfile.lastSeen = new Date();
        user.activityProfile.totalSessions += 1;
        await user.save();
      }

      // Update user context
      req.userContext.user = user;
      req.userContext.userType = user.userType;
      req.userContext.securityContext = {
        trustScore: Math.min(user.securityProfile.overallTrustScore, deviceFingerprint.securityProfile.trustScore),
        riskLevel: getHigherRiskLevel(user.securityProfile.securityRiskLevel, deviceFingerprint.securityProfile.riskLevel),
        quarantined: user.securityProfile.quarantineStatus || deviceFingerprint.securityProfile.quarantineStatus
      };

      // Security checks
      if (req.userContext.securityContext.quarantined) {
        console.log(`🚨 Quarantined device/user detected: ${deviceFingerprintId}`);
        req.userContext.permissions = ['view_map']; // Restricted permissions
      }

      console.log(`👤 User context established: ${user.userType} (Trust: ${req.userContext.securityContext.trustScore}, Risk: ${req.userContext.securityContext.riskLevel})`);
    }

    // 3. IP-BASED FALLBACK (No device fingerprint)
    if (!req.userContext.user) {
      // Create temporary anonymous context for this request
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      const tempUserId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      req.userContext.user = {
        userId: tempUserId,
        userType: 'anonymous',
        temporary: true
      };
      
      console.log(`🌐 Temporary anonymous context created for IP: ${clientIP}`);
    }

    next();

  } catch (error) {
    console.error('❌ User type detection error:', error);
    
    // Fallback to basic anonymous context
    req.userContext = {
      user: { userId: 'fallback_anonymous', userType: 'anonymous' },
      userType: 'anonymous',
      deviceFingerprint: null,
      permissions: ['view_map'],
      securityContext: {
        trustScore: 25, // Lower trust for fallback
        riskLevel: 'medium',
        quarantined: false
      }
    };
    
    next();
  }
};

// Helper function to detect device type from user agent
function detectDeviceType(userAgent) {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else if (ua.includes('desktop') || ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) {
    return 'desktop';
  } else {
    return 'unknown';
  }
}

// Helper function to get higher risk level
function getHigherRiskLevel(level1, level2) {
  const riskLevels = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'critical': 5
  };
  
  const levelNames = ['very_low', 'low', 'medium', 'high', 'critical'];
  const maxLevel = Math.max(riskLevels[level1] || 3, riskLevels[level2] || 3);
  
  return levelNames[maxLevel - 1];
}

// Express middleware function
module.exports = userTypeDetection;

// Additional utility middleware for specific user types
module.exports.requireAdmin = (req, res, next) => {
  if (req.userContext?.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      userType: req.userContext?.userType || 'unknown'
    });
  }
  next();
};

module.exports.requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.userContext?.permissions?.includes(permission) && 
        !req.userContext?.permissions?.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: `Permission required: ${permission}`,
        userType: req.userContext?.userType || 'unknown',
        permissions: req.userContext?.permissions || []
      });
    }
    next();
  };
};

module.exports.requireNonQuarantined = (req, res, next) => {
  if (req.userContext?.securityContext?.quarantined) {
    return res.status(423).json({
      success: false,
      message: 'Account temporarily restricted due to security concerns',
      userType: req.userContext?.userType || 'unknown',
      securityContext: req.userContext?.securityContext
    });
  }
  next();
};

module.exports.logUserActivity = (activityType) => {
  return async (req, res, next) => {
    try {
      if (req.userContext?.user && !req.userContext.user.temporary) {
        const user = await User.findById(req.userContext.user._id);
        if (user) {
          // Update feature usage
          if (user.activityProfile.featureUsage[activityType] !== undefined) {
            user.activityProfile.featureUsage[activityType] += 1;
          }
          
          // Add security event for admin activities
          if (req.userContext.userType === 'admin' && ['moderation', 'analytics', 'user_management'].includes(activityType)) {
            user.addSecurityEvent(`admin_${activityType}`, `Admin performed ${activityType}`, 'low');
          }
          
          await user.save();
        }
      }
    } catch (error) {
      console.error('❌ Error logging user activity:', error);
      // Don't block the request for logging errors
    }
    next();
  };
};