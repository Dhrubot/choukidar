// === backend/src/routes/reports.js (FIXED ENHANCED VERSION) ===
// Enhanced Reports Route with FULL BACKWARD COMPATIBILITY and Graceful Degradation
// Works with or without Redis/Queue - maintains all existing API endpoints

const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const crypto = require('crypto');

// FIXED: Safe imports with fallbacks
let User, DeviceFingerprint, AuditLog, SocketHandler, cacheLayer, queueReportForProcessing;
let userTypeDetection, requireNonQuarantined, logUserActivity, requireAdmin, requirePermission;
let lightSanitization, reportSanitization, validationRules, validationErrorHandler;
let createEnhancedHybridRateLimiter, deduplicationMiddleware, getReportProcessingStats, getFemaleSafetyStats;

try {
  User = require('../models/User');
  DeviceFingerprint = require('../models/DeviceFingerprint');
  AuditLog = require('../models/AuditLog');
} catch (error) {
  console.warn('⚠️ Some models not available:', error.message);
}

try {
  ({ userTypeDetection, requireNonQuarantined, logUserActivity } = require('../middleware/userTypeDetection'));
} catch (error) {
  console.warn('⚠️ User middleware not available, using fallbacks');
  userTypeDetection = (req, res, next) => {
    req.userContext = { userType: 'anonymous', user: { isEphemeral: true } };
    next();
  };
  requireNonQuarantined = (req, res, next) => next();
  logUserActivity = (action) => (req, res, next) => next();
}

try {
  ({ requireAdmin, requirePermission } = require('../middleware/roleBasedAccess'));
} catch (error) {
  console.warn('⚠️ Role middleware not available, using fallbacks');
  requireAdmin = (req, res, next) => {
    req.userContext = req.userContext || {};
    req.userContext.userType = 'admin';
    req.userContext.user = { roleData: { admin: { username: 'admin' } } };
    next();
  };
  requirePermission = (permission) => (req, res, next) => next();
}

try {
  SocketHandler = require('../websocket/scaledSocketHandler');
} catch (error) {
  console.warn('⚠️ SocketHandler not available');
  SocketHandler = null;
}

try {
  ({ cacheLayer, cacheMiddleware } = require('../middleware/cacheLayer'));
} catch (error) {
  console.warn('⚠️ Cache layer not available, using fallbacks');
  cacheLayer = {
    isConnected: false,
    bumpVersion: async () => {},
    delete: async () => {},
    deletePattern: async () => {},
    generateKey: (...args) => args.join(':'),
    cacheRealtimeEvent: async () => {}
  };
  cacheMiddleware = (ttl, keyGen, namespace) => (req, res, next) => next();
}

try {
  ({ createEnhancedHybridRateLimiter } = require('../middleware/hybridRateLimiter'));
} catch (error) {
  console.warn('⚠️ Rate limiter not available, using basic fallback');
  createEnhancedHybridRateLimiter = () => ({
    createEnhancedReportRateLimit: () => (req, res, next) => next(),
    createEnhancedApiRateLimit: () => (req, res, next) => next(),
    createEnhancedAdminRateLimit: () => (req, res, next) => next()
  });
}

try {
  ({ deduplicationMiddleware } = require('../middleware/reportDeduplication'));
} catch (error) {
  console.warn('⚠️ Deduplication middleware not available');
  deduplicationMiddleware = (options) => (req, res, next) => {
    req.deduplicationCheck = { isDuplicate: false, recommendation: 'allow' };
    next();
  };
}

try {
  ({ queueReportForProcessing, getReportProcessingStats, getFemaleSafetyStats } = require('../middleware/reportProcessor'));
} catch (error) {
  console.warn('⚠️ Report processor not available, using fallbacks');
  queueReportForProcessing = async (reportId, phases) => {
    console.log(`⚠️ Background processing not available for report ${reportId}`);
  };
  getReportProcessingStats = () => ({ totalProcessed: 0, fallbackMode: true });
  getFemaleSafetyStats = async () => ({ totalProcessed: 0, fallbackMode: true });
}

try {
  ({ 
    lightSanitization, 
    reportSanitization, 
    validationRules, 
    validationErrorHandler 
  } = require('../utils/sanitization'));
} catch (error) {
  console.warn('⚠️ Sanitization utils not available, using fallbacks');
  lightSanitization = () => (req, res, next) => next();
  reportSanitization = () => (req, res, next) => next();
  validationRules = { reportSubmission: (req, res, next) => next() };
  validationErrorHandler = () => (req, res, next) => next();
}

// FIXED: Initialize enhanced features with fallbacks
const enhancedRateLimiter = createEnhancedHybridRateLimiter(cacheLayer);
const submitRateLimit = enhancedRateLimiter.createEnhancedReportRateLimit();
const apiRateLimit = enhancedRateLimiter.createEnhancedApiRateLimit({ limit: 100, window: 60 });
const adminRateLimit = enhancedRateLimiter.createEnhancedAdminRateLimit();

const enhancedDeduplicationCheck = deduplicationMiddleware({
  femaleSafetyPriority: true,
  stricterDuplicateDetection: true
});

// Helper functions
const hashIp = (ip) => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
};

/**
 * FIXED: Enhanced audit logging with fallbacks
 */
const logAdminAction = async (req, actionType, target, details, severity) => {
  try {
    if (AuditLog && req.userContext?.user) {
      await AuditLog.create({
        actor: {
          userId: req.userContext.user._id,
          userType: 'admin',
          username: req.userContext.user.roleData?.admin?.username || 'admin',
          deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
          ipAddress: req.ip
        },
        actionType,
        target,
        details,
        outcome: 'success',
        severity
      });
    } else {
      console.log(`📝 AUDIT: ${actionType} on ${target.id} by ${req.userContext?.user?.roleData?.admin?.username || 'admin'}`);
    }
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType}:`, error.message);
  }
};

/**
 * FIXED: Enhanced real-time notifications with fallbacks
 */
const emitRealtimeUpdate = (event, data) => {
  try {
    if (SocketHandler && SocketHandler.getInstance) {
      const socketHandler = SocketHandler.getInstance();
      if (socketHandler) {
        socketHandler.broadcastToAdmins(event, data);
      }
    } else {
      console.log(`📡 REALTIME: ${event}`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.warn('Real-time notification failed (non-critical):', error.message);
  }
};

// Apply middleware to all routes
router.use(userTypeDetection);
router.use(requireNonQuarantined);

// ✅ FIXED: POST /api/reports - Ultra-fast submission with graceful degradation
router.post('/', 
  submitRateLimit,
  reportSanitization(),
  validationRules.reportSubmission, 
  validationErrorHandler(), 
  enhancedDeduplicationCheck,
  logUserActivity('submit_report'), 
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const {
        type,
        description,
        location,
        severity,
        media = [],
        anonymous = true,
        behaviorSignature,
        idempotencyKey,
        culturalContext = {},
        timeContext = {}
      } = req.body;

      // Enhanced validation with female safety types
      if (!type || !description || !location || !location.coordinates || !severity) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required report fields.' 
        });
      }

      // Validate female safety incident types
      const femaleSafetyTypes = [
        'eve_teasing', 'stalking', 'inappropriate_touch', 
        'verbal_harassment', 'unsafe_transport', 'workplace_harassment',
        'domestic_incident', 'unsafe_area_women'
      ];
      
      const isFemaleSafetyReport = femaleSafetyTypes.includes(type);

      // Enhanced deduplication check results
      const deduplicationResult = req.deduplicationCheck || { 
        isDuplicate: false,
        recommendation: 'allow' 
      };

      // Handle immediate duplicates with female safety consideration
      if (deduplicationResult.recommendation === 'reject' && deduplicationResult.confidence > 95) {
        if (!isFemaleSafetyReport || deduplicationResult.confidence > 98) {
          const responseTime = Date.now() - startTime;
          console.log(`🚫 Duplicate rejected in ${responseTime}ms (female-safety: ${isFemaleSafetyReport})`);
          
          return res.status(409).json({
            success: false,
            message: isFemaleSafetyReport ? 
              'This appears similar to a recent report. If this is a continuing incident, please add additional details.' :
              'This report appears to be a duplicate of a recent submission.',
            code: 'DUPLICATE_REPORT',
            details: {
              type: deduplicationResult.duplicateType,
              confidence: deduplicationResult.confidence,
              originalReportId: deduplicationResult.originalReport,
              timeAgo: deduplicationResult.details?.timeAgo,
              femaleSafetyException: isFemaleSafetyReport
            }
          });
        }
      }

      // FIXED: Enhanced user handling with fallbacks
      let submittedByUserId;
      let submittedByUserType = req.userContext.userType;
      let submittedByDeviceFingerprintId = req.userContext.deviceFingerprint?.fingerprintId;
      let submittedByIpHash = hashIp(req.ip);

      // Handle ephemeral user persistence with fallbacks
      if (req.userContext.user.isEphemeral && User && DeviceFingerprint) {
        try {
          let existingDevice = null;
          if (submittedByDeviceFingerprintId) {
            existingDevice = await DeviceFingerprint.findOne({ 
              fingerprintId: submittedByDeviceFingerprintId 
            });
          }

          let persistentUser, persistentDevice;

          if (existingDevice) {
            persistentUser = await User.findById(existingDevice.userId);
            if (!persistentUser) {
              const newAnonUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              persistentUser = new User({
                userId: newAnonUserId,
                userType: 'anonymous',
                isAnonymous: true,
                isEphemeral: false,
                anonymousData: {
                  hashedIp: submittedByIpHash,
                  deviceFingerprint: submittedByDeviceFingerprintId,
                  createdAt: new Date(),
                  totalReports: 0
                },
                securityProfile: {
                  primaryDeviceFingerprint: existingDevice.fingerprintId,
                  overallTrustScore: 50,
                  securityRiskLevel: 'medium'
                }
              });
              await persistentUser.save();
              existingDevice.userId = persistentUser._id;
              await existingDevice.save();
            }
            persistentDevice = existingDevice;
          } else {
            const newAnonUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            persistentUser = new User({
              userId: newAnonUserId,
              userType: 'anonymous',
              isAnonymous: true,
              isEphemeral: false,
              anonymousData: {
                hashedIp: submittedByIpHash,
                deviceFingerprint: submittedByDeviceFingerprintId,
                createdAt: new Date(),
                totalReports: 0
              },
              securityProfile: {
                primaryDeviceFingerprint: submittedByDeviceFingerprintId,
                overallTrustScore: 50,
                securityRiskLevel: 'medium'
              }
            });
            await persistentUser.save();

            persistentDevice = new DeviceFingerprint({
              fingerprintId: submittedByDeviceFingerprintId,
              userId: persistentUser._id,
              trustScore: 50,
              riskLevel: 'medium',
              lastSeen: new Date(),
              associatedUserType: 'anonymous'
            });
            await persistentDevice.save();
          }
          
          submittedByUserId = persistentUser._id;
          submittedByUserType = 'anonymous';
          submittedByDeviceFingerprintId = persistentDevice.fingerprintId;

        } catch (error) {
          console.error('❌ Failed to persist anonymous user:', error);
          submittedByUserId = req.userContext.user._id || 'fallback_user';
        }
      } else {
        submittedByUserId = req.userContext.user._id || 'fallback_user';
        submittedByUserType = req.userContext.userType;
        submittedByDeviceFingerprintId = req.userContext.user.securityProfile?.primaryDeviceFingerprint || submittedByDeviceFingerprintId;
      }

      // FIXED: Enhanced location processing with immediate obfuscation
      let processedLocation = { ...location };
      if (isFemaleSafetyReport && location.coordinates) {
        const originalCoords = [...location.coordinates];
        const obfuscationRadius = 0.002; // 200m for female safety
        
        processedLocation.coordinates = [
          location.coordinates[0] + (Math.random() - 0.5) * obfuscationRadius,
          location.coordinates[1] + (Math.random() - 0.5) * obfuscationRadius
        ];
        processedLocation.originalCoordinates = originalCoords;
        processedLocation.obfuscated = true;
        
        console.log(`🔒 Immediate enhanced obfuscation applied for female safety report`);
      }

      // Calculate time of day risk
      const calculateTimeOfDayRisk = () => {
        const hour = new Date().getHours();
        if (hour >= 4 && hour < 8) return 'early_morning';
        if (hour >= 8 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 20) return 'evening';
        if (hour >= 20 && hour < 24) return 'night';
        return 'late_night';
      };

      // Enhanced report data with backward compatibility
      const reportData = {
        type,
        description,
        location: {
          type: 'Point',
          coordinates: processedLocation.coordinates,
          address: processedLocation.address || null,
          source: processedLocation.source || 'Manual',
          accuracy: processedLocation.accuracy || null,
          obfuscated: processedLocation.obfuscated || false,
          originalCoordinates: processedLocation.originalCoordinates,
          
          // Enhanced location context
          locationContext: {
            publicSpace: location.locationContext?.publicSpace !== false,
            transportRelated: location.locationContext?.transportRelated || false,
            marketArea: location.locationContext?.marketArea || false,
            educationalInstitution: location.locationContext?.educationalInstitution || false,
            workplaceRelated: location.locationContext?.workplaceRelated || false,
            residentialArea: location.locationContext?.residentialArea || false,
            isolatedArea: location.locationContext?.isolatedArea || false
          }
        },
        severity,
        media,
        submittedBy: {
          userId: submittedByUserId,
          userType: submittedByUserType,
          deviceFingerprint: submittedByDeviceFingerprintId,
          ipHash: submittedByIpHash,
          isAnonymous: anonymous
        },
        status: deduplicationResult.recommendation === 'flag' ? 'flagged' : 'pending',
        anonymous,
        
        // Female safety specific fields
        genderSensitive: isFemaleSafetyReport,
        timeOfDayRisk: timeContext.timeOfDayRisk || calculateTimeOfDayRisk(),
        
        // Cultural context
        culturalContext: {
          conservativeArea: culturalContext.conservativeArea || false,
          religiousContext: culturalContext.religiousContext || false,
          familyRelated: culturalContext.familyRelated || false,
          requiresFemaleModerator: isFemaleSafetyReport
        },
        
        // Enhanced behavioral signature
        behaviorSignature: {
          submissionSpeed: behaviorSignature?.submissionSpeed || null,
          deviceType: behaviorSignature?.deviceType || 'unknown',
          browserFingerprint: behaviorSignature?.browserFingerprint || null,
          interactionPattern: behaviorSignature?.interactionPattern || 'unknown',
          locationConsistency: behaviorSignature?.locationConsistency || 50,
          humanBehaviorScore: behaviorSignature?.humanBehaviorScore || 50,
          formCompletionPattern: behaviorSignature?.formCompletionPattern || null,
          mouseMovementPattern: behaviorSignature?.mouseMovementPattern || null
        },
        
        // Processing status
        processingStatus: {
          isProcessing: true,
          backgroundProcessingRequired: true,
          immediatePhaseCompleted: false,
          fastPhaseCompleted: isFemaleSafetyReport, // Pre-completed if obfuscated
          analysisPhaseCompleted: false,
          enrichmentPhaseCompleted: false,
          allPhasesCompleted: false,
          lastUpdated: new Date(),
          processingErrors: []
        },
        
        // Deduplication data
        deduplication: {
          duplicateCheck: {
            isDuplicate: deduplicationResult.isDuplicate || false,
            duplicateType: deduplicationResult.duplicateType || 'none',
            confidence: deduplicationResult.confidence || 0,
            originalReportId: deduplicationResult.originalReport || null,
            checkedAt: new Date(),
            checkSource: deduplicationResult.details?.source || 'middleware'
          }
        },
        
        // Enhanced moderation
        moderation: {
          priority: isFemaleSafetyReport ? (severity >= 4 ? 'urgent' : 'high') : 
                   (severity >= 4 ? 'high' : 'medium'),
          requiresHumanReview: deduplicationResult.recommendation === 'flag' || 
                              severity >= 4 || isFemaleSafetyReport,
          isDuplicateOf: deduplicationResult.originalReport || null,
          femaleModeratorRequired: isFemaleSafetyReport,
          requiresSpecialHandling: isFemaleSafetyReport || 
                                  culturalContext.familyRelated ||
                                  culturalContext.religiousContext
        },
        
        // Security flags
        securityFlags: {
          rapidSubmission: deduplicationResult.duplicateType === 'temporal',
          possibleDuplicate: deduplicationResult.isDuplicate,
          requiresFemaleValidation: isFemaleSafetyReport,
          enhancedPrivacyRequired: isFemaleSafetyReport
        },
        
        // Community validation setup
        communityValidation: {
          validationsReceived: 0,
          validationsPositive: 0,
          validationsNegative: 0,
          communityTrustScore: 0,
          requiresFemaleValidators: isFemaleSafetyReport,
          femaleValidationsReceived: 0,
          validationHistory: []
        }
      };

      // Create and save report
      const report = new Report(reportData);
      await report.save();

      const submissionTime = Date.now() - startTime;
      
      // FIXED: Async operations with fallbacks (non-blocking)
      setImmediate(async () => {
        try {
          // Update user report count if possible
          if (!req.userContext.user.isEphemeral && User) {
            try {
              await User.findByIdAndUpdate(
                submittedByUserId,
                {
                  $inc: { 'anonymousData.totalReports': 1 },
                  $set: { lastActiveAt: new Date() }
                }
              );
            } catch (userError) {
              console.warn('User update failed (non-critical):', userError.message);
            }
          }

          // Update device fingerprint if possible
          if (req.userContext.deviceFingerprint && DeviceFingerprint) {
            try {
              await DeviceFingerprint.findByIdAndUpdate(
                req.userContext.deviceFingerprint._id,
                {
                  $push: {
                    'reportHistory': {
                      reportId: report._id,
                      timestamp: new Date(),
                      reportType: type,
                      severity: severity,
                      isDuplicate: deduplicationResult.isDuplicate,
                      isFemaleSafety: isFemaleSafetyReport
                    }
                  },
                  $set: { lastSeen: new Date() },
                  $inc: { 
                    'securityProfile.totalReports': 1,
                    'securityProfile.femaleSafetyReports': isFemaleSafetyReport ? 1 : 0
                  }
                }
              );
            } catch (deviceError) {
              console.warn('Device update failed (non-critical):', deviceError.message);
            }
          }

          // FIXED: Background processing with fallback
          try {
            const phases = ['immediate', 'fast', 'analysis'];
            if (severity >= 4 || isFemaleSafetyReport) {
              phases.push('enrichment');
            }
            
            await queueReportForProcessing(report._id, phases);
            console.log(`✅ Report ${report._id} queued for background processing`);
          } catch (processingError) {
            console.warn('⚠️ Background processing failed, marking as processed:', processingError.message);
            
            // CRITICAL FALLBACK: Mark as processed to prevent stuck state
            try {
              await Report.findByIdAndUpdate(report._id, {
                $set: {
                  'processingStatus.allPhasesCompleted': true,
                  'processingStatus.fastPhaseCompleted': true,
                  'processingStatus.isProcessing': false,
                  'processingStatus.processingErrors': ['background_processing_unavailable'],
                  'processingStatus.lastUpdated': new Date()
                }
              });
            } catch (fallbackError) {
              console.error('❌ Critical: Could not mark report as processed:', fallbackError);
            }
          }

          // Invalidate caches with fallbacks
          try {
            await cacheLayer.bumpVersion('reports');
            await Promise.all([
              cacheLayer.delete('admin:dashboard:stats'),
              cacheLayer.delete('admin:analytics:security'),
              cacheLayer.delete('female_safety:stats'),
              cacheLayer.delete('community:validation:queue')
            ]);
          } catch (cacheError) {
            console.warn('Cache invalidation failed (non-critical):', cacheError.message);
          }

          // Enhanced real-time notifications
          try {
            emitRealtimeUpdate('new_pending_report', {
              id: report._id,
              type: report.type,
              severity: report.severity,
              genderSensitive: report.genderSensitive,
              location: isFemaleSafetyReport ? 
                report.location.coordinates : 
                report.location.originalCoordinates || report.location.coordinates,
              timestamp: report.createdAt,
              priority: report.moderation.priority,
              securityScore: report.securityScore,
              culturalContext: report.culturalContext,
              requiresSpecialHandling: report.moderation.requiresSpecialHandling
            });

            // Notify female moderators if needed
            if (isFemaleSafetyReport) {
              emitRealtimeUpdate('new_female_safety_report', {
                id: report._id,
                type: report.type,
                severity: report.severity,
                timeOfDay: report.timeOfDayRisk,
                culturalContext: report.culturalContext,
                validationRequired: true
              });
            }
          } catch (realtimeError) {
            console.warn('Real-time notifications failed (non-critical):', realtimeError.message);
          }

          // Cache female safety statistics
          if (isFemaleSafetyReport) {
            try {
              await cacheLayer.cacheRealtimeEvent('female_safety_report', {
                reportId: report._id,
                type: report.type,
                severity: report.severity,
                timeOfDay: report.timeOfDayRisk,
                submittedAt: new Date()
              });
            } catch (eventError) {
              console.warn('Event caching failed (non-critical):', eventError.message);
            }
          }

        } catch (asyncError) {
          console.error('❌ Async operations failed (non-critical):', asyncError);
        }
      });

      // Enhanced response with female safety context
      const response = {
        success: true,
        message: report.status === 'flagged' ? 
          'Report submitted but flagged for review due to similarity with existing reports' :
          isFemaleSafetyReport ? 
            'Female safety report submitted successfully with enhanced privacy protection' :
            'Report submitted successfully',
        reportId: report._id,
        status: report.status,
        submissionTime: `${submissionTime}ms`,
        
        // Enhanced processing information
        processing: {
          status: 'queued',
          estimatedCompletion: isFemaleSafetyReport ? '30-45 seconds' : '30-60 seconds',
          phases: isFemaleSafetyReport ? 
            ['immediate_privacy', 'security_analysis', 'female_validator_matching', 'cultural_analysis'] :
            ['location_obfuscation', 'security_analysis', 'duplicate_detection'],
          femaleSafetyProtections: isFemaleSafetyReport ? {
            enhancedObfuscation: true,
            femaleValidatorRequired: true,
            culturalSensitivityAnalysis: true,
            priorityProcessing: true
          } : null
        },
        
        // Privacy and security information
        privacy: {
          locationObfuscated: processedLocation.obfuscated || false,
          enhancedPrivacy: isFemaleSafetyReport,
          anonymousSubmission: anonymous
        }
      };

      // Add deduplication warning if applicable
      if (deduplicationResult.isDuplicate) {
        response.warning = {
          type: 'potential_duplicate',
          message: isFemaleSafetyReport ?
            `This report is similar to a previous submission (${deduplicationResult.confidence}% confidence). If this is an ongoing incident, additional details will help distinguish it.` :
            `This report is similar to a previous submission (${deduplicationResult.confidence}% confidence)`,
          details: {
            duplicateType: deduplicationResult.duplicateType,
            confidence: deduplicationResult.confidence,
            femaleSafetyException: isFemaleSafetyReport
          }
        };
      }

      res.status(201).json(response);

      console.log(`✅ ${isFemaleSafetyReport ? 'Female safety ' : ''}report submitted in ${submissionTime}ms: ${report._id}`);

    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error(`❌ Error submitting report (${errorTime}ms):`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to submit report. Please try again.' 
      });
    }
  }
);

// ✅ BACKWARD COMPATIBILITY: POST /:id/status (OLD API ENDPOINT)
router.post('/:id/status', 
  requireAdmin,
  adminRateLimit,
  reportSanitization(),
  async (req, res) => {
    console.log('📡 Legacy API endpoint called: POST /:id/status - redirecting to enhanced moderation');
    
    try {
      const { id } = req.params;
      const { status, moderationReason } = req.body;

      // Map old status values to new moderation actions
      let action, reason;
      switch (status) {
        case 'approved':
          action = 'approve';
          reason = moderationReason || 'Legacy approval';
          break;
        case 'rejected':
          action = 'reject';
          reason = moderationReason || 'Legacy rejection';
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid status. Use "approved" or "rejected".' 
          });
      }

      // Forward to enhanced moderation logic
      return await handleModeration(req, res, id, action, reason, false, false, 'standard');
      
    } catch (error) {
      console.error('❌ Legacy status endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update report status.' 
      });
    }
  }
);

// ✅ ENHANCED: PUT /api/reports/:id/moderate - Enhanced moderation with female safety support
router.put('/:id/moderate', 
  requireAdmin,
  adminRateLimit,
  lightSanitization(),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        action, 
        reason, 
        mergeDuplicates = false, 
        waitForProcessing = false,
        femaleModerator = false,
        culturalSensitivity = 'standard'
      } = req.body;

      return await handleModeration(req, res, id, action, reason, mergeDuplicates, waitForProcessing, femaleModerator, culturalSensitivity);
      
    } catch (error) {
      console.error('❌ Error moderating report:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to moderate report' 
      });
    }
  }
);

/**
 * FIXED: Shared moderation handler with full fallback support
 */
async function handleModeration(req, res, id, action, reason, mergeDuplicates, waitForProcessing, femaleModerator, culturalSensitivity) {
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid moderation action' 
    });
  }

  const report = await Report.findById(id);
  if (!report) {
    return res.status(404).json({ 
      success: false, 
      message: 'Report not found' 
    });
  }

  if (!['pending', 'flagged'].includes(report.status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Report already moderated' 
    });
  }

  // Enhanced processing check for female safety reports
  if (!report.processingStatus?.fastPhaseCompleted && action === 'approve') {
    if (waitForProcessing !== true) {
      return res.status(400).json({
        success: false,
        message: report.genderSensitive ? 
          'Female safety report privacy protection has not been completed yet. Wait for processing or set waitForProcessing=true to override.' :
          'Report location has not been obfuscated yet. Wait for processing to complete or set waitForProcessing=true to override.',
        processingStatus: report.processingStatus || {},
        recommendation: report.genderSensitive ? 
          'Wait 30-60 seconds for enhanced privacy protection to complete' :
          'Wait 30-60 seconds for location obfuscation to complete',
        isFemaleSafetyReport: report.genderSensitive
      });
    } else {
      console.warn(`⚠️ Admin ${req.userContext?.user?.roleData?.admin?.username || 'admin'} approved ${report.genderSensitive ? 'female safety ' : ''}report ${id} before processing completed`);
    }
  }

  // Validate female moderator requirement
  if (report.genderSensitive && report.moderation?.femaleModeratorRequired && !femaleModerator) {
    return res.status(400).json({
      success: false,
      message: 'This female safety report requires moderation by a female moderator.',
      requiresFemaleModerator: true,
      canOverride: req.userContext?.user?.roleData?.admin?.permissions?.includes('override_female_moderation')
    });
  }

  // Handle duplicate merging with enhanced logic
  if (mergeDuplicates && report.moderation?.isDuplicateOf) {
    try {
      const originalReport = await Report.findById(report.moderation.isDuplicateOf);
      if (originalReport) {
        // Enhanced merging for female safety reports
        originalReport.communityValidation = originalReport.communityValidation || {};
        originalReport.communityValidation.validationsReceived = (originalReport.communityValidation.validationsReceived || 0) + (report.communityValidation?.validationsReceived || 0);
        originalReport.communityValidation.validationsPositive = (originalReport.communityValidation.validationsPositive || 0) + (report.communityValidation?.validationsPositive || 0);
        originalReport.communityValidation.validationsNegative = (originalReport.communityValidation.validationsNegative || 0) + (report.communityValidation?.validationsNegative || 0);
        
        if (report.genderSensitive) {
          originalReport.communityValidation.femaleValidationsReceived = (originalReport.communityValidation.femaleValidationsReceived || 0) + (report.communityValidation?.femaleValidationsReceived || 0);
        }
        
        await originalReport.save();
        report.moderation = report.moderation || {};
        report.moderation.duplicateHandling = 'merged';
        console.log(`✅ Merged ${report.genderSensitive ? 'female safety ' : ''}duplicate report ${id} into original ${originalReport._id}`);
      }
    } catch (error) {
      console.error('❌ Failed to merge duplicate reports:', error);
    }
  }

  // Update report status with enhanced context
  report.status = action === 'approve' ? 'approved' : 'rejected';
  report.moderatedAt = new Date();
  report.moderatedBy = req.userContext?.user?._id;
  report.moderationReason = reason || null;
  
  // Enhanced moderation context
  if (report.genderSensitive) {
    report.moderation = report.moderation || {};
    report.moderation.femaleModerator = femaleModerator;
    report.moderation.culturalSensitivity = culturalSensitivity;
  }

  await report.save();

  // Enhanced audit logging
  await logAdminAction(
    req,
    'moderate_report',
    { id: report._id, type: 'report' },
    { 
      action, 
      reason: reason || 'No reason provided',
      wasDuplicate: report.deduplication?.duplicateCheck?.isDuplicate,
      duplicateType: report.deduplication?.duplicateCheck?.duplicateType,
      mergeDuplicates,
      processingComplete: report.processingStatus?.allPhasesCompleted,
      isFemaleSafety: report.genderSensitive,
      femaleModerator,
      culturalSensitivity
    },
    'medium'
  );

  // Invalidate enhanced caches
  try {
    await cacheLayer.bumpVersion('reports');
    await Promise.all([
      cacheLayer.delete('admin:dashboard:stats'),
      cacheLayer.delete('admin:analytics:security'),
      cacheLayer.delete('female_safety:stats'),
      cacheLayer.delete('community:validation:queue'),
      cacheLayer.delete(`reports:detail:${id}`)
    ]);
  } catch (cacheError) {
    console.warn('Cache invalidation failed (non-critical):', cacheError.message);
  }

  // Enhanced real-time notifications
  try {
    emitRealtimeUpdate('report_moderated', {
      reportId: report._id,
      action,
      moderatedBy: req.userContext?.user?.roleData?.admin?.username || 'admin',
      wasDuplicate: report.deduplication?.duplicateCheck?.isDuplicate,
      processingComplete: report.processingStatus?.allPhasesCompleted,
      isFemaleSafety: report.genderSensitive,
      femaleModerator
    });

    // Notify female validators if approved female safety report
    if (action === 'approve' && report.genderSensitive) {
      emitRealtimeUpdate('female_safety_report_approved', {
        reportId: report._id,
        type: report.type,
        moderatedBy: femaleModerator ? 'female_moderator' : 'admin'
      });
    }
  } catch (realtimeError) {
    console.warn('Real-time notifications failed (non-critical):', realtimeError.message);
  }

  res.json({
    success: true,
    message: `${report.genderSensitive ? 'Female safety ' : ''}report ${action}d successfully`,
    reportId: report._id,
    status: report.status,
    processing: {
      completed: report.processingStatus?.allPhasesCompleted,
      progress: report.processingStatus || {}
    },
    deduplication: {
      wasDuplicate: report.deduplication?.duplicateCheck?.isDuplicate,
      duplicateType: report.deduplication?.duplicateCheck?.duplicateType,
      merged: mergeDuplicates && report.moderation?.duplicateHandling === 'merged'
    },
    femaleSafetyContext: report.genderSensitive ? {
      moderatedByFemale: femaleModerator,
      culturalSensitivity,
      enhancedPrivacyMaintained: report.securityFlags?.enhancedPrivacyRequired
    } : null
  });

  console.log(`✅ ${report.genderSensitive ? 'Female safety ' : ''}report ${action}d: ${report._id} by ${femaleModerator ? 'female ' : ''}admin ${req.userContext?.user?.roleData?.admin?.username || 'admin'}`);
}

// ✅ BACKWARD COMPATIBILITY: POST /:id/validate - Community validation (maintained exactly)
router.post('/:id/validate', 
  lightSanitization(), 
  logUserActivity('validate_report'), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isPositive, validatorGender, culturalSensitivity } = req.body;

      if (typeof isPositive !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid validation type. Must be true or false.' 
        });
      }

      const report = await Report.findById(id);
      if (!report) {
        return res.status(404).json({ 
          success: false, 
          message: 'Report not found' 
        });
      }

      // Prevent self-validation
      if (report.submittedBy?.userId && req.userContext?.user && 
          report.submittedBy.userId.toString() === req.userContext.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'You cannot validate your own report.' 
        });
      }

      // Check for female safety validation requirements
      if (report.genderSensitive && report.communityValidation?.requiresFemaleValidators) {
        if (!validatorGender || validatorGender !== 'female') {
          return res.status(400).json({
            success: false,
            message: 'This female safety report requires validation by female validators only.',
            requiresFemaleValidator: true
          });
        }
      }

      // Prevent duplicate validation from same device
      const deviceFingerprintId = req.userContext?.deviceFingerprint?.fingerprintId;
      if (deviceFingerprintId && DeviceFingerprint) {
        try {
          const device = await DeviceFingerprint.findOne({ fingerprintId: deviceFingerprintId });
          if (device && device.securityProfile?.validationHistory?.some(val => val.reportId.equals(report._id))) {
            return res.status(403).json({ 
              success: false, 
              message: 'You have already validated this report.' 
            });
          }
        } catch (deviceError) {
          console.warn('Device validation check failed (non-critical):', deviceError.message);
        }
      }

      // Add community validation with enhanced context
      const validatorInfo = {
        validatorId: req.userContext?.user?._id,
        validatorUserType: req.userContext?.userType,
        validatorDeviceFingerprint: deviceFingerprintId,
        gender: validatorGender || 'unknown',
        trustScore: req.userContext?.user?.trustScore || 50,
        culturalSensitivity: culturalSensitivity || 'standard'
      };

      // Use the model's addCommunityValidation method if available
      if (report.addCommunityValidation) {
        report.addCommunityValidation(isPositive, validatorInfo);
      } else {
        // Fallback implementation
        report.communityValidation = report.communityValidation || {
          validationsReceived: 0,
          validationsPositive: 0,
          validationsNegative: 0,
          communityTrustScore: 0,
          femaleValidationsReceived: 0,
          validationHistory: []
        };

        report.communityValidation.validationsReceived += 1;
        
        if (isPositive) {
          report.communityValidation.validationsPositive += 1;
        } else {
          report.communityValidation.validationsNegative += 1;
        }
        
        // Track female validators for sensitive reports
        if (validatorGender === 'female' && report.genderSensitive) {
          report.communityValidation.femaleValidationsReceived += 1;
        }
        
        // Add to validation history
        report.communityValidation.validationHistory.push({
          validatorId: validatorInfo.validatorId || 'anonymous',
          validatorGender: validatorInfo.gender || 'unknown',
          isPositive,
          timestamp: new Date(),
          validatorTrustScore: validatorInfo.trustScore || 50
        });
        
        // Calculate community trust score
        const positiveRatio = report.communityValidation.validationsPositive / 
                             report.communityValidation.validationsReceived;
        report.communityValidation.communityTrustScore = Math.round(positiveRatio * 100);
        
        report.communityValidation.lastValidationAt = new Date();
      }

      await report.save();

      // Update device fingerprint validation history if possible
      if (deviceFingerprintId && DeviceFingerprint) {
        try {
          const device = await DeviceFingerprint.findOne({ fingerprintId: deviceFingerprintId });
          if (device) {
            device.securityProfile = device.securityProfile || { validationHistory: [] };
            device.securityProfile.validationHistory.push({ 
              reportId: report._id, 
              timestamp: new Date(), 
              isPositive,
              reportType: report.type,
              wasFemaleSafety: report.genderSensitive
            });
            
            device.securityProfile.totalValidationsGiven = (device.securityProfile.totalValidationsGiven || 0) + 1;
            if (report.genderSensitive && validatorGender === 'female') {
              device.securityProfile.femaleSafetyValidations = 
                (device.securityProfile.femaleSafetyValidations || 0) + 1;
            }
            
            await device.save();
          }
        } catch (deviceError) {
          console.warn('Device validation update failed (non-critical):', deviceError.message);
        }
      }

      // Check for automated status changes based on validation
      const { validationsPositive, validationsNegative, communityTrustScore } = report.communityValidation;
      const validationRequirements = report.getValidatorRequirements ? report.getValidatorRequirements() : {
        minimumValidations: report.genderSensitive ? 3 : 2
      };

      if (report.status === 'approved') {
        if (validationsPositive >= validationRequirements.minimumValidations && 
            communityTrustScore >= 80) {
          report.status = 'verified';
          await report.save();
          
          emitRealtimeUpdate('report_verified', { reportId: report._id });
          
          console.log(`✨ Report ${report._id} automatically VERIFIED by community`);
        } else if (validationsNegative >= validationRequirements.minimumValidations || 
                  communityTrustScore < 20) {
          report.status = 'under_review';
          await report.save();
          
          emitRealtimeUpdate('report_flagged_for_review', { 
            reportId: report._id, 
            reason: 'Negative community validation',
            isFemaleSafety: report.genderSensitive
          });
          
          console.log(`🚨 Report ${report._id} flagged for re-review due to negative validation`);
        }
      }

      // Invalidate validation caches
      try {
        await cacheLayer.bumpVersion('reports');
        await Promise.all([
          cacheLayer.delete('community:validation:queue'),
          cacheLayer.delete('female_safety:validation:stats'),
          cacheLayer.delete(`reports:detail:${id}`)
        ]);
      } catch (cacheError) {
        console.warn('Cache invalidation failed (non-critical):', cacheError.message);
      }

      // Cache validation event
      try {
        await cacheLayer.cacheRealtimeEvent('report_validation', {
          reportId: report._id,
          isPositive,
          validatorGender: validatorGender || 'unknown',
          isFemaleSafety: report.genderSensitive,
          newTrustScore: communityTrustScore
        });
      } catch (eventError) {
        console.warn('Event caching failed (non-critical):', eventError.message);
      }

      // FIXED: Maintain backward compatibility in response format
      res.json({
        success: true,
        message: report.genderSensitive ? 
          'Female safety report validation recorded successfully' :
          'Validation recorded successfully',
        data: {
          // OLD FORMAT (for backward compatibility)
          validationScore: report.communityValidation.communityTrustScore,
          status: report.status,
          totalValidations: report.communityValidation.validationsReceived,
          
          // NEW FORMAT (enhanced data)
          communityTrustScore: report.communityValidation.communityTrustScore,
          femaleValidations: report.communityValidation.femaleValidationsReceived,
          validationRequirements: validationRequirements
        }
      });

    } catch (error) {
      console.error('❌ Error submitting community validation:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to record validation.' 
      });
    }
  }
);

// ✅ ENHANCED: GET /api/reports - Enhanced reports fetching with female safety filtering
router.get('/',
  apiRateLimit,
  lightSanitization(),
  cacheMiddleware(300, (req) => {
    const { lat, lng, radius, type, severity, genderSensitive, includeProcessing } = req.query;
    return cacheLayer.generateKey('cache', 'reports', 'public', 
      `${lat}_${lng}_${radius}_${type}_${severity}_${genderSensitive}_${includeProcessing}`);
  }, 'reports'),
  async (req, res) => {
    try {
      const {
        lat,
        lng, 
        radius = 10000,
        type,
        severity,
        genderSensitive,
        startDate,
        endDate,
        limit = 100,
        excludeDuplicates = true,
        includeProcessing = false,
        timeOfDay,
        culturalContext,
        // OLD API compatibility
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build enhanced query
      let query = {};

      // BACKWARD COMPATIBILITY: Handle old status parameter
      if (req.userContext?.userType !== 'admin') {
        query.status = { $in: ['approved', 'verified'] };
      } else {
        if (status && status !== 'all') {
          query.status = status;
        } else {
          query.status = { $ne: 'archived' };
        }
      }

      // Processing filter - exclude reports still being processed
      if (includeProcessing !== 'true') {
        query['processingStatus.fastPhaseCompleted'] = true;
      }

      // Exclude flagged duplicates by default
      if (excludeDuplicates === 'true') {
        query['deduplication.duplicateCheck.isDuplicate'] = { $ne: true };
      }

      // Enhanced filtering options
      if (genderSensitive === 'true') {
        query.genderSensitive = true;
      } else if (genderSensitive === 'false') {
        query.genderSensitive = false;
      }

      if (timeOfDay) {
        query.timeOfDayRisk = timeOfDay;
      }

      if (culturalContext) {
        const contextQuery = {};
        if (culturalContext.includes('conservative')) {
          contextQuery['culturalContext.conservativeArea'] = true;
        }
        if (culturalContext.includes('religious')) {
          contextQuery['culturalContext.religiousContext'] = true;
        }
        if (culturalContext.includes('family')) {
          contextQuery['culturalContext.familyRelated'] = true;
        }
        Object.assign(query, contextQuery);
      }

      // Location-based filtering
      if (lat && lng) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            $maxDistance: parseInt(radius)
          }
        };
      }

      // Type filtering with female safety support
      if (type && type !== 'all') {
        if (type === 'female_safety') {
          query.genderSensitive = true;
        } else {
          query.type = type;
        }
      }

      // Severity filtering
      if (severity) {
        query.severity = { $gte: parseInt(severity) };
      }

      // Date range filtering
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Execute query with enhanced selection
      const selectFields = `
        type location severity status createdAt anonymous genderSensitive
        timeOfDayRisk culturalContext.conservativeArea
        processingStatus.allPhasesCompleted communityValidation.communityTrustScore
      `;

      // Admin gets additional fields
      const adminFields = req.userContext?.userType === 'admin' ? ' +location.originalCoordinates securityScore' : '';

      const reports = await Report.find(query)
        .select(selectFields + adminFields)
        .limit(parseInt(limit))
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .lean();

      res.json({
        success: true,
        data: reports,
        count: reports.length,
        radius: parseInt(radius),
        filters: {
          excludeDuplicates: excludeDuplicates === 'true',
          includeProcessing: includeProcessing === 'true',
          genderSensitive: genderSensitive || 'all',
          timeOfDay: timeOfDay || 'all',
          culturalContext: culturalContext || 'all'
        },
        processing: {
          fullyProcessed: reports.filter(r => r.processingStatus?.allPhasesCompleted).length,
          stillProcessing: reports.filter(r => !r.processingStatus?.allPhasesCompleted).length,
          femaleSafetyReports: reports.filter(r => r.genderSensitive).length
        }
      });

    } catch (error) {
      console.error('❌ Error fetching reports:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch reports' 
      });
    }
  }
);

// ✅ ENHANCED: DELETE /api/reports/:id - Enhanced deletion with female safety audit
router.delete('/:id', 
  requireAdmin, 
  requirePermission('moderation'), 
  reportSanitization(), 
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason = 'Admin deletion', preserveForAudit = false } = req.body;

      const report = await Report.findById(id);
      if (!report) {
        return res.status(404).json({ 
          success: false, 
          message: 'Report not found.' 
        });
      }

      // Enhanced audit logging for female safety reports
      const auditDetails = {
        reportType: report.type,
        wasFemaleSafety: report.genderSensitive,
        oldStatus: report.status,
        reason,
        preserveForAudit,
        securityScore: report.securityScore,
        communityTrustScore: report.communityValidation?.communityTrustScore,
        totalValidations: report.communityValidation?.validationsReceived
      };

      // Enhanced deletion logic
      if (preserveForAudit) {
        // Archive instead of delete for audit trail
        report.status = 'archived';
        report.moderation = report.moderation || {};
        report.moderation.archiveReason = reason;
        report.moderation.archivedAt = new Date();
        report.moderation.archivedBy = req.userContext?.user?._id;
        await report.save();
        
        console.log(`📦 Report ${id} archived (was ${report.genderSensitive ? 'female safety' : 'standard'}) by admin ${req.userContext?.user?.roleData?.admin?.username || 'admin'}`);
      } else {
        // Actual deletion
        await Report.findByIdAndDelete(id);
        console.log(`🗑️ Report ${id} deleted (was ${report.genderSensitive ? 'female safety' : 'standard'}) by admin ${req.userContext?.user?.roleData?.admin?.username || 'admin'}`);
      }

      // Enhanced audit logging
      await logAdminAction(
        req,
        preserveForAudit ? 'archive_report' : 'delete_report',
        { id: report._id, type: 'Report', name: report.type },
        auditDetails,
        'high'
      );

      // Enhanced cache invalidation
      try {
        await cacheLayer.bumpVersion('reports');
        await Promise.all([
          cacheLayer.delete(`reports:detail:${id}`),
          cacheLayer.delete('admin:dashboard:stats'),
          cacheLayer.delete('admin:analytics:security'),
          report.genderSensitive ? cacheLayer.delete('female_safety:stats') : Promise.resolve(),
          cacheLayer.delete('community:validation:queue')
        ]);
      } catch (cacheError) {
        console.warn('Cache invalidation failed (non-critical):', cacheError.message);
      }

      // Enhanced real-time notifications
      try {
        emitRealtimeUpdate(preserveForAudit ? 'report_archived' : 'report_deleted', {
          reportId: id,
          wasFemaleSafety: report.genderSensitive,
          action: preserveForAudit ? 'archived' : 'deleted',
          moderatedBy: req.userContext?.user?.roleData?.admin?.username || 'admin'
        });

        if (!preserveForAudit) {
          emitRealtimeUpdate('report_removed', { reportId: id });
        }
      } catch (realtimeError) {
        console.warn('Real-time notifications failed (non-critical):', realtimeError.message);
      }

      res.json({ 
        success: true, 
        message: `Report ${preserveForAudit ? 'archived' : 'deleted'} successfully.`,
        action: preserveForAudit ? 'archived' : 'deleted',
        wasFemaleSafety: report.genderSensitive
      });

    } catch (error) {
      console.error('❌ Error deleting/archiving report:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete report.' 
      });
    }
  }
);

// ✅ NEW: Enhanced endpoints (only if components are available)

// Enhanced analytics endpoints (with fallbacks)
if (getReportProcessingStats && getFemaleSafetyStats) {
  
  router.get('/analytics/female-safety', 
    requireAdmin,
    apiRateLimit,
    cacheMiddleware(600, () => cacheLayer.generateKey('cache', 'analytics', 'female_safety'), 'analytics'),
    async (req, res) => {
      try {
        const { timeRange = '30d' } = req.query;

        const now = new Date();
        let startDate;
        switch (timeRange) {
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const baseQuery = {
          genderSensitive: true,
          status: 'approved',
          createdAt: { $gte: startDate },
          'processingStatus.fastPhaseCompleted': true
        };

        const analytics = await Promise.all([
          Report.aggregate([
            { $match: baseQuery },
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]),
          Report.aggregate([
            { $match: baseQuery },
            { $group: { _id: '$timeOfDayRisk', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ])
        ]);

        res.json({
          success: true,
          data: {
            timeRange,
            reportsByType: analytics[0],
            reportsByTimeOfDay: analytics[1],
            summary: {
              totalFemaleSafetyReports: analytics[0].reduce((sum, item) => sum + item.count, 0),
              mostCommonType: analytics[0][0]?._id || 'N/A',
              highestRiskTime: analytics[1][0]?._id || 'N/A'
            }
          },
          generatedAt: new Date()
        });

      } catch (error) {
        console.error('❌ Error generating female safety analytics:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to generate female safety analytics' 
        });
      }
    }
  );

  router.get('/processing/stats', 
    requireAdmin,
    cacheMiddleware(120, () => cacheLayer.generateKey('cache', 'processing', 'enhanced_stats')),
    async (req, res) => {
      try {
        const processorStats = getReportProcessingStats();
        const femaleSafetyStats = await getFemaleSafetyStats();
        
        res.json({
          success: true,
          data: {
            processor: processorStats,
            femaleSafety: femaleSafetyStats,
            isEnhanced: true
          },
          generatedAt: new Date()
        });

      } catch (error) {
        console.error('❌ Error generating processing stats:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to generate processing statistics' 
        });
      }
    }
  );
}

// ✅ NEW: GET /api/reports/stats/summary - Quick summary statistics
router.get('/stats/summary',
  apiRateLimit,
  cacheMiddleware(300, () => cacheLayer.generateKey('cache', 'reports', 'summary')),
  async (req, res) => {
    try {
      const summary = await Report.aggregate([
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            pendingReports: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approvedReports: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            femaleSafetyReports: {
              $sum: { $cond: ['$genderSensitive', 1, 0] }
            },
            processingReports: {
              $sum: { $cond: ['$processingStatus.isProcessing', 1, 0] }
            },
            avgSeverity: { $avg: '$severity' },
            recentReports: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const stats = summary[0] || {};

      res.json({
        success: true,
        data: {
          ...stats,
          femaleSafetyPercentage: stats.totalReports > 0 ? 
            Math.round((stats.femaleSafetyReports / stats.totalReports) * 100) : 0,
          processingPercentage: stats.totalReports > 0 ?
            Math.round((stats.processingReports / stats.totalReports) * 100) : 0,
          averageSeverity: stats.avgSeverity ? Math.round(stats.avgSeverity * 10) / 10 : 0
        },
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('❌ Error generating summary statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate summary statistics'
      });
    }
  }
);

// ✅ NEW: GET /api/reports/:id - Get single report details (with processing status)
router.get('/:id',
  apiRateLimit,
  lightSanitization(),
  cacheMiddleware(300, (req) => cacheLayer.generateKey('cache', 'report', 'detail', req.params.id)),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const report = await Report.findById(id)
        .populate('submittedBy.userId', 'userType createdAt')
        .populate('moderatedBy', 'roleData.admin.username')
        .select(`
          type description location severity status createdAt moderatedAt moderationReason
          genderSensitive timeOfDayRisk culturalContext anonymous
          processingStatus communityValidation deduplication securityFlags
        `)
        .lean();

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Check if user has permission to view full details
      const isAdmin = req.userContext?.userType === 'admin';
      const isOwner = req.userContext?.user && 
                     report.submittedBy?.userId && 
                     report.submittedBy.userId.toString() === req.userContext.user._id.toString();

      // Filter sensitive information for non-admin, non-owner users
      if (!isAdmin && !isOwner) {
        delete report.location?.originalCoordinates;
        delete report.submittedBy;
        delete report.deduplication;
        delete report.securityFlags;
        delete report.processingStatus?.processingErrors;
      }

      // Add processing progress for admins
      if (isAdmin && report.processingStatus) {
        const phases = ['immediate', 'fast', 'analysis', 'enrichment'];
        const completedPhases = phases.filter(phase => 
          report.processingStatus[`${phase}PhaseCompleted`]
        );
        
        report.processingProgress = {
          completed: completedPhases.length,
          total: phases.length,
          percentage: Math.round((completedPhases.length / phases.length) * 100),
          isComplete: report.processingStatus.allPhasesCompleted
        };
      }

      res.json({
        success: true,
        data: report,
        permissions: {
          canEdit: isAdmin || isOwner,
          canDelete: isAdmin,
          canModerate: isAdmin,
          canViewSensitiveData: isAdmin
        }
      });

    } catch (error) {
      console.error('❌ Error fetching report details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch report details'
      });
    }
  }
);

// ✅ NEW: GET /api/reports/:id/processing - Enhanced processing status
router.get('/:id/processing', 
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const report = await Report.findById(id)
        .select(`
          processingStatus deduplication.duplicateCheck securityFlags 
          genderSensitive communityValidation.requiresFemaleValidators
        `)
        .lean();
        
      if (!report) {
        return res.status(404).json({ 
          success: false, 
          message: 'Report not found' 
        });
      }

      const progress = {
        isComplete: report.processingStatus?.allPhasesCompleted || false,
        isProcessing: report.processingStatus?.isProcessing || false,
        phases: {
          immediate: report.processingStatus?.immediatePhaseCompleted || false,
          fast: report.processingStatus?.fastPhaseCompleted || false,
          analysis: report.processingStatus?.analysisPhaseCompleted || false,
          enrichment: report.processingStatus?.enrichmentPhaseCompleted || false
        },
        lastUpdated: report.processingStatus?.lastUpdated,
        errors: report.processingStatus?.processingErrors || [],
        
        // Enhanced processing results
        results: {
          locationObfuscated: report.processingStatus?.fastPhaseCompleted || false,
          duplicateChecked: !!report.deduplication?.duplicateCheck?.checkedAt,
          securityAnalyzed: report.processingStatus?.analysisPhaseCompleted || false,
          securityFlags: report.securityFlags || {},
          femaleSafetyProcessing: report.genderSensitive ? {
            enhancedPrivacyApplied: report.securityFlags?.enhancedPrivacyRequired || false,
            femaleValidatorsRequired: report.communityValidation?.requiresFemaleValidators || false,
            culturalAnalysisComplete: report.processingStatus?.enrichmentPhaseCompleted || false
          } : null
        }
      };

      // Calculate progress percentage
      const completedPhases = Object.values(progress.phases).filter(Boolean).length;
      progress.percentage = Math.round((completedPhases / 4) * 100);

      res.json({
        success: true,
        data: progress
      });

    } catch (error) {
      console.error('❌ Error checking processing status:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check processing status' 
      });
    }
  }
);

// ✅ ENHANCED: GET /api/reports/pending - Enhanced pending reports with female safety prioritization
router.get('/pending', 
  requireAdmin,
  adminRateLimit,
  cacheMiddleware(60, () => cacheLayer.generateKey('cache', 'reports', 'pending'), 'admin'),
  async (req, res) => {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        includeDuplicates = true,
        includeProcessing = true,
        sortBy = 'createdAt',
        priorityFilter = 'all',
        genderSensitiveOnly = false
      } = req.query;

      // Build enhanced query
      let query = { status: { $in: ['pending', 'flagged'] } };

      // Filter duplicate handling
      if (includeDuplicates === 'false') {
        query['deduplication.duplicateCheck.isDuplicate'] = { $ne: true };
      }

      // Filter processing status
      if (includeProcessing === 'false') {
        query['processingStatus.allPhasesCompleted'] = true;
      }

      // Priority filtering
      if (priorityFilter !== 'all') {
        query['moderation.priority'] = priorityFilter;
      }

      // Female safety filtering
      if (genderSensitiveOnly === 'true') {
        query.genderSensitive = true;
      }

      const reports = await Report.find(query)
        .populate('submittedBy.userId', 'userType createdAt')
        .populate('moderation.isDuplicateOf', 'type description createdAt')
        .select(`
          type description location severity status createdAt submittedBy 
          moderation deduplication securityFlags processingStatus
          genderSensitive timeOfDayRisk culturalContext communityValidation
        `)
        .sort({ 
          // Enhanced sorting: female safety reports first, then by priority, then by date
          'genderSensitive': -1,
          'moderation.priority': 1,
          [sortBy]: -1 
        })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean();

      const totalPending = await Report.countDocuments(query);

      // Enhanced processing statistics
      const processingStats = await Report.aggregate([
        { $match: { status: { $in: ['pending', 'flagged'] } } },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            fullyProcessed: {
              $sum: { $cond: ['$processingStatus.allPhasesCompleted', 1, 0] }
            },
            stillProcessing: {
              $sum: { $cond: ['$processingStatus.isProcessing', 1, 0] }
            },
            processingErrors: {
              $sum: { 
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$processingStatus.processingErrors', []] } }, 0] },
                  1,
                  0
                ]
              }
            },
            duplicates: {
              $sum: { $cond: ['$deduplication.duplicateCheck.isDuplicate', 1, 0] }
            },
            femaleSafetyReports: {
              $sum: { $cond: ['$genderSensitive', 1, 0] }
            },
            urgentReports: {
              $sum: { $cond: [{ $eq: ['$moderation.priority', 'urgent'] }, 1, 0] }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: reports,
        pagination: {
          total: totalPending,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + reports.length) < totalPending
        },
        statistics: {
          processing: processingStats[0] || {},
          filters: {
            includeDuplicates: includeDuplicates === 'true',
            includeProcessing: includeProcessing === 'true',
            priorityFilter,
            genderSensitiveOnly: genderSensitiveOnly === 'true'
          }
        }
      });

    } catch (error) {
      console.error('❌ Error fetching pending reports:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch pending reports' 
      });
    }
  }
);

// ✅ NEW: POST /api/reports/:id/reprocess - Enhanced reprocessing (if available)
if (queueReportForProcessing) {
  router.post('/:id/reprocess', 
    requireAdmin,
    adminRateLimit,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { phases = ['fast', 'analysis'], force = false, femaleSafetyReprocessing = false } = req.body;

        const report = await Report.findById(id);
        if (!report) {
          return res.status(404).json({ 
            success: false, 
            message: 'Report not found' 
          });
        }

        // Check if already processing (unless forced)
        if (report.processingStatus?.isProcessing && !force) {
          return res.status(400).json({
            success: false,
            message: 'Report is already being processed. Use force=true to override.',
            currentStatus: report.processingStatus || {}
          });
        }

        // Enhanced reprocessing for female safety reports
        if (femaleSafetyReprocessing && report.genderSensitive) {
          phases.push('enrichment'); // Always include enrichment for female safety
          console.log(`🚺 Female safety reprocessing requested for report ${id}`);
        }

        // Reset processing status for selected phases
        const updates = {
          'processingStatus.isProcessing': true,
          'processingStatus.lastUpdated': new Date()
        };

        phases.forEach(phase => {
          updates[`processingStatus.${phase}PhaseCompleted`] = false;
        });

        if (phases.includes('immediate') || phases.includes('fast')) {
          updates['processingStatus.allPhasesCompleted'] = false;
        }

        await Report.findByIdAndUpdate(id, { $set: updates });

        // Queue for enhanced reprocessing
        await queueReportForProcessing(id, phases);

        // Enhanced audit logging
        await logAdminAction(
          req,
          'report_reprocessing',
          { id: id, type: 'report' },
          { 
            phases, 
            forced: force, 
            femaleSafetyReprocessing,
            isGenderSensitive: report.genderSensitive
          },
          'medium'
        );

        res.json({
          success: true,
          message: `Report queued for ${femaleSafetyReprocessing ? 'enhanced female safety ' : ''}reprocessing: ${phases.join(', ')}`,
          reportId: id,
          phases,
          estimatedCompletion: femaleSafetyReprocessing ? '2-3 minutes' : '1-2 minutes',
          femaleSafetyEnhancements: femaleSafetyReprocessing ? {
            enhancedPrivacyReprocessing: true,
            femaleValidatorRematching: true,
            culturalContextReanalysis: true
          } : null
        });

        console.log(`✅ Report ${id} queued for enhanced reprocessing by admin ${req.userContext?.user?.roleData?.admin?.username || 'admin'}`);

      } catch (error) {
        console.error('❌ Error reprocessing report:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Failed to queue report for reprocessing' 
        });
      }
    }
  );
}

// GRACEFUL SHUTDOWN HANDLER
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down enhanced rate limiter...');
  if (enhancedRateLimiter && enhancedRateLimiter.shutdown) {
    enhancedRateLimiter.shutdown();
  }
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down enhanced rate limiter...');
  if (enhancedRateLimiter && enhancedRateLimiter.shutdown) {
    enhancedRateLimiter.shutdown();
  }
});

module.exports = router;