// === backend/src/routes/reports.js ===
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const User = require('../models/User'); // Import User model
const DeviceFingerprint = require('../models/DeviceFingerprint'); // Import DeviceFingerprint model
const AuditLog = require('../models/AuditLog'); // Import AuditLog for admin action logging
const { userTypeDetection, requireNonQuarantined, logUserActivity } = require('../middleware/userTypeDetection'); // Import necessary middleware
const { requireAdmin, requirePermission } = require('../middleware/roleBasedAccess'); // Corrected import
const SocketHandler = require('../websocket/socketHandler'); // Import the SocketHandler class
const { cacheLayer, cacheMiddleware } = require('../middleware/cacheLayer'); // Import Redis caching
const crypto = require('crypto'); // For hashing IP addresses and cache keys
const rateLimit = require('express-rate-limit'); // Import rate-limit

// Helper function to hash an IP address
const hashIp = (ip) => {
  if (!ip) return null;
  // Use a strong hashing algorithm like SHA256
  return crypto.createHash('sha256').update(ip).digest('hex');
};

// Rate limiting for report submission
const submitLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' || process.env.LOAD_TESTING === 'true' ? 1000 : 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many reports submitted from this IP, please try again later.'
  },
  keyGenerator: (req) => {
    // Use IP hash for rate limiting
    return hashIp(req.ip);
  },
  skip: (req) => {
    // Skip rate limiting if load testing is enabled
    return process.env.LOAD_TESTING === 'true' || process.env.NODE_ENV === 'test';
  }
});

/**
 * Helper function to create an audit log entry for admin actions on reports.
 */
const logAdminAction = async (req, actionType, target, details, severity) => {
  try {
    await AuditLog.create({
      actor: {
        userId: req.userContext.user._id,
        userType: 'admin',
        username: req.userContext.user.roleData.admin.username,
        deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
        ipAddress: req.ip
      },
      actionType,
      target,
      details,
      outcome: 'success',
      severity
    });
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType} on report ${target.id}:`, error);
  }
};

// Apply user type detection to all report routes
router.use(userTypeDetection);
router.use(requireNonQuarantined); // Ensure quarantined users cannot submit reports

// POST /api/reports - Submit a new report
router.post('/', submitLimit, logUserActivity('submit_report'), async (req, res) => { // Apply rate limit here
  try {
    const {
      type,
      description,
      location, // { coordinates: [lng, lat], address, source }
      severity,
      media = [],
      anonymous = true, // Frontend indicates if user chose anonymous
      behaviorSignature // From frontend, if collected (e.g., submissionSpeed)
    } = req.body;

    // Basic validation
    if (!type || !description || !location || !location.coordinates || !severity) {
      return res.status(400).json({ success: false, message: 'Missing required report fields.' });
    }

    // Determine submittedBy user and device fingerprint
    let submittedByUserId;
    let submittedByUserType = req.userContext.userType;
    let submittedByDeviceFingerprintId = req.userContext.deviceFingerprint?.fingerprintId;
    let submittedByIpHash = hashIp(req.ip); // Capture and hash the IP address

    // --- Handle Anonymous User Persistence on First Report ---
    if (req.userContext.user.isEphemeral) {
      // This is an ephemeral anonymous user. We need to persist them now.
      console.log(`Attempting to persist ephemeral anonymous user: ${req.userContext.user.userId}`);

      let existingDevice = null;
      if (submittedByDeviceFingerprintId) {
        existingDevice = await DeviceFingerprint.findOne({ fingerprintId: submittedByDeviceFingerprintId });
      }

      let persistentUser;
      let persistentDevice;

      if (existingDevice) {
        // Device already exists, link to its user (should be an anonymous user)
        persistentUser = await User.findById(existingDevice.userId);
        if (!persistentUser) {
            // This scenario indicates a data inconsistency, create a new user for the existing device
            console.warn(`Existing device ${existingDevice.fingerprintId} found but no linked user. Creating new anonymous user.`);
            const newAnonUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            persistentUser = new User({
                userId: newAnonUserId,
                userType: 'anonymous',
                securityProfile: {
                    primaryDeviceFingerprint: existingDevice.fingerprintId,
                    overallTrustScore: 50, // Default for new anonymous
                    securityRiskLevel: 'medium'
                }
            });
            await persistentUser.save();
            existingDevice.userId = persistentUser._id; // Update device to link to new user
            await existingDevice.save();
        }
        persistentDevice = existingDevice;
        console.log(`Re-using existing anonymous user ${persistentUser.userId} for report.`);
      } else {
        // New device fingerprint for an ephemeral user - create new User and DeviceFingerprint
        const newAnonUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        persistentUser = new User({
          userId: newAnonUserId,
          userType: 'anonymous',
          securityProfile: {
            primaryDeviceFingerprint: submittedByDeviceFingerprintId,
            overallTrustScore: 50, // Default for new anonymous
            securityRiskLevel: 'medium'
          }
        });
        await persistentUser.save();

        persistentDevice = new DeviceFingerprint({
          fingerprintId: submittedByDeviceFingerprintId,
          userId: persistentUser._id, // Link to the newly created anonymous user
          trustScore: 50,
          riskLevel: 'medium',
          lastSeen: new Date(),
          associatedUserType: 'anonymous'
        });
        await persistentDevice.save();
        console.log(`Created new anonymous user ${persistentUser.userId} and device ${persistentDevice.fingerprintId} for report.`);
      }
      submittedByUserId = persistentUser._id; // Use Mongoose _id for reference
      submittedByUserType = 'anonymous'; // Ensure it's set to anonymous
      submittedByDeviceFingerprintId = persistentDevice.fingerprintId; // Ensure it's the persisted ID

    } else {
      // User is already persistent (authenticated or existing anonymous)
      submittedByUserId = req.userContext.user._id; // Use Mongoose _id for reference
      submittedByUserType = req.userContext.userType;
      // If the user is authenticated, their deviceFingerprint might not be directly in req.userContext.deviceFingerprint
      // but should be in their securityProfile.primaryDeviceFingerprint
      submittedByDeviceFingerprintId = req.userContext.user.securityProfile?.primaryDeviceFingerprint || submittedByDeviceFingerprintId;
    }

    // Create the new report
    const newReport = new Report({
      type,
      description,
      location: {
        coordinates: location.coordinates,
        address: location.address,
        source: location.source || 'Manual',
        // originalCoordinates will be set by pre-save hook
        obfuscated: true // Always obfuscate for public display
      },
      severity,
      media,
      anonymous: anonymous,
      submittedBy: {
        userId: submittedByUserId, // Store Mongoose _id
        userType: submittedByUserType,
        deviceFingerprint: submittedByDeviceFingerprintId,
        ipHash: submittedByIpHash, // Store the hashed IP address
        // sessionId: req.sessionID // If using sessions
      },
      behaviorSignature: behaviorSignature || {},
      status: 'pending' // All new reports start as pending
    });

    await newReport.save(); // Pre-save hooks will run here (security analysis, obfuscation)

    console.log(`✅ New report submitted: ${newReport._id} by ${submittedByUserType} user ${submittedByUserId}`);

    // === FIX  GRANULAR CACHE INVALIDATION ===
    // Instead of wiping the entire cache with deletePattern, invalidate only what's necessary.
    // This prevents cache thrashing and allows analytics endpoints to stay fast.
 // === FIX : GRANULAR CACHE INVALIDATION ===
    // Instead of wiping the entire cache with deletePattern, invalidate only what's necessary.
    // This prevents cache thrashing and allows analytics endpoints to stay fast.
    console.log('🗑️ Invalidating specific caches due to new report submission...');
    await Promise.all([
      cacheLayer.delete('admin:dashboard:stats'),
      cacheLayer.delete('admin:analytics:security'),
      // Let paginated report lists expire via TTL instead of scanning keys.
      // This is a safe and performant approach.
    ]);
    // REMOVED: await cacheLayer.deletePattern('reports:*');
    // REMOVED: await cacheLayer.deletePattern('admin:*');
    // REMOVED: await cacheLayer.deletePattern('safezones:analytics:*');
    // --- Real-time Notification for Admins (and potentially nearby users later) ---
    if (req.app.locals.socketHandler) {
      req.app.locals.socketHandler.emitToAdmins('new_pending_report', {
        reportId: newReport._id,
        type: newReport.type,
        severity: newReport.severity,
        location: newReport.location.coordinates,
        timestamp: newReport.timestamp,
        priority: newReport.moderation.priorityLevel,
        securityScore: newReport.securityScore
      });
    } else {
      console.warn('SocketHandler not available in app.locals. Cannot emit real-time updates.');
    }

    // Log the action for audit purposes (only for authenticated users)
    if (req.userContext?.user && req.userContext.user.userType !== 'anonymous') {
      try {
        await logAdminAction(req, 'submit_report', { reportId: newReport._id, type, severity }, 'medium');
      } catch (auditError) {
        console.warn('⚠️ Audit logging failed:', auditError.message);
      }
    }
  

    // Real-time notifications are already handled by emitToAdmins above
    // No need for additional global.socketHandler.notifyNewReport call

    res.status(201).json({ success: true, message: 'Report submitted successfully.', data: newReport });

  } catch (error) {
    console.error('❌ Error submitting report:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report.', error: error.message });
  }
});

// GET /api/reports - Get all reports (admin only, or filtered for public)
router.get('/', 
  cacheMiddleware(300, (req) => {
    // Custom cache key generator based on user type and query parameters
    const queryHash = crypto.createHash('md5')
      .update(JSON.stringify({
        status: req.query.status,
        type: req.query.type,
        severity: req.query.severity,
        genderSensitive: req.query.genderSensitive,
        sortBy: req.query.sortBy || 'timestamp',
        sortOrder: req.query.sortOrder || 'desc'
      }))
      .digest('hex');
    return `reports:${req.userContext.userType}:${queryHash}`;
  }),
  async (req, res) => {
  try {
    const { status, type, severity, genderSensitive, sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
    const query = {};

    // Public users only see approved/verified reports that are NOT archived
    if (req.userContext.userType !== 'admin') {
      query.status = { $in: ['approved', 'verified'] };
    } else {
      // Admins can filter by any status, including 'archived'
      if (status && status !== 'all') {
        query.status = status;
      } else {
        // By default, admins see all non-archived reports
        query.status = { $ne: 'archived' };
      }
    }

    if (type && type !== 'all') query.type = type;
    if (severity) query.severity = { $gte: parseInt(severity) };
    if (genderSensitive) query.genderSensitive = genderSensitive === 'true';

    const reports = await Report.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .select(req.userContext.userType === 'admin' ? '+location.originalCoordinates' : '-location.originalCoordinates'); // Admins see original coords

    res.json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports.', error: error.message });
  }
});

// POST /api/reports/:id/status - Admin action to change report status
router.post('/:id/status', requireAdmin, requirePermission('moderation'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, moderationReason } = req.body; // status: 'approved', 'rejected', 'flagged', 'under_review', 'archived'

    if (!['approved', 'rejected', 'flagged', 'under_review', 'archived'].includes(status)) { // Added 'archived'
      return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const oldStatus = report.status;
    report.status = status;
    report.moderation.moderatedBy = req.userContext.user.roleData.admin.username;
    report.moderation.moderatedAt = new Date();
    report.moderation.moderationReason = moderationReason || '';

    await report.save(); // This will re-run pre-save hooks if needed (though not for status change)

    // --- Audit Log ---
    await logAdminAction(
        req,
        'report_status_change',
        { id: report._id, type: 'Report', name: report.type },
        { oldStatus, newStatus: status, reason: moderationReason },
        'medium'
    );

    await Promise.all([
      cacheLayer.delete(`reports:detail:${id}`), // Invalidate this specific report's cache
      cacheLayer.delete('admin:dashboard:stats'),
      cacheLayer.delete('admin:analytics:security'),
      cacheLayer.delete('admin:reports:flagged') // Flagged reports list might have changed
    ]);

    // If approved, send real-time notification to public clients
    if (status === 'approved') {
      if (req.app.locals.socketHandler) {
        req.app.locals.socketHandler.emitToAll('report_approved', {
          reportId: report._id,
          type: report.type,
          severity: report.severity,
          location: report.location.coordinates, // Obfuscated coordinates
          timestamp: report.timestamp
        });
      } else {
        console.warn('SocketHandler not available in app.locals. Cannot emit real-time updates.');
      }
    }
    
    // If rejected/flagged, potentially notify the reporter if not anonymous (or log for admin)
    // If status changes to 'under_review' or 'flagged', you might want to send a specific admin alert.
    // If archived, notify relevant systems (e.g., data warehousing) for export.
    if (status === 'archived') {
        console.log(`📦 Report ${report._id} manually archived by admin.`);
        // You might emit an event here for an external data export service to pick up
        // req.app.locals.socketHandler.emitToAdmins('report_archived_for_export', { reportId: report._id });
    }

    console.log(`✅ Report ${report._id} status changed to: ${status} by admin ${req.userContext.user.roleData.admin.username}`);
    res.json({ success: true, message: `Report status updated to ${status}.`, report });

  } catch (error) {
    console.error('❌ Error changing report status:', error);
    res.status(500).json({ success: false, message: 'Failed to update report status.', error: error.message });
  }
});

// POST /api/reports/:id/validate - Community validation endpoint
router.post('/:id/validate', logUserActivity('validate_report'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isPositive } = req.body; // boolean: true for positive, false for negative

    if (typeof isPositive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid validation type. Must be true or false.' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    // Prevent self-validation (optional, but good practice)
    if (report.submittedBy.userId && req.userContext.user && report.submittedBy.userId.toString() === req.userContext.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You cannot validate your own report.' });
    }

    // --- Prevent duplicate validation from the same device/user ---
    const deviceFingerprintId = req.userContext.deviceFingerprint?.fingerprintId;
    if (deviceFingerprintId) {
      const device = await DeviceFingerprint.findOne({ fingerprintId: deviceFingerprintId });
      if (device && device.securityProfile.validationHistory.some(val => val.reportId.equals(report._id))) {
        return res.status(403).json({ success: false, message: 'You have already validated this report.' });
      }
    } else {
      // If no device fingerprint, we cannot prevent duplicate anonymous validations effectively
      // This is a trade-off for absolute anonymity without tracking.
      console.warn('Validation attempted without device fingerprint. Cannot prevent duplicate validation.');
    }

    report.addCommunityValidation(isPositive, {
      validatorUserId: req.userContext.user._id,
      validatorUserType: req.userContext.userType,
      validatorDeviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId
    });

    await report.save(); // This will recalculate securityScore based on communityTrustScore

    // If device fingerprint exists, record the validation in its history
    if (deviceFingerprintId) {
      const device = await DeviceFingerprint.findOne({ fingerprintId: deviceFingerprintId });
      if (device) {
        device.securityProfile.validationHistory.push({ reportId: report._id, timestamp: new Date(), isPositive });
        // Update device's total validations given and accuracy rate
        device.securityProfile.totalValidationsGiven += 1;
        if (isPositive) {
            device.securityProfile.accurateValidations += 1;
        } else {
            device.securityProfile.inaccurateValidations += 1;
        }
        if (device.securityProfile.totalValidationsGiven > 0) {
            device.securityProfile.validationAccuracyRate = 
                (device.securityProfile.accurateValidations / device.securityProfile.totalValidationsGiven) * 100;
        }
        await device.save();
      }
    }

    // Check for automated status changes based on validation
    // This logic could be a separate helper function or a scheduled job for performance
    const { validationsPositive, validationsNegative, communityTrustScore, validationsReceived } = report.communityValidation;
    const validationRequirements = report.getValidatorRequirements();

    if (report.status === 'approved') { // Only re-evaluate 'approved' reports for automated removal/verification
      if (validationsPositive >= validationRequirements.minimumValidations && communityTrustScore >= 80) {
        report.status = 'verified';
        console.log(`✨ Report ${report._id} automatically VERIFIED by community.`);
        await report.save();
        if (req.app.locals.socketHandler) {
          req.app.locals.socketHandler.emitToAll('report_verified', { reportId: report._id }); // Notify map of verified status
        }
      } else if (validationsNegative >= validationRequirements.minimumValidations || communityTrustScore < 20) {
        report.status = 'under_review'; // Flag for admin re-review
        console.log(`🚨 Report ${report._id} flagged for re-review due to negative community validation.`);
        await report.save();
        if (req.app.locals.socketHandler) {
          req.app.locals.socketHandler.emitToAdmins('report_flagged_for_review', { reportId: report._id, reason: 'Negative community validation' });
        }
      }
    }

    await report.save();

    // Invalidate caches after validation
    await cacheLayer.deletePattern('reports:*');
    await cacheLayer.deletePattern('admin:*');

    res.json({ 
      success: true, 
      message: 'Validation recorded successfully.', 
      data: { 
        validationScore: report.validation.score,
        status: report.status,
        totalValidations 
      } 
    });

  } catch (error) {
    console.error('❌ Error submitting community validation:', error);
    res.status(500).json({ success: false, message: 'Failed to record validation.', error: error.message });
  }
});

// DELETE /api/reports/:id - Admin action to delete a report
router.delete('/:id', requireAdmin, requirePermission('moderation'), async (req, res) => {
  try {
    const { id } = req.params;
    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    // --- Audit Log for deletion ---
    await logAdminAction(
        req,
        'report_status_change', // Using existing enum
        { id: report._id, type: 'Report', name: report.type },
        { oldStatus: report.status, newStatus: 'deleted', reason: 'Admin deletion' },
        'high' // Deletion is a high-severity action
    );

    console.log(`🗑️ Report ${id} deleted by admin ${req.userContext.user.roleData.admin.username}`);
    if (req.app.locals.socketHandler) {
      req.app.locals.socketHandler.emitToAll('report_deleted', { reportId: id }); // Notify clients to remove from map
    }

    // Log admin action
    await logAdminAction(req, 'delete_report', { reportId: id }, 'high');

    // === FIX #2: GRANULAR CACHE INVALIDATION ===
    await Promise.all([
      cacheLayer.delete(`reports:detail:${id}`), // Invalidate this specific report's cache
      cacheLayer.delete('admin:dashboard:stats'),
      cacheLayer.delete('admin:analytics:security'),
      cacheLayer.delete('admin:reports:flagged')
    ]);

    res.json({ success: true, message: 'Report deleted successfully.' });

  } catch (error) {
    console.error('❌ Error deleting report:', error);
    res.status(500).json({ success: false, message: 'Failed to delete report.', error: error.message });
  }
});

module.exports = router;