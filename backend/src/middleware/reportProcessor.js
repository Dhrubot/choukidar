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
      if (tier === 'emergency') {
        setImmediate(async () => {
          try {
            await this.processEmergencyReport(reportData, { ...options, emergencyMode: true });
          } catch (error) {
            console.error('❌ Emergency immediate processing failed:', error);
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

    try {
      console.log(`🚨 EMERGENCY: Processing critical report ${reportData._id}`);

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

      // 6. Queue background analysis (non-blocking)
      this.queueBackgroundAnalysis(savedReport, { priority: 'high' });

      const processingTime = Date.now() - startTime;

      console.log(`✅ Emergency report processed in ${processingTime}ms`);

      this.stats.emergency++;

      return {
        success: true,
        reportId: savedReport._id,
        processingTime,
        securityScore: securityAnalysis.score,
        emergencyAlerts: true,
        backgroundAnalysisQueued: true
      };

    } catch (error) {
      console.error('❌ Emergency report processing failed:', error);

      // Emergency fallback: Save with minimal processing
      try {
        const Report = require('../models/Report');
        const savedReport = await Report.create({
          type: this.getValidType(reportData.type),
          description: reportData.description || 'Emergency fallback report',
          location: reportData.location || { coordinates: [90.4125, 23.8103] },
          severity: typeof reportData.severity === 'number' ? reportData.severity : 3,
          genderSensitive: reportData.genderSensitive || false,
          status: 'flagged',
          processingErrors: [error.message],
          timestamp: new Date()
        });

        return {
          success: true,
          reportId: savedReport._id,
          fallback: true,
          warning: 'Emergency fallback processing used'
        };

      } catch (fallbackError) {
        console.error('❌ Emergency fallback also failed:', fallbackError);
        throw new Error(`Emergency processing failed: ${error.message}`);
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

  /**
   * Sanitize report data for processing
   */
  sanitizeReportData(reportData) {
    // Remove sensitive fields and sanitize
    const sanitized = {
      type: reportData.type,
      description: reportData.description,
      location: reportData.location,
      severity: reportData.severity,
      genderSensitive: reportData.genderSensitive,
      timestamp: reportData.timestamp || new Date(),
      deviceFingerprint: reportData.deviceFingerprint,
      userContext: reportData.userContext
    };

    // Remove any potential XSS or injection content
    if (sanitized.description) {
      sanitized.description = sanitized.description
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .substring(0, 1000); // Limit length
    }

    return sanitized;
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
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ===== PLACEHOLDER METHODS (to be implemented) =====

  async performEmergencySecurityAnalysis(reportData) {
    return { score: 85, flags: ['emergency'], confidence: 'high' };
  }

  async performStandardSecurityAnalysis(reportData) {
    return { score: 70, flags: [], confidence: 'medium' };
  }

  async performDeepSecurityAnalysis(reportData) {
    return { score: 75, flags: [], confidence: 'high', analysis: 'complete' };
  }

  async saveReportWithPriority(reportData, priority) {
    const Report = require('../models/Report');
    return await Report.create({ ...reportData, status: 'pending' });
  }

  async triggerEmergencyNotifications(report) {
    console.log(`🚨 Emergency notifications triggered for ${report._id}`);
  }

  async triggerStandardNotifications(report) {
    console.log(`📧 Standard notifications triggered for ${report._id}`);
  }

  async triggerMinimalNotifications(report) {
    console.log(`📨 Minimal notifications triggered for ${report._id}`);
  }

  async broadcastEmergencyAlert(report) {
    console.log(`📡 Emergency alert broadcasted for ${report._id}`);
  }

  async broadcastMapUpdate(report) {
    console.log(`🗺️ Map update broadcasted for ${report._id}`);
  }

  queueBackgroundAnalysis(report, options = {}) {
    if (this.distributedQueue) {
      this.distributedQueue.addJob('backgroundTasks', {
        reportId: report._id,
        taskType: 'security_analysis',
        priority: options.priority || 'normal'
      }).catch(console.error);
    }
  }

  async enrichLocationData(coordinates) {
    return { enriched: true, coordinates };
  }

  async analyzeTrends(reportData) {
    return { trends: 'analyzed' };
  }

  async analyzeDeviceFingerprint(deviceFingerprint) {
    return { analyzed: true };
  }

  async updateReportWithAnalysis(reportId, analysisResults) {
    console.log(`📊 Updated report ${reportId} with analysis`);
  }

  async updateAnalyticsCounters(reportData) {
    console.log(`📈 Analytics counters updated`);
  }

  async updateTrendData(reportData) {
    console.log(`📊 Trend data updated`);
  }

  async updateAreaSafetyScore(coordinates, reportData) {
    console.log(`🏠 Area safety score updated`);
  }

  async updateFemaleSafetyMetrics(reportData) {
    console.log(`👩 Female safety metrics updated`);
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