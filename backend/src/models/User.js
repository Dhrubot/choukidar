// === backend/src/models/User.js ===
// Enhanced User Model with Security Integration and Multi-Role Support
// Integrates with DeviceFingerprint for comprehensive security tracking

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  // Core User Identity
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User Type and Role Management
  userType: {
    type: String,
    enum: ['anonymous', 'admin', 'police', 'researcher'],
    default: 'anonymous',
    required: true,
    index: true
  },
  
  // Role-Specific Information
  roleData: {
    // Admin Information
    admin: {
      username: String,
      email: String,
      passwordHash: String,
      permissions: [{
        type: String,
        enum: ['moderation', 'analytics', 'user_management', 'safe_zones', 'security_monitoring', 'super_admin']
      }],
      lastLogin: Date,
      loginAttempts: { type: Number, default: 0 },
      accountLocked: { type: Boolean, default: false },
      lockUntil: Date,
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: String, // For 2FA authentication
      adminLevel: { type: Number, min: 1, max: 10, default: 5 },
      emailVerified: { type: Boolean, default: false }, // For email verification
      emailVerificationToken: String, // For email verification process
      passwordResetToken: String, // For password reset functionality
      passwordResetExpires: Date // Expiry time for password reset tokens
    },
    
    // Police Officer Information (Future Implementation Ready)
    police: {
      badgeNumber: String,
      department: String,
      rank: String,
      division: String,
      district: String,
      thana: String,
      phoneNumber: String,
      email: String, // Police officers also have email
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      verificationDocuments: [String], // Document URLs
      verifiedBy: String, // Admin who verified
      verifiedAt: Date,
      accessLevel: {
        type: String,
        enum: ['read_only', 'standard', 'supervisor', 'chief'],
        default: 'read_only'
      }
    },
    
    // Researcher Information (Future Implementation Ready)
    researcher: {
      institution: String,
      researchArea: String,
      academicTitle: String,
      researchProposal: String,
      ethicsApproval: String,
      supervisorContact: String,
      expectedDuration: Number, // months
      email: String, // Researchers also have email
      dataUsageAgreement: { type: Boolean, default: false },
      verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      accessLevel: {
        type: String,
        enum: ['basic', 'full', 'api_access'],
        default: 'basic'
      }
    }
  },
  
  // Security Integration with Device Fingerprinting
  securityProfile: {
    associatedDevices: [{
      fingerprintId: { type: String, ref: 'DeviceFingerprint' },
      deviceType: String,
      lastUsed: Date,
      trustLevel: String,
      isPrimary: { type: Boolean, default: false }
    }],
    
    primaryDeviceFingerprint: { 
      type: String, 
      ref: 'DeviceFingerprint' 
    },
    
    // Security Metrics
    overallTrustScore: { type: Number, default: 50, min: 0, max: 100 },
    securityRiskLevel: {
      type: String,
      enum: ['very_low', 'low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    
    // Access Control
    accessRestrictions: [String], // Restricted features
    quarantineStatus: { type: Boolean, default: false },
    quarantineReason: String,
    quarantineUntil: Date,
    
    // Security Events
    securityEvents: [{
      eventType: String,
      timestamp: { type: Date, default: Date.now },
      details: String,
      deviceFingerprint: String,
      severity: String
    }],
    
    lastSecurityCheck: { type: Date, default: Date.now },
    securityUpdatedAt: { type: Date, default: Date.now }
  },
  
  // Anonymous User Tracking (for anonymous users)
  anonymousProfile: {
    sessionId: String,
    deviceFingerprint: { type: String, ref: 'DeviceFingerprint' },
    estimatedLocation: {
      division: String,
      district: String,
      accuracy: String
    },
    preferredLanguage: { type: String, default: 'en' },
    
    // Anonymous Activity Tracking
    activityMetrics: {
      totalReports: { type: Number, default: 0 },
      totalValidations: { type: Number, default: 0 },
      mapUsage: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 }
    },
    
    // Privacy Settings
    privacySettings: {
      locationTracking: { type: Boolean, default: false },
      behaviorAnalytics: { type: Boolean, default: true },
      personalizedExperience: { type: Boolean, default: false }
    }
  },
  
  // Activity and Engagement Tracking
  activityProfile: {
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    totalSessions: { type: Number, default: 1 },
    totalActiveTime: { type: Number, default: 0 }, // minutes
    
    // Feature Usage
    featureUsage: {
      reporting: { type: Number, default: 0 },
      mapViewing: { type: Number, default: 0 },
      validation: { type: Number, default: 0 },
      adminPanel: { type: Number, default: 0 },
      analytics: { type: Number, default: 0 }
    },
    
    // Contribution Quality
    contributionMetrics: {
      reportsSubmitted: { type: Number, default: 0 },
      reportsApproved: { type: Number, default: 0 },
      validationsGiven: { type: Number, default: 0 },
      validationAccuracy: { type: Number, default: 0 },
      communityReputation: { type: Number, default: 50 }
    }
  },
  
  // User Preferences and Settings
  preferences: {
    language: { type: String, default: 'en' },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    notifications: {
      email: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      community: { type: Boolean, default: true }
    },
    
    // Map Preferences
    mapSettings: {
      defaultView: { type: String, enum: ['markers', 'heatmap', 'clusters'], default: 'clusters' },
      autoLocation: { type: Boolean, default: true },
      showSafeZones: { type: Boolean, default: true },
      showFemaleIncidents: { type: Boolean, default: true }
    },
    
    // Female Safety Mode
    femaleSafetyMode: {
      enabled: { type: Boolean, default: false },
      enhancedPrivacy: { type: Boolean, default: true },
      femaleOnlyValidation: { type: Boolean, default: false },
      culturalSensitivity: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
  // REMOVED: Schema-level indexes - now managed centrally by optimizedIndexes.js
  // This prevents duplicate index creation and provides better management
});

// === SECURITY METHODS ===

userSchema.methods.updateSecurityProfile = async function() {
  // Get associated device fingerprint data
  if (this.securityProfile.primaryDeviceFingerprint) {
    const DeviceFingerprint = mongoose.model('DeviceFingerprint');
    const device = await DeviceFingerprint.findOne({ 
      fingerprintId: this.securityProfile.primaryDeviceFingerprint 
    });
    
    if (device) {
      // Update trust score based on device trust and user activity
      const deviceTrust = device.securityProfile.trustScore;
      const activityQuality = this.calculateActivityQuality();
      const contributionQuality = this.calculateContributionQuality();
      
      this.securityProfile.overallTrustScore = Math.round(
        (deviceTrust * 0.4 + activityQuality * 0.3 + contributionQuality * 0.3)
      );
      
      // Update risk level based on device and user behavior
      if (device.securityProfile.riskLevel === 'critical' || this.securityProfile.overallTrustScore < 20) {
        this.securityProfile.securityRiskLevel = 'critical';
      } else if (device.securityProfile.riskLevel === 'high' || this.securityProfile.overallTrustScore < 40) {
        this.securityProfile.securityRiskLevel = 'high';
      } else if (this.securityProfile.overallTrustScore > 80) {
        this.securityProfile.securityRiskLevel = 'very_low';
      } else {
        this.securityProfile.securityRiskLevel = 'medium';
      }
    }
  }
  
  this.securityProfile.securityUpdatedAt = new Date();
};

userSchema.methods.calculateActivityQuality = function() {
  const totalTime = this.activityProfile.totalActiveTime;
  const sessionCount = this.activityProfile.totalSessions;
  const avgSessionTime = totalTime / Math.max(1, sessionCount);
  
  // Quality factors
  let score = 50;
  
  // Good session length (5-30 minutes is optimal)
  if (avgSessionTime >= 5 && avgSessionTime <= 30) score += 20;
  else if (avgSessionTime < 1) score -= 20; // Too short (bot-like)
  else if (avgSessionTime > 60) score -= 10; // Unusually long
  
  // Regular usage pattern
  const daysSinceFirst = (Date.now() - this.activityProfile.firstSeen) / (1000 * 60 * 60 * 24);
  const usageFrequency = sessionCount / Math.max(1, daysSinceFirst);
  
  if (usageFrequency > 0.1 && usageFrequency < 5) score += 15; // Good frequency
  else if (usageFrequency > 10) score -= 15; // Too frequent (suspicious)
  
  return Math.max(0, Math.min(100, score));
};

userSchema.methods.calculateContributionQuality = function() {
  const metrics = this.activityProfile.contributionMetrics;
  let score = 50;
  
  // Report approval rate
  if (metrics.reportsSubmitted > 0) {
    const approvalRate = metrics.reportsApproved / metrics.reportsSubmitted;
    score += approvalRate * 30;
  }
  
  // Validation accuracy
  if (metrics.validationAccuracy > 80) score += 20;
  else if (metrics.validationAccuracy < 50) score -= 20;
  
  // Community participation
  if (metrics.validationsGiven > 10) score += 10;
  
  return Math.max(0, Math.min(100, score));
};

userSchema.methods.addSecurityEvent = function(eventType, details, severity = 'medium') {
  this.securityProfile.securityEvents.push({
    eventType,
    details,
    severity,
    deviceFingerprint: this.securityProfile.primaryDeviceFingerprint
  });
  
  // Keep only last 50 events
  if (this.securityProfile.securityEvents.length > 50) {
    this.securityProfile.securityEvents = this.securityProfile.securityEvents.slice(-50);
  }
  
  // Auto-quarantine for critical events
  if (severity === 'critical') {
    this.securityProfile.quarantineStatus = true;
    this.securityProfile.quarantineReason = `Critical security event: ${eventType}`;
    this.securityProfile.quarantineUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
};

// === PERMISSION METHODS ===

userSchema.methods.hasPermission = function(permission) {
  if (this.userType === 'admin') {
    return this.roleData.admin.permissions.includes(permission) || 
           this.roleData.admin.permissions.includes('super_admin');
  }
  
  if (this.userType === 'police') {
    const policePermissions = {
      'read_only': ['view_reports', 'view_map'],
      'standard': ['view_reports', 'view_map', 'update_status'],
      'supervisor': ['view_reports', 'view_map', 'update_status', 'view_analytics'],
      'chief': ['view_reports', 'view_map', 'update_status', 'view_analytics', 'manage_officers']
    };
    return policePermissions[this.roleData.police.accessLevel]?.includes(permission) || false;
  }
  
  if (this.userType === 'researcher') {
    const researcherPermissions = {
      'basic': ['view_public_data'],
      'full': ['view_public_data', 'view_analytics', 'export_data'],
      'api_access': ['view_public_data', 'view_analytics', 'export_data', 'api_access']
    };
    return researcherPermissions[this.roleData.researcher.accessLevel]?.includes(permission) || false;
  }
  
  // Anonymous users have basic permissions
  return ['view_map', 'submit_report', 'validate_reports'].includes(permission);
};

// === STATIC METHODS ===

userSchema.statics.createAnonymousUser = function(deviceFingerprint) {
  const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return new this({
    userId: anonymousId,
    userType: 'anonymous',
    securityProfile: {
      primaryDeviceFingerprint: deviceFingerprint
    },
    anonymousProfile: {
      sessionId: `sess_${Date.now()}`,
      deviceFingerprint: deviceFingerprint
    }
  });
};

userSchema.statics.findByDeviceFingerprint = function(fingerprint) {
  return this.findOne({
    $or: [
      { 'securityProfile.primaryDeviceFingerprint': fingerprint },
      { 'anonymousProfile.deviceFingerprint': fingerprint }
    ]
  });
};

userSchema.statics.getSecurityInsights = async function() {
  const insights = await this.aggregate([
    {
      $group: {
        _id: '$userType',
        count: { $sum: 1 },
        avgTrustScore: { $avg: '$securityProfile.overallTrustScore' },
        riskDistribution: {
          $push: '$securityProfile.securityRiskLevel'
        }
      }
    }
  ]);
  
  return insights;
};

// === PASSWORD AND AUTHENTICATION METHODS ===

userSchema.methods.setPassword = async function(password) {
  if (this.userType !== 'admin') {
    throw new Error('Password can only be set for admin users');
  }
  
  const saltRounds = 12;
  this.roleData.admin.passwordHash = await bcrypt.hash(password, saltRounds);
};

userSchema.methods.comparePassword = async function(password) {
  if (this.userType !== 'admin' || !this.roleData.admin.passwordHash) {
    return false;
  }
  
  return await bcrypt.compare(password, this.roleData.admin.passwordHash);
};

userSchema.methods.incrementLoginAttempts = function() {
  if (this.userType === 'admin') {
    this.roleData.admin.loginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.roleData.admin.loginAttempts >= 5) {
      this.roleData.admin.accountLocked = true;
      this.roleData.admin.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }
};

userSchema.methods.resetLoginAttempts = function() {
  if (this.userType === 'admin') {
    this.roleData.admin.loginAttempts = 0;
    this.roleData.admin.accountLocked = false;
    this.roleData.admin.lockUntil = null;
    this.roleData.admin.lastLogin = new Date();
  }
};

// === UTILITY METHODS ===

userSchema.methods.isQuarantined = function() {
  if (!this.securityProfile.quarantineStatus) return false;
  
  // Check if quarantine has expired
  if (this.securityProfile.quarantineUntil && new Date() > this.securityProfile.quarantineUntil) {
    this.securityProfile.quarantineStatus = false;
    this.securityProfile.quarantineReason = null;
    this.securityProfile.quarantineUntil = null;
    return false;
  }
  
  return true;
};

userSchema.methods.updateLastSeen = function() {
  this.activityProfile.lastSeen = new Date();
  this.activityProfile.totalSessions += 1;
};

userSchema.methods.addDeviceAssociation = function(deviceFingerprint, deviceType, isPrimary = false) {
  // Check if device already associated
  const existingDevice = this.securityProfile.associatedDevices.find(
    device => device.fingerprintId === deviceFingerprint
  );
  
  if (existingDevice) {
    existingDevice.lastUsed = new Date();
    if (isPrimary) existingDevice.isPrimary = true;
  } else {
    this.securityProfile.associatedDevices.push({
      fingerprintId: deviceFingerprint,
      deviceType: deviceType,
      lastUsed: new Date(),
      trustLevel: 'unknown',
      isPrimary: isPrimary
    });
  }
  
  if (isPrimary) {
    this.securityProfile.primaryDeviceFingerprint = deviceFingerprint;
  }
};

// === MIDDLEWARE ===

// Pre-save middleware for security updates
userSchema.pre('save', async function(next) {
  // Update security profile if device fingerprint changed
  if (this.isModified('securityProfile.primaryDeviceFingerprint')) {
    await this.updateSecurityProfile();
  }
  
  // Device rotation - limit associated devices to 10 most recent
  if (this.securityProfile.associatedDevices.length > 10) {
    // Sort by lastUsed and keep most recent 10
    this.securityProfile.associatedDevices.sort((a, b) => b.lastUsed - a.lastUsed);
    this.securityProfile.associatedDevices = this.securityProfile.associatedDevices.slice(0, 10);
  }
  
  // Update last seen
  this.activityProfile.lastSeen = new Date();
  
  next();
});

// Post-save middleware for logging
userSchema.post('save', function(doc) {
  if (doc.securityProfile.securityRiskLevel === 'high' || doc.securityProfile.securityRiskLevel === 'critical') {
    console.log(`⚠️ High-risk user detected: ${doc.userId} - Risk: ${doc.securityProfile.securityRiskLevel}, Trust: ${doc.securityProfile.overallTrustScore}`);
  }
});

// Post-save middleware for automatic quarantine cleanup
userSchema.post('save', function(doc) {
  // Auto-cleanup expired quarantines
  if (doc.securityProfile.quarantineStatus && 
      doc.securityProfile.quarantineUntil && 
      new Date() > doc.securityProfile.quarantineUntil) {
    
    doc.securityProfile.quarantineStatus = false;
    doc.securityProfile.quarantineReason = null;
    doc.securityProfile.quarantineUntil = null;
    doc.save(); // This won't trigger infinite loop due to the condition
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;