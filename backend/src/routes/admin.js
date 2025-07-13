// === backend/src/routes/admin.js ===
const express = require('express');
const router = express.Router();
const Report = require('../models/Report'); // Import the MongoDB model

// GET all pending reports (admin only)
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .sort({ timestamp: -1 });
    
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

// GET all reports (admin only)
router.get('/reports/all', async (req, res) => {
  try {
    const reports = await Report.find()
      .sort({ timestamp: -1 });
    
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

// PUT approve/reject report
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

// GET admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const stats = {
      total: await Report.countDocuments(),
      pending: await Report.countDocuments({ status: 'pending' }),
      approved: await Report.countDocuments({ status: 'approved' }),
      rejected: await Report.countDocuments({ status: 'rejected' })
    };

    res.json({
      success: true,
      data: stats
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

module.exports = router;