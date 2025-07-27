// === src/middleware/reportProcessor.js (REFACTORED FOR DISTRIBUTED PROCESSING) ===
// Enhanced Report Processor with Bangladesh-Scale Distributed Queue Integration
// Handles 25,000+ concurrent users with intelligent processing tiers

const crypto = require('crypto');
const { productionLogger } = require('../utils/productionLogger');

class ReportProcessor {
  constructor() {
    this.isInitialized = false;
    this.distributedQueue = null;
    this.fallbackQueue = null;

    // Processing statistics
    this.stats = {
      processed: 0,
      emergency: 0,
      standard: 0,
      background: 0,
      failed: 0,
      avgProcessingTime: 0,
      lastResetTime: Date.now()
    };

    // Bangladesh-specific processing config
    this.bangladeshConfig = {
      // Geographic boundaries for Bangladesh
      bounds: {
        minLat: 20.670883,
        maxLat: 26.446526,
        minLng: 88.01200,
        maxLng: 92.673668
      },

      // Priority zones within Bangladesh
      priorityZones: [
        { name: 'Dhaka', lat: 23.8103, lng: 90.4125, radius: 50 },
        { name: 'Chittagong', lat: 22.3569, lng: 91.7832, radius: 30 },
        { name: 'Sylhet', lat: 24.8949, lng: 91.8687, radius: 25 },
        { name: 'Rajshahi', lat: 24.3636, lng: 88.6241, radius: 25 },
        { name: 'Khulna', lat: 22.8456, lng: 89.5403, radius: 25 }
      ],

      // Female safety zones (universities, markets, transport hubs)
      femaleSafetyZones: [
        { name: 'Dhaka University Area', lat: 23.7269, lng: 90.3951, radius: 5 },
        { name: 'New Market Area', lat: 23.7315, lng: 90.3815, radius: 3 },
        { name: 'Sadarghat Terminal', lat: 23.7104, lng: 90.4074, radius: 2 }
      ]
    };

    // Processing tiers for Bangladesh scale
    this.processingTiers = {
      // CRITICAL: Immediate processing (female safety, violence)
      emergency: {
        priority: 1,
        maxProcessingTime: 5000,  // 5 seconds max
        queue: 'emergencyReports',
        description: 'Female safety, violence, immediate threats'
      },

      // HIGH: Standard safety reports
      standard: {
        priority: 2,
        maxProcessingTime: 15000, // 15 seconds max
        queue: 'standardReports',
        description: 'Safety concerns, harassment, theft'
      },

      // MEDIUM: Background analysis
      background: {
        priority: 3,
        maxProcessingTime: 60000, // 1 minute max
        queue: 'backgroundTasks',
        description: 'Security analysis, trend detection'
      },

      // LOW: Analytics and insights
      analytics: {
        priority: 4,
        maxProcessingTime: 300000, // 5 minutes max
        queue: 'analyticsQueue',
        description: 'Data aggregation, insights'
      }

    };
    this.emergencyProcessingSet = new Set(); // Track emergency reports being processed
    this.recentlyProcessed = new Map(); // Cache recently processed reports
    this.processingReports = new Map(); // Track currently processing reports

    // Cleanup old entries every 5 minutes
    setInterval(() => {
      if (this.emergencyProcessingSet.size > 100) {
        console.log(`🧹 Cleaning up emergency processing set (${this.emergencyProcessingSet.size} entries)`);
        this.emergencyProcessingSet.clear();
      }

      // Clear old cached results
      const now = Date.now();
      for (const [reportId, result] of this.recentlyProcessed.entries()) {
        if (now - result.timestamp > 5 * 60 * 1000) { // 5 minutes old
          this.recentlyProcessed.delete(reportId);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Initialize the report processor with distributed queue
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Bangladesh-scale report processor...');

      // Initialize distributed queue service
      await this.initializeDistributedQueue();

      // Initialize fallback mechanisms
      await this.initializeFallbackSystems();

      // Setup monitoring
      this.setupMonitoring();

      this.isInitialized = true;

      console.log('✅ Report processor initialized for Bangladesh scale');
      console.log(`📊 Processing tiers: Emergency, Standard, Background, Analytics`);

      return { success: true, message: 'Report processor ready for 25,000+ users' };

    } catch (error) {
      console.error('❌ Report processor initialization failed:', error);

      // Attempt graceful degradation
      await this.initializeFallbackMode();

      throw error;
    }
  }

  /**
   * Initialize distributed queue system
   */
  async initializeDistributedQueue() {
    try {
      const { distributedQueueService } = require('../services/distributedQueueService');

      if (!distributedQueueService.isInitialized) {
        await distributedQueueService.initialize();
      }

      this.distributedQueue = distributedQueueService;
      console.log('✅ Distributed queue service connected');

    } catch (error) {
      console.warn('⚠️ Distributed queue unavailable, will use fallback:', error.message);
      this.distributedQueue = null;
    }
  }

  /**
   * Initialize fallback systems
   */
  async initializeFallbackSystems() {
    try {
      // Import existing queue service as fallback
      const { QueueService } = require('../services/queueService');
      this.fallbackQueue = new QueueService();

      if (!this.fallbackQueue.isInitialized) {
        await this.fallbackQueue.initialize();
      }

      console.log('✅ Fallback queue system ready');

    } catch (error) {
      console.warn('⚠️ Fallback queue initialization failed:', error.message);
      this.fallbackQueue = null;
    }
  }

  // Get a valid type from the original data or use a safe default
  getValidType(originalType) {
    const validTypes = [
      'chadabaji', 'teen_gang', 'chintai', 'political_harassment', 'other',
      'eve_teasing', 'stalking', 'inappropriate_touch', 'verbal_harassment',
      'unsafe_transport', 'workplace_harassment', 'domestic_incident', 'unsafe_area_women',
      'emergency'  // You added this
    ];

    return validTypes.includes(originalType) ? originalType : 'emergency';
  };

  /**
   * MAIN ENTRY POINT: Process any report with intelligent routing
   */
  async processReport(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📊 Processing report: ${reportData._id || 'new'}`);

      // 1. Analyze report and determine processing tier
      const analysis = await this.analyzeReport(reportData);

      // 2. Route to appropriate processing tier
      const result = await this.routeToProcessingTier(reportData, analysis, options);

      // 3. Update statistics
      this.updateProcessingStats(analysis.tier, Date.now() - startTime);

      console.log(`✅ Report processed successfully: ${analysis.tier} tier (${Date.now() - startTime}ms)`);

      return {
        success: true,
        reportId: result.reportId || reportData._id,
        tier: analysis.tier,
        processingTime: Date.now() - startTime,
        queueUsed: result.queueUsed || 'direct',
        analysis: analysis.summary
      };

    } catch (error) {
      console.error('❌ Report processing failed:', error);
      this.stats.failed++;

      // Attempt emergency fallback for critical reports
      if (this.isCriticalReport(reportData)) {
        return await this.processEmergencyFallback(reportData);
      }

      throw error;
    }
  }

  /**
   * Analyze report to determine processing requirements
   */
  async analyzeReport(reportData) {
    const analysis = {
      tier: 'standard',
      priority: 2,
      reasons: [],
      bangladeshRelevant: false,
      femaleSafety: false,
      urgency: 'normal',
      location: null,
      summary: {}
    };

    // 1. Check if report is from Bangladesh
    if (reportData.location?.coordinates) {
      analysis.bangladeshRelevant = this.isWithinBangladesh(reportData.location.coordinates);
      analysis.location = this.analyzeLocation(reportData.location.coordinates);
    }

    // 2. Female safety detection (HIGHEST PRIORITY)
    if (this.isFemaleSafetyReport(reportData)) {
      analysis.tier = 'emergency';
      analysis.priority = 1;
      analysis.femaleSafety = true;
      analysis.urgency = 'critical';
      analysis.reasons.push('Female safety concern detected');
    }

    // 3. Violence or immediate threat detection
    if (this.isViolenceReport(reportData)) {
      analysis.tier = 'emergency';
      analysis.priority = 1;
      analysis.urgency = 'critical';
      analysis.reasons.push('Violence or immediate threat detected');
    }

    // 4. High-severity reports in priority zones
    if (analysis.bangladeshRelevant && analysis.location?.inPriorityZone) {
      if (analysis.tier === 'standard') {
        analysis.tier = 'emergency';
        analysis.priority = 1;
        analysis.reasons.push(`Report in priority zone: ${analysis.location.nearestZone}`);
      }
    }

    // 5. Standard safety reports
    if (this.isSafetyReport(reportData) && analysis.tier === 'standard') {
      analysis.reasons.push('Standard safety report');
    }

    // 6. Background processing for analysis
    if (this.requiresBackgroundAnalysis(reportData)) {
      analysis.backgroundTasks = [
        'security_analysis',
        'location_enrichment',
        'trend_analysis'
      ];
    }

    // 7. Analytics processing
    if (this.requiresAnalytics(reportData)) {
      analysis.analyticsNeeded = true;
    }

    // 8. Generate summary
    analysis.summary = {
      tier: analysis.tier,
      priority: analysis.priority,
      femaleSafety: analysis.femaleSafety,
      bangladeshRelevant: analysis.bangladeshRelevant,
      urgency: analysis.urgency,
      processingPath: analysis.reasons.join(', ')
    };

    return analysis;
  }

  /**
   * Route report to appropriate processing tier
   */
  async routeToProcessingTier(reportData, analysis, options = {}) {
    const { tier, priority } = analysis;

    // Force queue bypass for emergency processing
    if (options.skipQueue || tier === 'emergency') {
      return await this.processDirectly(reportData, analysis, options);
    }

    // Use distributed queue system
    if (this.distributedQueue) {
      return await this.processViaDistributedQueue(reportData, analysis, options);
    }

    // Fallback to original queue system
    if (this.fallbackQueue) {
      return await this.processViaFallbackQueue(reportData, analysis, options);
    }

    // Last resort: direct processing
    return await this.processDirectly(reportData, analysis, options);
  }

  /**
   * Process via distributed queue system
   */
  async processViaDistributedQueue(reportData, analysis, options = {}) {
    const { tier } = analysis;
    const queueName = this.processingTiers[tier].queue;

    try {
      // Prepare job data
      const jobData = {
        reportData: this.sanitizeReportData(reportData),
        analysis: analysis.summary,
        options,
        timestamp: Date.now(),
        bangladeshSpecific: analysis.bangladeshRelevant
      };

      // Add to appropriate queue with priority
      const result = await this.distributedQueue.addJob(queueName, jobData, {
        priority: analysis.priority,
        attempts: tier === 'emergency' ? 3 : 2,
        delay: tier === 'emergency' ? 0 : this.getProcessingDelay(tier)
      });

      console.log(`📤 Report queued for ${tier} processing: Job ${result.jobId}`);

      // For emergency reports, also trigger immediate processing
      if (tier === 'emergency' && !options.emergencyMode && !options.skipQueue) {
        // Only do immediate processing if not already in emergency mode AND not skipping queue
        console.log(`🚨 Queueing emergency backup processing for ${reportData._id}`);

        setImmediate(async () => {
          try {
            // Add safety checks to prevent infinite loops
            const reportId = reportData._id || reportData.id;

            // Check if we're already processing this report
            if (this.emergencyProcessingSet && this.emergencyProcessingSet.has(reportId)) {
              console.log(`⚠️ Emergency report ${reportId} already being processed, skipping backup`);
              return;
            }

            // Initialize processing set if it doesn't exist
            if (!this.emergencyProcessingSet) {
              this.emergencyProcessingSet = new Set();
            }

            // Add to processing set
            this.emergencyProcessingSet.add(reportId);

            try {
              await this.processEmergencyReport(reportData, {
                ...options,
                emergencyMode: true,
                skipQueue: true,
                isBackupProcessing: true
              });
            } finally {
              // Always remove from processing set
              this.emergencyProcessingSet.delete(reportId);

              // Clear the set if it gets too large (memory management)
              if (this.emergencyProcessingSet.size > 1000) {
                this.emergencyProcessingSet.clear();
              }
            }

          } catch (error) {
            console.error('❌ Emergency backup processing failed:', error);
          }
        });
      }

      return {
        success: true,
        reportId: reportData._id,
        jobId: result.jobId,
        queue: queueName,
        queueUsed: 'distributed',
        estimatedProcessingTime: this.processingTiers[tier].maxProcessingTime
      };

    } catch (error) {
      console.error(`❌ Distributed queue processing failed for ${tier}:`, error);

      // Fallback to direct processing for emergency reports
      if (tier === 'emergency') {
        return await this.processDirectly(reportData, analysis, options);
      }

      throw error;
    }
  }

  /**
   * Process via fallback queue system
   */
  async processViaFallbackQueue(reportData, analysis, options = {}) {
    const { tier } = analysis;

    try {
      // Map tier to fallback queue type
      const queueType = this.mapTierToFallbackQueue(tier);

      const result = await this.fallbackQueue.addJob(queueType, {
        reportData: this.sanitizeReportData(reportData),
        analysis: analysis.summary,
        options,
        tier
      }, analysis.priority);

      console.log(`📤 Report queued via fallback for ${tier} processing`);

      return {
        success: true,
        reportId: reportData._id,
        jobId: result.jobId,
        queueUsed: 'fallback',
        tier
      };

    } catch (error) {
      console.error(`❌ Fallback queue processing failed:`, error);
      return await this.processDirectly(reportData, analysis, options);
    }
  }

  /**
   * Process report directly (synchronous)
   */
  async processDirectly(reportData, analysis, options = {}) {
    const { tier } = analysis;

    console.log(`⚡ Processing report directly: ${tier} tier`);

    try {
      let result;

      switch (tier) {
        case 'emergency':
          result = await this.processEmergencyReport(reportData, options);
          break;
        case 'standard':
          result = await this.processStandardReport(reportData, options);
          break;
        case 'background':
          result = await this.processBackgroundAnalysis(reportData, options);
          break;
        case 'analytics':
          result = await this.processAnalytics(reportData, options);
          break;
        default:
          result = await this.processStandardReport(reportData, options);
      }

      return {
        success: true,
        reportId: result.reportId || reportData._id,
        queueUsed: 'direct',
        processingMode: 'synchronous',
        tier
      };

    } catch (error) {
      console.error(`❌ Direct processing failed for ${tier}:`, error);
      throw error;
    }
  }

  /**
   * EMERGENCY PROCESSING: Female safety, violence, immediate threats
   */
  async processEmergencyReport(reportData, options = {}) {
    const startTime = Date.now();
    const reportId = reportData._id || reportData.id || `temp_${Date.now()}`;

    // 🛡️ CRITICAL: Prevent reprocessing the same report
    if (this.recentlyProcessed && this.recentlyProcessed.has(reportId)) {
      console.log(`⚠️ Report ${reportId} was recently processed, returning cached result`);
      const cached = this.recentlyProcessed.get(reportId);
      return {
        ...cached.result,
        fromCache: true,
        originalProcessingTime: cached.processingTime
      };
    }

    // Check if we're already processing this report
    if (this.processingReports && this.processingReports.has(reportId)) {
      console.log(`⚠️ Report ${reportId} is currently being processed, waiting for completion`);
      try {
        return await this.processingReports.get(reportId);
      } catch (error) {
        console.error(`❌ Error waiting for processing completion:`, error);
      }
    }

    // Initialize tracking if needed
    if (!this.processingReports) this.processingReports = new Map();
    if (!this.recentlyProcessed) this.recentlyProcessed = new Map();

    // Create processing promise
    const processingPromise = this._processEmergencyInternal(reportData, options, startTime, reportId);
    this.processingReports.set(reportId, processingPromise);

    try {
      const result = await processingPromise;

      // Cache the result to prevent reprocessing
      this.recentlyProcessed.set(reportId, {
        result,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime
      });

      // Set cache expiry (5 minutes)
      setTimeout(() => {
        if (this.recentlyProcessed) {
          this.recentlyProcessed.delete(reportId);
        }
      }, 5 * 60 * 1000);

      return result;

    } finally {
      // Always clean up processing status
      if (this.processingReports) {
        this.processingReports.delete(reportId);
      }
    }
  }

  /**
   * Internal emergency processing (separated to avoid recursion)
   */
  async _processEmergencyInternal(reportData, options = {}, startTime, reportId) {
    try {
      console.log(`🚨 EMERGENCY: Processing critical report ${reportId}`);

      // 1. Immediate validation and sanitization
      const sanitizedData = await this.sanitizeReportData(reportData);

      // 2. Enhanced security analysis for emergency reports
      const securityAnalysis = await this.performEmergencySecurityAnalysis(sanitizedData);

      // 3. Save to database with highest priority
      const savedReport = await this.saveReportWithPriority(sanitizedData, 'emergency');

      // 4. Immediate notification system
      await this.triggerEmergencyNotifications(savedReport);

      // 5. Real-time WebSocket updates
      await this.broadcastEmergencyAlert(savedReport);

      // 6. Queue background analysis (non-blocking) - ONLY if not already in emergency mode
      if (!options.emergencyMode && !options.isBackupProcessing) {
        try {
          await this.queueBackgroundAnalysis(savedReport, { priority: 'high' });
        } catch (bgError) {
          console.warn('⚠️ Background analysis queueing failed:', bgError.message);
        }
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ Emergency report processed in ${processingTime}ms`);

      this.stats.emergency++;

      return {
        success: true,
        reportId: savedReport._id,
        processingTime,
        securityScore: securityAnalysis.score,
        emergencyAlerts: true,
        backgroundAnalysisQueued: !options.emergencyMode && !options.isBackupProcessing,
        processingMode: options.isBackupProcessing ? 'backup' : 'primary'
      };

    } catch (error) {
      console.error('❌ Emergency report processing failed:', error);

      // Emergency fallback: Try to save with minimal processing
      try {
        return await this.processEmergencyFallback(reportData);
      } catch (fallbackError) {
        console.error('❌ Emergency fallback also failed:', fallbackError);

        // Last resort: return error but don't throw (prevents crashes)
        return {
          success: false,
          reportId: reportId,
          error: error.message,
          fallbackError: fallbackError.message,
          processingTime: Date.now() - startTime,
          emergencyFallbackFailed: true
        };
      }
    }
  }

  /**
   * STANDARD PROCESSING: Regular safety reports
   */
  async processStandardReport(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📊 STANDARD: Processing safety report ${reportData._id}`);

      // 1. Standard validation and sanitization
      const sanitizedData = await this.sanitizeReportData(reportData);

      // 2. Security and fraud analysis
      const securityAnalysis = await this.performStandardSecurityAnalysis(sanitizedData);

      // 3. Save to database with standard priority
      const savedReport = await this.saveReportWithPriority(sanitizedData, 'standard');

      // 4. Standard notification system
      await this.triggerStandardNotifications(savedReport);

      // 5. WebSocket updates for map
      await this.broadcastMapUpdate(savedReport);

      // 6. Queue background analysis
      this.queueBackgroundAnalysis(savedReport, { priority: 'normal' });

      const processingTime = Date.now() - startTime;

      console.log(`✅ Standard report processed in ${processingTime}ms`);

      this.stats.standard++;

      return {
        success: true,
        reportId: savedReport._id,
        processingTime,
        securityScore: securityAnalysis.score,
        backgroundAnalysisQueued: true
      };

    } catch (error) {
      console.error('❌ Standard report processing failed:', error);
      throw error;
    }
  }

  /**
   * BACKGROUND PROCESSING: Security analysis, trend detection
   */
  async processBackgroundAnalysis(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`⚙️ BACKGROUND: Processing analysis for ${reportData._id}`);

      const analysisResults = {};

      // 1. Deep security analysis
      if (options.includeSecurityAnalysis !== false) {
        analysisResults.security = await this.performDeepSecurityAnalysis(reportData);
      }

      // 2. Location enrichment
      if (reportData.location?.coordinates) {
        analysisResults.location = await this.enrichLocationData(reportData.location.coordinates);
      }

      // 3. Trend analysis
      analysisResults.trends = await this.analyzeTrends(reportData);

      // 4. Device analysis
      if (reportData.deviceFingerprint) {
        analysisResults.device = await this.analyzeDeviceFingerprint(reportData.deviceFingerprint);
      }

      // 5. Update report with analysis results
      await this.updateReportWithAnalysis(reportData._id, analysisResults);

      const processingTime = Date.now() - startTime;

      console.log(`✅ Background analysis completed in ${processingTime}ms`);

      this.stats.background++;

      return {
        success: true,
        reportId: reportData._id,
        processingTime,
        analysisResults: Object.keys(analysisResults)
      };

    } catch (error) {
      console.error('❌ Background analysis failed:', error);
      throw error;
    }
  }

  /**
   * ANALYTICS PROCESSING: Data aggregation, insights
   */
  async processAnalytics(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📈 ANALYTICS: Processing metrics for ${reportData._id}`);

      // 1. Update aggregation counters
      await this.updateAnalyticsCounters(reportData);

      // 2. Update trend data
      await this.updateTrendData(reportData);

      // 3. Update safety score for area
      if (reportData.location?.coordinates) {
        await this.updateAreaSafetyScore(reportData.location.coordinates, reportData);
      }

      // 4. Update female safety metrics
      if (reportData.genderSensitive) {
        await this.updateFemaleSafetyMetrics(reportData);
      }

      const processingTime = Date.now() - startTime;

      console.log(`✅ Analytics processing completed in ${processingTime}ms`);

      return {
        success: true,
        reportId: reportData._id,
        processingTime,
        analyticsUpdated: true
      };

    } catch (error) {
      console.error('❌ Analytics processing failed:', error);
      throw error;
    }
  }

  /**
   * EMERGENCY FALLBACK: Process immediately when queue fails
   */
  async processEmergencyFallback(reportData) {
    console.log(`🚨 FALLBACK: Emergency processing for ${reportData._id || 'new'}`);

    try {
      // Minimal processing to ensure report is saved
      const Report = require('../models/Report');

      const minimalReport = {
        type: this.getValidType(reportData.type),
        description: reportData.description || 'Emergency report',
        location: reportData.location || { coordinates: [90.4125, 23.8103] }, // Dhaka center
        genderSensitive: reportData.genderSensitive || true,
        severity: reportData.severity || 3,
        status: 'flagged',
        timestamp: new Date(),
        processingMode: 'emergency_fallback',
        securityScore: 50, // Default moderate score

        // Add minimal security flags
        securityFlags: {
          emergencyFallback: true,
          needsReview: true,
          timestamp: new Date()
        }
      };

      const savedReport = await Report.create(minimalReport);

      // Trigger minimal notifications
      try {
        await this.triggerMinimalNotifications(savedReport);
      } catch (notificationError) {
        console.warn('⚠️ Emergency fallback notification failed:', notificationError);
      }

      console.log(`✅ Emergency fallback completed: ${savedReport._id}`);

      return {
        success: true,
        reportId: savedReport._id,
        fallback: true,
        message: 'Emergency fallback processing completed'
      };

    } catch (error) {
      console.error('❌ Emergency fallback failed:', error);
      throw new Error(`Complete processing failure: ${error.message}`);
    }
  }

  // ===== ANALYSIS HELPER METHODS =====

  /**
   * Analyze report content for credibility
   */
  analyzeReportContent(description) {
    if (!description) {
      return { credibilityScore: -10, flags: ['no_description'] };
    }

    let score = 0;
    const flags = [];

    // Length analysis
    if (description.length < 10) {
      score -= 15;
      flags.push('too_short');
    } else if (description.length > 500) {
      score += 5;
      flags.push('detailed');
    } else if (description.length > 50) {
      score += 10;
    }

    // Language quality (basic checks)
    const words = description.split(/\s+/);
    if (words.length > 5) {
      score += 5;
    }

    // Check for spam patterns
    const spamPatterns = /(.)\1{4,}|[A-Z]{10,}|(.{1,3})\1{3,}/i;
    if (spamPatterns.test(description)) {
      score -= 20;
      flags.push('spam_pattern');
    }

    // Check for emotional content (indicates genuine report)
    const emotionalWords = /scared|afraid|threatened|unsafe|dangerous|worried|anxious/i;
    if (emotionalWords.test(description)) {
      score += 10;
      flags.push('emotional_content');
    }

    return {
      credibilityScore: Math.max(-30, Math.min(30, score)),
      flags
    };
  }

  /**
   * Analyze location credibility
   */
  async analyzeLocationCredibility(coordinates) {
    const [lng, lat] = coordinates;
    let credibilityBonus = 0;
    const flags = [];

    // Check if coordinates are in Bangladesh
    if (lat >= 20.3 && lat <= 26.7 && lng >= 88.0 && lng <= 92.8) {
      credibilityBonus += 10;
      flags.push('bangladesh_coordinates');
    } else {
      credibilityBonus -= 20;
      flags.push('outside_bangladesh');
    }

    // Check if coordinates are in populated area (simplified)
    if (lat >= 23.7 && lat <= 23.9 && lng >= 90.3 && lng <= 90.5) {
      credibilityBonus += 5;
      flags.push('dhaka_area');
    }

    return { credibilityBonus, flags };
  }

  /**
   * Analyze submission time patterns
   */
  analyzeSubmissionTime(timestamp) {
    const hour = new Date(timestamp).getHours();
    let credibilityModifier = 0;
    const flags = [];

    // Night time reports might be more urgent
    if (hour >= 22 || hour <= 6) {
      credibilityModifier += 5;
      flags.push('night_submission');
    }

    // Peak hours analysis
    if (hour >= 8 && hour <= 10 || hour >= 17 && hour <= 19) {
      credibilityModifier += 3;
      flags.push('peak_hours');
    }

    return { credibilityModifier, flags };
  }

  /**
   * Calculate overall analysis score
   */
  calculateOverallAnalysisScore(analysisResults) {
    let totalScore = 50; // Base score
    let weightSum = 0;

    if (analysisResults.security) {
      totalScore += analysisResults.security.score * 0.4;
      weightSum += 0.4;
    }

    if (analysisResults.location && analysisResults.location.success) {
      const locationScore = analysisResults.location.data?.areaSafetyAssessment?.score || 50;
      totalScore += locationScore * 0.2;
      weightSum += 0.2;
    }

    if (analysisResults.trends && analysisResults.trends.success) {
      const trendScore = analysisResults.trends.riskLevel === 'low' ? 70 :
        analysisResults.trends.riskLevel === 'medium' ? 50 : 30;
      totalScore += trendScore * 0.2;
      weightSum += 0.2;
    }

    if (analysisResults.device && analysisResults.device.success) {
      const deviceScore = analysisResults.device.analysis?.deviceProfile?.trustScore || 50;
      totalScore += deviceScore * 0.2;
      weightSum += 0.2;
    }

    // Normalize score
    return weightSum > 0 ? Math.round(totalScore / (1 + weightSum - 1)) : 50;
  }


  /**
   * Check if report type is Bangladesh relevant
   */
  isBangladeshRelevant(reportData) {
    // Check coordinates
    if (reportData.location?.coordinates) {
      const [lng, lat] = reportData.location.coordinates;
      return lat >= 20.3 && lat <= 26.7 && lng >= 88.0 && lng <= 92.8;
    }

    // Check report types common in Bangladesh
    const bangladeshTypes = [
      'eve_teasing', 'chadabaji', 'teen_gang', 'chintai',
      'political_harassment', 'unsafe_transport'
    ];

    return bangladeshTypes.includes(reportData.type);
  }

  /**
   * Helper methods for trend analysis
   */
  analyzeCommonTypes(reports) {
    const typeCounts = {};
    reports.forEach(report => {
      typeCounts[report.type] = (typeCounts[report.type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Generate trend analysis
   */
  generateTrendAnalysis(patterns) {
    const analysis = {
      predictions: [],
      riskLevel: 'medium',
      recommendations: []
    };

    // Analyze temporal patterns
    if (patterns.temporal?.totalIncidents > 10) {
      analysis.riskLevel = 'high';
      analysis.predictions.push('High incident frequency detected');
    }

    // Analyze geographic patterns
    if (patterns.geographic?.nearbyIncidents > 5) {
      analysis.predictions.push('Incident clustering in area');
      analysis.recommendations.push('Increase safety measures in area');
    }

    return analysis;
  }


  /**
 * Calculate safety impact
 */
  calculateSafetyImpact(reportData) {
    let impact = 0;

    // Base impact by severity
    impact += reportData.severity * 0.5;

    // Additional impact for gender-sensitive reports
    if (reportData.genderSensitive) {
      impact += 1.0;
    }

    // Type-specific impacts
    const highImpactTypes = ['violence', 'harassment', 'stalking'];
    if (highImpactTypes.includes(reportData.type)) {
      impact += 1.5;
    }

    return Math.min(3, impact); // Cap at 3 points
  }

  /**
   * Transport-related check
   */
  isTransportRelated(type) {
    return ['unsafe_transport', 'harassment'].includes(type);
  }

  /**
 * Harassment type check
 */
  isHarassmentType(type) {
    return ['harassment', 'eve_teasing', 'stalking', 'inappropriate_behavior'].includes(type);
  }



  /**
   * Check if report is from Bangladesh
   */
  isWithinBangladesh(coordinates) {
    if (!coordinates || coordinates.length !== 2) return false;

    const [lng, lat] = coordinates;
    const bounds = this.bangladeshConfig.bounds;

    return lat >= bounds.minLat && lat <= bounds.maxLat &&
      lng >= bounds.minLng && lng <= bounds.maxLng;
  }

  /**
   * Analyze location for priority zones
   */
  analyzeLocation(coordinates) {
    if (!coordinates || coordinates.length !== 2) return null;

    const [lng, lat] = coordinates;
    const analysis = {
      inPriorityZone: false,
      nearestZone: null,
      distanceToZone: null,
      inFemaleSafetyZone: false
    };

    // Check priority zones
    for (const zone of this.bangladeshConfig.priorityZones) {
      const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      if (distance <= zone.radius) {
        analysis.inPriorityZone = true;
        analysis.nearestZone = zone.name;
        analysis.distanceToZone = distance;
        break;
      }
    }

    // Check female safety zones
    for (const zone of this.bangladeshConfig.femaleSafetyZones) {
      const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
      if (distance <= zone.radius) {
        analysis.inFemaleSafetyZone = true;
        break;
      }
    }

    return analysis;
  }

  /**
   * Detect female safety reports
   */
  isFemaleSafetyReport(reportData) {
    // Explicit gender sensitive flag
    if (reportData.genderSensitive === true) return true;

    // Check description for female safety keywords
    const femaleSafetyKeywords = [
      'harassment', 'stalking', 'assault', 'abuse', 'threat', 'inappropriate',
      'uncomfortable', 'unsafe', 'scared', 'followed', 'touched', 'commented',
      'মহিলা', 'নারী', 'হয়রানি', 'অনিরাপদ' // Bengali keywords
    ];

    const description = (reportData.description || '').toLowerCase();

    return femaleSafetyKeywords.some(keyword =>
      description.includes(keyword.toLowerCase())
    );
  }

  /**
   * Detect violence reports
   */
  isViolenceReport(reportData) {
    const violenceKeywords = [
      'violence', 'attack', 'fight', 'weapon', 'gun', 'knife', 'blood',
      'emergency', 'help', 'police', 'urgent', 'danger', 'threat',
      'হিংসা', 'আক্রমণ', 'অস্ত্র', 'বিপদ' // Bengali keywords
    ];

    const description = (reportData.description || '').toLowerCase();
    const severity = reportData.severity || '';

    return violenceKeywords.some(keyword =>
      description.includes(keyword.toLowerCase())
    ) || severity === 'critical' || severity === 'high';
  }

  /**
    * ADDED:Check if report is a safety report
  */

  isSafetyReport(reportData) {
    const safetyKeywords = [
      'safety', 'unsafe', 'danger', 'concern', 'risk', 'hazard',
      'incident', 'problem', 'issue', 'warning', 'alert',
      'নিরাপত্তা', 'বিপদ', 'ঝুঁকি', 'সমস্যা' // Bengali keywords
    ];

    const description = (reportData.description || '').toLowerCase();
    const type = (reportData.type || '').toLowerCase();

    // Check if it's explicitly a safety-related type
    const safetyTypes = [
      'theft', 'robbery', 'harassment', 'assault', 'vandalism',
      'suspicious_activity', 'unsafe_area', 'poor_lighting'
    ];

    if (safetyTypes.includes(type)) {
      return true;
    }

    // Check description for safety keywords
    return safetyKeywords.some(keyword =>
      description.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if report requires background analysis
   */
  requiresBackgroundAnalysis(reportData) {
    return reportData.deviceFingerprint ||
      reportData.location?.coordinates ||
      reportData.severity === 'high' ||
      reportData.genderSensitive;
  }

  /**
   * Check if report requires analytics
   */
  requiresAnalytics(reportData) {
    return true; // All reports contribute to analytics
  }

  /**
   * Check if report is critical
   */
  isCriticalReport(reportData) {
    return this.isFemaleSafetyReport(reportData) ||
      this.isViolenceReport(reportData) ||
      reportData.severity === 'critical';
  }

  // ===== PROCESSING HELPER METHODS =====

  // === DATA SANITIZATION HELPERS ===

  sanitizeText(text) {
    if (!text) return '';

    return text
      .toString()
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s\u0980-\u09FF.,!?;:()\-]/g, '') // Allow Bengali chars
      .substring(0, 2000); // Limit length
  }

  sanitizeLocation(location) {
    if (!location || !location.coordinates) {
      return {
        type: 'Point',
        coordinates: [90.4125, 23.8103] // Default to Dhaka center
      };
    }

    const [lng, lat] = location.coordinates;

    // Validate coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
      lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return {
        type: 'Point',
        coordinates: [90.4125, 23.8103]
      };
    }

    return {
      type: location.type || 'Point',
      coordinates: [
        parseFloat(lng.toFixed(6)),
        parseFloat(lat.toFixed(6))
      ]
    };
  }

  sanitizeSubmissionData(submittedBy) {
    if (!submittedBy) {
      return {
        deviceFingerprint: 'unknown',
        userType: 'citizen',
        ipAddress: '127.0.0.1'
      };
    }

    return {
      deviceFingerprint: submittedBy.deviceFingerprint || 'unknown',
      userType: submittedBy.userType || 'citizen',
      ipAddress: submittedBy.ipAddress || '127.0.0.1',
      userAgent: submittedBy.userAgent ? this.sanitizeText(submittedBy.userAgent) : undefined
    };
  }

  sanitizeImages(images) {
    if (!Array.isArray(images)) return [];

    return images
      .filter(img => img && typeof img === 'string')
      .slice(0, 5) // Limit to 5 images
      .map(img => this.sanitizeText(img));
  }

  sanitizeContact(contact) {
    if (!contact) return null;

    return {
      phone: contact.phone ? this.sanitizeText(contact.phone).substring(0, 20) : undefined,
      email: contact.email ? this.sanitizeText(contact.email).substring(0, 100) : undefined
    };
  }

  /**
   * Sanitize report data for processing
   */
  async sanitizeReportData(reportData) {

    try {
      // Remove sensitive fields and sanitize
      const sanitized = {
        _id: reportData._id,
        type: this.getValidType(reportData.type),
        description: this.sanitizeText(reportData.description),
        location: this.sanitizeLocation(reportData.location),
        severity: Math.max(1, Math.min(5, parseInt(reportData.severity) || 2)),
        genderSensitive: Boolean(reportData.genderSensitive),
        deviceFingerprint: reportData.deviceFingerprint,
        userContext: reportData.userContext,
        timestamp: reportData.timestamp || new Date(),
        submittedBy: this.sanitizeSubmissionData(reportData.submittedBy)
      };

      // Add optional fields if present
      if (reportData.images) {
        sanitized.images = this.sanitizeImages(reportData.images);
      }

      if (reportData.emergencyContact) {
        sanitized.emergencyContact = this.sanitizeContact(reportData.emergencyContact);
      }

      return sanitized;

    } catch (error) {
      console.error('❌ Data sanitization failed:', error);
      throw new Error(`Data sanitization failed: ${error.message}`);
    }
  }

  /**
   * Get processing delay based on tier
   */
  getProcessingDelay(tier) {
    const delays = {
      emergency: 0,
      standard: 1000,    // 1 second
      background: 5000,  // 5 seconds
      analytics: 30000   // 30 seconds
    };

    return delays[tier] || 1000;
  }

  /**
   * Map tier to fallback queue type
   */
  mapTierToFallbackQueue(tier) {
    const mapping = {
      emergency: 'reportProcessing',
      standard: 'reportProcessing',
      background: 'analytics',
      analytics: 'analytics'
    };

    return mapping[tier] || 'reportProcessing';
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
 * Calculate security score based on multiple factors
 */
  calculateSecurityScore(reportData, priority) {
    let score = 50;

    if (priority === 'emergency') score += 30;
    if (reportData.genderSensitive) score += 15;
    if (reportData.severity >= 4) score += 20;
    if (['harassment', 'stalking', 'violence'].includes(reportData.type)) score += 10;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get area name from coordinates (simplified)
   */
  getAreaName(location) {
    if (!location?.coordinates) return 'Unknown Area';

    const [lng, lat] = location.coordinates;

    // Simplified area mapping for Dhaka
    if (lat > 23.8 && lat < 23.9 && lng > 90.3 && lng < 90.5) return 'Dhaka Central';
    if (lat > 23.7 && lat < 23.8 && lng > 90.3 && lng < 90.5) return 'Old Dhaka';
    if (lat > 23.8 && lat < 23.9 && lng > 90.4 && lng < 90.5) return 'Gulshan Area';

    return 'Dhaka Metropolitan';
  }

  /**
   * Obfuscate location coordinates for privacy
   */
  obfuscateLocation(coordinates) {
    if (!coordinates || coordinates.length !== 2) return null;

    const [lng, lat] = coordinates;
    const obfuscation = 0.001; // ~100m radius

    return [
      lng + (Math.random() - 0.5) * obfuscation,
      lat + (Math.random() - 0.5) * obfuscation
    ];
  }

  /**
   * Generate emergency message
   */
  generateEmergencyMessage(report) {
    const area = this.getAreaName(report.location);
    const time = new Date(report.timestamp).toLocaleTimeString();

    return `EMERGENCY: ${report.type} reported in ${area} at ${time}. Security score: ${report.securityScore}`;
  }

  // ===== METHODS  =====

  // === ADVANCED ANALYSIS HELPERS ===

  async performAdvancedContentAnalysis(description) {
    const analysis = {
      credibilityScore: 0,
      flags: [],
      confidence: 'medium'
    };

    if (!description) {
      return { ...analysis, credibilityScore: -20, flags: ['no_content'] };
    }

    // 1. Language analysis
    const languageAnalysis = this.analyzeLanguageQuality(description);
    analysis.credibilityScore += languageAnalysis.score;
    analysis.flags.push(...languageAnalysis.flags);

    // 2. Emotional consistency analysis
    const emotionalAnalysis = this.analyzeEmotionalConsistency(description);
    analysis.credibilityScore += emotionalAnalysis.score;
    analysis.flags.push(...emotionalAnalysis.flags);

    // 3. Temporal consistency analysis
    const temporalAnalysis = this.analyzeTemporalConsistency(description);
    analysis.credibilityScore += temporalAnalysis.score;
    analysis.flags.push(...temporalAnalysis.flags);

    // 4. Detail analysis
    const detailAnalysis = this.analyzeDetailLevel(description);
    analysis.credibilityScore += detailAnalysis.score;
    analysis.flags.push(...detailAnalysis.flags);

    analysis.confidence = analysis.credibilityScore > 15 ? 'high' :
      analysis.credibilityScore > -5 ? 'medium' : 'low';

    return analysis;
  }

  analyzeLanguageQuality(text) {
    let score = 0;
    const flags = [];

    // Word count analysis
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 5) {
      score -= 10;
      flags.push('too_few_words');
    } else if (words.length > 20) {
      score += 10;
      flags.push('detailed_description');
    }

    // Repetition analysis
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const repetitionRatio = uniqueWords.size / words.length;
    if (repetitionRatio < 0.5) {
      score -= 15;
      flags.push('high_repetition');
    } else if (repetitionRatio > 0.8) {
      score += 5;
      flags.push('varied_vocabulary');
    }

    // Bengali script analysis
    const bengaliPattern = /[\u0980-\u09FF]/;
    if (bengaliPattern.test(text)) {
      score += 5;
      flags.push('bengali_content');
    }

    return { score, flags };
  }

  analyzeEmotionalConsistency(text) {
    let score = 0;
    const flags = [];

    // Emotional indicators
    const fearWords = /scared|afraid|threatened|unsafe|dangerous|worried|anxious|terrified/gi;
    const angerWords = /angry|furious|outraged|disgusted|violated|harassed|abused/gi;
    const urgencyWords = /help|urgent|immediate|emergency|please|serious|critical/gi;

    const fearMatches = (text.match(fearWords) || []).length;
    const angerMatches = (text.match(angerWords) || []).length;
    const urgencyMatches = (text.match(urgencyWords) || []).length;

    if (fearMatches + angerMatches + urgencyMatches > 0) {
      score += 10;
      flags.push('emotional_content');

      if (fearMatches > 2) {
        score += 5;
        flags.push('high_fear_content');
      }
    }

    // Check for emotional inconsistency (too emotional)
    if (fearMatches + angerMatches + urgencyMatches > 8) {
      score -= 10;
      flags.push('excessive_emotional_language');
    }

    return { score, flags };
  }

  analyzeTemporalConsistency(text) {
    let score = 0;
    const flags = [];

    // Time references
    const timePatterns = /yesterday|today|tonight|this morning|this evening|just now|recently|minutes ago|hours ago/gi;
    const timeMatches = (text.match(timePatterns) || []).length;

    if (timeMatches > 0) {
      score += 8;
      flags.push('temporal_reference');
    }

    // Multiple conflicting time references
    if (timeMatches > 3) {
      score -= 5;
      flags.push('conflicting_time_refs');
    }

    return { score, flags };
  }

  analyzeDetailLevel(text) {
    let score = 0;
    const flags = [];

    // Specific details
    const locationWords = /street|road|building|shop|station|park|area|near|beside|opposite/gi;
    const personWords = /man|woman|boy|girl|person|people|group|wearing|tall|short/gi;
    const actionWords = /touched|grabbed|followed|said|shouted|approached|stopped|blocked/gi;

    const locationMatches = (text.match(locationWords) || []).length;
    const personMatches = (text.match(personWords) || []).length;
    const actionMatches = (text.match(actionWords) || []).length;

    if (locationMatches > 0) {
      score += 5;
      flags.push('location_details');
    }

    if (personMatches > 0) {
      score += 5;
      flags.push('person_description');
    }

    if (actionMatches > 0) {
      score += 8;
      flags.push('action_description');
    }

    // Good level of detail
    if (locationMatches + personMatches + actionMatches >= 5) {
      score += 10;
      flags.push('comprehensive_details');
    }

    return { score, flags };
  }

  async analyzeHistoricalPatterns(reportData) {
    try {
      const Report = require('../models/Report');

      // Look for similar reports in the last 30 days
      const similarReports = await Report.find({
        type: reportData.type,
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        _id: { $ne: reportData._id }
      }).limit(50);

      let credibilityModifier = 0;
      const flags = [];

      // Pattern analysis
      if (similarReports.length > 10) {
        credibilityModifier += 5;
        flags.push('consistent_pattern');
      } else if (similarReports.length === 0) {
        credibilityModifier -= 3;
        flags.push('isolated_incident');
      }

      // Location clustering analysis
      if (reportData.location?.coordinates) {
        const [lng, lat] = reportData.location.coordinates;
        const nearbyReports = similarReports.filter(report => {
          if (!report.location?.coordinates) return false;
          const distance = this.calculateDistance(
            lat, lng,
            report.location.coordinates[1], report.location.coordinates[0]
          );
          return distance < 1000; // Within 1km
        });

        if (nearbyReports.length > 2) {
          credibilityModifier += 8;
          flags.push('location_pattern');
        }
      }

      return {
        credibilityModifier,
        flags,
        historicalCount: similarReports.length
      };

    } catch (error) {
      console.warn('⚠️ Historical pattern analysis failed:', error.message);
      return { credibilityModifier: 0, flags: ['analysis_failed'] };
    }
  }

  async analyzeDeviceCorrelations(deviceFingerprint) {
    try {
      const DeviceFingerprint = require('../models/DeviceFingerprint');

      const correlatedDevices = await DeviceFingerprint.performCrossDeviceCorrelation(deviceFingerprint);

      let credibilityModifier = 0;
      const flags = [];

      // High-risk device correlations
      const highRiskCorrelations = correlatedDevices.filter(d =>
        d.riskLevel === 'high' || d.trustScore < 30
      );

      if (highRiskCorrelations.length > 0) {
        credibilityModifier -= 15;
        flags.push('high_risk_correlations');
      }

      // Multiple device usage (potential manipulation)
      if (correlatedDevices.length > 5) {
        credibilityModifier -= 10;
        flags.push('multiple_device_usage');
      }

      // Trusted device correlations
      const trustedCorrelations = correlatedDevices.filter(d => d.trustScore > 70);
      if (trustedCorrelations.length > 0) {
        credibilityModifier += 5;
        flags.push('trusted_correlations');
      }

      return {
        credibilityModifier,
        flags,
        correlationCount: correlatedDevices.length
      };

    } catch (error) {
      console.warn('⚠️ Device correlation analysis failed:', error.message);
      return { credibilityModifier: 0, flags: ['correlation_analysis_failed'] };
    }
  }

  async analyzeGeographicPatterns(coordinates, reportType) {
    try {
      const [lng, lat] = coordinates;
      const Report = require('../models/Report');

      // Find reports of the same type in the area
      const nearbyReports = await Report.find({
        type: reportType,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 2000 // 2km radius
          }
        },
        timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Last 2 weeks
      }).limit(20);

      let credibilityModifier = 0;
      const flags = [];

      if (nearbyReports.length > 3) {
        credibilityModifier += 10;
        flags.push('geographic_pattern_confirmed');
      } else if (nearbyReports.length === 0) {
        credibilityModifier -= 5;
        flags.push('isolated_geographic_incident');
      }

      // Time clustering analysis
      const recentReports = nearbyReports.filter(report => {
        const timeDiff = Date.now() - new Date(report.timestamp).getTime();
        return timeDiff < 24 * 60 * 60 * 1000; // Last 24 hours
      });

      if (recentReports.length > 1) {
        credibilityModifier += 5;
        flags.push('recent_geographic_cluster');
      }

      return {
        credibilityModifier,
        flags,
        nearbyCount: nearbyReports.length,
        recentCount: recentReports.length
      };

    } catch (error) {
      console.warn('⚠️ Geographic pattern analysis failed:', error.message);
      return { credibilityModifier: 0, flags: ['geographic_analysis_failed'] };
    }
  }

  async analyzeTemporalPatterns(reportData) {
    try {
      const Report = require('../models/Report');

      const reportTime = new Date(reportData.timestamp);
      const hour = reportTime.getHours();
      const dayOfWeek = reportTime.getDay();

      // Find reports of same type at similar times
      const temporalReports = await Report.find({
        type: reportData.type,
        $expr: {
          $and: [
            { $eq: [{ $hour: '$timestamp' }, hour] },
            { $eq: [{ $dayOfWeek: '$timestamp' }, dayOfWeek] }
          ]
        },
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).limit(10);

      let credibilityModifier = 0;
      const flags = [];

      if (temporalReports.length > 2) {
        credibilityModifier += 7;
        flags.push('temporal_pattern_confirmed');
      }

      // Night time incidents (higher credibility for certain types)
      if ((hour >= 22 || hour <= 6) &&
        ['harassment', 'stalking', 'unsafe_area_women'].includes(reportData.type)) {
        credibilityModifier += 5;
        flags.push('night_incident_pattern');
      }

      // Peak hour incidents
      if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19)) {
        credibilityModifier += 3;
        flags.push('peak_hour_incident');
      }

      return {
        credibilityModifier,
        flags,
        temporalMatches: temporalReports.length
      };

    } catch (error) {
      console.warn('⚠️ Temporal pattern analysis failed:', error.message);
      return { credibilityModifier: 0, flags: ['temporal_analysis_failed'] };
    }
  }

  async correlateThreatIntelligence(reportData) {
    try {
      let credibilityModifier = 0;
      const flags = [];

      // Check device threat intelligence
      if (reportData.submittedBy?.deviceFingerprint) {
        const DeviceFingerprint = require('../models/DeviceFingerprint');
        const device = await DeviceFingerprint.findOne({
          fingerprintId: reportData.submittedBy.deviceFingerprint
        });

        if (device?.threatIntelligence) {
          const threatLevel = device.threatIntelligence.threatConfidence || 0;

          if (threatLevel > 70) {
            credibilityModifier -= 20;
            flags.push('high_threat_device');
          } else if (threatLevel > 40) {
            credibilityModifier -= 10;
            flags.push('moderate_threat_device');
          }

          if (device.threatIntelligence.knownThreatActor) {
            credibilityModifier -= 30;
            flags.push('known_threat_actor');
          }
        }
      }

      // Check for coordinated attack patterns
      const coordinatedPattern = await this.checkCoordinatedAttacks(reportData);
      if (coordinatedPattern.detected) {
        credibilityModifier -= 15;
        flags.push('coordinated_attack_pattern');
      }

      return {
        credibilityModifier,
        flags,
        threatIntelligence: 'analyzed'
      };

    } catch (error) {
      console.warn('⚠️ Threat intelligence correlation failed:', error.message);
      return { credibilityModifier: 0, flags: ['threat_analysis_failed'] };
    }
  }

  async checkCoordinatedAttacks(reportData) {
    try {
      const Report = require('../models/Report');

      // Look for multiple reports of same type submitted within a short time frame
      const recentSimilarReports = await Report.find({
        type: reportData.type,
        timestamp: {
          $gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          $ne: reportData.timestamp
        }
      });

      // Check for device fingerprint patterns
      const deviceFingerprints = recentSimilarReports
        .map(r => r.submittedBy?.deviceFingerprint)
        .filter(Boolean);

      const uniqueDevices = new Set(deviceFingerprints);

      // If many reports from few devices, might be coordinated
      const detected = recentSimilarReports.length > 5 && uniqueDevices.size < 3;

      return {
        detected,
        reportCount: recentSimilarReports.length,
        uniqueDevices: uniqueDevices.size
      };

    } catch (error) {
      return { detected: false, error: error.message };
    }
  }

  // === ANALYTICS UPDATE HELPERS ===

  async updateDailyCounters(reportData) {
    const today = new Date().toISOString().split('T')[0];

    // Use MongoDB to update or create daily counter
    const mongoose = require('mongoose');
    await mongoose.connection.db.collection('daily_analytics').updateOne(
      { date: today },
      {
        $inc: {
          totalReports: 1,
          [`reportTypes.${reportData.type}`]: 1,
          [`severityBreakdown.severity_${reportData.severity}`]: 1
        },
        $setOnInsert: { date: today, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateTypeCounters(reportData) {
    const mongoose = require('mongoose');
    await mongoose.connection.db.collection('type_analytics').updateOne(
      { type: reportData.type },
      {
        $inc: {
          totalCount: 1,
          [`monthly.${new Date().getMonth()}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { type: reportData.type, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateLocationCounters(reportData) {
    const [lng, lat] = reportData.location.coordinates;
    const area = this.getAreaName(reportData.location);

    const mongoose = require('mongoose');
    await mongoose.connection.db.collection('location_analytics').updateOne(
      { area: area },
      {
        $inc: {
          incidentCount: 1,
          [`types.${reportData.type}`]: 1
        },
        $set: {
          lastIncident: new Date(),
          coordinates: [lng, lat]
        },
        $setOnInsert: { area: area, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateSeverityCounters(reportData) {
    const mongoose = require('mongoose');
    await mongoose.connection.db.collection('severity_analytics').updateOne(
      { severity: reportData.severity },
      {
        $inc: {
          count: 1,
          [`types.${reportData.type}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { severity: reportData.severity, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateGenderSafetyCounters(reportData) {
    const mongoose = require('mongoose');
    const today = new Date().toISOString().split('T')[0];

    await mongoose.connection.db.collection('gender_safety_analytics').updateOne(
      { date: today },
      {
        $inc: {
          totalFemaleSafetyReports: 1,
          [`types.${reportData.type}`]: 1,
          [`hourly.hour_${new Date().getHours()}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { date: today, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateTimeBasedCounters(reportData) {
    const hour = new Date(reportData.timestamp).getHours();
    const dayOfWeek = new Date(reportData.timestamp).getDay();

    const mongoose = require('mongoose');
    await mongoose.connection.db.collection('time_analytics').updateOne(
      { type: reportData.type },
      {
        $inc: {
          [`hourlyDistribution.${hour}`]: 1,
          [`weeklyDistribution.${dayOfWeek}`]: 1,
          totalReports: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { type: reportData.type, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  // === TREND UPDATE HELPERS ===

  async updateHourlyTrends(type, hour, severity) {
    const mongoose = require('mongoose');
    const today = new Date().toISOString().split('T')[0];

    await mongoose.connection.db.collection('hourly_trends').updateOne(
      { date: today, hour: hour },
      {
        $inc: {
          totalReports: 1,
          [`types.${type}`]: 1,
          [`severitySum`]: severity
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { date: today, hour: hour, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateDailyTrends(type, date, reportData) {
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('daily_trends').updateOne(
      { date: date, type: type },
      {
        $inc: {
          count: 1,
          severitySum: reportData.severity
        },
        $set: {
          lastUpdated: new Date(),
          avgSeverity: { $divide: ['$severitySum', '$count'] }
        },
        $setOnInsert: { date: date, type: type, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateLocationTrends(reportData) {
    const area = this.getAreaName(reportData.location);
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('location_trends').updateOne(
      { area: area, type: reportData.type },
      {
        $inc: { count: 1 },
        $set: { lastIncident: new Date() },
        $setOnInsert: {
          area: area,
          type: reportData.type,
          coordinates: reportData.location.coordinates,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async updateSeverityTrends(reportData) {
    const mongoose = require('mongoose');
    const week = this.getWeekNumber(new Date());

    await mongoose.connection.db.collection('severity_trends').updateOne(
      { week: week, severity: reportData.severity },
      {
        $inc: { count: 1 },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { week: week, severity: reportData.severity, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateGenderSafetyTrends(reportData) {
    const mongoose = require('mongoose');
    const month = new Date().getMonth();

    await mongoose.connection.db.collection('gender_safety_trends').updateOne(
      { month: month, type: reportData.type },
      {
        $inc: { count: 1 },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { month: month, type: reportData.type, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateEmergingPatterns(reportData) {
    // Complex pattern detection - simplified for now
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('emerging_patterns').updateOne(
      {
        pattern: `${reportData.type}_${this.getAreaName(reportData.location)}`,
        timeWindow: this.getTimeWindow()
      },
      {
        $inc: { occurrences: 1 },
        $set: { lastOccurrence: new Date() },
        $setOnInsert: {
          pattern: `${reportData.type}_${this.getAreaName(reportData.location)}`,
          timeWindow: this.getTimeWindow(),
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  // === FEMALE SAFETY SPECIFIC HELPERS ===

  async updateFemaleSafetyCounters(reportData) {
    const mongoose = require('mongoose');
    const today = new Date().toISOString().split('T')[0];

    await mongoose.connection.db.collection('female_safety_counters').updateOne(
      { date: today },
      {
        $inc: {
          totalIncidents: 1,
          [`types.${reportData.type}`]: 1,
          [`severity.level_${reportData.severity}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { date: today, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateLocationFemaleSafety(reportData) {
    const area = this.getAreaName(reportData.location);
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('location_female_safety').updateOne(
      { area: area },
      {
        $inc: {
          femaleIncidents: 1,
          [`types.${reportData.type}`]: 1
        },
        $set: {
          lastIncident: new Date(),
          coordinates: reportData.location.coordinates
        },
        $setOnInsert: { area: area, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateTimeBasedFemaleSafety(reportData) {
    const hour = new Date(reportData.timestamp).getHours();
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('time_female_safety').updateOne(
      { hour: hour },
      {
        $inc: {
          incidents: 1,
          [`types.${reportData.type}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { hour: hour, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateTransportFemaleSafety(reportData) {
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('transport_female_safety').updateOne(
      { type: reportData.type },
      {
        $inc: { incidents: 1 },
        $set: { lastIncident: new Date() },
        $setOnInsert: { type: reportData.type, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async updateHarassmentPatterns(reportData) {
    const timeOfDay = this.getTimeOfDay(new Date(reportData.timestamp));
    const mongoose = require('mongoose');

    await mongoose.connection.db.collection('harassment_patterns').updateOne(
      {
        type: reportData.type,
        timeOfDay: timeOfDay
      },
      {
        $inc: { count: 1 },
        $set: { lastOccurrence: new Date() },
        $setOnInsert: {
          type: reportData.type,
          timeOfDay: timeOfDay,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  async updateSafeZoneFemaleSafety(reportData) {
    try {
      const SafeZone = require('../models/SafeZone');
      const [lng, lat] = reportData.location.coordinates;

      // Find nearby safe zones
      const nearbyZones = await SafeZone.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 500 // 500m radius
          }
        }
      }).limit(5);

      // Update female safety metrics for each zone
      for (const zone of nearbyZones) {
        await SafeZone.findByIdAndUpdate(zone._id, {
          $inc: {
            'femaleSafety.incidentCount': 1,
            [`femaleSafety.incidentTypes.${reportData.type}`]: 1
          },
          $set: {
            'femaleSafety.lastIncident': new Date()
          }
        });
      }

    } catch (error) {
      console.warn('⚠️ Safe zone female safety update failed:', error.message);
    }
  }

  async checkFemaleSafetyThresholds(reportData) {
    try {
      const area = this.getAreaName(reportData.location);
      const mongoose = require('mongoose');

      // Check if area has exceeded safety thresholds
      const areaStats = await mongoose.connection.db.collection('location_female_safety')
        .findOne({ area: area });

      if (areaStats && areaStats.femaleIncidents > 10) {
        // Trigger safety alert
        console.log(`🚨 Female safety threshold exceeded in ${area}`);

        // Send alert to relevant authorities
        if (this.distributedQueue) {
          await this.distributedQueue.addJob('emailQueue', {
            type: 'female_safety_alert',
            area: area,
            incidentCount: areaStats.femaleIncidents,
            priority: 'high'
          });
        }
      }

    } catch (error) {
      console.warn('⚠️ Female safety threshold check failed:', error.message);
    }
  }

  // === UTILITY HELPERS ===

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  getTimeWindow() {
    const now = new Date();
    const hours = Math.floor(now.getHours() / 6) * 6; // 6-hour windows
    return `${now.toISOString().split('T')[0]}_${hours}`;
  }

  getTimeOfDay(date) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  async reverseGeocode(lat, lng) {
    // Simplified reverse geocoding for Bangladesh
    // In production, you'd use a proper geocoding service

    if (lat >= 23.7 && lat <= 23.9 && lng >= 90.3 && lng <= 90.5) {
      return {
        area: 'Dhaka Metropolitan',
        district: 'Dhaka',
        division: 'Dhaka'
      };
    }

    return {
      area: 'Bangladesh',
      district: 'Unknown',
      division: 'Unknown'
    };
  }

  async assessAreaSafety(lat, lng) {
    // Simplified area safety assessment
    // In production, this would use comprehensive safety databases

    let score = 70; // Base safety score

    // Check if in known unsafe areas (simplified)
    const unsafeAreas = [
      { lat: 23.8103, lng: 90.4125, radius: 500, impact: -20 } // Example unsafe area
    ];

    for (const area of unsafeAreas) {
      const distance = this.calculateDistance(lat, lng, area.lat, area.lng);
      if (distance < area.radius) {
        score += area.impact;
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      factors: ['location_analysis', 'historical_data'],
      lastUpdated: new Date()
    };
  }

  async analyzeTransportAccess(lat, lng) {
    // Simplified transport accessibility analysis
    return {
      nearestBusStop: '200m',
      nearestTrainStation: '2km',
      accessibilityScore: 75,
      analyzed: true
    };
  }

  analyzePopulationDensity(lat, lng) {
    // Simplified population density analysis for Bangladesh
    if (lat >= 23.7 && lat <= 23.9 && lng >= 90.3 && lng <= 90.5) {
      return {
        density: 'high',
        estimatedPeople: 50000,
        category: 'urban_high_density'
      };
    }

    return {
      density: 'medium',
      estimatedPeople: 5000,
      category: 'suburban'
    };
  }

  async analyzeHistoricalIncidents(lat, lng) {
    try {
      const Report = require('../models/Report');

      const historicalReports = await Report.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 1000
          }
        },
        timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
      }).limit(50);

      return {
        totalIncidents: historicalReports.length,
        severityAverage: historicalReports.reduce((sum, r) => sum + r.severity, 0) / historicalReports.length || 0,
        commonTypes: this.analyzeCommonTypes(historicalReports),
        trend: historicalReports.length > 10 ? 'increasing' : 'stable'
      };

    } catch (error) {
      return {
        totalIncidents: 0,
        error: 'Analysis failed'
      };
    }
  }

  generateDeviceRecommendations(device, analysis) {
    const recommendations = {
      riskAssessment: 'medium',
      actions: [],
      monitoring: []
    };

    if (analysis.deviceProfile.trustScore < 30) {
      recommendations.riskAssessment = 'high';
      recommendations.actions.push('increase_monitoring');
      recommendations.actions.push('require_verification');
    }

    if (analysis.securityAssessment.anomalyScore > 70) {
      recommendations.actions.push('security_review');
      recommendations.monitoring.push('behavior_tracking');
    }

    if (analysis.correlations.suspiciousCorrelations > 0) {
      recommendations.actions.push('correlation_investigation');
    }

    return recommendations;
  }

  analyzeNetworkConsistency(device) {
    // Simplified network consistency analysis
    return device.networkProfile.ipHash ? 75 : 50;
  }

  analyzeLocationConsistency(device) {
    // Simplified location consistency analysis
    return device.locationProfile.locationJumps < 5 ? 80 : 40;
  }

  analyzeBehaviorConsistency(device) {
    // Simplified behavior consistency analysis
    return device.behaviorProfile.humanBehaviorScore || 50;
  }

  async updateRegionalSafetyMetrics(lat, lng, reportData) {
    const mongoose = require('mongoose');
    const region = this.getRegion(lat, lng);

    await mongoose.connection.db.collection('regional_safety').updateOne(
      { region: region },
      {
        $inc: {
          totalReports: 1,
          [`types.${reportData.type}`]: 1
        },
        $set: { lastUpdated: new Date() },
        $setOnInsert: { region: region, createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async triggerAreaSafetyRecalculation(lat, lng) {
    // Queue area safety recalculation
    if (this.distributedQueue) {
      await this.distributedQueue.addJob('backgroundTasks', {
        type: 'area_safety_recalculation',
        coordinates: [lng, lat],
        priority: 'normal'
      }).catch(error => {
        console.warn('⚠️ Failed to queue area safety recalculation:', error.message);
      });
    }
  }

  getRegion(lat, lng) {
    // Simplified region mapping for Bangladesh
    if (lat >= 23.7 && lat <= 23.9 && lng >= 90.3 && lng <= 90.5) {
      return 'dhaka_central';
    }
    return 'other';
  }

  createTrendModel() {
    // Fallback if TrendAnalytics model doesn't exist
    return {
      findOneAndUpdate: () => Promise.resolve(),
      create: () => Promise.resolve()
    };
  }

  async performEmergencySecurityAnalysis(reportData) {
    try {
      let score = 50; // Base score
      let riskLevel = 'medium';
      let flags = [];

      // Gender sensitivity analysis
      if (reportData.genderSensitive) {
        score += 25;
        flags.push('gender_sensitive');
      }

      // Severity analysis
      if (reportData.severity >= 4) {
        score += 20;
        flags.push('high_severity');
      }

      // Type-based analysis
      const highRiskTypes = ['harassment', 'stalking', 'violence', 'inappropriate_behavior'];
      if (highRiskTypes.includes(reportData.type)) {
        score += 15;
        flags.push('high_risk_type');
      }

      // Location analysis (if in known unsafe area)
      if (reportData.location?.coordinates) {
        const [lng, lat] = reportData.location.coordinates;
        // Check if in known unsafe areas (simplified)
        const unsafeAreas = [
          { lat: 23.8103, lng: 90.4125, radius: 1000 }, // Example area
        ];

        for (const area of unsafeAreas) {
          const distance = this.calculateDistance(lat, lng, area.lat, area.lng);
          if (distance < area.radius) {
            score += 10;
            flags.push('unsafe_area');
            break;
          }
        }
      }

      // Time-based analysis (late night reports get higher score)
      const hour = new Date().getHours();
      if (hour >= 22 || hour <= 6) {
        score += 5;
        flags.push('night_time');
      }

      // Device fingerprint analysis (if available)
      if (reportData.submittedBy?.deviceFingerprint) {
        try {
          const DeviceFingerprint = require('../models/DeviceFingerprint');
          const device = await DeviceFingerprint.findOne({
            fingerprintId: reportData.submittedBy.deviceFingerprint
          });

          if (device) {
            if (device.trustScore < 30) {
              score -= 10;
              flags.push('low_trust_device');
            } else if (device.trustScore > 70) {
              score += 5;
              flags.push('trusted_device');
            }
          }
        } catch (error) {
          console.warn('⚠️ Device fingerprint analysis failed:', error.message);
        }
      }

      // Final score normalization
      score = Math.max(0, Math.min(100, score));

      // Determine risk level
      if (score >= 80) riskLevel = 'critical';
      else if (score >= 65) riskLevel = 'high';
      else if (score >= 35) riskLevel = 'medium';
      else riskLevel = 'low';

      const analysis = {
        score,
        riskLevel,
        flags,
        analysis: `Emergency security analysis completed - ${riskLevel} risk`,
        timestamp: new Date(),
        factors: {
          genderSensitive: reportData.genderSensitive,
          severity: reportData.severity,
          type: reportData.type,
          timeOfDay: hour
        }
      };

      console.log(`🛡️ Security analysis: Score ${score}, Risk ${riskLevel}`);
      return analysis;

    } catch (error) {
      console.error('❌ Emergency security analysis failed:', error);
      // Return default analysis on error
      return {
        score: 50,
        riskLevel: 'medium',
        flags: ['analysis_failed'],
        analysis: 'Emergency security analysis failed, using defaults',
        error: error.message
      };
    }
  }


  async performStandardSecurityAnalysis(reportData) {
    try {
      let score = 60; // Base score for standard reports
      let flags = [];
      let riskLevel = 'medium';

      // Content analysis
      const contentAnalysis = this.analyzeReportContent(reportData.description);
      score += contentAnalysis.credibilityScore;
      if (contentAnalysis.flags.length > 0) {
        flags.push(...contentAnalysis.flags);
      }

      // Severity-based scoring
      if (reportData.severity >= 3) {
        score += 10;
        flags.push('high_severity');
      }

      // Location analysis
      if (reportData.location?.coordinates) {
        const locationAnalysis = await this.analyzeLocationCredibility(reportData.location.coordinates);
        score += locationAnalysis.credibilityBonus;
        if (locationAnalysis.flags.length > 0) {
          flags.push(...locationAnalysis.flags);
        }
      }

      // Device fingerprint analysis
      if (reportData.submittedBy?.deviceFingerprint) {
        try {
          const DeviceFingerprint = require('../models/DeviceFingerprint');
          const device = await DeviceFingerprint.findOne({
            fingerprintId: reportData.submittedBy.deviceFingerprint
          });

          if (device) {
            const deviceScore = device.securityProfile.trustScore || 50;
            score += (deviceScore - 50) * 0.3; // 30% weight from device trust

            if (device.securityProfile.riskLevel === 'high') {
              score -= 20;
              flags.push('high_risk_device');
            } else if (device.securityProfile.riskLevel === 'low') {
              score += 10;
              flags.push('trusted_device');
            }

            if (device.securityProfile.quarantineStatus === 'quarantined') {
              score -= 30;
              flags.push('quarantined_device');
            }
          }
        } catch (error) {
          console.warn('⚠️ Device analysis failed:', error.message);
        }
      }

      // Time-based analysis
      const timeAnalysis = this.analyzeSubmissionTime(reportData.timestamp);
      score += timeAnalysis.credibilityModifier;
      if (timeAnalysis.flags.length > 0) {
        flags.push(...timeAnalysis.flags);
      }

      // Final score normalization
      score = Math.max(0, Math.min(100, score));

      // Determine risk level
      if (score >= 75) riskLevel = 'low';
      else if (score >= 50) riskLevel = 'medium';
      else riskLevel = 'high';

      return {
        score,
        riskLevel,
        flags: [...new Set(flags)], // Remove duplicates
        confidence: 'medium',
        analysis: 'Standard security analysis completed',
        timestamp: new Date(),
        factors: {
          contentCredibility: contentAnalysis.credibilityScore,
          locationCredibility: reportData.location ? 'analyzed' : 'not_available',
          deviceTrust: reportData.submittedBy?.deviceFingerprint ? 'analyzed' : 'not_available',
          timeAnalysis: timeAnalysis.credibilityModifier
        }
      };

    } catch (error) {
      console.error('❌ Standard security analysis failed:', error);
      return {
        score: 50,
        riskLevel: 'medium',
        flags: ['analysis_failed'],
        confidence: 'low',
        analysis: 'Security analysis failed, using defaults',
        error: error.message
      };
    }
  }

  async performDeepSecurityAnalysis(reportData) {
    try {
      console.log(`🔍 Deep security analysis for report ${reportData._id}`);

      let score = 50; // Starting score
      const flags = [];
      const analysisDetails = {};

      // 1. Advanced content analysis
      const contentAnalysis = await this.performAdvancedContentAnalysis(reportData.description);
      analysisDetails.content = contentAnalysis;
      score += contentAnalysis.credibilityScore;
      flags.push(...contentAnalysis.flags);

      // 2. Cross-reference with historical reports
      const historicalAnalysis = await this.analyzeHistoricalPatterns(reportData);
      analysisDetails.historical = historicalAnalysis;
      score += historicalAnalysis.credibilityModifier;
      flags.push(...historicalAnalysis.flags);

      // 3. Device correlation analysis
      if (reportData.submittedBy?.deviceFingerprint) {
        const deviceCorrelation = await this.analyzeDeviceCorrelations(reportData.submittedBy.deviceFingerprint);
        analysisDetails.deviceCorrelation = deviceCorrelation;
        score += deviceCorrelation.credibilityModifier;
        flags.push(...deviceCorrelation.flags);
      }

      // 4. Geographic pattern analysis
      if (reportData.location?.coordinates) {
        const geoAnalysis = await this.analyzeGeographicPatterns(reportData.location.coordinates, reportData.type);
        analysisDetails.geographic = geoAnalysis;
        score += geoAnalysis.credibilityModifier;
        flags.push(...geoAnalysis.flags);
      }

      // 5. Temporal pattern analysis
      const temporalAnalysis = await this.analyzeTemporalPatterns(reportData);
      analysisDetails.temporal = temporalAnalysis;
      score += temporalAnalysis.credibilityModifier;
      flags.push(...temporalAnalysis.flags);

      // 6. Threat intelligence correlation
      const threatAnalysis = await this.correlateThreatIntelligence(reportData);
      analysisDetails.threatIntelligence = threatAnalysis;
      score += threatAnalysis.credibilityModifier;
      flags.push(...threatAnalysis.flags);

      // Final score normalization
      score = Math.max(0, Math.min(100, score));

      let riskLevel = 'medium';
      let confidence = 'high';

      if (score >= 80) {
        riskLevel = 'low';
        confidence = 'very_high';
      } else if (score >= 60) {
        riskLevel = 'medium';
        confidence = 'high';
      } else if (score >= 40) {
        riskLevel = 'high';
        confidence = 'medium';
      } else {
        riskLevel = 'critical';
        confidence = 'high';
      }

      return {
        score,
        riskLevel,
        confidence,
        flags: [...new Set(flags)],
        analysis: 'Deep security analysis completed',
        analysisDetails,
        timestamp: new Date(),
        processingTime: Date.now() - (reportData.analysisStartTime || Date.now())
      };

    } catch (error) {
      console.error('❌ Deep security analysis failed:', error);
      return {
        score: 50,
        riskLevel: 'medium',
        confidence: 'low',
        flags: ['deep_analysis_failed'],
        analysis: 'Deep security analysis failed',
        error: error.message
      };
    }
  }

  async saveReportWithPriority(reportData, priority = 'standard') {
    const Report = require('../models/Report');

    const reportDoc = {
      type: this.getValidType(reportData.type),
      description: reportData.description || 'Emergency report',
      location: reportData.location || {
        type: 'Point',
        coordinates: [90.4125, 23.8103] // Dhaka center
      },
      severity: reportData.severity || (priority === 'emergency' ? 4 : 2),
      genderSensitive: reportData.genderSensitive || (priority === 'emergency'),
      status: priority === 'emergency' ? 'flagged' : 'verified',
      timestamp: new Date(),
      processingMode: priority,

      // Your existing Report model fields
      submittedBy: reportData.submittedBy || {
        deviceFingerprint: `${priority}_processor`,
        userType: 'citizen',
        ipAddress: '127.0.0.1'
      },

      // Processing status tracking (from your enhanced Report model)
      processingStatus: {
        distributedProcessing: {
          enabled: true,
          priority: priority === 'emergency' ? 1 : 3,
          tier: priority,
          processingStarted: new Date()
        },
        overallStatus: priority === 'emergency' ? 'pending' : 'processing'
      },

      // Security context
      securityScore: this.calculateSecurityScore(reportData, priority),
      securityFlags: {
        emergencyProcessing: priority === 'emergency',
        autoProcessed: true,
        processingTimestamp: new Date()
      }
    };

    try {
      const savedReport = await Report.create(reportDoc);
      console.log(`💾 Report saved with ${priority} priority: ${savedReport._id}`);

      // Update processing status
      await Report.findByIdAndUpdate(savedReport._id, {
        'processingStatus.distributedProcessing.reportId': savedReport._id,
        'processingStatus.lastUpdated': new Date()
      });

      return savedReport;
    } catch (error) {
      console.error('❌ Error saving report with priority:', error);
      throw error;
    }
  }

  async triggerEmergencyNotifications(report) {
    try {
      console.log(`🚨 EMERGENCY ALERT: Report ${report._id} requires immediate attention`);

      const notifications = [];

      // 1. WebSocket emergency broadcast (using your ScaledSocketHandler)
      try {
        const socketHandler = global.socketHandler || require('../websocket/scaledSocketHandler');
        if (socketHandler && typeof socketHandler.emergencyBroadcast === 'function') {
          await socketHandler.emergencyBroadcast({
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: report.location,
            message: `Emergency report: ${report.type} in ${this.getAreaName(report.location)}`,
            timestamp: new Date()
          });
          notifications.push('websocket_broadcast');
        }
      } catch (error) {
        console.warn('⚠️ WebSocket emergency broadcast failed:', error.message);
      }

      // 2. Email notifications to admin team (using your EmailService)
      try {
        const EmailService = require('../services/emailService');

        // Get admin emails from environment or database
        const adminEmails = process.env.ADMIN_EMERGENCY_EMAILS?.split(',') ||
          [process.env.ADMIN_EMAIL].filter(Boolean);

        for (const email of adminEmails) {
          await EmailService.sendEmergencyAlertEmail(email, {
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: this.getAreaName(report.location),
            timestamp: report.timestamp,
            securityScore: report.securityScore
          });
        }
        notifications.push('admin_emails');
      } catch (error) {
        console.warn('⚠️ Emergency email notifications failed:', error.message);
      }

      // 3. Queue SMS notifications (if SMS service available)
      try {
        if (this.distributedQueue) {
          await this.distributedQueue.addJob('emergencyReports', {
            type: 'sms_notification',
            reportId: report._id,
            urgency: 'critical'
          });
          notifications.push('sms_queued');
        }
      } catch (error) {
        console.warn('⚠️ SMS notification queueing failed:', error.message);
      }

      // 4. Admin dashboard notifications (using your socket system)
      try {
        const socketHandler = global.socketHandler;
        if (socketHandler && typeof socketHandler.emitToAdmins === 'function') {
          await socketHandler.emitToAdmins('emergency_report_alert', {
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: report.location,
            securityScore: report.securityScore,
            requiresImmediate: true
          });
          notifications.push('admin_dashboard');
        }
      } catch (error) {
        console.warn('⚠️ Admin dashboard notification failed:', error.message);
      }

      console.log(`✅ Emergency notifications triggered: ${notifications.join(', ')}`);

      return {
        success: true,
        notified: notifications,
        count: notifications.length
      };

    } catch (error) {
      console.error('❌ Emergency notification system failed:', error);
      return {
        success: false,
        error: error.message,
        notified: []
      };
    }
  }

  async triggerStandardNotifications(report) {
    try {
      console.log(`📧 Standard notifications for report ${report._id}`);

      const notifications = [];

      // 1. Admin email notification (non-urgent)
      try {
        const adminEmails = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',') ||
          [process.env.ADMIN_EMAIL].filter(Boolean);

        for (const email of adminEmails) {
          const EmailService = require('../services/emailService');
          await EmailService.sendStandardReportNotification(email, {
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: this.getAreaName(report.location),
            timestamp: report.timestamp
          });
        }
        notifications.push('admin_emails');
      } catch (error) {
        console.warn('⚠️ Standard email notifications failed:', error.message);
      }

      // 2. WebSocket notification to admin dashboard
      try {
        const socketHandler = global.socketHandler;
        if (socketHandler && typeof socketHandler.emitToAdmins === 'function') {
          await socketHandler.emitToAdmins('new_standard_report', {
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: report.location,
            timestamp: report.timestamp,
            requiresReview: report.severity >= 3
          });
          notifications.push('admin_dashboard');
        }
      } catch (error) {
        console.warn('⚠️ Admin dashboard notification failed:', error.message);
      }

      // 3. Queue SMS notifications for high severity
      if (report.severity >= 4) {
        try {
          if (this.distributedQueue) {
            await this.distributedQueue.addJob('emailQueue', {
              type: 'sms_notification',
              reportId: report._id,
              priority: 'high',
              severity: report.severity
            });
            notifications.push('sms_queued');
          }
        } catch (error) {
          console.warn('⚠️ SMS notification queueing failed:', error.message);
        }
      }

      // 4. Update community dashboard
      try {
        const socketHandler = global.socketHandler;
        if (socketHandler && socketHandler.io) {
          socketHandler.io.to('public_updates').emit('new_report_public', {
            type: report.type,
            area: this.getAreaName(report.location),
            severity: report.severity,
            timestamp: report.timestamp,
            // Don't include specific location or report ID for privacy
          });
          notifications.push('community_dashboard');
        }
      } catch (error) {
        console.warn('⚠️ Community dashboard notification failed:', error.message);
      }

      console.log(`✅ Standard notifications sent: ${notifications.join(', ')}`);

      return {
        success: true,
        notified: notifications,
        count: notifications.length
      };

    } catch (error) {
      console.error('❌ Standard notification system failed:', error);
      return {
        success: false,
        error: error.message,
        notified: []
      };
    }
  }


  async triggerMinimalNotifications(report) {
    try {
      console.log(`📧 Minimal notification: Report ${report._id} saved via emergency fallback`);

      const notifications = [];

      // 1. Console alert (always works)
      console.log(`🚨 EMERGENCY FALLBACK ALERT: ${report.type} report ${report._id} processed`);
      notifications.push('console_alert');

      // 2. Try basic email notification
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const EmailService = require('../services/emailService');
          await EmailService.sendFallbackAlertEmail(adminEmail, {
            reportId: report._id,
            type: report.type,
            timestamp: report.timestamp,
            fallbackReason: 'Emergency processing system failure'
          });
          notifications.push('admin_email');
        }
      } catch (error) {
        console.warn('⚠️ Minimal email notification failed:', error.message);
      }

      // 3. Try WebSocket notification (basic)
      try {
        const socketHandler = global.socketHandler;
        if (socketHandler && socketHandler.io) {
          socketHandler.io.emit('system_alert', {
            type: 'emergency_fallback',
            reportId: report._id,
            message: `Emergency report processed via fallback: ${report.type}`,
            timestamp: new Date()
          });
          notifications.push('websocket_alert');
        }
      } catch (error) {
        console.warn('⚠️ Minimal WebSocket notification failed:', error.message);
      }

      return {
        success: true,
        type: 'minimal',
        notifications
      };

    } catch (error) {
      console.error('❌ Minimal notification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async broadcastEmergencyAlert(report) {
    try {
      const socketHandler = global.socketHandler;

      if (socketHandler) {
        // Use your existing emergencyBroadcast method
        if (typeof socketHandler.emergencyBroadcast === 'function') {
          const alertId = await socketHandler.emergencyBroadcast({
            reportId: report._id,
            type: report.type,
            severity: report.severity,
            location: {
              area: this.getAreaName(report.location),
              coordinates: this.obfuscateLocation(report.location.coordinates)
            },
            message: this.generateEmergencyMessage(report),
            timestamp: new Date(),
            securityScore: report.securityScore
          });

          console.log(`📡 Emergency broadcast sent: Alert ID ${alertId}`);
          return { success: true, alertId, broadcasted: true };
        }

        // Fallback to manual WebSocket emit
        if (socketHandler.io) {
          const alertData = {
            id: `emergency_${Date.now()}`,
            reportId: report._id,
            type: 'emergency_alert',
            data: {
              reportType: report.type,
              severity: report.severity,
              area: this.getAreaName(report.location),
              message: this.generateEmergencyMessage(report),
              timestamp: new Date()
            }
          };

          socketHandler.io.emit('emergency_alert', alertData);
          console.log(`📡 Emergency alert broadcasted via WebSocket`);
          return { success: true, alertId: alertData.id, broadcasted: true };
        }
      }

      // No WebSocket available
      console.log(`⚠️ Emergency broadcast skipped - WebSocket unavailable`);
      return { success: false, broadcasted: false, reason: 'websocket_unavailable' };

    } catch (error) {
      console.error('❌ Emergency broadcast failed:', error);
      return { success: false, error: error.message, broadcasted: false };
    }
  }

  async broadcastMapUpdate(report) {
    try {
      const socketHandler = global.socketHandler;

      if (socketHandler && socketHandler.io) {
        // Create map update data (location obfuscated for privacy)
        const mapUpdate = {
          id: `map_update_${Date.now()}`,
          type: 'new_report',
          reportType: report.type,
          severity: report.severity,
          location: {
            area: this.getAreaName(report.location),
            coordinates: this.obfuscateLocation(report.location.coordinates, 200) // 200m obfuscation
          },
          timestamp: new Date(),
          safetyImpact: this.calculateSafetyImpact(report)
        };

        // Broadcast to map subscribers
        socketHandler.io.to('map_updates').emit('map_update', mapUpdate);

        // Also broadcast to public safety updates
        socketHandler.io.to('safety_updates').emit('safety_alert', {
          type: 'area_safety_update',
          area: mapUpdate.location.area,
          severity: report.severity,
          reportType: report.type,
          timestamp: mapUpdate.timestamp
        });

        console.log(`🗺️ Map update broadcasted for report ${report._id}`);
        return { success: true, broadcasted: true, updateId: mapUpdate.id };
      }

      console.log(`⚠️ Map update skipped - WebSocket unavailable`);
      return { success: false, broadcasted: false, reason: 'websocket_unavailable' };

    } catch (error) {
      console.error('❌ Map update broadcast failed:', error);
      return { success: false, error: error.message, broadcasted: false };
    }
  }


  async queueBackgroundAnalysis(report, options = {}) {
    try {
      const analysisJobs = [];

      if (this.distributedQueue) {
        // 1. Queue security analysis
        const securityJob = await this.distributedQueue.addJob('backgroundTasks', {
          type: 'security_analysis',
          reportId: report._id,
          priority: options.priority || 'high',
          analysisType: 'post_emergency',
          metadata: {
            originalSeverity: report.severity,
            processingMode: report.processingMode,
            timestamp: new Date()
          }
        });
        analysisJobs.push({ type: 'security', jobId: securityJob.jobId });

        // 2. Queue location enrichment
        if (report.location?.coordinates) {
          const locationJob = await this.distributedQueue.addJob('backgroundTasks', {
            type: 'location_enrichment',
            reportId: report._id,
            coordinates: report.location.coordinates,
            priority: options.priority || 'medium'
          });
          analysisJobs.push({ type: 'location', jobId: locationJob.jobId });
        }

        // 3. Queue analytics update
        const analyticsJob = await this.distributedQueue.addJob('analyticsQueue', {
          type: 'analytics_update',
          reportId: report._id,
          reportType: report.type,
          emergency: true,
          genderSensitive: report.genderSensitive
        });
        analysisJobs.push({ type: 'analytics', jobId: analyticsJob.jobId });

        // 4. Queue trend analysis (if female safety related)
        if (report.genderSensitive) {
          const trendJob = await this.distributedQueue.addJob('analyticsQueue', {
            type: 'female_safety_trends',
            reportId: report._id,
            location: report.location,
            priority: 'high'
          });
          analysisJobs.push({ type: 'trends', jobId: trendJob.jobId });
        }

        console.log(`📤 Background analysis queued: ${analysisJobs.length} jobs for report ${report._id}`);

      } else if (this.fallbackQueue) {
        // Use fallback queue system
        const fallbackJob = await this.fallbackQueue.addJob('backgroundTasks', {
          reportId: report._id,
          analysisType: 'post_emergency_fallback',
          priority: options.priority || 'high'
        });
        analysisJobs.push({ type: 'fallback', jobId: fallbackJob.jobId });

        console.log(`📤 Background analysis queued via fallback for report ${report._id}`);

      } else {
        console.log(`⚠️ Background analysis skipped for report ${report._id} - no queue available`);
      }

      return {
        success: true,
        queued: analysisJobs.length > 0,
        jobs: analysisJobs
      };

    } catch (error) {
      console.error('❌ Background analysis queueing failed:', error);
      return {
        success: false,
        error: error.message,
        queued: false
      };
    }
  }


  async enrichLocationData(coordinates) {
    try {
      console.log(`📍 Enriching location data for coordinates: ${coordinates}`);

      const [lng, lat] = coordinates;
      const enrichedData = {
        originalCoordinates: coordinates,
        enrichedAt: new Date()
      };

      // 1. Reverse geocoding (simplified for Bangladesh)
      enrichedData.address = await this.reverseGeocode(lat, lng);

      // 2. Find nearby safe zones
      try {
        const SafeZone = require('../models/SafeZone');
        const nearbyZones = await SafeZone.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: 1000 // 1km radius
            }
          }
        }).limit(5).select('name zoneType safetyScore distance');

        enrichedData.nearbySafeZones = nearbyZones;
      } catch (error) {
        console.warn('⚠️ Safe zone lookup failed:', error.message);
        enrichedData.nearbySafeZones = [];
      }

      // 3. Area safety assessment
      enrichedData.areaSafetyAssessment = await this.assessAreaSafety(lat, lng);

      // 4. Transport accessibility
      enrichedData.transportAccess = await this.analyzeTransportAccess(lat, lng);

      // 5. Population density analysis
      enrichedData.populationAnalysis = this.analyzePopulationDensity(lat, lng);

      // 6. Historical incident analysis
      enrichedData.historicalIncidents = await this.analyzeHistoricalIncidents(lat, lng);

      console.log(`✅ Location enrichment completed for ${enrichedData.address?.area || 'unknown area'}`);

      return {
        success: true,
        enriched: true,
        data: enrichedData
      };

    } catch (error) {
      console.error('❌ Location enrichment failed:', error);
      return {
        success: false,
        enriched: false,
        error: error.message,
        data: { originalCoordinates: coordinates }
      };
    }
  }

  async analyzeTrends(reportData) {
    try {
      console.log(`📊 Analyzing trends for report ${reportData._id}`);

      const Report = require('../models/Report');
      const trends = {
        analyzedAt: new Date(),
        reportType: reportData.type,
        location: reportData.location,
        patterns: {}
      };

      // 1. Temporal trends (same type, last 30 days)
      const temporalTrends = await Report.aggregate([
        {
          $match: {
            type: reportData.type,
            timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            status: { $in: ['verified', 'approved'] }
          }
        },
        {
          $group: {
            _id: {
              hour: { $hour: '$timestamp' },
              dayOfWeek: { $dayOfWeek: '$timestamp' }
            },
            count: { $sum: 1 },
            avgSeverity: { $avg: '$severity' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      trends.patterns.temporal = {
        peakHours: temporalTrends.slice(0, 3).map(t => t._id.hour),
        peakDays: temporalTrends.slice(0, 2).map(t => t._id.dayOfWeek),
        totalIncidents: temporalTrends.reduce((sum, t) => sum + t.count, 0)
      };

      // 2. Geographic trends (nearby incidents)
      if (reportData.location?.coordinates) {
        const [lng, lat] = reportData.location.coordinates;
        const geographicTrends = await Report.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: 500 // 500m radius
            }
          },
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
          status: { $in: ['verified', 'approved'] }
        }).limit(20);

        trends.patterns.geographic = {
          nearbyIncidents: geographicTrends.length,
          commonTypes: this.analyzeCommonTypes(geographicTrends),
          severityTrend: geographicTrends.reduce((sum, r) => sum + r.severity, 0) / geographicTrends.length || 0
        };
      }

      // 3. Severity trends for this type
      const severityTrends = await Report.aggregate([
        {
          $match: {
            type: reportData.type,
            timestamp: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Last 14 days
          }
        },
        {
          $group: {
            _id: '$severity',
            count: { $sum: 1 }
          }
        }
      ]);

      trends.patterns.severity = severityTrends.reduce((acc, item) => {
        acc[`severity_${item._id}`] = item.count;
        return acc;
      }, {});

      // 4. Female safety trends (if applicable)
      if (reportData.genderSensitive) {
        const femaleSafetyTrends = await Report.aggregate([
          {
            $match: {
              genderSensitive: true,
              timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              avgSeverity: { $avg: '$severity' }
            }
          },
          {
            $sort: { count: -1 }
          }
        ]);

        trends.patterns.femaleSafety = femaleSafetyTrends;
      }

      // 5. Trend analysis and predictions
      trends.analysis = this.generateTrendAnalysis(trends.patterns);

      console.log(`✅ Trend analysis completed for ${reportData.type}`);

      return {
        success: true,
        trends: trends,
        predictions: trends.analysis.predictions,
        riskLevel: trends.analysis.riskLevel
      };

    } catch (error) {
      console.error('❌ Trend analysis failed:', error);
      return {
        success: false,
        trends: { error: error.message },
        analyzed: false
      };
    }
  }

  async analyzeDeviceFingerprint(deviceFingerprint) {
    try {
      console.log(`🔍 Analyzing device fingerprint: ${deviceFingerprint}`);

      const DeviceFingerprint = require('../models/DeviceFingerprint');

      const device = await DeviceFingerprint.findOne({
        fingerprintId: deviceFingerprint
      });

      if (!device) {
        return {
          success: false,
          analyzed: false,
          error: 'Device fingerprint not found'
        };
      }

      const analysis = {
        fingerprintId: deviceFingerprint,
        analyzedAt: new Date(),
        deviceProfile: {}
      };

      // 1. Trust score analysis
      analysis.deviceProfile.trustScore = device.securityProfile.trustScore;
      analysis.deviceProfile.riskLevel = device.securityProfile.riskLevel;
      analysis.deviceProfile.quarantineStatus = device.securityProfile.quarantineStatus;

      // 2. Activity pattern analysis
      analysis.activityPattern = {
        totalSessions: device.activityHistory.totalSessions,
        averageSessionTime: device.analytics.averageSessionTime,
        lastSeen: device.activityHistory.lastSeen,
        reportingFrequency: device.analytics.totalReports / Math.max(1, device.activityHistory.totalSessions)
      };

      // 3. Security flags analysis
      analysis.securityAssessment = {
        flags: device.securityProfile.flags || [],
        anomalyScore: device.deviceAnomalyScore,
        threatLevel: device.threatIntelligence?.threatConfidence || 0,
        moderatorAlerts: device.moderatorAlerts || []
      };

      // 4. Device consistency analysis
      analysis.consistency = {
        deviceConsistencyScore: device.analytics.deviceConsistencyScore,
        networkConsistency: this.analyzeNetworkConsistency(device),
        locationConsistency: this.analyzeLocationConsistency(device),
        behaviorConsistency: this.analyzeBehaviorConsistency(device)
      };

      // 5. Cross-device correlation
      try {
        const correlatedDevices = await DeviceFingerprint.performCrossDeviceCorrelation(deviceFingerprint);
        analysis.correlations = {
          relatedDevices: correlatedDevices.length,
          highConfidenceMatches: correlatedDevices.filter(c => c.correlationScore > 70).length,
          suspiciousCorrelations: correlatedDevices.filter(c =>
            c.riskLevel === 'high' || c.trustScore < 30
          ).length
        };
      } catch (error) {
        console.warn('⚠️ Cross-device correlation failed:', error.message);
        analysis.correlations = { error: 'Analysis failed' };
      }

      // 6. Bangladesh-specific analysis
      if (device.bangladeshProfile) {
        analysis.bangladeshProfile = {
          crossBorderSuspicion: device.bangladeshProfile.crossBorderSuspicion,
          vpnUsage: device.bangladeshProfile.vpnUsage,
          locationJumps: device.locationProfile.locationJumps,
          networkProvider: device.networkProfile.networkProvider
        };
      }

      // 7. Generate recommendations
      analysis.recommendations = this.generateDeviceRecommendations(device, analysis);

      console.log(`✅ Device fingerprint analysis completed for ${deviceFingerprint}`);

      return {
        success: true,
        analyzed: true,
        analysis: analysis,
        riskAssessment: analysis.recommendations.riskAssessment
      };

    } catch (error) {
      console.error('❌ Device fingerprint analysis failed:', error);
      return {
        success: false,
        analyzed: false,
        error: error.message
      };
    }
  }

  async updateReportWithAnalysis(reportId, analysisResults) {
    try {
      console.log(`📊 Updating report ${reportId} with analysis results`);

      const Report = require('../models/Report');

      // Prepare update data
      const updateData = {
        'analysis.lastUpdated': new Date(),
        'analysis.analysisVersion': '2.0',
        'analysis.completedAnalyses': Object.keys(analysisResults)
      };

      // Add security analysis results
      if (analysisResults.security) {
        updateData['analysis.security'] = {
          score: analysisResults.security.score,
          riskLevel: analysisResults.security.riskLevel,
          flags: analysisResults.security.flags,
          confidence: analysisResults.security.confidence,
          lastAnalyzed: new Date()
        };
      }

      // Add location enrichment results
      if (analysisResults.location) {
        updateData['analysis.location'] = {
          enriched: analysisResults.location.success,
          address: analysisResults.location.data?.address,
          nearbySafeZones: analysisResults.location.data?.nearbySafeZones?.length || 0,
          areaSafetyScore: analysisResults.location.data?.areaSafetyAssessment?.score,
          lastEnriched: new Date()
        };
      }

      // Add trend analysis results
      if (analysisResults.trends) {
        updateData['analysis.trends'] = {
          analyzed: analysisResults.trends.success,
          riskLevel: analysisResults.trends.riskLevel,
          nearbyIncidents: analysisResults.trends.trends?.patterns?.geographic?.nearbyIncidents,
          temporalPattern: analysisResults.trends.trends?.patterns?.temporal?.peakHours,
          lastAnalyzed: new Date()
        };
      }

      // Add device analysis results
      if (analysisResults.device) {
        updateData['analysis.device'] = {
          analyzed: analysisResults.device.success,
          trustScore: analysisResults.device.analysis?.deviceProfile?.trustScore,
          riskLevel: analysisResults.device.analysis?.deviceProfile?.riskLevel,
          anomalyScore: analysisResults.device.analysis?.securityAssessment?.anomalyScore,
          lastAnalyzed: new Date()
        };
      }

      // Update overall analysis score
      updateData['analysis.overallScore'] = this.calculateOverallAnalysisScore(analysisResults);
      updateData['analysis.analysisCompleted'] = true;

      // Update processing status
      updateData['processingStatus.lastUpdated'] = new Date();
      updateData['processingStatus.analysisPhaseCompleted'] = true;

      // Perform the update
      const updatedReport = await Report.findByIdAndUpdate(
        reportId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!updatedReport) {
        throw new Error('Report not found for update');
      }

      console.log(`✅ Report ${reportId} updated with analysis results`);

      return {
        success: true,
        reportId: reportId,
        analysesApplied: Object.keys(analysisResults),
        overallScore: updateData['analysis.overallScore']
      };

    } catch (error) {
      console.error(`❌ Failed to update report ${reportId} with analysis:`, error);
      return {
        success: false,
        reportId: reportId,
        error: error.message
      };
    }
  }

  async updateAnalyticsCounters(reportData) {
    try {
      console.log(`📈 Updating analytics counters for report type: ${reportData.type}`);

      // 1. Update daily counters
      await this.updateDailyCounters(reportData);

      // 2. Update type-specific counters
      await this.updateTypeCounters(reportData);

      // 3. Update location-based counters
      if (reportData.location?.coordinates) {
        await this.updateLocationCounters(reportData);
      }

      // 4. Update severity counters
      await this.updateSeverityCounters(reportData);

      // 5. Update gender-sensitive counters
      if (reportData.genderSensitive) {
        await this.updateGenderSafetyCounters(reportData);
      }

      // 6. Update time-based counters
      await this.updateTimeBasedCounters(reportData);

      console.log(`✅ Analytics counters updated for ${reportData.type}`);

      return {
        success: true,
        countersUpdated: [
          'daily',
          'type',
          reportData.location ? 'location' : null,
          'severity',
          reportData.genderSensitive ? 'gender_safety' : null,
          'time_based'
        ].filter(Boolean)
      };

    } catch (error) {
      console.error('❌ Analytics counter update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }


  async updateTrendData(reportData) {
    try {
      console.log(`📊 Updating trend data for ${reportData.type}`);

      const TrendAnalytics = require('../models/TrendAnalytics') || this.createTrendModel();

      // 1. Update hourly trends
      const hour = new Date(reportData.timestamp).getHours();
      await this.updateHourlyTrends(reportData.type, hour, reportData.severity);

      // 2. Update daily trends
      const date = new Date(reportData.timestamp).toISOString().split('T')[0];
      await this.updateDailyTrends(reportData.type, date, reportData);

      // 3. Update location-based trends
      if (reportData.location?.coordinates) {
        await this.updateLocationTrends(reportData);
      }

      // 4. Update severity trends
      await this.updateSeverityTrends(reportData);

      // 5. Update gender safety trends
      if (reportData.genderSensitive) {
        await this.updateGenderSafetyTrends(reportData);
      }

      // 6. Update emerging patterns
      await this.updateEmergingPatterns(reportData);

      console.log(`✅ Trend data updated for ${reportData.type}`);

      return {
        success: true,
        trendsUpdated: [
          'hourly',
          'daily',
          reportData.location ? 'location' : null,
          'severity',
          reportData.genderSensitive ? 'gender_safety' : null,
          'emerging_patterns'
        ].filter(Boolean)
      };

    } catch (error) {
      console.error('❌ Trend data update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }


  async updateAreaSafetyScore(coordinates, reportData) {
    try {
      console.log(`🏠 Updating area safety score for coordinates: ${coordinates}`);

      const [lng, lat] = coordinates;

      // 1. Calculate impact on area safety
      const safetyImpact = this.calculateSafetyImpact(reportData);

      // 2. Find nearby safe zones to update
      const SafeZone = require('../models/SafeZone');
      const nearbyZones = await SafeZone.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 1000 // 1km radius
          }
        }
      });

      const updatedZones = [];

      // 3. Update each nearby zone's safety score
      for (const zone of nearbyZones) {
        const distance = this.calculateDistance(
          lat, lng,
          zone.location.coordinates[1], zone.location.coordinates[0]
        );

        // Calculate impact based on distance (closer = more impact)
        const distanceWeight = Math.max(0, 1 - (distance / 1000)); // Linear decay over 1km
        const impactScore = safetyImpact * distanceWeight;

        // Update zone safety score
        const newSafetyScore = Math.max(1, Math.min(10, zone.safetyScore - impactScore));

        await SafeZone.findByIdAndUpdate(zone._id, {
          $set: {
            safetyScore: newSafetyScore,
            'analytics.lastIncidentUpdate': new Date(),
            'analytics.incidentImpactScore': impactScore
          },
          $inc: {
            'analytics.nearbyIncidents': 1
          }
        });

        updatedZones.push({
          zoneId: zone._id,
          zoneName: zone.name,
          oldScore: zone.safetyScore,
          newScore: newSafetyScore,
          impactScore: impactScore,
          distance: Math.round(distance)
        });
      }

      // 4. Update area-wide safety metrics
      await this.updateRegionalSafetyMetrics(lat, lng, reportData);

      // 5. Trigger safety score recalculation for the area
      await this.triggerAreaSafetyRecalculation(lat, lng);

      console.log(`✅ Area safety score updated for ${updatedZones.length} zones`);

      return {
        success: true,
        updatedZones: updatedZones.length,
        zones: updatedZones,
        safetyImpact: safetyImpact
      };

    } catch (error) {
      console.error('❌ Area safety score update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFemaleSafetyMetrics(reportData) {
    try {
      console.log(`👩 Updating female safety metrics for ${reportData.type}`);

      // 1. Update overall female safety counters
      await this.updateFemaleSafetyCounters(reportData);

      // 2. Update location-specific female safety
      if (reportData.location?.coordinates) {
        await this.updateLocationFemaleSafety(reportData);
      }

      // 3. Update time-based female safety patterns
      await this.updateTimeBasedFemaleSafety(reportData);

      // 4. Update transport-related female safety
      if (this.isTransportRelated(reportData.type)) {
        await this.updateTransportFemaleSafety(reportData);
      }

      // 5. Update harassment pattern metrics
      if (this.isHarassmentType(reportData.type)) {
        await this.updateHarassmentPatterns(reportData);
      }

      // 6. Update safe zone female safety scores
      if (reportData.location?.coordinates) {
        await this.updateSafeZoneFemaleSafety(reportData);
      }

      // 7. Trigger female safety alerts if needed
      await this.checkFemaleSafetyThresholds(reportData);

      console.log(`✅ Female safety metrics updated for ${reportData.type}`);

      return {
        success: true,
        metricsUpdated: [
          'counters',
          reportData.location ? 'location' : null,
          'time_patterns',
          this.isTransportRelated(reportData.type) ? 'transport' : null,
          this.isHarassmentType(reportData.type) ? 'harassment' : null,
          reportData.location ? 'safe_zones' : null
        ].filter(Boolean)
      };

    } catch (error) {
      console.error('❌ Female safety metrics update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }


  // ===== MONITORING AND STATISTICS =====

  /**
   * Setup monitoring
   */
  setupMonitoring() {
    // Log statistics every 5 minutes
    setInterval(() => {
      this.logProcessingStatistics();
    }, 300000);

    // Reset statistics every hour
    setInterval(() => {
      this.resetStatistics();
    }, 3600000);
  }

  /**
   * Update processing statistics
   */
  updateProcessingStats(tier, processingTime) {
    this.stats.processed++;
    this.stats[tier] = (this.stats[tier] || 0) + 1;

    // Update average processing time
    const alpha = 0.1;
    this.stats.avgProcessingTime = alpha * processingTime +
      (1 - alpha) * this.stats.avgProcessingTime;
  }

  /**
   * Log processing statistics
   */
  logProcessingStatistics() {
    const uptime = Date.now() - this.stats.lastResetTime;
    const throughput = (this.stats.processed / uptime) * 1000 * 60; // per minute

    console.log('📊 Report Processing Statistics:', {
      ...this.stats,
      throughputPerMinute: throughput.toFixed(2),
      uptime: `${Math.round(uptime / 60000)} minutes`
    });
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      processed: 0,
      emergency: 0,
      standard: 0,
      background: 0,
      failed: 0,
      avgProcessingTime: this.stats.avgProcessingTime, // Keep average
      lastResetTime: Date.now()
    };
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.stats.lastResetTime;
    const throughput = uptime > 0 ? (this.stats.processed / uptime) * 1000 * 60 : 0;

    return {
      ...this.stats,
      throughputPerMinute: throughput,
      uptime,
      queueStatus: this.distributedQueue ? 'distributed' :
        this.fallbackQueue ? 'fallback' : 'direct'
    };
  }

  /**
   * Initialize fallback mode
   */
  async initializeFallbackMode() {
    console.warn('⚠️ Initializing report processor in fallback mode');

    this.distributedQueue = null;
    this.fallbackQueue = null;

    // Ensure basic functionality
    this.isInitialized = true;

    console.log('✅ Report processor running in fallback mode (direct processing only)');
  }
}

// Export singleton instance
const reportProcessor = new ReportProcessor();

module.exports = {
  reportProcessor,
  ReportProcessor
};