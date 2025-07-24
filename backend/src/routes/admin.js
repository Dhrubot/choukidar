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
  requirePermission('view_admin_analytics'),
  cacheMiddleware(300, () => {
    // Cache dashboard for 5 minutes - same for all admins
    return 'admin:dashboard:stats';
  }),
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
  requirePermission('moderate_content'),
  cacheMiddleware(180, () => {
    // Cache flagged reports for 3 minutes
    return 'admin:reports:flagged';
  }),
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
  }),
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
  }),
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
router.get('/verify', requirePermission('admin_access'), async (req, res) => {
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
  requirePermission('view_security_analytics'),
  cacheMiddleware(600, () => {
    // Cache security analytics for 10 minutes - same for all admins
    return 'admin:analytics:security';
  }),
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

module.exports = router;