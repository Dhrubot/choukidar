// === src/routes/reports.js ===
const express = require('express');
const router = express.Router();

// Temporary in-memory storage (replace with MongoDB later)
let reports = [];

// GET all approved reports
router.get('/', (req, res) => {
  try {
    const approvedReports = reports.filter(report => report.status === 'approved');
    res.json({
      success: true,
      count: approvedReports.length,
      data: approvedReports
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching reports',
      error: error.message 
    });
  }
});

// POST new report
router.post('/', (req, res) => {
  try {
    const { type, description, location, severity } = req.body;
    
    // Basic validation
    if (!type || !description || !location || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const newReport = {
      id: Date.now().toString(),
      type,
      description,
      location,
      severity,
      status: 'pending',
      timestamp: new Date().toISOString(),
      anonymous: true
    };

    reports.push(newReport);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: { id: newReport.id }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error creating report',
      error: error.message 
    });
  }
});

// GET single report by ID
router.get('/:id', (req, res) => {
  try {
    const report = reports.find(r => r.id === req.params.id);
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
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching report',
      error: error.message 
    });
  }
});

module.exports = router;