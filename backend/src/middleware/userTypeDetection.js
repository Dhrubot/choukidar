const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const jwt = require('jsonwebtoken'); // Assuming JWT for admin tokens
const { getUserPermissions } = require('./roleBasedAccess'); // Import for dynamic permissions

/**
 * User Type Detection Middleware
 * Detects and manages user types based on device fingerprints and authentication.
 * Prioritizes authenticated users (admin) over device-based or anonymous detection.
 */

const userTypeDetection = async (req, res, next) => {
  try {
    // Initialize request user context with default anonymous values (in-memory, not persisted)
    req.userContext = {
      user: null, // Will be a full User document for authenticated, or a minimal object for ephemeral anonymous
      userType: 'anonymous',
      deviceFingerprint: null, // Will be a full DeviceFingerprint document if found/created
      permissions: ['view_map', 'submit_report', 'validate_reports'], // Default anonymous permissions
      securityContext: {
        trustScore: 50,
        riskLevel: 'medium',
        quarantined: false,
        deviceTrusted: false // Default
      }
    };

    // Extract device fingerprint from headers or body
    const deviceFingerprintId = req.headers['x-device-fingerprint'] ||
                               req.body.deviceFingerprint ||
                               req.query.deviceFingerprint;
    
    // Extract admin session token from Authorization header or cookies
    const adminToken = req.headers['authorization']?.replace('Bearer ', '') ||
                      req.cookies?.adminToken;

    let userIdentified = false; // Flag to track if a user has been identified (admin, police, researcher, or existing anonymous)

    // --- 1. ADMIN AUTHENTICATION CHECK (Highest Priority) ---
    if (adminToken) {
      try {
        const decoded = jwt.verify(adminToken, process.env.JWT_SECRET); // Use your JWT_SECRET
        const adminUser = await User.findById(decoded.userId);

        if (adminUser && adminUser.userType === 'admin') {
          // Check if admin account is locked
          if (adminUser.roleData.admin.accountLocked && adminUser.roleData.admin.lockUntil > new Date()) {
            req.userContext.userType = 'locked';
            req.userContext.securityContext.accountLocked = true;
            req.userContext.securityContext.lockUntil = adminUser.roleData.admin.lockUntil;
            console.log(`🔒 Admin account locked: ${adminUser.roleData.admin.username}`);
            userIdentified = true; // User identified as locked admin
            return next(); // Stop processing, account is locked
          }

          // Admin is authenticated and not locked
          req.userContext.user = adminUser;
          req.userContext.userType = 'admin';
          // Permissions are dynamically fetched here for the userContext
          req.userContext.permissions = await getUserPermissions({ // Use the imported getUserPermissions
            user: adminUser,
            userType: 'admin'
          });
          req.userContext.securityContext = {
            ...req.userContext.securityContext, // Keep defaults
            ...adminUser.securityProfile.toObject(), // Override with user's security profile
            loginAttempts: adminUser.roleData.admin.loginAttempts,
            accountLocked: adminUser.roleData.admin.accountLocked,
            lockUntil: adminUser.roleData.admin.lockUntil,
            lastLogin: adminUser.roleData.admin.lastLogin,
            twoFactorEnabled: adminUser.roleData.admin.twoFactorEnabled
          };
          userIdentified = true; // Admin user successfully identified
          console.log(`🔑 Admin user authenticated by token: ${adminUser.roleData.admin.username}`);
        }
      } catch (jwtError) {
        console.log('❌ Admin token invalid or expired:', jwtError.message);
        // Token invalid, continue to device fingerprinting or anonymous fallback
      }
    }

    // --- 2. DEVICE FINGERPRINT CHECK (If no admin token or invalid token, or admin not found) ---
    // This block runs if an authenticated user wasn't identified by token.
    if (!userIdentified && deviceFingerprintId) {
      let device = await DeviceFingerprint.findOne({ fingerprintId: deviceFingerprintId });

      if (device) {
        // Device found, try to find associated user
        const associatedUser = await User.findById(device.userId);
        if (associatedUser) {
          req.userContext.user = associatedUser;
          req.userContext.userType = associatedUser.userType;
          // Dynamically get permissions based on user type
          req.userContext.permissions = await getUserPermissions({
            user: associatedUser,
            userType: associatedUser.userType
          });
          req.userContext.securityContext = {
            ...req.userContext.securityContext,
            ...associatedUser.securityProfile.toObject() // Merge user's security profile
          };
          userIdentified = true; // User identified by device
          console.log(`👤 User context established by device: ${associatedUser.userType} (Trust: ${associatedUser.securityProfile.overallTrustScore}, Risk: ${associatedUser.securityProfile.securityRiskLevel})`);
        }
        // Always assign the device fingerprint document if found
        req.userContext.deviceFingerprint = device;
      } else {
        // If deviceFingerprintId was provided but NO matching DeviceFingerprint document was found,
        // we DO NOT create a new anonymous user/device here.
        // Instead, we fall through to the ephemeral anonymous user.
        console.log(`ℹ️ Device fingerprint provided but not found: ${deviceFingerprintId}. Treating as ephemeral anonymous.`);
        // Ensure deviceFingerprint is still available in userContext for potential later persistence
        req.userContext.deviceFingerprint = { fingerprintId: deviceFingerprintId, isNew: true };
      }
    }

    // --- 3. FALLBACK TO EPHEMERAL ANONYMOUS (If no user identified by token or existing device fingerprint) ---
    if (!userIdentified) {
      // This block runs if:
      // - No valid admin token was present.
      // - No deviceFingerprintId was provided at all.
      // - A deviceFingerprintId was provided, but no existing DeviceFingerprint document was found.
      
      // For these cases, we establish an in-memory, non-persistent anonymous user context.
      // No new User or DeviceFingerprint documents are created in the database here.
      req.userContext.user = {
        userId: `ephemeral_anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userType: 'anonymous',
        isEphemeral: true // Custom flag to indicate this is not a persisted user
      };
      req.userContext.userType = 'anonymous';
      req.userContext.permissions = ['view_map', 'submit_report', 'validate_reports'];
      // If a deviceFingerprintId was provided but not found, it's already set above.
      // If not, req.userContext.deviceFingerprint remains null.
      console.log(`👤 Established ephemeral anonymous user context: ${req.userContext.user.userId}`);
    }

    next(); // Proceed to the next middleware/route handler

  } catch (error) {
    console.error('❌ User type detection error:', error);
    // Ensure req.userContext is initialized even on error to prevent cascading failures
    if (!req.userContext || !req.userContext.userType) { // Check if it's truly uninitialized or broken
      req.userContext = {
        user: {
          userId: `error_anon_${Date.now()}`,
          userType: 'anonymous',
          isEphemeral: true
        },
        userType: 'anonymous',
        deviceFingerprint: null,
        permissions: ['view_map', 'submit_report'],
        securityContext: {
          trustScore: 20,
          riskLevel: 'critical', // Indicate a problem
          quarantined: false
        }
      };
    }
    next(); // Always call next to avoid hanging requests
  }
};

// We need to import getUserPermissions from roleBasedAccess.js
// Since userTypeDetection.js is a middleware, it might be imported before roleBasedAccess.js
// So, we'll export the middleware functions here and then require them in server.js
// to ensure correct order of operations and access to getUserPermissions.

// Additional utility middleware for specific user types
module.exports = {
  userTypeDetection,
  // Removed duplicate requireAdmin and requirePermission - these should be imported from roleBasedAccess
  requireNonQuarantined: (req, res, next) => {
    if (req.userContext?.securityContext?.quarantined) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily restricted due to security concerns',
        userType: req.userContext?.userType || 'unknown',
        securityContext: req.userContext?.securityContext
      });
    }
    next();
  },
  logUserActivity: (activityType) => {
    return async (req, res, next) => {
      try {
        // Only log activity for persistent users (not ephemeral ones)
        if (req.userContext?.user && !req.userContext.user.isEphemeral) {
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
  }
};