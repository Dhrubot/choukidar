// === backend/src/routes/reports.js (Complete with ALL original functionality) ===
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const rateLimit = require('express-rate-limit');

// Rate limiting for report submission
const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many reports submitted, please try again later.'
  }
});

// GET all approved reports (ORIGINAL FUNCTIONALITY PRESERVED)
router.get('/', async (req, res) => {
  try {
    const { includeFlagged = false } = req.query;
    
    let query = { status: 'approved' };
    
    // Filter out potentially suspicious reports for public view unless specifically requested
    if (!includeFlagged) {
      query['securityFlags.potentialSpam'] = { $ne: true };
    }
    
    const reports = await Report.find(query)
      .select('-ipHash -moderatedBy -location.originalCoordinates') // Hide sensitive data
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

// POST new report (ENHANCED with security while maintaining original structure)
router.post('/', submitLimit, async (req, res) => {
  console.log('📥 Received report data:', req.body);
  
  try {
    const { type, description, location, severity } = req.body;
    
    // Enhanced validation (maintains original structure)
    if (!type || !description || !location || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Handle both old and new location formats for backward compatibility
    let locationData;
    let coordinates;
    
    if (location.coordinates) {
      // New enhanced format
      coordinates = location.coordinates;
      locationData = {
        coordinates: coordinates,
        address: location.address || '',
        source: location.source || 'default',
        withinBangladesh: location.withinBangladesh ?? true,
        obfuscated: true
      };
    } else {
      // Old format fallback (if someone uses old structure)
      coordinates = [90.4125, 23.8103]; // Default Dhaka
      locationData = {
        coordinates: coordinates,
        address: location.address || location || 'Location provided',
        source: 'default',
        withinBangladesh: true,
        obfuscated: true
      };
    }

    // Validate coordinates
    if (!coordinates || coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location coordinates'
      });
    }

    const [lng, lat] = coordinates;
    
    // Enhanced security checks
    const securityFlags = {
      suspiciousLocation: false,
      crossBorderReport: !locationData.withinBangladesh,
      potentialSpam: false
    };

    // Basic spam detection
    if (description.length < 10 || 
        /(.)\1{10,}/.test(description) || // Repeated characters
        /^[^a-zA-Z]*$/.test(description)) { // No letters
      securityFlags.potentialSpam = true;
    }

    // Determine reporting country (basic detection)
    const reportingCountry = locationData.withinBangladesh ? 'BD' : 'OTHER';

    // Create enhanced report (maintains original structure + security)
    const newReport = new Report({
      type,
      description,
      location: locationData,
      severity,
      ipHash: req.ip, // Original functionality preserved
      reportingCountry,
      securityFlags
    });

    console.log('🔧 Created enhanced report object:', {
      id: newReport._id,
      type: newReport.type,
      locationSource: newReport.location.source,
      withinBangladesh: newReport.location.withinBangladesh,
      securityFlags: newReport.securityFlags
    });

    const savedReport = await newReport.save();
    console.log('💾 Saved to MongoDB with security enhancements');

    // Log security events for monitoring
    if (securityFlags.crossBorderReport || securityFlags.potentialSpam) {
      console.log('🚨 Security alert for report:', savedReport._id, securityFlags);
    }

    // Original response format maintained
    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: { 
        id: savedReport._id,
        requiresReview: securityFlags.crossBorderReport || securityFlags.potentialSpam
      }
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

// GET single report by ID (RESTORED - was missing!)
router.get('/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .select('-ipHash -moderatedBy -location.originalCoordinates'); // Hide sensitive data for public access
    
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