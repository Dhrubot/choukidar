// === backend/src/middleware/roleBasedAccess.js ===
// Role-Based Access Control Middleware for SafeStreets Bangladesh
// Works with User model and userTypeDetection middleware

/**
 * Role-Based Access Control System
 * Provides granular permission control for different user types
 * Integrates with security monitoring for access attempts
 */

const User = require('../models/User');

// Permission definitions for each user type
const PERMISSIONS = {
  // Anonymous user permissions
  anonymous: [
    'view_map',
    'submit_report',
    'validate_reports',
    'view_safe_zones',
    'view_public_analytics'
  ],
  
  // Admin permissions
  admin: {
    moderation: [
      'view_pending_reports',
      'approve_reports',
      'reject_reports',
      'view_all_reports',
      'moderate_content',
      'view_flagged_reports'
    ],
    analytics: [
      'view_admin_analytics',
      'export_data',
      'view_user_statistics',
      'view_security_analytics',
      'generate_reports'
    ],
    user_management: [
      'view_users',
      'manage_user_permissions',
      'quarantine_users',
      'view_user_activity',
      'manage_admin_accounts'
    ],
    safe_zones: [
      'create_safe_zones',
      'edit_safe_zones',
      'delete_safe_zones',
      'verify_safe_zones',
      'manage_safe_zone_categories'
    ],
    security_monitoring: [
      'view_security_dashboard',
      'manage_threat_intel',
      'view_device_fingerprints',
      'manage_quarantine',
      'view_abuse_patterns'
    ],
    super_admin: [
      'all_permissions',
      'manage_admins',
      'system_configuration',
      'backup_management',
      'audit_logs'
    ]
  },
  
  // Police permissions (Future implementation)
  police: {
    read_only: [
      'view_reports',
      'view_map',
      'view_basic_analytics'
    ],
    standard: [
      'view_reports',
      'view_map',
      'update_report_status',
      'add_police_notes',
      'view_area_analytics'
    ],
    supervisor: [
      'view_reports',
      'view_map',
      'update_report_status',
      'add_police_notes',
      'view_area_analytics',
      'manage_patrol_routes',
      'view_advanced_analytics'
    ],
    chief: [
      'view_reports',
      'view_map',
      'update_report_status',
      'add_police_notes',
      'view_area_analytics',
      'manage_patrol_routes',
      'view_advanced_analytics',
      'manage_officers',
      'coordinate_operations'
    ]
  },
  
  // Researcher permissions (Future implementation)
  researcher: {
    basic: [
      'view_public_data',
      'view_anonymized_reports',
      'view_basic_statistics'
    ],
    full: [
      'view_public_data',
      'view_anonymized_reports',
      'view_basic_statistics',
      'view_detailed_analytics',
      'export_anonymized_data',
      'access_research_api'
    ],
    api_access: [
      'view_public_data',
      'view_anonymized_reports',
      'view_basic_statistics',
      'view_detailed_analytics',
      'export_anonymized_data',
      'access_research_api',
      'bulk_data_access',
      'real_time_data_access'
    ]
  }
};

// Security-aware permission checking
const checkPermission = async (req, res, next) => {
  try {
    const { userContext } = req;
    const requiredPermission = req.permissionRequired;
    
    if (!requiredPermission) {
      return next(); // No permission required
    }
    
    // Security check: Quarantined users have limited access
    if (userContext.securityContext.quarantined) {
      const allowedForQuarantined = ['view_map']; // Very limited access
      
      if (!allowedForQuarantined.includes(requiredPermission)) {
        console.log(`🚨 Quarantined user ${userContext.user.userId} attempted to access: ${requiredPermission}`);
        
        // Log security event
        if (userContext.user && !userContext.user.temporary) {
          const user = await User.findById(userContext.user._id);
          if (user) {
            user.addSecurityEvent(
              'quarantine_violation',
              `Attempted to access ${requiredPermission} while quarantined`,
              'medium'
            );
            await user.save();
          }
        }
        
        return res.status(423).json({
          success: false,
          message: 'Account temporarily restricted. Limited access only.',
          allowedActions: allowedForQuarantined,
          securityContext: userContext.securityContext
        });
      }
    }
    
    // Check if user has permission
    const hasPermission = await userHasPermission(userContext, requiredPermission);
    
    if (!hasPermission) {
      console.log(`❌ Permission denied: ${userContext.userType} user ${userContext.user.userId} attempted ${requiredPermission}`);
      
      // Log failed access attempt
      if (userContext.user && !userContext.user.temporary) {
        const user = await User.findById(userContext.user._id);
        if (user) {
          user.addSecurityEvent(
            'permission_denied',
            `Attempted to access ${requiredPermission}`,
            'low'
          );
          await user.save();
        }
      }
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: requiredPermission,
        userType: userContext.userType,
        permissions: userContext.permissions
      });
    }
    
    // Log successful access for sensitive operations
    const sensitiveOperations = [
      'approve_reports', 'reject_reports', 'quarantine_users', 
      'manage_admins', 'system_configuration', 'export_data'
    ];
    
    if (sensitiveOperations.includes(requiredPermission) && userContext.user && !userContext.user.temporary) {
      const user = await User.findById(userContext.user._id);
      if (user) {
        user.addSecurityEvent(
          'sensitive_operation',
          `Performed ${requiredPermission}`,
          'low'
        );
        await user.save();
      }
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Permission check error:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
      error: error.message
    });
  }
};

// Check if user has specific permission
async function userHasPermission(userContext, permission) {
  const { user, userType } = userContext;
  
  try {
    // Anonymous users
    if (userType === 'anonymous') {
      return PERMISSIONS.anonymous.includes(permission);
    }
    
    // Admin users
    if (userType === 'admin') {
      if (!user.roleData?.admin?.permissions) {
        return false;
      }
      
      // Super admin has all permissions
      if (user.roleData.admin.permissions.includes('super_admin')) {
        return true;
      }
      
      // Check specific admin permissions
      for (const adminRole of user.roleData.admin.permissions) {
        if (PERMISSIONS.admin[adminRole]?.includes(permission)) {
          return true;
        }
      }
      return false;
    }
    
    // Police users (Future implementation)
    if (userType === 'police') {
      const accessLevel = user.roleData?.police?.accessLevel || 'read_only';
      return PERMISSIONS.police[accessLevel]?.includes(permission) || false;
    }
    
    // Researcher users (Future implementation)
    if (userType === 'researcher') {
      const accessLevel = user.roleData?.researcher?.accessLevel || 'basic';
      return PERMISSIONS.researcher[accessLevel]?.includes(permission) || false;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Error checking user permission:', error);
    return false;
  }
}

// Middleware factory for requiring specific permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    req.permissionRequired = permission;
    checkPermission(req, res, next);
  };
};

// Middleware for requiring admin access
const requireAdmin = (req, res, next) => {
  if (req.userContext?.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      userType: req.userContext?.userType || 'unknown'
    });
  }
  next();
};

// Middleware for requiring authenticated users (non-anonymous)
const requireAuthenticated = (req, res, next) => {
  if (req.userContext?.userType === 'anonymous' || req.userContext?.user?.temporary) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      userType: req.userContext?.userType || 'unknown'
    });
  }
  next();
};

// Middleware for checking minimum trust score
const requireMinimumTrust = (minTrustScore = 50) => {
  return (req, res, next) => {
    const trustScore = req.userContext?.securityContext?.trustScore || 0;
    
    if (trustScore < minTrustScore) {
      console.log(`🚨 Low trust user ${req.userContext?.user?.userId} (${trustScore}) attempted restricted action`);
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient trust score for this action',
        required: minTrustScore,
        current: trustScore,
        securityContext: req.userContext?.securityContext
      });
    }
    next();
  };
};

// Middleware for checking risk level
const requireMaxRisk = (maxRiskLevel = 'medium') => {
  const riskLevels = {
    'very_low': 1,
    'low': 2,
    'medium': 3,
    'high': 4,
    'critical': 5
  };
  
  return (req, res, next) => {
    const userRisk = req.userContext?.securityContext?.riskLevel || 'medium';
    const userRiskValue = riskLevels[userRisk] || 3;
    const maxRiskValue = riskLevels[maxRiskLevel] || 3;
    
    if (userRiskValue > maxRiskValue) {
      console.log(`🚨 High risk user ${req.userContext?.user?.userId} (${userRisk}) attempted restricted action`);
      
      return res.status(403).json({
        success: false,
        message: 'Risk level too high for this action',
        maxAllowed: maxRiskLevel,
        current: userRisk,
        securityContext: req.userContext?.securityContext
      });
    }
    next();
  };
};

// Utility function to get all permissions for a user
const getUserPermissions = async (userContext) => {
  const { user, userType } = userContext;
  const permissions = [];
  
  try {
    if (userType === 'anonymous') {
      permissions.push(...PERMISSIONS.anonymous);
    } else if (userType === 'admin' && user.roleData?.admin?.permissions) {
      for (const adminRole of user.roleData.admin.permissions) {
        if (PERMISSIONS.admin[adminRole]) {
          permissions.push(...PERMISSIONS.admin[adminRole]);
        }
      }
    } else if (userType === 'police' && user.roleData?.police?.accessLevel) {
      const accessLevel = user.roleData.police.accessLevel;
      if (PERMISSIONS.police[accessLevel]) {
        permissions.push(...PERMISSIONS.police[accessLevel]);
      }
    } else if (userType === 'researcher' && user.roleData?.researcher?.accessLevel) {
      const accessLevel = user.roleData.researcher.accessLevel;
      if (PERMISSIONS.researcher[accessLevel]) {
        permissions.push(...PERMISSIONS.researcher[accessLevel]);
      }
    }
    
    // Remove duplicates
    return [...new Set(permissions)];
    
  } catch (error) {
    console.error('❌ Error getting user permissions:', error);
    return [];
  }
};

module.exports = {
  checkPermission,
  requirePermission,
  requireAdmin,
  requireAuthenticated,
  requireMinimumTrust,
  requireMaxRisk,
  getUserPermissions,
  userHasPermission,
  PERMISSIONS
};