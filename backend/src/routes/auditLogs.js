// === backend/src/routes/auditLogs.js ===
// Audit Log Export and Query Routes

const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const RoleMiddleware = require('../middleware/roleSpecificMiddleware');
const { userTypeDetection } = require('../middleware/userTypeDetection');

router.use(userTypeDetection);

// GET /api/audit-logs - Query audit logs with filters
router.get('/', RoleMiddleware.apply(RoleMiddleware.auditAccess), async (req, res) => {
  try {
    const {
      actionType,
      actorType,
      outcome,
      severity,
      startDate,
      endDate,
      userId,
      page = 1,
      limit = 100,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      export: exportFormat
    } = req.query;

    // Build query
    const query = {};
    
    if (actionType && actionType !== 'all') {
      query.actionType = actionType;
    }
    
    if (actorType && actorType !== 'all') {
      query['actor.userType'] = actorType;
    }
    
    if (outcome && outcome !== 'all') {
      query.outcome = outcome;
    }
    
    if (severity && severity !== 'all') {
      query.severity = severity;
    }
    
    if (userId) {
      query['actor.userId'] = userId;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const logs = await AuditLog.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await AuditLog.countDocuments(query);

    // Export functionality
    if (exportFormat === 'csv') {
      const csv = convertToCSV(logs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    if (exportFormat === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${new Date().toISOString().split('T')[0]}.json`);
      return res.json({
        exportedAt: new Date().toISOString(),
        total,
        logs
      });
    }

    // Regular response
    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        actionType,
        actorType,
        outcome,
        severity,
        startDate,
        endDate,
        userId
      }
    });

  } catch (error) {
    console.error('❌ Audit logs query error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query audit logs'
    });
  }
});

// GET /api/audit-logs/statistics - Audit log statistics
router.get('/statistics', RoleMiddleware.apply(RoleMiddleware.auditAccess), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stats = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          successfulActions: { $sum: { $cond: [{ $eq: ['$outcome', 'success'] }, 1, 0] } },
          failedActions: { $sum: { $cond: [{ $eq: ['$outcome', 'failure'] }, 1, 0] } },
          criticalEvents: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          highSeverityEvents: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } }
        }
      }
    ]);

    const actionTypeBreakdown = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$actionType',
          count: { $sum: 1 },
          successCount: { $sum: { $cond: [{ $eq: ['$outcome', 'success'] }, 1, 0] } },
          failureCount: { $sum: { $cond: [{ $eq: ['$outcome', 'failure'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const userActivityBreakdown = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$actor.userId',
          username: { $first: '$actor.username' },
          userType: { $first: '$actor.userType' },
          actionCount: { $sum: 1 },
          lastActivity: { $max: '$timestamp' }
        }
      },
      { $sort: { actionCount: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      period: `${days} days`,
      overview: stats[0] || {},
      actionTypes: actionTypeBreakdown,
      topUsers: userActivityBreakdown,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Audit statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate audit statistics'
    });
  }
});

// GET /api/audit-logs/user/:userId - Get logs for specific user
router.get('/user/:userId', RoleMiddleware.apply(RoleMiddleware.auditAccess), async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const logs = await AuditLog.find({ 'actor.userId': userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await AuditLog.countDocuments({ 'actor.userId': userId });

    res.json({
      success: true,
      userId,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ User audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user audit logs'
    });
  }
});

// Helper function to convert logs to CSV
function convertToCSV(logs) {
  const headers = ['Timestamp', 'Action Type', 'Actor Username', 'Actor Type', 'Outcome', 'Severity', 'Details'];
  const rows = logs.map(log => [
    new Date(log.timestamp).toISOString(),
    log.actionType,
    log.actor.username || 'N/A',
    log.actor.userType,
    log.outcome,
    log.severity,
    JSON.stringify(log.details || {})
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

module.exports = router;