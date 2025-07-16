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
    
    // Security Events
    securityViolations: [String],                         // Types of violations
    lastSecurityEvent: Date,                              // Last security incident
    quarantineStatus: { type: Boolean, default: false }, // Temporarily blocked
    quarantineUntil: Date,                                // Quarantine expiration
    permanentlyBanned: { type: Boolean, default: false }  // Permanent ban status
  },
  
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
  timestamps: true,
  // Optimize for security queries
  indexes: [
    { fingerprintId: 1 },
    { 'securityProfile.trustScore': -1 },
    { 'securityProfile.riskLevel': 1 },
    { 'threatIntelligence.threatConfidence': -1 },
    { 'bangladeshProfile.crossBorderSuspicion': -1 },
    { lastSeen: -1 }
  ]
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
  
  this.securityProfile.trustScore = Math.max(0, Math.min(100, score));
  return this.securityProfile.trustScore;
};

deviceFingerprintSchema.methods.assessThreatLevel = function() {
  const threatScore = this.threatIntelligence.threatConfidence;
  const trustScore = this.securityProfile.trustScore;
  const crossBorderSuspicion = this.bangladeshProfile.crossBorderSuspicion;
  
  if (threatScore > 80 || trustScore < 20 || this.threatIntelligence.botnetMember) {
    this.securityProfile.riskLevel = 'critical';
  } else if (threatScore > 60 || trustScore < 40 || crossBorderSuspicion > 70) {
    this.securityProfile.riskLevel = 'high';
  } else if (threatScore > 40 || trustScore < 60 || crossBorderSuspicion > 40) {
    this.securityProfile.riskLevel = 'medium';
  } else if (trustScore > 80 && threatScore < 20) {
    this.securityProfile.riskLevel = 'very_low';
  } else {
    this.securityProfile.riskLevel = 'low';
  }
  
  return this.securityProfile.riskLevel;
};

deviceFingerprintSchema.methods.shouldQuarantine = function() {
  return this.securityProfile.riskLevel === 'critical' || 
         this.threatIntelligence.threatConfidence > 85 ||
         this.securityProfile.spamReports > 5;
};

deviceFingerprintSchema.methods.updateActivity = function() {
  this.activityHistory.lastSeen = new Date();
  this.activityHistory.totalSessions += 1;
  
  // Calculate engagement score
  const sessionQuality = Math.min(100, (this.activityHistory.averageSessionDuration / 10) * 20);
  const participationQuality = Math.min(100, this.activityHistory.communityParticipation * 10);
  const trustFactor = this.securityProfile.trustScore;
  
  this.activityHistory.engagementScore = Math.round((sessionQuality + participationQuality + trustFactor) / 3);
};

// Static methods for security analysis
deviceFingerprintSchema.statics.findSuspiciousDevices = function(criteria = {}) {
  const suspiciousQuery = {
    $or: [
      { 'securityProfile.riskLevel': { $in: ['high', 'critical'] } },
      { 'threatIntelligence.threatConfidence': { $gt: 70 } },
      { 'bangladeshProfile.crossBorderSuspicion': { $gt: 70 } },
      { 'securityProfile.spamReports': { $gt: 3 } }
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
    if (devices.length > 5) { // More than 5 similar devices active
      suspiciousPatterns.push({
        pattern,
        deviceCount: devices.length,
        suspicionLevel: 'high',
        devices: devices.map(d => d.fingerprintId)
      });
    }
  });
  
  return suspiciousPatterns;
};

// Pre-save middleware for automatic analysis
deviceFingerprintSchema.pre('save', function(next) {
  // Auto-calculate trust score and threat level
  this.calculateTrustScore();
  this.assessThreatLevel();
  
  // Check for quarantine
  if (this.shouldQuarantine() && !this.securityProfile.quarantineStatus) {
    this.securityProfile.quarantineStatus = true;
    this.securityProfile.quarantineUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    console.log(`🚨 Device ${this.fingerprintId} auto-quarantined due to high risk`);
  }
  
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