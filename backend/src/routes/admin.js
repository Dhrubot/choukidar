// === backend/src/routes/admin.js (Refactored) ===
// This file now contains admin-specific analytics and dashboard routes.
// Basic report management (viewing, approving, rejecting) has been consolidated
// into './reports.js' to avoid duplication and use more advanced features.

const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog'); // For logging admin actions
const { userTypeDetection } = require('../middleware/userTypeDetection');
const { requireAdmin, requirePermission } = require('../middleware/roleBasedAccess'); // Corrected import

// Apply security middleware to all admin routes
router.use(userTypeDetection);
router.use(requireAdmin); // Ensures only admins can access these routes

/**
 * Helper function to create an audit log entry.
 * @param {object} req - The request object from Express.
 * @param {string} actionType - The type of action from the AuditLog schema enum.
 * @param {object} details - Any additional details to log.
 * @param {string} severity - The severity level of the action.
 */
const logAdminAction = async (req, actionType, details = {}, severity = 'low') => {
  try {
    // Ensure actor information is consistent with AuditLog model
    const actorInfo = {
      userId: req.userContext.user?._id, // Use _id for database reference
      userType: req.userContext.userType,
      username: req.userContext.user?.roleData?.admin?.username,
      deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
      ipAddress: req.ip // In a real app, hash or obfuscate this
    };

    await AuditLog.create({
      actor: actorInfo,
      actionType,
      details,
      outcome: 'success', // Assuming success for these logging contexts
      severity
    });
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType}:`, error);
  }
};


// GET /api/admin/dashboard - Admin dashboard stats
router.get('/dashboard', requirePermission('view_admin_analytics'), async (req, res) => {
  try {
    const basicStats = {
      total: await Report.countDocuments(),
      pending: await Report.countDocuments({ status: 'pending' }),
      approved: await Report.countDocuments({ status: 'approved' }),
      rejected: await Report.countDocuments({ status: 'rejected' })
    };

    const securityStats = {
      crossBorderReports: await Report.countDocuments({ 'securityFlags.crossBorderReport': true }),
      potentialSpam: await Report.countDocuments({ 'securityFlags.potentialSpam': true }),
      flaggedForReview: await Report.countDocuments({ status: { $in: ['flagged', 'under_review'] } })
    };

    // Log this action
    await logAdminAction(req, 'view_admin_analytics', { dashboard: 'main' }, 'low');

    res.json({
      success: true,
      data: {
        ...basicStats,
        security: securityStats,
      }
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
});

// GET /api/admin/reports/flagged - Get reports with security flags
router.get('/reports/flagged', requirePermission('moderate_content'), async (req, res) => {
  try {
    const flaggedReports = await Report.find({
      $or: [
        { 'securityFlags.crossBorderReport': true },
        { 'securityFlags.potentialSpam': true },
        { 'securityFlags.suspiciousLocation': true },
        { status: { $in: ['flagged', 'under_review'] } }
      ]
    })
    .select('+location.originalCoordinates')
    .sort({ 'moderation.priorityLevel': -1, timestamp: -1 });

    // Log this action
    await logAdminAction(req, 'view_flagged_reports', { count: flaggedReports.length }, 'medium');

    res.json({
      success: true,
      count: flaggedReports.length,
      data: flaggedReports
    });
  } catch (error) {
    console.error('❌ Error fetching flagged reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching flagged reports',
      error: error.message
    });
  }
});

// GET /api/admin/analytics/security - Security analytics for admin monitoring
router.get('/analytics/security', requirePermission('view_security_analytics'), async (req, res) => {
  try {
    const analytics = await Report.aggregate([
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          crossBorderReports: {
            $sum: { $cond: ['$securityFlags.crossBorderReport', 1, 0] }
          },
          potentialSpam: {
            $sum: { $cond: ['$securityFlags.potentialSpam', 1, 0] }
          },
          avgSecurityScore: { $avg: '$securityScore' }
        }
      }
    ]);

    const statusBreakdown = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Log this action
    await logAdminAction(req, 'view_security_analytics', { source: 'reports' }, 'medium');

    res.json({
      success: true,
      data: {
        summary: analytics[0] || {},
        statusBreakdown,
      }
    });
  } catch (error) {
    console.error('❌ Error fetching security analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching security analytics',
      error: error.message
    });
  }
});

module.exports = router;

// === backend/src/routes/admin.js ===
// Enhanced Admin Routes with Role-Specific Middleware

// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const Report = require('../models/Report');
// const AuditLog = require('../models/AuditLog');
// const RoleMiddleware = require('../middleware/roleSpecificMiddleware');
// const { userTypeDetection } = require('../middleware/userTypeDetection');
// const { adminOperationLimiter } = require('../middleware/rateLimiter');

// router.use(userTypeDetection);
// router.use(adminOperationLimiter);

// // Admin dashboard with enhanced statistics
// router.get('/dashboard', RoleMiddleware.apply(RoleMiddleware.adminAnalytics), async (req, res) => {
//   try {
//     const [userStats, reportStats, securityStats, auditStats] = await Promise.all([
//       // User statistics
//       User.aggregate([
//         {
//           $group: {
//             _id: '$userType',
//             count: { $sum: 1 },
//             avgTrustScore: { $avg: '$securityProfile.overallTrustScore' }
//           }
//         }
//       ]),
      
//       // Report statistics
//       Report.aggregate([
//         {
//           $group: {
//             _id: '$status',
//             count: { $sum: 1 }
//           }
//         }
//       ]),
      
//       // Security statistics
//       User.aggregate([
//         {
//           $group: {
//             _id: '$securityProfile.securityRiskLevel',
//             count: { $sum: 1 }
//           }
//         }
//       ]),
      
//       // Recent audit activity
//       AuditLog.countDocuments({
//         timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
//       })
//     ]);

//     res.json({
//       success: true,
//       dashboard: {
//         users: userStats,
//         reports: reportStats,
//         security: securityStats,
//         auditActivity: auditStats,
//         generatedAt: new Date().toISOString()
//       }
//     });

//   } catch (error) {
//     console.error('❌ Dashboard error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to load dashboard'
//     });
//   }
// });

// // User management routes with enhanced security
// router.get('/users', RoleMiddleware.apply(RoleMiddleware.adminUserManagement), async (req, res) => {
//   try {
//     const {
//       userType = 'all',
//       riskLevel = 'all',
//       quarantined = 'all',
//       emailVerified = 'all',
//       page = 1,
//       limit = 50
//     } = req.query;

//     const query = {};
    
//     if (userType !== 'all') query.userType = userType;
//     if (riskLevel !== 'all') query['securityProfile.securityRiskLevel'] = riskLevel;
//     if (quarantined !== 'all') query['securityProfile.quarantineStatus'] = quarantined === 'true';
//     if (emailVerified !== 'all') query['roleData.admin.emailVerified'] = emailVerified === 'true';

//     const users = await User.find(query)
//       .select('-roleData.admin.passwordHash -roleData.admin.passwordResetToken')
//       .sort({ 'activityProfile.lastSeen': -1 })
//       .limit(parseInt(limit))
//       .skip((parseInt(page) - 1) * parseInt(limit))
//       .lean();

//     const total = await User.countDocuments(query);

//     res.json({
//       success: true,
//       users,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     });

//   } catch (error) {
//     console.error('❌ Users query error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to get users'
//     });
//   }
// });

// // System health check
// router.get('/health', RoleMiddleware.apply(RoleMiddleware.systemAdmin), async (req, res) => {
//   try {
//     const health = {
//       status: 'healthy',
//       timestamp: new Date().toISOString(),
//       services: {
//         database: 'connected',
//         redis: 'connected', // You'd implement actual Redis health check
//         email: 'operational'
//       },
//       metrics: {
//         totalUsers: await User.countDocuments(),
//         activeUsers: await User.countDocuments({
//           'activityProfile.lastSeen': { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
//         }),
//         totalReports: await Report.countDocuments(),
//         pendingReports: await Report.countDocuments({ status: 'pending' }),
//         auditLogsToday: await AuditLog.countDocuments({
//           timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
//         })
//       }
//     };

//     res.json({
//       success: true,
//       health
//     });

//   } catch (error) {
//     console.error('❌ Health check error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Health check failed',
//       health: {
//         status: 'unhealthy',
//         error: error.message
//       }
//     });
//   }
// });

// module.exports = router;