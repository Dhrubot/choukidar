// === backend/src/models/Report.js (ENHANCED VERSION) ===
// Enhanced Report Model with Female Safety Integration and Advanced Security
// Integrates with User and DeviceFingerprint models for comprehensive tracking

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Enhanced incident types with female safety categories
  type: {
    type: String,
    enum: [
      // Original incident types
      'chadabaji',           // Political extortion
      'teen_gang',           // Youth gang violence  
      'chintai',             // Harassment/extortion
      'other',               // General criminal activity
      
      // NEW: Female Safety Incident Types
      'eve_teasing',         // Street harassment of women
      'stalking',            // Following/tracking women
      'inappropriate_touch', // Physical harassment
      'verbal_harassment',   // Catcalling, inappropriate comments
      'unsafe_transport',    // Harassment in rickshaw/bus/ride-sharing
      'workplace_harassment',// Professional harassment
      'domestic_incident',   // Family/domestic related (anonymous)
      'unsafe_area_women'    // Areas unsafe specifically for women
    ],
    required: true,
    index: true
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Enhanced location data with female safety considerations
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[1] >= -90 && coords[1] <= 90 && // Valid latitude
                 coords[0] >= -180 && coords[0] <= 180; // Valid longitude
        },
        message: 'Invalid coordinates'
      }
    },
    address: String,
    obfuscated: {
      type: Boolean,
      default: true
    },
    // Enhanced location metadata
    source: {
      type: String,
      enum: ['GPS', 'Search', 'Map Click', 'Manual', 'default'],
      default: 'default'
    },
    withinBangladesh: {
      type: Boolean,
      default: true,
      index: true
    },
    // Store original coordinates privately for admin use
    originalCoordinates: {
      type: [Number],
      select: false // Hidden by default in queries
    },
    // Enhanced location context for female safety
    locationContext: {
      publicSpace: { type: Boolean, default: true },
      transportRelated: { type: Boolean, default: false },
      marketArea: { type: Boolean, default: false },
      educationalInstitution: { type: Boolean, default: false },
      workplaceRelated: { type: Boolean, default: false },
      residentialArea: { type: Boolean, default: false },
      isolatedArea: { type: Boolean, default: false }
    }
  },
  
  severity: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged', 'under_review'],
    default: 'pending',
    index: true
  },
  
  media: [{
    type: String, // URLs to uploaded files
  }],
  
  anonymous: {
    type: Boolean,
    default: true
  },
  
  // Enhanced user and device tracking
  submittedBy: {
    userId: { type: String, ref: 'User' },
    userType: { type: String, default: 'anonymous' },
    deviceFingerprint: { type: String, ref: 'DeviceFingerprint', index: true },
    ipHash: String, // For rate limiting, not stored as plain IP
    sessionId: String
  },
  
  // Female Safety Specific Fields
  genderSensitive: {
    type: Boolean,
    default: function() {
      const femaleIncidentTypes = [
        'eve_teasing', 'stalking', 'inappropriate_touch', 
        'verbal_harassment', 'unsafe_transport', 'workplace_harassment',
        'domestic_incident', 'unsafe_area_women'
      ];
      return femaleIncidentTypes.includes(this.type);
    },
    index: true
  },
  
  timeOfDayRisk: {
    type: String,
    enum: ['early_morning', 'morning', 'afternoon', 'evening', 'night', 'late_night'],
    default: function() {
      const hour = new Date(this.timestamp).getHours();
      if (hour >= 4 && hour < 8) return 'early_morning';
      if (hour >= 8 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      if (hour >= 17 && hour < 20) return 'evening';
      if (hour >= 20 && hour < 24) return 'night';
      return 'late_night';
    }
  },
  
  culturalContext: {
    conservativeArea: { type: Boolean, default: false },
    religiousContext: { type: Boolean, default: false },
    familyRelated: { type: Boolean, default: false },
    requiresFemaleModerator: { type: Boolean, default: false }
  },
  
  // Enhanced moderation data
  moderation: {
    moderatedBy: String,
    moderatedAt: Date,
    moderationReason: String,
    priorityLevel: {
      type: String,
      enum: ['low', 'normal', 'high', 'critical'],
      default: function() {
        // Female safety incidents get higher priority
        if (this.genderSensitive) return 'high';
        if (this.severity >= 4) return 'high';
        return 'normal';
      }
    },
    requiresSpecialHandling: { type: Boolean, default: false }
  },
  
  // Enhanced security and analytics fields
  reportingCountry: {
    type: String,
    default: 'BD' // ISO country code
  },
  
  // Enhanced security flags
  securityFlags: {
    suspiciousLocation: { type: Boolean, default: false },
    crossBorderReport: { type: Boolean, default: false },
    potentialSpam: { type: Boolean, default: false },
    
    // NEW: Advanced security flags
    coordinatedAttack: { type: Boolean, default: false },
    behaviorAnomalous: { type: Boolean, default: false },
    deviceSuspicious: { type: Boolean, default: false },
    contentInauthentic: { type: Boolean, default: false },
    politicallyMotivated: { type: Boolean, default: false },
    massReportingCampaign: { type: Boolean, default: false },
    
    // Female safety specific flags
    requiresFemaleValidation: { type: Boolean, default: false },
    enhancedPrivacyRequired: { type: Boolean, default: false }
  },
  
  // Security scoring and threat assessment
  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50 // Higher = more trustworthy
  },
  
  threatIntelligence: {
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    threatVectors: [String], // ['botnet', 'state_actor', 'spam_farm']
    confidenceScore: Number, // 0-100 confidence in threat assessment
    mitigationApplied: [String] // Applied countermeasures
  },
  
  // Behavioral analysis data
  behaviorSignature: {
    submissionSpeed: Number,        // Time taken to fill form (seconds)
    deviceType: String,             // Mobile, desktop, etc.
    browserFingerprint: String,     // Browser characteristics
    interactionPattern: String,     // Human vs bot indicators
    locationConsistency: Number,    // GPS vs manual location consistency (0-100)
    humanBehaviorScore: { type: Number, default: 50 } // Confidence this is human (0-100)
  },
  
  // Community validation data
  communityValidation: {
    validationsReceived: { type: Number, default: 0 },
    validationsPositive: { type: Number, default: 0 },
    validationsNegative: { type: Number, default: 0 },
    communityTrustScore: { type: Number, default: 0 },
    lastValidationAt: Date,
    requiresFemaleValidators: { type: Boolean, default: false }
  }
}, {
  timestamps: true
  // REMOVED: Schema-level indexes - now managed centrally by optimizedIndexes.js
  // This prevents duplicate index creation and provides better management
});

// Enhanced pre-save middleware for location obfuscation and security analysis
reportSchema.pre('save', function(next) {
  // Store original coordinates for admin use
  if (this.isNew && this.location.coordinates) {
    this.location.originalCoordinates = [...this.location.coordinates];
    
    // Enhanced obfuscation for female safety incidents
    if (this.genderSensitive) {
      // Larger obfuscation radius for sensitive incidents (±200m instead of ±100m)
      const obfuscationRadius = 0.002; // ~200 meters
      this.location.coordinates[0] += (Math.random() - 0.5) * obfuscationRadius;
      this.location.coordinates[1] += (Math.random() - 0.5) * obfuscationRadius;
      
      // Set enhanced privacy flags
      this.securityFlags.enhancedPrivacyRequired = true;
      this.securityFlags.requiresFemaleValidation = true;
      this.moderation.requiresSpecialHandling = true;
    } else {
      // Standard obfuscation (±100m)
      const obfuscationRadius = 0.001; // ~100 meters
      this.location.coordinates[0] += (Math.random() - 0.5) * obfuscationRadius;
      this.location.coordinates[1] += (Math.random() - 0.5) * obfuscationRadius;
    }
  }
  
  // Enhanced Bangladesh boundary detection
  if (this.location.coordinates) {
    const [lng, lat] = this.location.coordinates;
    const bangladeshBounds = {
      minLat: 20.670883, maxLat: 26.446526,
      minLng: 88.097888, maxLng: 92.682899
    };
    
    this.location.withinBangladesh = (
      lat >= bangladeshBounds.minLat && lat <= bangladeshBounds.maxLat &&
      lng >= bangladeshBounds.minLng && lng <= bangladeshBounds.maxLng
    );
    
    if (!this.location.withinBangladesh) {
      this.securityFlags.crossBorderReport = true;
      this.securityFlags.suspiciousLocation = true;
      this.threatIntelligence.riskLevel = 'high';
    }
  }
  
  // Enhanced content analysis for spam detection
  if (this.description) {
    // Check for repeated characters (spam indicator)
    if (/(.)\1{10,}/.test(this.description)) {
      this.securityFlags.potentialSpam = true;
    }
    
    // Check for no-letters content (bot indicator)
    if (/^[^a-zA-Z]*$/.test(this.description) && this.description.length > 5) {
      this.securityFlags.potentialSpam = true;
      this.securityFlags.contentInauthentic = true;
    }
    
    // Enhanced spam detection for short descriptions
    if (this.description.length < 10) {
      this.securityFlags.potentialSpam = true;
    }
  }
  
  // Calculate security score based on multiple factors
  this.calculateSecurityScore();
  
  next();
});

// Method to calculate security score
reportSchema.methods.calculateSecurityScore = function() {
  let score = 50; // Start with neutral score
  
  // Positive factors
  if (this.location.withinBangladesh) score += 20;
  if (this.behaviorSignature.humanBehaviorScore > 70) score += 15;
  if (this.description.length >= 20) score += 10;
  if (this.location.source === 'GPS') score += 10;
  if (this.communityValidation.communityTrustScore > 70) score += 15;
  
  // Negative factors
  if (this.securityFlags.crossBorderReport) score -= 30;
  if (this.securityFlags.potentialSpam) score -= 25;
  if (this.securityFlags.behaviorAnomalous) score -= 20;
  if (this.securityFlags.coordinatedAttack) score -= 40;
  if (this.behaviorSignature.humanBehaviorScore < 30) score -= 30;
  if (this.threatIntelligence.riskLevel === 'critical') score -= 50;
  if (this.threatIntelligence.riskLevel === 'high') score -= 25;
  
  this.securityScore = Math.max(0, Math.min(100, score));
  return this.securityScore;
};

// Method to check if report needs enhanced moderation
reportSchema.methods.needsEnhancedModeration = function() {
  return this.genderSensitive || 
         this.severity >= 4 || 
         this.securityScore < 40 || 
         this.securityFlags.crossBorderReport ||
         this.threatIntelligence.riskLevel === 'high' ||
         this.threatIntelligence.riskLevel === 'critical';
};

// Method to get appropriate validators for this report
reportSchema.methods.getValidatorRequirements = function() {
  return {
    femaleOnly: this.genderSensitive && this.securityFlags.requiresFemaleValidation,
    minimumTrustScore: this.genderSensitive ? 70 : 60,
    geographicProximity: this.genderSensitive ? 500 : 1000, // meters
    minimumValidations: this.genderSensitive ? 3 : 2,
    adminReviewRequired: this.needsEnhancedModeration()
  };
};

// Method to update community validation
reportSchema.methods.addCommunityValidation = function(isPositive, validatorInfo = {}) {
  this.communityValidation.validationsReceived += 1;
  
  if (isPositive) {
    this.communityValidation.validationsPositive += 1;
  } else {
    this.communityValidation.validationsNegative += 1;
  }
  
  // Calculate community trust score
  const positiveRatio = this.communityValidation.validationsPositive / 
                       this.communityValidation.validationsReceived;
  this.communityValidation.communityTrustScore = Math.round(positiveRatio * 100);
  
  this.communityValidation.lastValidationAt = new Date();
  
  // Recalculate security score with new validation data
  this.calculateSecurityScore();
};

// Static method to find reports needing female validation
reportSchema.statics.findNeedingFemaleValidation = function() {
  return this.find({
    genderSensitive: true,
    'securityFlags.requiresFemaleValidation': true,
    status: { $in: ['pending', 'approved'] },
    'communityValidation.validationsReceived': { $lt: 3 }
  }).sort({ timestamp: -1 });
};

// Static method to get security insights
reportSchema.statics.getSecurityInsights = async function() {
  const insights = await this.aggregate([
    {
      $group: {
        _id: {
          genderSensitive: '$genderSensitive',
          riskLevel: '$threatIntelligence.riskLevel'
        },
        count: { $sum: 1 },
        avgSecurityScore: { $avg: '$securityScore' },
        flaggedReports: {
          $sum: {
            $cond: [
              {
                $or: [
                  '$securityFlags.crossBorderReport',
                  '$securityFlags.potentialSpam',
                  '$securityFlags.coordinatedAttack'
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  return insights;
};

// Static method to detect coordinated attacks
reportSchema.statics.detectCoordinatedAttacks = async function(timeWindow = 3600000) {
  const recentReports = await this.find({
    timestamp: { $gte: new Date(Date.now() - timeWindow) }
  });
  
  // Group by location clusters
  const locationClusters = {};
  const suspiciousPatterns = [];
  
  recentReports.forEach(report => {
    const key = `${Math.round(report.location.coordinates[1] * 100)}_${Math.round(report.location.coordinates[0] * 100)}`;
    
    if (!locationClusters[key]) {
      locationClusters[key] = [];
    }
    locationClusters[key].push(report);
  });
  
  // Analyze clusters for suspicious patterns
  Object.entries(locationClusters).forEach(([location, reports]) => {
    if (reports.length >= 5) { // 5+ reports in same area within time window
      const uniqueDevices = new Set(reports.map(r => r.submittedBy.deviceFingerprint));
      const avgSecurityScore = reports.reduce((sum, r) => sum + r.securityScore, 0) / reports.length;
      
      if (uniqueDevices.size >= 3 && avgSecurityScore < 60) {
        suspiciousPatterns.push({
          location,
          reportCount: reports.length,
          uniqueDevices: uniqueDevices.size,
          avgSecurityScore,
          suspicionLevel: 'high',
          reports: reports.map(r => r._id)
        });
      }
    }
  });
  
  return suspiciousPatterns;
};

// Static method to get female safety statistics
reportSchema.statics.getFemaleSafetyStats = async function() {
  const stats = await this.aggregate([
    {
      $match: { genderSensitive: true }
    },
    {
      $group: {
        _id: {
          type: '$type',
          timeOfDay: '$timeOfDayRisk'
        },
        count: { $sum: 1 },
        avgSeverity: { $avg: '$severity' },
        approvedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return stats;
};

// Virtual for getting human-readable incident type
reportSchema.virtual('incidentTypeLabel').get(function() {
  const labels = {
    'chadabaji': 'Chadabaji (Extortion)',
    'teen_gang': 'Teen Gang Activity',
    'chintai': 'Chintai (Harassment)',
    'other': 'Other Criminal Activity',
    'eve_teasing': 'Eve Teasing',
    'stalking': 'Stalking',
    'inappropriate_touch': 'Inappropriate Touch',
    'verbal_harassment': 'Verbal Harassment',
    'unsafe_transport': 'Unsafe Transport',
    'workplace_harassment': 'Workplace Harassment',
    'domestic_incident': 'Domestic Incident',
    'unsafe_area_women': 'Unsafe Area for Women'
  };
  
  return labels[this.type] || this.type;
});

// Virtual for getting risk assessment
reportSchema.virtual('riskAssessment').get(function() {
  let level = 'low';
  let factors = [];
  
  if (this.securityScore < 30) {
    level = 'high';
    factors.push('Low security score');
  }
  
  if (this.securityFlags.crossBorderReport) {
    level = 'high';
    factors.push('Cross-border report');
  }
  
  if (this.securityFlags.coordinatedAttack) {
    level = 'critical';
    factors.push('Coordinated attack detected');
  }
  
  if (this.genderSensitive && this.severity >= 4) {
    level = level === 'low' ? 'medium' : level;
    factors.push('High-severity gender-sensitive incident');
  }
  
  return { level, factors };
});

// Post-save middleware for logging and notifications
reportSchema.post('save', function(doc) {
  // Log high-risk reports
  if (doc.securityScore < 30 || doc.threatIntelligence.riskLevel === 'high') {
    console.log(`⚠️ High-risk report detected: ${doc._id} - Score: ${doc.securityScore}, Risk: ${doc.threatIntelligence.riskLevel}`);
  }
  
  // Log female safety incidents
  if (doc.genderSensitive && doc.isNew) {
    console.log(`🚺 Female safety incident reported: ${doc.type} - Severity: ${doc.severity}`);
  }
  
  // Log cross-border reports
  if (doc.securityFlags.crossBorderReport) {
    console.log(`🌐 Cross-border report detected: ${doc._id} - Location: ${doc.location.coordinates}`);
  }
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;