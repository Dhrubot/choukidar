// === src/routes/admin.js ===
const express = require('express');
const router = express.Router();

// Temporary in-memory storage (same as reports.js for now)
// In production, this would use the same database
let reports = [];

// GET all pending reports (admin only)
router.get('/reports', (req, res) => {
  try {
    const pendingReports = reports.filter(report => report.status === 'pending');
    res.json({
      success: true,
      count: pendingReports.length,
      data: pendingReports
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching pending reports',
      error: error.message 
    });
  }
});

// GET all reports (admin only)
router.get('/reports/all', (req, res) => {
  try {
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching all reports',
      error: error.message 
    });
  }
});

// PUT approve/reject report
router.put('/reports/:id', (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approved" or "rejected"'
      });
    }

    const reportIndex = reports.findIndex(r => r.id === req.params.id);
    if (reportIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    reports[reportIndex] = {
      ...reports[reportIndex],
      status,
      moderatedBy: 'admin',
      moderatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: `Report ${status} successfully`,
      data: reports[reportIndex]
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating report',
      error: error.message 
    });
  }
});

// GET admin dashboard stats
router.get('/dashboard', (req, res) => {
  try {
    const stats = {
      total: reports.length,
      pending: reports.filter(r => r.status === 'pending').length,
      approved: reports.filter(r => r.status === 'approved').length,
      rejected: reports.filter(r => r.status === 'rejected').length
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard stats',
      error: error.message 
    });
  }
});

module.exports = router;