// === backend/src/models/Report.js (ENHANCED & FIXED VERSION) ===
// Enhanced Report Model with Female Safety Integration and Background Processing
// Combines performance optimization with comprehensive safety features

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Enhanced incident types with female safety categories
  type: {
    type: String,
    required: true,
    enum: [
      // Original incident types
      'chadabaji',           // Political extortion
      'teen_gang',           // Youth gang violence  
      'chintai',             // Harassment/extortion
      'political_harassment', // Political harassment
      'other',               // General criminal activity
      
      // Female Safety Incident Types (RESTORED)
      'eve_teasing',         // Street harassment of women
      'stalking',            // Following/tracking women
      'inappropriate_touch', // Physical harassment
      'verbal_harassment',   // Catcalling, inappropriate comments
      'unsafe_transport',    // Harassment in rickshaw/bus/ride-sharing
      'workplace_harassment',// Professional harassment
      'domestic_incident',   // Family/domestic related (anonymous)
      'unsafe_area_women'    // Areas unsafe specifically for women
    ],
  },
  
  description: {
    type: String,
    required: true,
    maxLength: 2000
  },
  
  // Enhanced location with background obfuscation
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true, index: '2dsphere' },
    address: String,
    source: { type: String, enum: ['GPS', 'Manual', 'Estimated', 'Search', 'Map Click'], default: 'GPS' },
    accuracy: Number,
    obfuscated: { type: Boolean, default: false },
    originalCoordinates: { type: [Number], select: false }, // Hidden by default, admin only
    withinBangladesh: { type: Boolean, default: true },
    
    // Enhanced location context for female safety (RESTORED)
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
    required: true,
    min: 1,
    max: 5,
  },
  
  media: [{
    type: { type: String, enum: ['image', 'video', 'audio'] },
    url: String,
    thumbnail: String,
    metadata: {
      size: Number,
      format: String,
      duration: Number,
      resolution: String
    }
  }],
  
  // Submission metadata
  submittedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userType: { type: String, enum: ['anonymous', 'admin'], default: 'anonymous' },
    deviceFingerprint: { type: String, index: true },
    ipHash: String,
    isAnonymous: { type: Boolean, default: true }
  },
  
  // Report lifecycle
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged', 'under_review', 'archived', 'verified'],
    default: 'pending',
  },
  
  moderatedAt: Date,
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderationReason: String,
  
  // Female Safety Specific Fields (RESTORED)
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
  },
  
  timeOfDayRisk: {
    type: String,
    enum: ['early_morning', 'morning', 'afternoon', 'evening', 'night', 'late_night'],
    default: function() {
      const hour = new Date().getHours();
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
    requiresFemaleModerator: { 
      type: Boolean, 
      default: function() { return this.genderSensitive; }
    }
  },
  
  // Background processing tracking
  processingStatus: {
    isProcessing: { type: Boolean, default: true },
    immediatePhaseCompleted: { type: Boolean, default: false },
    fastPhaseCompleted: { type: Boolean, default: false },
    analysisPhaseCompleted: { type: Boolean, default: false },
    enrichmentPhaseCompleted: { type: Boolean, default: false },
    allPhasesCompleted: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now },
    processingErrors: [String],
    totalProcessingTime: Number,
    backgroundProcessingRequired: { type: Boolean, default: true }
  },
  
  // Deduplication (populated by background processor)
  deduplication: {
    contentHash: {
      type: String,
      index: true,
      sparse: true
    },
    
    temporalHash: {
      type: String,
      index: true,
      sparse: true
    },
    
    normalizedContent: {
      description: String,
      roundedCoordinates: [Number],
      contentSignature: String
    },
    
    duplicateCheck: {
      isDuplicate: { type: Boolean, default: false },
      duplicateType: { 
        type: String, 
        enum: ['content', 'temporal', 'rapid', 'location', 'none'],
        default: 'none'
      },
      confidence: { type: Number, min: 0, max: 100, default: 0 },
      originalReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
      checkedAt: Date,
      checkSource: { type: String, enum: ['cache', 'database', 'temporal', 'middleware'] }
    },
    
    relatedReports: [{
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
      similarity: { type: Number, min: 0, max: 100 },
      relationType: { 
        type: String, 
        enum: ['duplicate', 'similar_location', 'similar_content', 'same_user', 'temporal_cluster']
      },
      detectedAt: { type: Date, default: Date.now }
    }]
  },
  
  // Gender sensitivity and anonymity
  anonymous: { type: Boolean, default: true },
  
  // Enhanced moderation data
  moderation: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent', 'critical'],
      default: function() {
        if (this.genderSensitive) return 'high';
        if (this.severity >= 4) return 'high';
        return 'medium';
      }
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    flagReason: String,
    internalNotes: String,
    autoModerationScore: { type: Number, default: 50 },
    requiresHumanReview: { 
      type: Boolean, 
      default: function() { 
        return this.genderSensitive || this.severity >= 4; 
      }
    },
    isDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
    duplicateHandling: {
      type: String,
      enum: ['auto_rejected', 'flagged_for_review', 'merged', 'kept_separate']
    },
    femaleModeratorRequired: { 
      type: Boolean, 
      default: function() { return this.genderSensitive; }
    }
  },
  
  // Enhanced security flags
  securityFlags: {
    suspiciousLocation: { type: Boolean, default: false },
    crossBorderReport: { type: Boolean, default: false },
    potentialSpam: { type: Boolean, default: false },
    coordinatedAttack: { type: Boolean, default: false },
    behaviorAnomalous: { type: Boolean, default: false },
    deviceSuspicious: { type: Boolean, default: false },
    contentInauthentic: { type: Boolean, default: false },
    politicallyMotivated: { type: Boolean, default: false },
    massReportingCampaign: { type: Boolean, default: false },
    rapidSubmission: { type: Boolean, default: false },
    possibleDuplicate: { type: Boolean, default: false },
    contentSimilarity: { type: Boolean, default: false },
    
    // Female safety specific flags
    requiresFemaleValidation: { type: Boolean, default: false },
    enhancedPrivacyRequired: { type: Boolean, default: false }
  },
  
  // Security scoring
  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  
  // Enhanced threat intelligence
  threatIntelligence: {
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    threatVectors: [String],
    confidenceScore: { type: Number, min: 0, max: 100 },
    mitigationApplied: [String],
    lastAssessmentAt: Date
  },
  
  // Behavioral analysis (RESTORED)
  behaviorSignature: {
    submissionSpeed: Number,
    deviceType: String,
    browserFingerprint: String,
    interactionPattern: String,
    locationConsistency: Number,
    humanBehaviorScore: { type: Number, default: 50 },
    formCompletionPattern: String,
    mouseMovementPattern: String
  },
  
  // Community validation (RESTORED)
  communityValidation: {
    validationsReceived: { type: Number, default: 0 },
    validationsPositive: { type: Number, default: 0 },
    validationsNegative: { type: Number, default: 0 },
    communityTrustScore: { type: Number, default: 0 },
    lastValidationAt: Date,
    requiresFemaleValidators: { 
      type: Boolean, 
      default: function() { return this.genderSensitive; }
    },
    femaleValidationsReceived: { type: Number, default: 0 },
    validationHistory: [{
      validatorId: String,
      validatorGender: String,
      isPositive: Boolean,
      timestamp: { type: Date, default: Date.now },
      validatorTrustScore: Number
    }]
  }
}, {
  timestamps: true
});

// CRITICAL FIX: Enhanced pre-save middleware with immediate obfuscation for sensitive reports
reportSchema.pre('save', function(next) {
  if (this.isNew) {
    // 1. IMMEDIATE PRIVACY PROTECTION for sensitive reports
    if (this.genderSensitive && this.location.coordinates && !this.location.obfuscated) {
      // Store original coordinates for admin use
      this.location.originalCoordinates = [...this.location.coordinates];
      
      // ENHANCED obfuscation for female safety incidents (±200m instead of ±100m)
      const obfuscationRadius = 0.002; // ~200 meters for sensitive incidents
      this.location.coordinates[0] += (Math.random() - 0.5) * obfuscationRadius;
      this.location.coordinates[1] += (Math.random() - 0.5) * obfuscationRadius;
      
      this.location.obfuscated = true;
      this.securityFlags.enhancedPrivacyRequired = true;
      this.securityFlags.requiresFemaleValidation = true;
      this.moderation.requiresSpecialHandling = true;
      this.moderation.femaleModeratorRequired = true;
      
      console.log(`🔒 Immediate obfuscation applied for sensitive report: ${this._id}`);
    } else if (this.location.coordinates && !this.location.obfuscated) {
      // Store original for non-sensitive reports too
      this.location.originalCoordinates = [...this.location.coordinates];
      // Background processing will handle standard obfuscation
    }
    
    // 2. Set processing requirements
    this.processingStatus.isProcessing = true;
    this.processingStatus.backgroundProcessingRequired = true;
    this.processingStatus.lastUpdated = new Date();
    
    // 3. Basic security flags for immediate filtering
    if (this.description && this.description.length < 10) {
      this.securityFlags.potentialSpam = true;
      this.securityScore = 30;
    }
    
    // 4. Set priority based on content
    if (this.genderSensitive) {
      this.moderation.priority = this.severity >= 4 ? 'urgent' : 'high';
    } else if (this.severity >= 4) {
      this.moderation.priority = 'high';
    }
  }
  
  next();
});

// Post-save hook to trigger background processing
reportSchema.post('save', async function(doc) {
  if (doc.processingStatus.backgroundProcessingRequired && !doc.processingStatus.immediatePhaseCompleted) {
    try {
      const { queueReportForProcessing } = require('../middleware/reportProcessor');
      
      const phases = ['immediate', 'fast', 'analysis'];
      
      // Add enrichment for high-priority reports
      if (doc.severity >= 4 || doc.genderSensitive) {
        phases.push('enrichment');
      }
      
      await queueReportForProcessing(doc._id, phases);
      console.log(`🚀 Queued report ${doc._id} for background processing`);
      
    } catch (error) {
      console.error(`❌ Failed to queue report ${doc._id} for processing:`, error);
      
      try {
        await this.model('Report').findByIdAndUpdate(doc._id, {
          $set: {
            'processingStatus.processingErrors': [error.message],
            'processingStatus.backgroundProcessingRequired': false
          }
        });
      } catch (updateError) {
        console.error('Failed to update processing error status:', updateError);
      }
    }
  }
});

// RESTORED: Method to calculate security score
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

// RESTORED: Method to check if report needs enhanced moderation
reportSchema.methods.needsEnhancedModeration = function() {
  return this.genderSensitive || 
         this.severity >= 4 || 
         this.securityScore < 40 || 
         this.securityFlags.crossBorderReport ||
         this.threatIntelligence.riskLevel === 'high' ||
         this.threatIntelligence.riskLevel === 'critical';
};

// RESTORED: Method to get appropriate validators
reportSchema.methods.getValidatorRequirements = function() {
  return {
    femaleOnly: this.genderSensitive && this.securityFlags.requiresFemaleValidation,
    minimumTrustScore: this.genderSensitive ? 70 : 60,
    geographicProximity: this.genderSensitive ? 500 : 1000, // meters
    minimumValidations: this.genderSensitive ? 3 : 2,
    adminReviewRequired: this.needsEnhancedModeration(),
    requiresFemaleValidators: this.communityValidation.requiresFemaleValidators
  };
};

// RESTORED: Community validation method
reportSchema.methods.addCommunityValidation = function(isPositive, validatorInfo = {}) {
  this.communityValidation.validationsReceived += 1;
  
  if (isPositive) {
    this.communityValidation.validationsPositive += 1;
  } else {
    this.communityValidation.validationsNegative += 1;
  }
  
  // Track female validators for sensitive reports
  if (validatorInfo.gender === 'female' && this.genderSensitive) {
    this.communityValidation.femaleValidationsReceived += 1;
  }
  
  // Add to validation history
  this.communityValidation.validationHistory.push({
    validatorId: validatorInfo.validatorId || 'anonymous',
    validatorGender: validatorInfo.gender || 'unknown',
    isPositive,
    timestamp: new Date(),
    validatorTrustScore: validatorInfo.trustScore || 50
  });
  
  // Calculate community trust score
  const positiveRatio = this.communityValidation.validationsPositive / 
                       this.communityValidation.validationsReceived;
  this.communityValidation.communityTrustScore = Math.round(positiveRatio * 100);
  
  this.communityValidation.lastValidationAt = new Date();
  
  // Recalculate security score with new validation data
  this.calculateSecurityScore();
};

// STATIC METHODS for background processing
reportSchema.statics.findPendingProcessing = function(phase = null) {
  const query = {
    'processingStatus.isProcessing': true,
    'processingStatus.allPhasesCompleted': false
  };
  
  if (phase) {
    query[`processingStatus.${phase}PhaseCompleted`] = false;
  }
  
  return this.find(query)
    .sort({ createdAt: 1 })
    .limit(100);
};

reportSchema.statics.markPhaseCompleted = async function(reportId, phase) {
  const update = {
    [`processingStatus.${phase}PhaseCompleted`]: true,
    'processingStatus.lastUpdated': new Date()
  };
  
  const report = await this.findById(reportId);
  if (report) {
    const allComplete = 
      (phase === 'immediate' || report.processingStatus.immediatePhaseCompleted) &&
      (phase === 'fast' || report.processingStatus.fastPhaseCompleted) &&
      (phase === 'analysis' || report.processingStatus.analysisPhaseCompleted);
    
    if (allComplete) {
      update['processingStatus.allPhasesCompleted'] = true;
      update['processingStatus.isProcessing'] = false;
    }
  }
  
  return this.findByIdAndUpdate(reportId, { $set: update });
};

// RESTORED: Find potential duplicates
reportSchema.statics.findPotentialDuplicates = function(contentHash, timeRange = 24 * 60 * 60 * 1000) {
  const since = new Date(Date.now() - timeRange);
  
  return this.find({
    'deduplication.contentHash': contentHash,
    createdAt: { $gte: since },
    status: { $ne: 'rejected' }
  }).select('_id type description location severity createdAt submittedBy deduplication');
};

// RESTORED: Find reports needing female validation
reportSchema.statics.findNeedingFemaleValidation = function() {
  return this.find({
    genderSensitive: true,
    'securityFlags.requiresFemaleValidation': true,
    status: { $in: ['pending', 'approved'] },
    'communityValidation.validationsReceived': { $lt: 3 }
  }).sort({ createdAt: -1 });
};

// RESTORED: Coordinated attack detection
reportSchema.statics.detectCoordinatedAttacks = async function(timeWindow = 3600000) {
  const recentReports = await this.find({
    createdAt: { $gte: new Date(Date.now() - timeWindow) }
  });
  
  const locationClusters = {};
  const suspiciousPatterns = [];
  
  recentReports.forEach(report => {
    const key = `${Math.round(report.location.coordinates[1] * 100)}_${Math.round(report.location.coordinates[0] * 100)}`;
    
    if (!locationClusters[key]) {
      locationClusters[key] = [];
    }
    locationClusters[key].push(report);
  });
  
  Object.entries(locationClusters).forEach(([location, reports]) => {
    if (reports.length >= 5) {
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

// RESTORED: Female safety statistics
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

// Processing statistics
reportSchema.statics.getProcessingStats = async function() {
  const pipeline = [
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        processing: {
          $sum: { $cond: ['$processingStatus.isProcessing', 1, 0] }
        },
        completed: {
          $sum: { $cond: ['$processingStatus.allPhasesCompleted', 1, 0] }
        },
        immediateComplete: {
          $sum: { $cond: ['$processingStatus.immediatePhaseCompleted', 1, 0] }
        },
        fastComplete: {
          $sum: { $cond: ['$processingStatus.fastPhaseCompleted', 1, 0] }
        },
        analysisComplete: {
          $sum: { $cond: ['$processingStatus.analysisPhaseCompleted', 1, 0] }
        },
        enrichmentComplete: {
          $sum: { $cond: ['$processingStatus.enrichmentPhaseCompleted', 1, 0] }
        },
        withErrors: {
          $sum: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$processingStatus.processingErrors', []] } }, 0] },
              1,
              0
            ]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

// Instance methods for processing progress
reportSchema.methods.isProcessingComplete = function() {
  return this.processingStatus.allPhasesCompleted;
};

reportSchema.methods.isReadyForPublic = function() {
  return (
    this.processingStatus.fastPhaseCompleted &&
    this.status === 'approved' &&
    !this.securityFlags.potentialSpam
  );
};

reportSchema.methods.getProcessingProgress = function() {
  const phases = ['immediate', 'fast', 'analysis', 'enrichment'];
  const completed = phases.filter(phase => 
    this.processingStatus[`${phase}PhaseCompleted`]
  );
  
  return {
    completed: completed.length,
    total: phases.length,
    percentage: Math.round((completed.length / phases.length) * 100),
    phases: {
      immediate: this.processingStatus.immediatePhaseCompleted,
      fast: this.processingStatus.fastPhaseCompleted,
      analysis: this.processingStatus.analysisPhaseCompleted,
      enrichment: this.processingStatus.enrichmentPhaseCompleted
    },
    isComplete: this.processingStatus.allPhasesCompleted,
    errors: this.processingStatus.processingErrors || []
  };
};

// RESTORED: Virtuals
reportSchema.virtual('incidentTypeLabel').get(function() {
  const labels = {
    'chadabaji': 'Chadabaji (Extortion)',
    'teen_gang': 'Teen Gang Activity',
    'chintai': 'Chintai (Harassment)',
    'political_harassment': 'Political Harassment',
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

// Create indexes for efficient querying
reportSchema.index({ 
  'processingStatus.isProcessing': 1, 
  'processingStatus.allPhasesCompleted': 1,
  'createdAt': 1 
});

reportSchema.index({ 
  'genderSensitive': 1,
  'communityValidation.requiresFemaleValidators': 1,
  'status': 1
});

reportSchema.index({
  'deduplication.contentHash': 1,
  'createdAt': 1
});

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;