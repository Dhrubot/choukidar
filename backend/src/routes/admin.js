// === backend/src/routes/admin.js (FIXED - Proper All Reports Endpoint) ===
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

// GET pending reports (admin only) - ORIGINAL FUNCTIONALITY PRESERVED
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .select('+location.originalCoordinates') // Show original coordinates to admins
      .sort({ timestamp: -1, createdAt: -1 });
    
    console.log(`✅ Found ${reports.length} pending reports for admin`);
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('❌ Error fetching pending reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending reports',
      error: error.message 
    });
  }
});

// GET all reports (admin only) - FIXED TO RETURN ALL REPORTS
router.get('/reports/all', async (req, res) => {
  try {
    // Fetch ALL reports regardless of status - THIS IS THE KEY FIX
    const reports = await Report.find({}) // Remove any status filter
      .select('+location.originalCoordinates') // Show original coordinates to admins
      .sort({ timestamp: -1, createdAt: -1 }); // Sort by newest first
    
    console.log(`✅ Found ${reports.length} total reports for admin (pending: ${reports.filter(r => r.status === 'pending').length}, approved: ${reports.filter(r => r.status === 'approved').length}, rejected: ${reports.filter(r => r.status === 'rejected').length})`);
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('❌ Error fetching all reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching all reports',
      error: error.message 
    });
  }
});

// PUT approve/reject report - ORIGINAL FUNCTIONALITY PRESERVED
router.put('/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { 
        status, 
        moderatedBy: 'admin', // Use proper auth later
        moderatedAt: new Date() 
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    console.log(`✅ Report ${req.params.id} ${status} successfully`);

    res.json({
      success: true,
      message: `Report ${status} successfully`,
      data: report
    });
  } catch (error) {
    console.error('❌ Error updating report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating report',
      error: error.message 
    });
  }
});

// GET admin dashboard stats - ENHANCED with better logging
router.get('/dashboard', async (req, res) => {
  try {
    // Original stats preserved
    const basicStats = {
      total: await Report.countDocuments(),
      pending: await Report.countDocuments({ status: 'pending' }),
      approved: await Report.countDocuments({ status: 'approved' }),
      rejected: await Report.countDocuments({ status: 'rejected' })
    };

    // Enhanced security stats
    const securityStats = {
      crossBorderReports: await Report.countDocuments({ 'securityFlags.crossBorderReport': true }),
      potentialSpam: await Report.countDocuments({ 'securityFlags.potentialSpam': true }),
      bangladeshReports: await Report.countDocuments({ 'location.withinBangladesh': true }),
      flaggedReports: await Report.countDocuments({
        $or: [
          { 'securityFlags.crossBorderReport': true },
          { 'securityFlags.potentialSpam': true },
          { 'securityFlags.suspiciousLocation': true }
        ]
      })
    };

    // Location source breakdown
    const sourceBreakdown = await Report.aggregate([
      {
        $group: {
          _id: '$location.source',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`✅ Dashboard stats: Total: ${basicStats.total}, Pending: ${basicStats.pending}, Approved: ${basicStats.approved}, Rejected: ${basicStats.rejected}`);

    res.json({
      success: true,
      data: {
        ...basicStats, // Original stats maintained
        security: securityStats, // Security insights
        sourceBreakdown // Location source analytics
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

// GET reports with security flags (additional admin feature)
router.get('/reports/flagged', async (req, res) => {
  try {
    const flaggedReports = await Report.find({
      $or: [
        { 'securityFlags.crossBorderReport': true },
        { 'securityFlags.potentialSpam': true },
        { 'securityFlags.suspiciousLocation': true }
      ]
    })
    .select('+location.originalCoordinates') // Include original coordinates for admins
    .sort({ timestamp: -1, createdAt: -1 });
    
    console.log(`✅ Found ${flaggedReports.length} flagged reports for admin`);
    
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

// GET security analytics for admin monitoring
router.get('/analytics/security', async (req, res) => {
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
          bangladeshReports: {
            $sum: { $cond: ['$location.withinBangladesh', 1, 0] }
          },
          avgSeverity: { $avg: '$severity' }
        }
      }
    ]);

    // Geographic distribution
    const geoDistribution = await Report.aggregate([
      {
        $group: {
          _id: '$location.withinBangladesh',
          count: { $sum: 1 }
        }
      }
    ]);

    // Reports by status and security flags
    const statusBreakdown = await Report.aggregate([
      {
        $group: {
          _id: {
            status: '$status',
            crossBorder: '$securityFlags.crossBorderReport'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`✅ Security analytics generated successfully`);

    res.json({
      success: true,
      data: {
        summary: analytics[0] || {},
        geoDistribution,
        statusBreakdown
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