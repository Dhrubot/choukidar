// === backend/src/middleware/roleSpecificMiddleware.js ===
// Role-Specific Middleware for Clean Route Protection

const { requireAdmin, requirePermission, requireAuthenticated, requireMinimumTrust } = require('./roleBasedAccess');

// Composable middleware for different roles and permissions
class RoleMiddleware {
  // Admin middleware combinations
  static adminOnly = [requireAdmin];
  
  static adminWithPermission = (permission) => [
    requireAdmin,
    requirePermission(permission)
  ];
  
  static superAdminOnly = [
    requireAdmin,
    requirePermission('super_admin')
  ];
  
  static highTrustAdmin = (minTrust = 80) => [
    requireAdmin,
    requireMinimumTrust(minTrust)
  ];
  
  static adminModerator = [
    requireAdmin,
    requirePermission('moderation')
  ];
  
  static adminAnalytics = [
    requireAdmin,
    requirePermission('analytics')
  ];
  
  static adminUserManagement = [
    requireAdmin,
    requirePermission('user_management')
  ];
  
  static adminSecurity = [
    requireAdmin,
    requirePermission('security_monitoring')
  ];
  
  // User management specific combinations
  static userQuarantine = [
    requireAdmin,
    requirePermission('quarantine_users'),
    requireMinimumTrust(70)
  ];
  
  static bulkOperations = [
    requireAdmin,
    requirePermission('quarantine_users'),
    requireMinimumTrust(80)
  ];
  
  static adminManagement = [
    requireAdmin,
    requirePermission('manage_admin_accounts'),
    requireMinimumTrust(90)
  ];
  
  // System administration
  static systemAdmin = [
    requireAdmin,
    requirePermission('system_configuration'),
    requireMinimumTrust(95)
  ];
  
  // Data access roles
  static dataExport = [
    requireAdmin,
    requirePermission('export_data'),
    requireMinimumTrust(85)
  ];
  
  static auditAccess = [
    requireAdmin,
    requirePermission('audit_logs'),
    requireMinimumTrust(85)
  ];
  
  // Helper method to apply multiple middleware
  static apply(middlewares) {
    return (req, res, next) => {
      let index = 0;
      
      function runNext() {
        if (index >= middlewares.length) {
          return next();
        }
        
        const middleware = middlewares[index++];
        middleware(req, res, runNext);
      }
      
      runNext();
    };
  }
}

module.exports = RoleMiddleware;