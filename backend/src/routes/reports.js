
// === backend/src/routes/reports.js ===
const express = require('express');
const router = express.Router();
const Report = require('../models/Report'); // Import the MongoDB model

// GET all approved reports
router.get('/', async (req, res) => {
  try {
    const reports = await Report.find({ status: 'approved' })
      .select('-ipHash -moderatedBy')
      .sort({ timestamp: -1 });
    
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reports',
      error: error.message 
    });
  }
});

// POST new report
router.post('/', async (req, res) => {
  console.log('📥 Received report data:', req.body);
  
  try {
    const { type, description, location, severity } = req.body;
    
    // Basic validation
    if (!type || !description || !location || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create new report using MongoDB model
    const newReport = new Report({
      type,
      description,
      location,
      severity,
      ipHash: req.ip // Simple IP hash for rate limiting
    });

    console.log('🔧 Created report object:', newReport);

    const savedReport = await newReport.save();
    console.log('💾 Saved to MongoDB:', savedReport);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: { id: savedReport._id }
    });
  } catch (error) {
    console.error('❌ Error creating report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating report',
      error: error.message 
    });
  }
});

// GET single report by ID
router.get('/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error fetching report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching report',
      error: error.message 
    });
  }
});

module.exports = router;