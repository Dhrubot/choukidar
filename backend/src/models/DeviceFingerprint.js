// === backend/src/models/DeviceFingerprint.js ===
// Advanced Anonymous Device Tracking & Security System - PRODUCTION READY
// Fully integrated with CacheLayer, ProductionLogger, and Background Processor

const mongoose = require('mongoose');
const crypto = require('crypto');
const { productionLogger } = require('../utils/productionLogger');
const { cacheLayer } = require('../middleware/cacheLayer');

const deviceFingerprintSchema = new mongoose.Schema({
  // Core Device Identity (Anonymous but Trackable)
  fingerprintId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 64
  },

  // Link to the associated User document (can be anonymous, admin, police, researcher)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Not required if device is ephemeral or not yet linked to persistent user
    index: true
  },

  // Device Characteristics for Security Analysis
  deviceSignature: {
    canvasFingerprint: String,        // Canvas rendering signature
    screenResolution: String,         // Screen dimensions and color depth
    timezone: String,                 // Browser timezone
    language: String,                 // Browser language
    languages: [String],              // All supported languages - FIXED: Added missing field
    platform: String,                // Operating system
    userAgent: String,                // Full user agent (stored for consistency checking)
    userAgentHash: String,            // Hashed user agent string
    webglFingerprint: String,         // WebGL rendering signature
    audioFingerprint: String,         // Audio context fingerprint
    fontsAvailable: [String],         // Available system fonts
    pluginsInstalled: [String],       // Browser plugins
    hardwareConcurrency: Number,      // CPU core count
    deviceMemory: Number,             // Device memory in GB
    colorDepth: Number,               // Screen color depth
    pixelRatio: Number                // Device pixel ratio
  },

  // MISSING FUNCTIONALITY 2: Store previous signature for consistency checking
  previousSignature: {
    userAgent: String,
    screenResolution: String,
    timezone: String,
    platform: String,
    timestamp: { type: Date, default: Date.now }
  },

  // Behavioral Analysis for Human vs Bot Detection
  behaviorProfile: {
    averageTypingSpeed: { type: Number, default: 0 },     // WPM
    mouseMovementPattern: String,                          // Movement signature
    formCompletionTime: { type: Number, default: 0 },     // Seconds to fill forms
    keyboardInteractionPattern: String,                   // Typing rhythm
    scrollBehavior: String,                               // Scroll patterns
    touchPattern: String,                                 // Touch interaction (mobile)
    navigationPattern: String,                            // Page navigation behavior
    sessionLength: { type: Number, default: 0 },          // Average session duration
    sessionDuration: { type: Number, default: 300 },      // Current session duration in seconds
    reportingFrequency: { type: Number, default: 0 },     // Reports per hour
    humanBehaviorScore: { type: Number, default: 50, min: 0, max: 100 }, // Confidence human user
    anomalousPatterns: [String],                          // Detected anomalous behaviors
    model: {                                              // Behavioral model data
      type: { type: String, default: 'unknown' },
      confidence: { type: Number, default: 0 }
    }
  },

  // Geographic and Network Analysis
  networkProfile: {
    estimatedCountry: { type: String, default: 'BD' },    // Estimated country
    networkProvider: String,                              // ISP or network provider
    connectionType: String,                               // WiFi, mobile, etc.
    browserVersion: String,                               // Browser version info
    operatingSystem: String,                              // OS details
    deviceType: { type: String, enum: ['mobile', 'desktop', 'tablet', 'unknown'], default: 'unknown' },
    vpnSuspected: { type: Boolean, default: false },      // VPN detection
    proxyDetected: { type: Boolean, default: false },     // Proxy detection
    torDetected: { type: Boolean, default: false },       // Tor browser detection
    ipHash: String,                                       // MISSING FUNCTIONALITY 1: Hashed IP for tracking
    suspiciousHeaders: [String],                          // Suspicious HTTP headers
    lastKnownIP: String                                   // Last known IP (hashed)
  },

  // Security Reputation System
  securityProfile: {
    trustScore: { type: Number, default: 50, min: 0, max: 100 },  // Overall trust level
    riskLevel: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },

    // Abuse History Tracking
    totalReportsSubmitted: { type: Number, default: 0 },
    approvedReports: { type: Number, default: 0 },
    rejectedReports: { type: Number, default: 0 },
    spamReports: { type: Number, default: 0 },
    flaggedReports: { type: Number, default: 0 },         // Reports flagged by moderators

    // Validation History
    totalValidationsGiven: { type: Number, default: 0 },
    accurateValidations: { type: Number, default: 0 },
    inaccurateValidations: { type: Number, default: 0 },
    validationAccuracyRate: { type: Number, default: 0, min: 0, max: 100 },

    // MISSING FUNCTIONALITY 3: Enhanced validation history with cleanup
    validationHistory: [{
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
      timestamp: { type: Date, default: Date.now },
      isPositive: Boolean, // Store if it was a positive or negative validation
      accuracy: Number     // How accurate this validation was (0-100)
    }],

    // Security Events and Flags
    securityViolations: [String],                         // Types of violations
    lastSecurityEvent: Date,                              // Last security incident
    quarantineStatus: { type: Boolean, default: false }, // Temporarily blocked
    quarantineUntil: Date,                                // Quarantine expiration
    quarantineReason: String,                             // Reason for quarantine
    permanentlyBanned: { type: Boolean, default: false }, // Permanent ban status
    spamSuspected: { type: Boolean, default: false },     // Spam detection flag
    spoofingSuspected: { type: Boolean, default: false }, // Spoofing detection flag
    coordinatedAttackSuspected: { type: Boolean, default: false }, // Coordinated attack flag
    threatLevel: String                                   // Current threat assessment
  },

  // Quarantine Management
  quarantineHistory: [{
    reason: String,
    triggeredBy: { type: String, enum: ["auto", "moderator", "threshold_violation", "system"], default: "auto" },
    timestamp: { type: Date, default: Date.now },
    reviewedBy: String,                                   // Who reviewed the quarantine
    reviewTimestamp: Date,                                // When it was reviewed
    autoReleaseScheduled: { type: Boolean, default: false } // MISSING FUNCTIONALITY 4: Auto-release tracking
  }],

  // Device Anomaly Detection
  deviceAnomalyScore: { type: Number, default: 0, min: 0, max: 100 },
  previousAnomalyScore: { type: Number, default: 0 },    // For temporal smoothing
  needsDetailedAnalysis: { type: Boolean, default: false }, // Background processing flag

  // Report Submission Pattern Analysis
  submissionPattern: {
    hourlyDistribution: { type: [Number], default: Array(24).fill(0) }, // Array of 24 ints: # of reports per hour
    peakHours: { type: [Number], default: [] },         // Most active hours (e.g., [9, 14, 22])
    dailyPattern: { type: [Number], default: Array(7).fill(0) }, // Weekly pattern
    suspiciousTimePatterns: { type: Boolean, default: false }
  },

  // Advanced Security Features
  shadowBanned: { type: Boolean, default: false },        // Silent activity suppression
  gpsSpoofingSuspected: { type: Boolean, default: false }, // GPS spoofing detection
  locationDriftScore: { type: Number, default: 0, min: 0, max: 100 },
  moderatorAlerts: { type: [String], default: [] },       // Alert flags for dashboard

  // Threat Intelligence Integration
  threatIntelligence: {
    suspiciousPatterns: [String],                         // Detected threat patterns
    coordinatedAttackParticipant: { type: Boolean, default: false },
    massReportingCampaign: { type: Boolean, default: false },
    crossBorderThreat: { type: Boolean, default: false },
    politicalManipulation: { type: Boolean, default: false },
    botnetMember: { type: Boolean, default: false },

    // Attack Pattern Analysis
    reportingFrequency: String,                           // Time pattern analysis
    locationTargeting: [String],                          // Targeted areas
    contentSimilarity: Number,                            // Content repetition score
    temporalCorrelation: Number,                          // Time-based correlation
    matches: [{                                           // Threat intelligence matches
      source: String,
      confidence: Number,
      type: String,
      timestamp: { type: Date, default: Date.now }
    }],

    // Threat Scoring
    threatConfidence: { type: Number, default: 0, min: 0, max: 100 },
    lastThreatAssessment: { type: Date, default: Date.now },
    threatSources: [String],                              // Sources of threat intelligence
    mitigationActions: [String]                           // Applied countermeasures
  },

  // Activity Tracking and Analytics
  activityHistory: {
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    totalSessions: { type: Number, default: 1 },
    totalPageViews: { type: Number, default: 0 },
    averageSessionDuration: { type: Number, default: 0 }, // Minutes

    // Feature Usage Tracking
    mapUsage: { type: Number, default: 0 },               // Map interactions
    reportingUsage: { type: Number, default: 0 },         // Report submissions
    validationUsage: { type: Number, default: 0 },        // Validation participation

    // Engagement Quality Metrics
    bounceRate: { type: Number, default: 0 },             // Single page visits
    engagementScore: { type: Number, default: 0, min: 0, max: 100 },
    communityParticipation: { type: Number, default: 0 }  // Community engagement level
  },

  // Bangladesh-Specific Security Analysis
  bangladeshProfile: {
    likelyFromBangladesh: { type: Boolean, default: true },
    estimatedDivision: String,                            // Estimated division
    estimatedDistrict: String,                            // Estimated district
    localLanguageUsage: { type: Boolean, default: false },
    culturalContextMatch: { type: Number, default: 50 }, // Cultural context score

    // Anti-Sabotage Security Measures
    crossBorderSuspicion: { type: Number, default: 0, min: 0, max: 100 },
    indianIPDetection: { type: Boolean, default: false },
    antiBangladeshContent: { type: Number, default: 0 }, // Anti-Bangladesh sentiment score
    politicalManipulationScore: { type: Number, default: 0 }
  },

  // Geographic Location Analysis
  locationProfile: {
    crossBorderActivity: { type: Boolean, default: false },
    locationJumps: { type: Number, default: 0 },
    gpsAccuracy: { type: Number, default: 100 }, // GPS accuracy in meters
    lastKnownLocation: {
      coordinates: [Number], // [lng, lat]
      address: String,
      timestamp: Date,
      accuracy: Number
    },
    locationHistory: [{
      coordinates: [Number],
      timestamp: { type: Date, default: Date.now },
      accuracy: Number,
      source: String // 'gps', 'ip', 'manual'
    }],
    suspiciousLocationPatterns: { type: Boolean, default: false },
    geoAnalysis: {                                        // Enhanced geographic analysis
      region: String,
      confidence: Number,
      riskFactors: [String]
    }
  },

  // Comprehensive Analytics Profile
  analytics: {
    totalReports: { type: Number, default: 0 },
    approvedReports: { type: Number, default: 0 },
    rejectedReports: { type: Number, default: 0 },
    averageSessionTime: { type: Number, default: 0 }, // in seconds
    totalSessionTime: { type: Number, default: 0 },
    loginFrequency: { type: Number, default: 0 },
    deviceConsistencyScore: { type: Number, default: 75 }, // Device consistency tracking
    
    // Reporting Pattern Analysis
    reportingPatterns: {
      dailyAverage: { type: Number, default: 0 },
      weeklyAverage: { type: Number, default: 0 },
      monthlyAverage: { type: Number, default: 0 },
      peakReportingHours: [Number],
      suspiciousPatterns: [String]
    },
    
    // User Engagement Metrics
    engagementMetrics: {
      pageViews: { type: Number, default: 0 },
      timeOnSite: { type: Number, default: 0 },
      bounceRate: { type: Number, default: 0 },
      interactionRate: { type: Number, default: 0 }
    }
  },

  // MISSING FUNCTIONALITY 5: Cross-device correlation data
  crossDeviceCorrelation: {
    relatedDevices: [String],                             // Other device fingerprints from same user
    sharedCharacteristics: [String],                      // Common characteristics across devices
    correlationConfidence: { type: Number, default: 0 }, // Confidence in device correlation
    lastCorrelationUpdate: { type: Date, default: Date.now }
  },

  // Background Processing Status
  processingStatus: {
    lastDetailedAnalysis: Date,                           // When detailed analysis was last run
    nextScheduledAnalysis: Date,                          // Next scheduled background analysis
    analysisInProgress: { type: Boolean, default: false }, // Currently being processed
    analysisQueue: {                                      // Queue position and priority
      position: Number,
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
    }
  },

  // Cache Management
  cacheKeys: [String],                                    // Active cache keys for this device
  lastCacheInvalidation: Date                             // Last cache invalidation timestamp

}, {
  timestamps: true,
  // Enable virtual population for related data
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========================================
// CACHE INTEGRATION METHODS
// ========================================

/**
 * Get device from cache or database
 */
deviceFingerprintSchema.statics.findByFingerprintCached = async function(fingerprintId) {
  const cacheKey = `device:fingerprint:${fingerprintId}`;
  
  try {
    // Try cache first
    const cached = await cacheLayer.get(cacheKey);
    if (cached) {
      productionLogger.debug('Device fingerprint cache hit', { fingerprintId });
      return new this(cached);
    }

    // Fallback to database
    const device = await this.findOne({ fingerprintId });
    if (device) {
      // Cache for 1 hour
      await cacheLayer.set(cacheKey, device.toObject(), 3600);
      productionLogger.debug('Device fingerprint cached from database', { fingerprintId });
    }

    return device;
  } catch (error) {
    productionLogger.error('Error in findByFingerprintCached', { error: error.message, fingerprintId });
    // Fallback to direct database query
    return await this.findOne({ fingerprintId });
  }
};

/**
 * Invalidate device cache
 */
deviceFingerprintSchema.methods.invalidateCache = async function() {
  const cacheKeys = [
    `device:fingerprint:${this.fingerprintId}`,
    `device:security:${this.fingerprintId}`,
    `device:analytics:${this.fingerprintId}`,
    `device:risk:${this.fingerprintId}`
  ];

  try {
    await Promise.all(cacheKeys.map(key => cacheLayer.delete(key)));
    
    // Clear pattern-based caches
    await cacheLayer.deletePattern(`device:related:${this.fingerprintId}:*`);
    
    productionLogger.debug('Device cache invalidated', { 
      fingerprintId: this.fingerprintId, 
      keysCleared: cacheKeys.length 
    });
  } catch (error) {
    productionLogger.warn('Failed to invalidate device cache', { 
      error: error.message, 
      fingerprintId: this.fingerprintId 
    });
  }
};

// ========================================
// SECURITY ANALYSIS METHODS (Enhanced)
// ========================================

/**
 * Calculate trust score with caching
 */
deviceFingerprintSchema.methods.calculateTrustScore = async function() {
  const cacheKey = `device:trust:${this.fingerprintId}`;
  
  try {
    // Check cache first (5 minute TTL for trust scores)
    const cached = await cacheLayer.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) {
      this.securityProfile.trustScore = cached.score;
      return cached.score;
    }
  } catch (error) {
    productionLogger.debug('Trust score cache miss', { fingerprintId: this.fingerprintId });
  }

  let score = 50; // Start with neutral

  // Positive factors
  if (this.securityProfile.approvedReports > 0) {
    const approvalRate = this.securityProfile.approvedReports / this.securityProfile.totalReportsSubmitted;
    score += approvalRate * 30;
  }

  if (this.securityProfile.validationAccuracyRate > 80) {
    score += 20;
  }

  if (this.behaviorProfile.humanBehaviorScore > 70) {
    score += 15;
  }

  if (this.bangladeshProfile.likelyFromBangladesh && !this.networkProfile.vpnSuspected) {
    score += 10;
  }

  // MISSING FUNCTIONALITY 6: Long-term trust calculation
  const accountAge = (Date.now() - this.activityHistory.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
  if (accountAge > 30 && this.securityProfile.totalReportsSubmitted > 10) {
    const longTermReliability = this.securityProfile.approvedReports / this.securityProfile.totalReportsSubmitted;
    score += longTermReliability * 15; // Bonus for long-term reliability
  }

  // Negative factors
  if (this.securityProfile.spamReports > 2) {
    score -= 30;
  }

  if (this.threatIntelligence.coordinatedAttackParticipant) {
    score -= 40;
  }

  if (this.bangladeshProfile.crossBorderSuspicion > 70) {
    score -= 25;
  }

  if (this.threatIntelligence.botnetMember) {
    score -= 50;
  }

  // Factor in device anomaly score
  score -= this.deviceAnomalyScore * 0.5;

  // Factor in shadow ban status
  if (this.shadowBanned) {
    score -= 10;
  }

  // Factor in cross-device correlation
  if (this.crossDeviceCorrelation.correlationConfidence > 70) {
    const relatedDevicesTrust = 50; // This would be calculated from related devices
    score = (score + relatedDevicesTrust) / 2; // Average with related devices
  }

  const finalScore = Math.max(0, Math.min(100, score));
  this.securityProfile.trustScore = finalScore;

  // Cache the result
  try {
    await cacheLayer.set(cacheKey, {
      score: finalScore,
      timestamp: Date.now()
    }, 300); // 5 minute cache
  } catch (error) {
    productionLogger.debug('Failed to cache trust score', { error: error.message });
  }

  return finalScore;
};

/**
 * Assess threat level with enhanced logic
 */
deviceFingerprintSchema.methods.assessThreatLevel = function() {
  const threatScore = this.threatIntelligence.threatConfidence;
  const trustScore = this.securityProfile.trustScore;
  const crossBorderSuspicion = this.bangladeshProfile.crossBorderSuspicion;
  const anomalyScore = this.deviceAnomalyScore;

  // Critical threat conditions
  if (threatScore > 80 || trustScore < 20 || this.threatIntelligence.botnetMember || anomalyScore > 80) {
    this.securityProfile.riskLevel = 'critical';
  } else if (threatScore > 60 || trustScore < 40 || crossBorderSuspicion > 70 || anomalyScore > 60) {
    this.securityProfile.riskLevel = 'high';
  } else if (threatScore > 40 || trustScore < 60 || crossBorderSuspicion > 40 || anomalyScore > 40) {
    this.securityProfile.riskLevel = 'medium';
  } else if (trustScore > 80 && threatScore < 20 && anomalyScore < 20) {
    this.securityProfile.riskLevel = 'very_low';
  } else {
    this.securityProfile.riskLevel = 'low';
  }

  // Update moderator alerts based on risk level and specific flags
  this.moderatorAlerts = [];
  if (this.securityProfile.riskLevel === 'critical') this.moderatorAlerts.push('Critical Risk Device');
  if (this.securityProfile.riskLevel === 'high') this.moderatorAlerts.push('High Risk Device');
  if (this.networkProfile.vpnSuspected) this.moderatorAlerts.push('VPN Detected');
  if (this.networkProfile.torDetected) this.moderatorAlerts.push('Tor Detected');
  if (this.gpsSpoofingSuspected) this.moderatorAlerts.push('GPS Spoofing Suspected');
  if (this.threatIntelligence.botnetMember) this.moderatorAlerts.push('Botnet Behavior');
  if (this.shadowBanned) this.moderatorAlerts.push('Shadow Banned');
  if (this.crossDeviceCorrelation.correlationConfidence > 80) this.moderatorAlerts.push('Multi-Device User');

  return this.securityProfile.riskLevel;
};

/**
 * Enhanced quarantine decision logic
 */
deviceFingerprintSchema.methods.shouldQuarantine = function() {
  return this.securityProfile.riskLevel === 'critical' ||
    this.threatIntelligence.threatConfidence > 85 ||
    this.securityProfile.spamReports > 5 ||
    this.gpsSpoofingSuspected ||
    (this.deviceAnomalyScore > 90 && this.securityProfile.trustScore < 30);
};

/**
 * MISSING FUNCTIONALITY 4: Automatic quarantine review
 */
deviceFingerprintSchema.methods.scheduleQuarantineReview = function(reason = 'auto', durationHours = 24) {
  const releaseTime = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
  
  this.securityProfile.quarantineStatus = true;
  this.securityProfile.quarantineUntil = releaseTime;
  this.securityProfile.quarantineReason = reason;
  
  // Add to quarantine history with auto-release flag
  this.quarantineHistory.push({
    reason,
    triggeredBy: 'auto',
    timestamp: new Date(),
    autoReleaseScheduled: true
  });

  productionLogger.security('Device quarantined with automatic review', {
    fingerprintId: this.fingerprintId,
    reason,
    releaseTime,
    durationHours
  });
};

/**
 * Check if quarantine should be automatically lifted
 */
deviceFingerprintSchema.methods.checkQuarantineExpiry = function() {
  if (this.securityProfile.quarantineStatus && this.securityProfile.quarantineUntil) {
    if (new Date() > this.securityProfile.quarantineUntil) {
      this.securityProfile.quarantineStatus = false;
      this.securityProfile.quarantineUntil = null;
      this.securityProfile.quarantineReason = null;
      
      productionLogger.info('Quarantine automatically lifted', {
        fingerprintId: this.fingerprintId,
        releasedAt: new Date()
      });
      
      return true;
    }
  }
  return false;
};

/**
 * Enhanced activity update with analytics
 */
deviceFingerprintSchema.methods.updateActivity = async function() {
  this.activityHistory.lastSeen = new Date();
  this.activityHistory.totalSessions += 1;

  // Calculate engagement score
  const sessionQuality = Math.min(100, (this.activityHistory.averageSessionDuration / 10) * 20);
  const participationQuality = Math.min(100, this.activityHistory.communityParticipation * 10);
  const trustFactor = this.securityProfile.trustScore;

  this.activityHistory.engagementScore = Math.round((sessionQuality + participationQuality + trustFactor) / 3);

  // Update submission pattern with enhanced tracking
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay();
  
  this.submissionPattern.hourlyDistribution[currentHour] = (this.submissionPattern.hourlyDistribution[currentHour] || 0) + 1;
  this.submissionPattern.dailyPattern[currentDay] = (this.submissionPattern.dailyPattern[currentDay] || 0) + 1;

  // Recalculate peak hours
  const maxReports = Math.max(...this.submissionPattern.hourlyDistribution);
  this.submissionPattern.peakHours = this.submissionPattern.hourlyDistribution
    .map((count, hour) => (count === maxReports && maxReports > 0 ? hour : -1))
    .filter(hour => hour !== -1);

  // Detect suspicious time patterns
  const peakCount = this.submissionPattern.peakHours.length;
  const totalReports = this.submissionPattern.hourlyDistribution.reduce((sum, count) => sum + count, 0);
  
  if (peakCount <= 2 && totalReports > 20) {
    // Too concentrated in specific hours
    this.submissionPattern.suspiciousTimePatterns = true;
  }

  // Invalidate related caches
  await this.invalidateCache();
};

/**
 * Add quarantine event to history with cleanup
 */
deviceFingerprintSchema.methods.addQuarantineEvent = function(reason, triggeredBy = "auto") {
  this.quarantineHistory.push({ 
    reason, 
    triggeredBy, 
    timestamp: new Date() 
  });
  
  // MISSING FUNCTIONALITY 3: Keep history to reasonable size and clean up old entries
  if (this.quarantineHistory.length > 50) {
    this.quarantineHistory = this.quarantineHistory.slice(-50);
  }
};

/**
 * MISSING FUNCTIONALITY 3: Enhanced validation history cleanup
 */
deviceFingerprintSchema.methods.cleanupValidationHistory = function() {
  if (this.securityProfile.validationHistory.length > 100) {
    // Keep only the most recent 100 validations
    this.securityProfile.validationHistory = this.securityProfile.validationHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);
    
    productionLogger.debug('Validation history cleaned up', {
      fingerprintId: this.fingerprintId,
      entriesRemoved: this.securityProfile.validationHistory.length - 100
    });
  }
};

// ========================================
// STATIC METHODS FOR SECURITY ANALYSIS
// ========================================

/**
 * Find suspicious devices with caching
 */
deviceFingerprintSchema.statics.findSuspiciousDevices = async function(criteria = {}) {
  const cacheKey = `devices:suspicious:${JSON.stringify(criteria)}`.substring(0, 250);
  
  try {
    const cached = await cacheLayer.get(cacheKey);
    if (cached) {
      productionLogger.debug('Suspicious devices cache hit');
      return cached.map(doc => new this(doc));
    }
  } catch (error) {
    productionLogger.debug('Suspicious devices cache miss');
  }

  const suspiciousQuery = {
    $or: [
      { 'securityProfile.riskLevel': { $in: ['high', 'critical'] } },
      { 'threatIntelligence.threatConfidence': { $gt: 70 } },
      { 'bangladeshProfile.crossBorderSuspicion': { $gt: 70 } },
      { 'securityProfile.spamReports': { $gt: 3 } },
      { 'deviceAnomalyScore': { $gt: 70 } },
      { 'shadowBanned': true }
    ],
    ...criteria
  };

  const devices = await this.find(suspiciousQuery)
    .sort({ 'threatIntelligence.threatConfidence': -1 })
    .limit(100); // Reasonable limit

  // Cache for 5 minutes
  try {
    await cacheLayer.set(cacheKey, devices.map(d => d.toObject()), 300);
  } catch (error) {
    productionLogger.debug('Failed to cache suspicious devices');
  }

  return devices;
};

/**
 * MISSING FUNCTIONALITY 5: Enhanced coordinated attack detection with cross-device correlation
 */
deviceFingerprintSchema.statics.detectCoordinatedAttack = async function(timeWindow = 3600000) {
  const cacheKey = `analysis:coordinated:${timeWindow}`;
  
  try {
    const cached = await cacheLayer.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    productionLogger.debug('Coordinated attack cache miss');
  }

  const recentActivity = await this.find({
    'activityHistory.lastSeen': { $gte: new Date(Date.now() - timeWindow) },
    'securityProfile.totalReportsSubmitted': { $gt: 0 }
  });

  const suspiciousPatterns = [];

  // Enhanced grouping with cross-device correlation
  const deviceGroups = recentActivity.reduce((groups, device) => {
    const key = `${device.networkProfile.estimatedCountry}_${device.deviceSignature.screenResolution}_${device.behaviorProfile.humanBehaviorScore}_${device.networkProfile.ipHash}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(device);
    return groups;
  }, {});

  // Look for suspicious clustering with cross-device analysis
  Object.entries(deviceGroups).forEach(([pattern, devices]) => {
    if (devices.length >= 3) { // Lowered threshold for better detection
      const uniqueDevices = new Set(devices.map(d => d.fingerprintId));
      const avgTrustScore = devices.reduce((sum, d) => sum + d.securityProfile.trustScore, 0) / devices.length;
      const avgAnomalyScore = devices.reduce((sum, d) => sum + d.deviceAnomalyScore, 0) / devices.length;

      // Enhanced detection criteria
      if (uniqueDevices.size >= 3 && (avgTrustScore < 40 || avgAnomalyScore > 60)) {
        // Check for cross-device correlation
        const correlatedDevices = devices.filter(d => d.crossDeviceCorrelation.correlationConfidence > 50);
        
        suspiciousPatterns.push({
          pattern,
          deviceCount: devices.length,
          uniqueDevices: uniqueDevices.size,
          avgTrustScore,
          avgAnomalyScore,
          correlatedDevices: correlatedDevices.length,
          suspicionLevel: avgAnomalyScore > 80 ? 'critical' : 'high',
          devices: devices.map(d => d.fingerprintId),
          detectionTime: new Date()
        });
      }
    }
  });

  // Cache results for 10 minutes
  try {
    await cacheLayer.set(cacheKey, suspiciousPatterns, 600);
  } catch (error) {
    productionLogger.debug('Failed to cache coordinated attack analysis');
  }

  if (suspiciousPatterns.length > 0) {
    productionLogger.security('Coordinated attack patterns detected', {
      patternCount: suspiciousPatterns.length,
      totalDevices: suspiciousPatterns.reduce((sum, p) => sum + p.deviceCount, 0)
    });
  }

  return suspiciousPatterns;
};

/**
 * MISSING FUNCTIONALITY 5: Cross-device correlation analysis
 */
deviceFingerprintSchema.statics.analyzeCorrelatedDevices = async function(fingerprintId) {
  const cacheKey = `device:correlation:${fingerprintId}`;
  
  try {
    const cached = await cacheLayer.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    productionLogger.debug('Device correlation cache miss');
  }

  const targetDevice = await this.findOne({ fingerprintId });
  if (!targetDevice) return [];

  const potentialMatches = new Map(); // Use Map to avoid duplicates

  try {
    // Query 1: Network-based correlation (IP hash and network provider)
    const networkMatches = await this.find({
      fingerprintId: { $ne: fingerprintId },
      $or: [
        { 'networkProfile.ipHash': targetDevice.networkProfile.ipHash },
        { 'networkProfile.networkProvider': targetDevice.networkProfile.networkProvider }
      ]
    }).limit(20);

    networkMatches.forEach(device => {
      potentialMatches.set(device.fingerprintId, device);
    });

    // Query 2: Device signature correlation
    const signatureMatches = await this.find({
      fingerprintId: { $ne: fingerprintId },
      $or: [
        { 
          'deviceSignature.userAgent': targetDevice.deviceSignature.userAgent,
          'deviceSignature.screenResolution': targetDevice.deviceSignature.screenResolution
        },
        { 'deviceSignature.userAgentHash': targetDevice.deviceSignature.userAgentHash }
      ]
    }).limit(20);

    signatureMatches.forEach(device => {
      potentialMatches.set(device.fingerprintId, device);
    });

    // Query 3: Geographic proximity (separate query for geospatial)
    if (targetDevice.locationProfile.lastKnownLocation?.coordinates) {
      const geoMatches = await this.find({
        fingerprintId: { $ne: fingerprintId },
        'locationProfile.lastKnownLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: targetDevice.locationProfile.lastKnownLocation.coordinates
            },
            $maxDistance: 1000 // 1km radius
          }
        }
      }).limit(15);

      geoMatches.forEach(device => {
        potentialMatches.set(device.fingerprintId, device);
      });
    }

    // Query 4: Behavioral similarity
    const behaviorScore = targetDevice.behaviorProfile.humanBehaviorScore || 50;
    const behaviorMatches = await this.find({
      fingerprintId: { $ne: fingerprintId },
      'behaviorProfile.humanBehaviorScore': {
        $gte: behaviorScore - 10,
        $lte: behaviorScore + 10
      },
      'activityHistory.lastSeen': {
        $gte: new Date(Date.now() - (24 * 60 * 60 * 1000)) // Last 24 hours
      }
    }).limit(15);

    behaviorMatches.forEach(device => {
      potentialMatches.set(device.fingerprintId, device);
    });

    // Calculate correlation scores for all potential matches
    const correlatedDevices = Array.from(potentialMatches.values()).map(device => {
      let correlationScore = 0;
      const sharedCharacteristics = [];

      // Network-based correlation (40% weight)
      if (device.networkProfile.ipHash === targetDevice.networkProfile.ipHash) {
        correlationScore += 40;
        sharedCharacteristics.push('same_ip_hash');
      }
      if (device.networkProfile.networkProvider === targetDevice.networkProfile.networkProvider) {
        correlationScore += 10;
        sharedCharacteristics.push('same_isp');
      }

      // Device signature correlation (30% weight)
      if (device.deviceSignature.userAgent === targetDevice.deviceSignature.userAgent) {
        correlationScore += 20;
        sharedCharacteristics.push('same_user_agent');
      }
      if (device.deviceSignature.screenResolution === targetDevice.deviceSignature.screenResolution) {
        correlationScore += 10;
        sharedCharacteristics.push('same_screen_resolution');
      }

      // Behavioral correlation (20% weight)
      const behaviorDiff = Math.abs(device.behaviorProfile.humanBehaviorScore - targetDevice.behaviorProfile.humanBehaviorScore);
      if (behaviorDiff < 10) {
        correlationScore += 15;
        sharedCharacteristics.push('similar_behavior');
      }

      // Geographic correlation (if both have coordinates)
      if (device.locationProfile.lastKnownLocation?.coordinates && 
          targetDevice.locationProfile.lastKnownLocation?.coordinates) {
        const distance = this.calculateDistance(
          device.locationProfile.lastKnownLocation.coordinates,
          targetDevice.locationProfile.lastKnownLocation.coordinates
        );
        
        if (distance < 1000) { // Within 1km
          const proximityScore = Math.max(0, 15 - (distance / 100)); // Closer = higher score
          correlationScore += proximityScore;
          sharedCharacteristics.push('geographic_proximity');
        }
      }

      // Temporal correlation (10% weight)
      const timeDiff = Math.abs(device.activityHistory.lastSeen - targetDevice.activityHistory.lastSeen);
      if (timeDiff < 300000) { // 5 minutes
        correlationScore += 10;
        sharedCharacteristics.push('concurrent_activity');
      }

      return {
        fingerprintId: device.fingerprintId,
        correlationScore: Math.min(100, correlationScore),
        sharedCharacteristics,
        riskLevel: device.securityProfile.riskLevel,
        trustScore: device.securityProfile.trustScore
      };
    }).filter(correlation => correlation.correlationScore > 30) // Only significant correlations
      .sort((a, b) => b.correlationScore - a.correlationScore)
      .slice(0, 20); // Limit to top 20 correlations

    // Cache for 30 minutes
    try {
      await cacheLayer.set(cacheKey, correlatedDevices, 1800);
    } catch (error) {
      productionLogger.debug('Failed to cache device correlation');
    }

    return correlatedDevices;

  } catch (error) {
    productionLogger.error('Cross-device correlation analysis failed', {
      error: error.message,
      fingerprintId
    });
    return [];
  }
};

/**
 * Helper method to calculate distance between two coordinates
 * Uses Haversine formula for accuracy
 */
deviceFingerprintSchema.statics.calculateDistance = function(coords1, coords2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = coords1[1] * Math.PI / 180; // φ, λ in radians
  const φ2 = coords2[1] * Math.PI / 180;
  const Δφ = (coords2[1] - coords1[1]) * Math.PI / 180;
  const Δλ = (coords2[0] - coords1[0]) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Batch update trust scores for performance
 */
deviceFingerprintSchema.statics.batchUpdateTrustScores = async function(fingerprintIds) {
  const devices = await this.find({ fingerprintId: { $in: fingerprintIds } });
  
  const bulkOps = [];
  
  for (const device of devices) {
    await device.calculateTrustScore();
    device.assessThreatLevel();
    
    bulkOps.push({
      updateOne: {
        filter: { fingerprintId: device.fingerprintId },
        update: {
          $set: {
            'securityProfile.trustScore': device.securityProfile.trustScore,
            'securityProfile.riskLevel': device.securityProfile.riskLevel,
            'moderatorAlerts': device.moderatorAlerts,
            'processingStatus.lastDetailedAnalysis': new Date()
          }
        }
      }
    });
  }

  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
    productionLogger.info('Batch trust score update completed', { devicesUpdated: bulkOps.length });
  }
};

// ========================================
// BACKGROUND PROCESSING INTEGRATION
// ========================================

/**
 * Queue device for background processing
 */
deviceFingerprintSchema.methods.queueForProcessing = async function(analysisType = 'full', priority = 'medium') {
  // Import the processor here to avoid circular dependencies
  const { deviceFingerprintProcessor } = require('../middleware/deviceFingerprintProcessor');
  
  this.processingStatus.analysisQueue = {
    priority,
    position: 0 // Will be set by processor
  };
  
  deviceFingerprintProcessor.queueForDetailedAnalysis(this.fingerprintId, analysisType);
  
  productionLogger.debug('Device queued for background processing', {
    fingerprintId: this.fingerprintId,
    analysisType,
    priority
  });
};

/**
 * Update device signature and detect changes
 */
deviceFingerprintSchema.methods.updateDeviceSignature = function(newSignature) {
  // Store previous signature for consistency checking
  this.previousSignature = {
    userAgent: this.deviceSignature.userAgent,
    screenResolution: this.deviceSignature.screenResolution,
    timezone: this.deviceSignature.timezone,
    platform: this.deviceSignature.platform,
    timestamp: new Date()
  };

  // Update current signature
  Object.assign(this.deviceSignature, newSignature);

  // Detect significant changes
  const significantChanges = [];
  if (this.previousSignature.userAgent !== this.deviceSignature.userAgent) {
    significantChanges.push('user_agent');
  }
  if (this.previousSignature.screenResolution !== this.deviceSignature.screenResolution) {
    significantChanges.push('screen_resolution');
  }
  if (this.previousSignature.timezone !== this.deviceSignature.timezone) {
    significantChanges.push('timezone');
  }
  if (this.previousSignature.platform !== this.deviceSignature.platform) {
    significantChanges.push('platform');
  }

  if (significantChanges.length > 0) {
    productionLogger.security('Significant device signature changes detected', {
      fingerprintId: this.fingerprintId,
      changes: significantChanges
    });

    // Increase anomaly score for rapid changes
    this.deviceAnomalyScore = Math.min(100, this.deviceAnomalyScore + (significantChanges.length * 10));
    
    // Queue for detailed analysis
    this.queueForProcessing('high_risk', 'high');
  }
};

// ========================================
// PRE-SAVE MIDDLEWARE (OPTIMIZED)
// ========================================

deviceFingerprintSchema.pre('save', async function(next) {
  try {
    // Ensure all required nested objects exist
    const requiredObjects = [
      'securityProfile', 'networkProfile', 'behaviorProfile', 'deviceSignature',
      'locationProfile', 'analytics', 'threatIntelligence', 'bangladeshProfile',
      'crossDeviceCorrelation', 'processingStatus'
    ];

    requiredObjects.forEach(obj => {
      if (!this[obj]) this[obj] = {};
    });

    // Initialize arrays if they don't exist
    if (!this.submissionPattern.hourlyDistribution) {
      this.submissionPattern.hourlyDistribution = Array(24).fill(0);
    }
    if (!this.submissionPattern.dailyPattern) {
      this.submissionPattern.dailyPattern = Array(7).fill(0);
    }

    // Performance optimization: Determine calculation intensity
    const isHighPriorityUpdate = this.isModified('securityProfile') || 
                                 this.isModified('networkProfile') || 
                                 this.isModified('behaviorProfile') ||
                                 this.isModified('locationProfile.crossBorderActivity') ||
                                 this.isModified('deviceSignature.userAgent') ||
                                 this.isModified('deviceSignature.timezone') ||
                                 this.isNew;

    // Always calculate core scores (fast operations)
    await this.calculateTrustScore();
    this.assessThreatLevel();
    this.checkQuarantineExpiry();
    this.cleanupValidationHistory();

    // Check for quarantine status change to log history
    if (this.isModified('securityProfile.quarantineStatus') && this.securityProfile.quarantineStatus) {
      this.addQuarantineEvent('Auto-quarantined due to high risk/spam/spoofing', 'auto');
    }

    // --- LIGHTWEIGHT ANOMALY SCORING (Your Superior Approach) ---
    if (isHighPriorityUpdate) {
      // Perform lightweight, synchronous anomaly calculation
      let anomaly = this.previousAnomalyScore || 0;
      
      // Critical security flags (fast checks)
      if (this.networkProfile.vpnSuspected || this.networkProfile.proxyDetected || this.networkProfile.torDetected) {
        anomaly += 20;
      }
      if (this.behaviorProfile.humanBehaviorScore < 30) {
        anomaly += 15;
      }
      if (this.locationProfile.crossBorderActivity) {
        anomaly += 25;
      }
      if (this.securityProfile.spamSuspected) {
        anomaly += 10;
      }
      if (this.securityProfile.spoofingSuspected) {
        anomaly += 15;
      }
      
      this.deviceAnomalyScore = Math.min(100, Math.max(0, anomaly));
      this.previousAnomalyScore = this.deviceAnomalyScore;

      // Flag for detailed background analysis
      this.needsDetailedAnalysis = true;
      
      // Set analysis priority based on risk level
      this.processingStatus.analysisPriority = this.securityProfile.riskLevel === 'critical' ? 'critical' : 
                                               this.deviceAnomalyScore > 70 ? 'high' : 'normal';
      this.processingStatus.lastFlaggedForAnalysis = new Date();
    }

    // Set IP hash if not already set
    if (!this.networkProfile.ipHash && this.networkProfile.lastKnownIP) {
      this.networkProfile.ipHash = crypto.createHash('sha256')
        .update(this.networkProfile.lastKnownIP)
        .digest('hex')
        .substring(0, 16);
    }

    next();
  } catch (error) {
    console.error('DeviceFingerprint pre-save middleware error:', error);
    next(error);
  }
});

// ========================================
// POST-SAVE MIDDLEWARE WITH LOGGING
// ========================================

deviceFingerprintSchema.post('save', async function(doc) {
  try {
    // Log security events
    if (doc.securityProfile.riskLevel === 'high' || doc.securityProfile.riskLevel === 'critical') {
      productionLogger.security('High-risk device detected', {
        fingerprintId: doc.fingerprintId,
        riskLevel: doc.securityProfile.riskLevel,
        trustScore: doc.securityProfile.trustScore,
        anomalyScore: doc.deviceAnomalyScore,
        alerts: doc.moderatorAlerts
      });
    }

    // Invalidate caches
    await doc.invalidateCache();

    // Update related statistics in cache
    await cacheLayer.delete('stats:devices:security');
    await cacheLayer.delete('stats:devices:risk_distribution');

    // Log significant changes for audit trail
    if (doc.isModified('securityProfile.quarantineStatus')) {
      productionLogger.audit(
        'device_quarantine_status_changed',
        { system: 'automated_security' },
        { fingerprintId: doc.fingerprintId },
        doc.securityProfile.quarantineStatus ? 'quarantined' : 'released',
        {
          riskLevel: doc.securityProfile.riskLevel,
          reason: doc.securityProfile.quarantineReason
        }
      );
    }

  } catch (error) {
    productionLogger.error('DeviceFingerprint post-save error', {
      error: error.message,
      fingerprintId: doc.fingerprintId
    });
  }
});

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Compound indexes for common queries
deviceFingerprintSchema.index({ 'securityProfile.riskLevel': 1, 'activityHistory.lastSeen': -1 });
deviceFingerprintSchema.index({ 'networkProfile.ipHash': 1, 'activityHistory.lastSeen': -1 });
deviceFingerprintSchema.index({ 'deviceAnomalyScore': -1, 'securityProfile.trustScore': 1 });
deviceFingerprintSchema.index({ 'threatIntelligence.threatConfidence': -1 });
deviceFingerprintSchema.index({ 'bangladeshProfile.crossBorderSuspicion': -1 });
deviceFingerprintSchema.index({ 'processingStatus.nextScheduledAnalysis': 1 });

// Geospatial index for location-based queries
deviceFingerprintSchema.index({ 'locationProfile.lastKnownLocation.coordinates': '2dsphere' });

// Text index for searching device characteristics
deviceFingerprintSchema.index({
  'deviceSignature.userAgent': 'text',
  'networkProfile.networkProvider': 'text',
  'locationProfile.lastKnownLocation.address': 'text'
});

// ========================================
// VIRTUAL FIELDS
// ========================================

// Overall security score combining multiple factors
deviceFingerprintSchema.virtual('overallSecurityScore').get(function() {
  const trustWeight = 0.4;
  const anomalyWeight = 0.3;
  const threatWeight = 0.3;
  
  const normalizedTrust = this.securityProfile.trustScore || 50;
  const normalizedAnomaly = 100 - (this.deviceAnomalyScore || 0);
  const normalizedThreat = 100 - (this.threatIntelligence.threatConfidence || 0);
  
  return Math.round(
    (normalizedTrust * trustWeight) +
    (normalizedAnomaly * anomalyWeight) +
    (normalizedThreat * threatWeight)
  );
});

// Risk summary for dashboard display
deviceFingerprintSchema.virtual('riskSummary').get(function() {
  return {
    level: this.securityProfile.riskLevel,
    score: this.overallSecurityScore,
    alerts: this.moderatorAlerts,
    quarantined: this.securityProfile.quarantineStatus,
    shadowBanned: this.shadowBanned,
    lastActivity: this.activityHistory.lastSeen
  };
});

// Activity summary
deviceFingerprintSchema.virtual('activitySummary').get(function() {
  return {
    totalSessions: this.activityHistory.totalSessions,
    totalReports: this.analytics.totalReports,
    approvalRate: this.securityProfile.totalReportsSubmitted > 0 ? 
      (this.securityProfile.approvedReports / this.securityProfile.totalReportsSubmitted * 100).toFixed(1) : 0,
    engagementScore: this.activityHistory.engagementScore,
    firstSeen: this.activityHistory.firstSeen,
    lastSeen: this.activityHistory.lastSeen
  };
});

// ========================================
// STATIC UTILITY METHODS
// ========================================

/**
 * Get devices requiring quarantine review
 */
deviceFingerprintSchema.statics.getQuarantineReviewQueue = async function() {
  return await this.find({
    'securityProfile.quarantineStatus': true,
    'securityProfile.quarantineUntil': { $lte: new Date() },
    'quarantineHistory.autoReleaseScheduled': true
  }).sort({ 'securityProfile.quarantineUntil': 1 });
};

/**
 * Get security statistics for dashboard
 */
deviceFingerprintSchema.statics.getSecurityStats = async function() {
  const cacheKey = 'stats:devices:security';
  
  try {
    const cached = await cacheLayer.get(cacheKey);
    if (cached) return cached;
  } catch (error) {
    productionLogger.debug('Security stats cache miss');
  }

  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        criticalRisk: { $sum: { $cond: [{ $eq: ['$securityProfile.riskLevel', 'critical'] }, 1, 0] } },
        highRisk: { $sum: { $cond: [{ $eq: ['$securityProfile.riskLevel', 'high'] }, 1, 0] } },
        quarantined: { $sum: { $cond: ['$securityProfile.quarantineStatus', 1, 0] } },
        shadowBanned: { $sum: { $cond: ['$shadowBanned', 1, 0] } },
        avgTrustScore: { $avg: '$securityProfile.trustScore' },
        avgAnomalyScore: { $avg: '$deviceAnomalyScore' }
      }
    }
  ]);

  const result = stats[0] || {
    totalDevices: 0,
    criticalRisk: 0,
    highRisk: 0,
    quarantined: 0,
    shadowBanned: 0,
    avgTrustScore: 50,
    avgAnomalyScore: 0
  };

  // Cache for 5 minutes
  try {
    await cacheLayer.set(cacheKey, result, 300);
  } catch (error) {
    productionLogger.debug('Failed to cache security stats');
  }

  return result;
};

/**
 * MISSING FUNCTIONALITY 7: Graceful shutdown handling
 */
deviceFingerprintSchema.statics.handleGracefulShutdown = async function() {
  try {
    // Save any pending operations
    const pendingDevices = await this.find({
      'processingStatus.analysisInProgress': true
    });

    const bulkOps = pendingDevices.map(device => ({
      updateOne: {
        filter: { fingerprintId: device.fingerprintId },
        update: {
          $set: {
            'processingStatus.analysisInProgress': false,
            'processingStatus.nextScheduledAnalysis': new Date(Date.now() + 300000) // 5 minutes
          }
        }
      }
    }));

    if (bulkOps.length > 0) {
      await this.bulkWrite(bulkOps);
      productionLogger.info('Graceful shutdown: Reset processing status for pending devices', {
        deviceCount: bulkOps.length
      });
    }

    // Clear processing-related caches
    await cacheLayer.deletePattern('device:processing:*');
    await cacheLayer.deletePattern('analysis:*');

    productionLogger.info('DeviceFingerprint graceful shutdown completed');
  } catch (error) {
    productionLogger.error('Error during DeviceFingerprint graceful shutdown', {
      error: error.message
    });
  }
};

// Create the model
const DeviceFingerprint = mongoose.model('DeviceFingerprint', deviceFingerprintSchema);

module.exports = DeviceFingerprint;