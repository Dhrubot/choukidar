// === backend/src/models/DeviceFingerprint.js ===
// Advanced Anonymous Device Tracking & Security System

const mongoose = require('mongoose');

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
    required: false, // Not required if device is ephemeral or not yet linked to a persistent user
    index: true 
  },
  
  // Device Characteristics for Security Analysis
  deviceSignature: {
    canvasFingerprint: String,        // Canvas rendering signature
    screenResolution: String,         // Screen dimensions and color depth
    timezone: String,                 // Browser timezone
    language: String,                 // Browser language
    platform: String,                // Operating system
    userAgentHash: String,            // Hashed user agent string
    webglFingerprint: String,         // WebGL rendering signature
    audioFingerprint: String,         // Audio context fingerprint
    fontsAvailable: [String],         // Available system fonts
    pluginsInstalled: [String]        // Browser plugins
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
    humanBehaviorScore: { type: Number, default: 50, min: 0, max: 100 } // Confidence human user
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
    torDetected: { type: Boolean, default: false }        // Tor browser detection
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
    
    // Validation History
    totalValidationsGiven: { type: Number, default: 0 },
    accurateValidations: { type: Number, default: 0 },
    inaccurateValidations: { type: Number, default: 0 },
    validationAccuracyRate: { type: Number, default: 0, min: 0, max: 100 },
    
    // Track reports validated by this device to prevent duplicates
    validationHistory: [{
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
      timestamp: { type: Date, default: Date.now },
      isPositive: Boolean // Store if it was a positive or negative validation
    }],

    // Security Events
    securityViolations: [String],                         // Types of violations
    lastSecurityEvent: Date,                              // Last security incident
    quarantineStatus: { type: Boolean, default: false }, // Temporarily blocked
    quarantineUntil: Date,                                // Quarantine expiration
    permanentlyBanned: { type: Boolean, default: false }  // Permanent ban status
  },

  // NEW: Quarantine Logs
  quarantineHistory: [{
    reason: String,
    triggeredBy: { type: String, enum: ["auto", "moderator", "threshold_violation", "system"], default: "auto" },
    timestamp: { type: Date, default: Date.now }
  }],

  // NEW: Device Anomaly Score
  // A single aggregated score to represent how abnormal the device is compared to other users
  // (based on browser, plugins, fonts, etc.). Higher score = more anomalous.
  deviceAnomalyScore: { type: Number, default: 0, min: 0, max: 100 },

  // NEW: Report Submission Pattern
  // Track time-of-day submission clusters which often emerge in abuse campaigns.
  submissionPattern: {
    hourlyDistribution: { type: [Number], default: Array(24).fill(0) }, // Array of 24 ints: # of reports per hour
    peakHours: { type: [Number], default: [] },         // Most active hours (e.g., [9, 14, 22])
  },

  // NEW: Shadow Ban Field
  // Sometimes you don’t want to quarantine outright, but silently suppress activity.
  shadowBanned: { type: Boolean, default: false },

  // NEW: Geo-fencing Drift Detection
  // For mobile/web hybrid users, detect if someone spoofs GPS location regularly.
  gpsSpoofingSuspected: { type: Boolean, default: false },
  locationDriftScore: { type: Number, default: 0, min: 0, max: 100 },

  // NEW: Alert Triggers or Flags for Dashboard UI
  // To let your admin dashboard easily render warning banners for high-risk devices.
  moderatorAlerts: { type: [String], default: [] }, // e.g. ["VPN Detected", "Botnet Behavior", "High Threat Confidence"]
  
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
    
    // Threat Scoring
    threatConfidence: { type: Number, default: 0, min: 0, max: 100 },
    lastThreatAssessment: { type: Date, default: Date.now },
    threatSources: [String],                              // Sources of threat intelligence
    mitigationActions: [String]                           // Applied countermeasures
  },
  
  // Activity Tracking
  activityHistory: {
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    totalSessions: { type: Number, default: 1 },
    totalPageViews: { type: Number, default: 0 },
    averageSessionDuration: { type: Number, default: 0 }, // Minutes
    
    // Feature Usage
    mapUsage: { type: Number, default: 0 },               // Map interactions
    reportingUsage: { type: Number, default: 0 },         // Report submissions
    validationUsage: { type: Number, default: 0 },        // Validation participation
    
    // Engagement Quality
    bounceRate: { type: Number, default: 0 },             // Single page visits
    engagementScore: { type: Number, default: 0, min: 0, max: 100 },
    communityParticipation: { type: Number, default: 0 }  // Community engagement level
  },
  
  // Bangladesh-Specific Analysis
  bangladeshProfile: {
    likelyFromBangladesh: { type: Boolean, default: true },
    estimatedDivision: String,                            // Estimated division
    estimatedDistrict: String,                            // Estimated district
    localLanguageUsage: { type: Boolean, default: false },
    culturalContextMatch: { type: Number, default: 50 }, // Cultural context score
    
    // Anti-Sabotage Measures
    crossBorderSuspicion: { type: Number, default: 0, min: 0, max: 100 },
    indianIPDetection: { type: Boolean, default: false },
    antiBAangladeshContent: { type: Number, default: 0 }, // Anti-Bangladesh sentiment
    politicalManipulationScore: { type: Number, default: 0 }
  }
}, {
  timestamps: true
  // REMOVED: Schema-level indexes - now managed centrally by optimizedIndexes.js
  // This prevents duplicate index creation and provides better management
});

// Security Analysis Methods
deviceFingerprintSchema.methods.calculateTrustScore = function() {
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
  score -= this.deviceAnomalyScore * 0.5; // Higher anomaly reduces trust

  // Factor in shadow ban status (if actively shadow banned, trust might be lower)
  if (this.shadowBanned) {
    score -= 10; // Small penalty for being shadow banned
  }
  
  this.securityProfile.trustScore = Math.max(0, Math.min(100, score));
  return this.securityProfile.trustScore;
};

deviceFingerprintSchema.methods.assessThreatLevel = function() {
  const threatScore = this.threatIntelligence.threatConfidence;
  const trustScore = this.securityProfile.trustScore;
  const crossBorderSuspicion = this.bangladeshProfile.crossBorderSuspicion;
  const anomalyScore = this.deviceAnomalyScore; // Use the new anomaly score
  
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
  
  return this.securityProfile.riskLevel;
};

deviceFingerprintSchema.methods.shouldQuarantine = function() {
  return this.securityProfile.riskLevel === 'critical' || 
         this.threatIntelligence.threatConfidence > 85 ||
         this.securityProfile.spamReports > 5 ||
         this.gpsSpoofingSuspected; // New condition for quarantine
};

deviceFingerprintSchema.methods.updateActivity = function() {
  this.activityHistory.lastSeen = new Date();
  this.activityHistory.totalSessions += 1;
  
  // Calculate engagement score
  const sessionQuality = Math.min(100, (this.activityHistory.averageSessionDuration / 10) * 20);
  const participationQuality = Math.min(100, this.activityHistory.communityParticipation * 10);
  const trustFactor = this.securityProfile.trustScore;
  
  this.activityHistory.engagementScore = Math.round((sessionQuality + participationQuality + trustFactor) / 3);

  // Update submission pattern (simple hourly count)
  const currentHour = new Date().getHours();
  this.submissionPattern.hourlyDistribution[currentHour] = (this.submissionPattern.hourlyDistribution[currentHour] || 0) + 1;
  
  // Recalculate peak hours (simple example, could be more complex)
  const maxReports = Math.max(...this.submissionPattern.hourlyDistribution);
  this.submissionPattern.peakHours = this.submissionPattern.hourlyDistribution
    .map((count, hour) => (count === maxReports && maxReports > 0 ? hour : -1))
    .filter(hour => hour !== -1);
};

// Method to add a quarantine event to history
deviceFingerprintSchema.methods.addQuarantineEvent = function(reason, triggeredBy = "auto") {
  this.quarantineHistory.push({ reason, triggeredBy, timestamp: new Date() });
  // Keep history to a reasonable size, e.g., last 20 events
  if (this.quarantineHistory.length > 20) {
    this.quarantineHistory = this.quarantineHistory.slice(-20);
  }
};

// Static methods for security analysis
deviceFingerprintSchema.statics.findSuspiciousDevices = function(criteria = {}) {
  const suspiciousQuery = {
    $or: [
      { 'securityProfile.riskLevel': { $in: ['high', 'critical'] } },
      { 'threatIntelligence.threatConfidence': { $gt: 70 } },
      { 'bangladeshProfile.crossBorderSuspicion': { $gt: 70 } },
      { 'securityProfile.spamReports': { $gt: 3 } },
      { 'deviceAnomalyScore': { $gt: 70 } }, // New condition
      { 'shadowBanned': true } // Include shadow banned devices
    ],
    ...criteria
  };
  
  return this.find(suspiciousQuery).sort({ 'threatIntelligence.threatConfidence': -1 });
};

deviceFingerprintSchema.statics.detectCoordinatedAttack = async function(timeWindow = 3600000) {
  const recentActivity = await this.find({
    lastSeen: { $gte: new Date(Date.now() - timeWindow) },
    'securityProfile.totalReportsSubmitted': { $gt: 0 }
  });
  
  // Analyze for coordinated patterns
  const suspiciousPatterns = [];
  
  // Group by similar characteristics
  const deviceGroups = recentActivity.reduce((groups, device) => {
    const key = `${device.networkProfile.estimatedCountry}_${device.deviceSignature.screenResolution}_${device.behaviorProfile.humanBehaviorScore}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(device);
    return groups;
  }, {});
  
  // Look for suspicious clustering
  Object.entries(deviceGroups).forEach(([pattern, devices]) => {
    if (devices.length >= 5) { // 5+ reports in same area within time window
      const uniqueDevices = new Set(devices.map(d => d.fingerprintId));
      const avgSecurityScore = devices.reduce((sum, d) => sum + d.securityProfile.trustScore, 0) / devices.length; // Use device trust score
      
      if (uniqueDevices.size >= 3 && avgSecurityScore < 60) {
        suspiciousPatterns.push({
          pattern,
          deviceCount: devices.length,
          uniqueDevices: uniqueDevices.size,
          avgSecurityScore,
          suspicionLevel: 'high',
          devices: devices.map(d => d.fingerprintId)
        });
      }
    }
  });
  
  return suspiciousPatterns;
};

// Pre-save middleware for automatic analysis
deviceFingerprintSchema.pre('save', function(next) {
  // Auto-calculate trust score and threat level
  this.calculateTrustScore();
  this.assessThreatLevel();
  
  // Check for quarantine status change to log history
  if (this.isModified('securityProfile.quarantineStatus') && this.securityProfile.quarantineStatus) {
    this.addQuarantineEvent('Auto-quarantined due to high risk/spam/spoofing', 'auto');
  }

  // Complete device anomaly scoring algorithm - PRODUCTION READY
  let anomaly = 0;
  
  // Network-based anomaly detection (30% weight)
  if (this.networkProfile.vpnSuspected) anomaly += 15;
  if (this.networkProfile.proxyDetected) anomaly += 10;
  if (this.networkProfile.torDetected) anomaly += 20;
  if (this.networkProfile.suspiciousHeaders?.length > 0) anomaly += 5;
  
  // Behavior-based anomaly detection (25% weight)
  if (this.behaviorProfile.humanBehaviorScore < 20) anomaly += 20;
  else if (this.behaviorProfile.humanBehaviorScore < 40) anomaly += 10;
  else if (this.behaviorProfile.humanBehaviorScore < 60) anomaly += 5;
  
  if (this.behaviorProfile.reportingFrequency > 10) anomaly += 8; // Too many reports
  if (this.behaviorProfile.sessionDuration < 30) anomaly += 5; // Very short sessions
  
  // Device signature anomaly detection (20% weight)
  if (this.deviceSignature.screenResolution === '800x600' || 
      this.deviceSignature.screenResolution === '1024x768') anomaly += 8; // Suspicious resolutions
  
  if (this.deviceSignature.timezone && 
      !['Asia/Dhaka', 'Asia/Kolkata'].includes(this.deviceSignature.timezone)) {
    // Non-Bangladesh timezone increases suspicion
    anomaly += 12;
  }
  
  if (!this.deviceSignature.languages?.includes('bn') && 
      !this.deviceSignature.languages?.includes('en')) {
    // No Bengali or English language support
    anomaly += 8;
  }
  
  // Location consistency check (15% weight)
  if (this.locationProfile.crossBorderActivity) anomaly += 15;
  if (this.locationProfile.locationJumps > 3) anomaly += 10; // Frequent location changes
  if (this.locationProfile.gpsAccuracy > 1000) anomaly += 5; // Poor GPS accuracy
  
  // Security flags (10% weight)
  if (this.securityProfile.spamSuspected) anomaly += 8;
  if (this.securityProfile.spoofingSuspected) anomaly += 12;
  if (this.securityProfile.flaggedReports > 0) {
    anomaly += Math.min(10, this.securityProfile.flaggedReports * 2);
  }
  
  // Historical behavior patterns
  if (this.analytics.totalReports > 50 && this.analytics.approvedReports === 0) {
    anomaly += 15; // Many reports but none approved - suspicious
  }
  
  if (this.analytics.averageSessionTime < 60) {
    anomaly += 5; // Very short average sessions
  }
  
  // Device consistency checks
  const deviceChanges = [
    this.deviceSignature.userAgent !== this.previousSignature?.userAgent,
    this.deviceSignature.screenResolution !== this.previousSignature?.screenResolution,
    this.deviceSignature.timezone !== this.previousSignature?.timezone
  ].filter(Boolean).length;
  
  if (deviceChanges >= 2) anomaly += 8; // Multiple device characteristics changed
  
  // Cap the anomaly score and apply smoothing
  this.deviceAnomalyScore = Math.min(100, Math.max(0, anomaly));
  
  // Apply temporal smoothing to prevent sudden spikes
  if (this.previousAnomalyScore !== undefined) {
    const maxChange = 15; // Maximum change per update
    const change = this.deviceAnomalyScore - this.previousAnomalyScore;
    if (Math.abs(change) > maxChange) {
      this.deviceAnomalyScore = this.previousAnomalyScore + (change > 0 ? maxChange : -maxChange);
    }
  }
  
  // Store previous score for next calculation
  this.previousAnomalyScore = this.deviceAnomalyScore;

  next();
});

// Post-save middleware for logging
deviceFingerprintSchema.post('save', function(doc) {
  if (doc.securityProfile.riskLevel === 'high' || doc.securityProfile.riskLevel === 'critical') {
    console.log(`⚠️ High-risk device detected: ${doc.fingerprintId} - Risk: ${doc.securityProfile.riskLevel}, Trust: ${doc.securityProfile.trustScore}`);
  }
});

const DeviceFingerprint = mongoose.model('DeviceFingerprint', deviceFingerprintSchema);

module.exports = DeviceFingerprint;
