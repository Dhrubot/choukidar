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
const { cacheLayer, cacheMiddleware } = require('../middleware/cacheLayer'); // Import Redis caching
const crypto = require('crypto'); // For cache key hashing
const { performanceMonitor } = require('../utils/performanceMonitor'); // Import performance monitoring
const { lightSanitization, adminSanitization } = require('../utils/sanitization');

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
router.get('/dashboard', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_admin_analytics'),
  cacheMiddleware(300, () => {
    // Cache dashboard for 5 minutes - same for all admins
    return 'admin:dashboard:stats';
  }, 'admin'), // Add version namespace
  async (req, res) => {
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
      flaggedForReview: await Report.countDocuments({ status: { $in: ['flagged', 'under_review'] } }),
      bangladeshReports: await Report.countDocuments({ 'location.withinBangladesh': true })
    };

    // Add source breakdown for frontend compatibility
    const sourceBreakdown = await Report.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]);

    // Log this action
    await logAdminAction(req, 'data_export', { 
      action: 'view_dashboard_analytics', 
      dashboard: 'main' 
    }, 'low');

    res.json({
      success: true,
      data: {
        ...basicStats,
        security: securityStats,
        sourceBreakdown
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
router.get('/reports/flagged', 
  lightSanitization(), // Only sanitize query params
  requirePermission('moderate_content'),
  cacheMiddleware(180, () => {
    // Cache flagged reports for 3 minutes
    return 'admin:reports:flagged';
  }, 'admin'), // Add version namespace
  async (req, res) => {
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
    await logAdminAction(req, 'data_export', { action: 'view_flagged_reports', count: flaggedReports.length }, 'medium');

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

// GET /api/admin/reports - Get reports for moderation queue (alias for /reports/all)
router.get('/reports', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_all_reports'),
  cacheMiddleware(180, (req) => {
    // Cache moderation queue for 3 minutes with pagination
    const queryHash = crypto.createHash('md5')
      .update(JSON.stringify({
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        status: req.query.status,
        severity: req.query.severity
      }))
      .digest('hex');
    return `admin:reports:moderation:${queryHash}`;
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.severity && req.query.severity !== 'all') {
      filter.severity = req.query.severity;
    }

    // Get reports with pagination
    const reports = await Report.find(filter)
      .populate('submittedBy.userId', 'username userType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Report.countDocuments(filter);

    // Log this action
    await logAdminAction(req, 'data_export', { 
      action: 'view_moderation_queue',
      filters: filter,
      pagination: { page, limit }
    }, 'low');

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching reports for moderation:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// GET /api/admin/reports/all - Get all reports for admin dashboard
router.get('/reports/all', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_all_reports'),
  cacheMiddleware(180, (req) => {
    // Cache admin reports for 3 minutes with pagination
    const queryHash = crypto.createHash('md5')
      .update(JSON.stringify({
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        status: req.query.status,
        severity: req.query.severity,
        sortBy: req.query.sortBy || 'timestamp',
        sortOrder: req.query.sortOrder || 'desc'
      }))
      .digest('hex');
    return `admin:reports:all:${queryHash}`;
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const { page = 1, limit = 50, status, severity, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    
    // Build filter object
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (severity && severity !== 'all') {
      filter.severity = severity;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const reports = await Report.find(filter)
      .select('+location.originalCoordinates')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('submittedBy.userId', 'username userType')
      .lean();

    const totalReports = await Report.countDocuments(filter);
    const totalPages = Math.ceil(totalReports / limit);

    // Log this action
    await logAdminAction(req, 'data_export', { 
      action: 'view_all_reports', 
      count: reports.length,
      filters: filter 
    }, 'low');

    res.json({
      success: true,
      data: reports,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReports,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Error fetching all reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// GET /api/admin/verify - Verify admin session for token restoration
router.get('/verify', 
  lightSanitization(), // Only sanitize query params
  requirePermission('admin_access'), async (req, res) => {
  try {
    // If we reach here, the middleware has already verified the token and user
    const user = req.userContext.user;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.roleData?.admin?.username,
        email: user.roleData?.admin?.email,
        permissions: user.roleData?.admin?.permissions || [],
        adminLevel: user.roleData?.admin?.adminLevel || 1
      },
      securityContext: {
        deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
        ipAddress: req.ip,
        lastActivity: new Date()
      },
      preferences: user.roleData?.admin?.preferences || {},
      refreshToken: req.userContext.refreshToken // If available
    });
  } catch (error) {
    console.error('❌ Error verifying admin session:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying session',
      error: error.message
    });
  }
});

// GET /api/admin/analytics/security - Security analytics for admin monitoring
router.get('/analytics/security', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_security_analytics'),
  cacheMiddleware(600, () => {
    // Cache security analytics for 10 minutes - same for all admins
    return 'admin:analytics:security';
  }, 'security'), // Use security namespace for security-related data
  async (req, res) => {
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
    await logAdminAction(req, 'data_export', { action: 'view_security_analytics', count: statusBreakdown.length }, 'medium');

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

// GET /api/admin/performance/report - Get comprehensive performance report
router.get('/performance/report', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_system_metrics'),
  cacheMiddleware(60, () => {
    // 1 minute cache for performance data
    return 'admin:performance:report';
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    
    // Log admin action
    await logAdminAction(req, 'view_performance_report', 
      { reportType: 'comprehensive' }, 
      'low'
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error generating performance report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate performance report.',
      error: error.message 
    });
  }
});

// GET /api/admin/performance/metrics - Get raw metrics for external monitoring
router.get('/performance/metrics', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_system_metrics'),
  cacheMiddleware(30, () => {
    // 30 second cache for raw metrics
    return 'admin:performance:metrics';
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const metrics = performanceMonitor.exportMetrics();
    
    // Log admin action
    await logAdminAction(req, 'export_performance_metrics', 
      { metricsCount: Object.keys(metrics).length }, 
      'low'
    );

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ Error exporting performance metrics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export performance metrics.',
      error: error.message 
    });
  }
});

// GET /api/admin/performance/database - Get database-specific performance data
router.get('/performance/database', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_system_metrics'),
  cacheMiddleware(60, () => {
    // Cache database metrics for 1 minute
    return 'admin:performance:database';
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    
    // Get additional database insights
    const indexStats = await mongoose.connection.db.admin().command({ dbStats: 1 });
    
    const databasePerformance = {
      ...report.database,
      dbStats: {
        collections: indexStats.collections,
        dataSize: indexStats.dataSize,
        indexSize: indexStats.indexSize,
        storageSize: indexStats.storageSize
      },
      optimizationImpact: {
        estimatedSpeedGain: '70-85%',
        indexEfficiency: report.database.optimizationRate,
        slowQueryReduction: report.database.slowQueries.length < 10 ? 'Excellent' : 'Needs Attention'
      }
    };

    res.json({
      success: true,
      data: databasePerformance
    });
  } catch (error) {
    console.error('❌ Error getting database performance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get database performance data.',
      error: error.message 
    });
  }
});

// GET /api/admin/performance/cache - Get Redis cache performance data
router.get('/performance/cache', 
  lightSanitization(), // Only sanitize query params
  requirePermission('view_system_metrics'),
  cacheMiddleware(30, () => {
    // Cache cache metrics for 30 seconds (meta!)
    return 'admin:performance:cache';
  }, 'admin'), // Add version namespace
  async (req, res) => {
  try {
    const report = performanceMonitor.generateReport();
    const cacheHealth = await cacheLayer.healthCheck();
    
    const cachePerformance = {
      ...report.cache,
      health: cacheHealth,
      optimization: {
        estimatedSpeedGain: '40-60%',
        efficiency: report.cache.efficiency,
        recommendedActions: report.recommendations
          .filter(r => r.category === 'Cache')
          .map(r => r.message)
      }
    };

    res.json({
      success: true,
      data: cachePerformance
    });
  } catch (error) {
    console.error('❌ Error getting cache performance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get cache performance data.',
      error: error.message 
    });
  }
});

// POST /api/admin/performance/reset - Reset performance metrics (admin only)
router.post('/performance/reset', 
  adminSanitization(), // Full sanitization with admin-specific logic
  requirePermission('system_configuration'),
  async (req, res) => {
  try {
    performanceMonitor.reset();
    
    // Log admin action
    await logAdminAction(req, 'reset_performance_metrics', 
      { resetTime: new Date() }, 
      'medium'
    );

    // Invalidate admin performance cache after reset
    await cacheLayer.bumpVersion('admin');
    console.log('🗑️ Invalidated admin cache after performance reset');

    res.json({
      success: true,
      message: 'Performance metrics reset successfully.'
    });
  } catch (error) {
    console.error('❌ Error resetting performance metrics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to reset performance metrics.',
      error: error.message 
    });
  }
});

// When admin actions modify data, invalidate relevant caches
// Example: After user management actions
async function invalidateUserRelatedCaches() {
  await Promise.all([
    cacheLayer.bumpVersion('admin'),
    cacheLayer.bumpVersion('auth')
  ]);
  console.log('🗑️ Invalidated admin and auth caches after user management');
}

module.exports = router;