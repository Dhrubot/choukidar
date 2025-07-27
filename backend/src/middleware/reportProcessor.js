// === src/middleware/reportProcessor.js (ENHANCED WITH CONNECTION VALIDATION) ===
// Enhanced Report Processor with Bangladesh-Scale Distributed Queue Integration
// CRITICAL FIX: Adds connection validation to prevent "Client must be connected" errors
// Handles 25,000+ concurrent users with intelligent processing tiers

const crypto = require('crypto');
const mongoose = require('mongoose');
const { productionLogger } = require('../utils/productionLogger');

// CRITICAL FIX: Import new connection validation systems
const { databaseHealthChecker } = require('./databaseHealthChecker');

class ReportProcessor {
  constructor() {
    this.isInitialized = false;
    this.distributedQueue = null;
    this.fallbackQueue = null;

    // PRESERVED: Your original processing statistics
    this.stats = {
      processed: 0,
      emergency: 0,
      standard: 0,
      background: 0,
      failed: 0,
      avgProcessingTime: 0,
      lastResetTime: Date.now()
    };

    // PRESERVED: Your original Bangladesh-specific processing config
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

    // PRESERVED: Your original processing tiers for Bangladesh scale
    this.processingTiers = {
      // CRITICAL: Immediate processing (female safety, violence)
      emergency: {
        priority: 1,
        maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_EMERGENCY) || 5,
        maxProcessingTime: parseInt(process.env.EMERGENCY_PROCESSING_TIMEOUT) || 30000,
        queue: 'emergencyReports',
        description: 'Female safety, violence, immediate threats'
      },

      // HIGH: Standard safety reports
      standard: {
        priority: 2,
        maxConcurrentJobs: 50,
        maxProcessingTime: 15000, // 15 seconds max
        queue: 'standardReports',
        description: 'Safety concerns, harassment, theft'
      },

      // MEDIUM: Background analysis
      background: {
        priority: 3,
        maxConcurrentJobs: 20,
        maxProcessingTime: 60000, // 1 minute max
        queue: 'backgroundTasks',
        description: 'Security analysis, trend detection'
      },

      // LOW: Analytics and insights
      analytics: {
        priority: 4,
        maxConcurrentJobs: 10,
        maxProcessingTime: 300000, // 5 minutes max
        queue: 'analyticsQueue',
        description: 'Data aggregation, insights'
      }
    };

    // PRESERVED: Your original memory management
    this.emergencyProcessingSet = new Set();
    this.MAX_EMERGENCY_SET_SIZE = 50; // Prevent memory growth

    // Use circular buffer for recent processing cache (fixed size)
    this.recentlyProcessed = new Map();
    this.recentlyProcessedOrder = []; // Track insertion order
    this.MAX_RECENT_CACHE = 100; // Fixed maximum size

    // Use WeakMap for processing reports (automatic cleanup)
    this.processingReports = new Map();
    this.MAX_PROCESSING_CONCURRENT = 50; // Prevent runaway processing

    // NEW: Connection validation cache and tracking
    this.lastConnectionCheck = 0;
    this.connectionCheckInterval = 5000; // 5 seconds
    this.lastKnownConnectionState = false;
    
    // NEW: Enhanced error tracking for connection issues
    this.connectionErrors = new Map();
    this.fallbackStats = {
      totalAttempts: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
      connectionRecoveries: 0
    };

    // PRESERVED: Single cleanup interval instead of individual timeouts
    this.setupMemoryEfficientCleanup();
  }

  // =================================================================
  // === CRITICAL FIX: CONNECTION VALIDATION LAYER ==================
  // =================================================================

  /**
   * NEW: Validate database connection before any operation
   */
  async validateDatabaseConnection(operationType = 'general') {
    try {
      // Use cached result if recent enough
      const now = Date.now();
      if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
        return this.lastKnownConnectionState;
      }

      // Perform fresh connection check
      const readiness = await databaseHealthChecker.isDatabaseReady();
      
      this.lastConnectionCheck = now;
      this.lastKnownConnectionState = readiness.ready;

      if (!readiness.ready) {
        console.warn(`⚠️ Database not ready for ${operationType}: ${readiness.reason}`);
        
        // Track connection errors by type
        if (!this.connectionErrors.has(operationType)) {
          this.connectionErrors.set(operationType, 0);
        }
        this.connectionErrors.set(operationType, this.connectionErrors.get(operationType) + 1);
        
        return false;
      }

      // Reset error count on successful connection
      this.connectionErrors.delete(operationType);
      return true;

    } catch (error) {
      console.error(`❌ Connection validation failed for ${operationType}:`, error.message);
      this.lastKnownConnectionState = false;
      return false;
    }
  }

  /**
   * NEW: Execute database operation with connection validation and retry
   */
  async withConnectionValidation(operation, operationType = 'database_operation', options = {}) {
    const { maxRetries = 3, retryDelay = 1000, fallbackAllowed = true } = options;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Validate connection before operation
        const isConnected = await this.validateDatabaseConnection(operationType);
        
        if (!isConnected) {
          if (attempt === maxRetries && fallbackAllowed) {
            console.log(`🔄 Attempting connection recovery for ${operationType}...`);
            await this.attemptConnectionRecovery();
            
            // One final check after recovery attempt
            const recoveredConnection = await this.validateDatabaseConnection(operationType);
            if (!recoveredConnection) {
              throw new Error('Database connection not available after recovery attempt');
            }
          } else if (attempt < maxRetries) {
            console.log(`⏳ Retrying ${operationType} in ${retryDelay}ms (attempt ${attempt}/${maxRetries})`);
            await this.sleep(retryDelay * attempt); // Exponential backoff
            continue;
          } else {
            throw new Error('Database connection not available');
          }
        }

        // Execute operation with timeout protection
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), 30000)
          )
        ]);

        // Success - reset retry count
        return result;

      } catch (error) {
        console.error(`❌ ${operationType} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await this.sleep(retryDelay * attempt);
      }
    }
  }

  /**
   * NEW: Attempt to recover database connection
   */
  async attemptConnectionRecovery() {
    try {
      console.log('🔄 Attempting database connection recovery...');
      
      // Check if mongoose is disconnected
      if (mongoose.connection.readyState !== 1) {
        console.log('🔌 Triggering connection pool recovery...');
        
        // Trigger connection pool manager recovery if available
        try {
          const { connectionPoolManager } = require('../config/connectionPoolManager');
          await connectionPoolManager.attemptConnectionRecovery();
          this.fallbackStats.connectionRecoveries++;
          console.log('✅ Connection recovery completed');
        } catch (poolError) {
          console.warn('⚠️ Connection pool manager not available:', poolError.message);
          
          // Fallback: Simple mongoose reconnection
          await mongoose.connection.close();
          await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 100,
            minPoolSize: 10,
            socketTimeoutMS: 30000,
            serverSelectionTimeoutMS: 3000
          });
          console.log('✅ Basic connection recovery completed');
        }
      }
      
    } catch (error) {
      console.error('❌ Connection recovery failed:', error.message);
      throw error;
    }
  }

  /**
   * NEW: Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * PRESERVED: Initialize the report processor with distributed queue
   */
  async initialize() {
    try {
      console.log('🚀 Initializing enhanced report processor with connection validation...');

      // NEW: Test initial database connection
      const connectionReady = await this.validateDatabaseConnection('initialization');
      
      if (!connectionReady) {
        console.warn('⚠️ Database not ready during initialization - will retry operations');
      }

      // PRESERVED: Initialize distributed queue service
      await this.initializeDistributedQueue();

      // PRESERVED: Initialize fallback mechanisms
      await this.initializeFallbackSystems();

      // PRESERVED: Setup monitoring
      this.setupMonitoring();

      // NEW: Start offline report recovery monitoring
      this.startOfflineRecoveryMonitoring();

      this.isInitialized = true;

      console.log('✅ Enhanced report processor initialized');
      console.log(`📊 Processing tiers: Emergency, Standard, Background, Analytics`);

      return { 
        success: true, 
        message: 'Report processor ready with connection validation',
        connectionReady 
      };

    } catch (error) {
      console.error('❌ Report processor initialization failed:', error);

      // PRESERVED: Attempt graceful degradation
      await this.initializeFallbackMode();

      throw error;
    }
  }

  /**
   * PRESERVED: Initialize distributed queue system
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
   * PRESERVED: Initialize fallback systems
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

  /**
   * PRESERVED: Get a valid type from the original data or use a safe default
   */
  getValidType(originalType) {
    const validTypes = [
      'chadabaji', 'teen_gang', 'chintai', 'political_harassment', 'other',
      'eve_teasing', 'stalking', 'inappropriate_touch', 'verbal_harassment',
      'unsafe_transport', 'workplace_harassment', 'domestic_incident', 'unsafe_area_women',
      'emergency'  // You added this
    ];

    return validTypes.includes(originalType) ? originalType : 'emergency';
  }

  /**
   * PRESERVED: MAIN ENTRY POINT: Process any report with intelligent routing
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
   * PRESERVED: 🚨 CRITICAL FIX: Missing function that routes/reports.js needs
   */
  async queueReportForProcessing(reportId, phases = ['immediate', 'fast', 'analysis']) {
    try {
      console.log(`📋 Queueing report ${reportId} for processing with phases: ${phases.join(', ')}`);
      
      const Report = require('../models/Report');
      
      // NEW: Validate connection before database operation
      return await this.withConnectionValidation(async () => {
        // Try distributed queue first
        if (this.distributedQueue && this.distributedQueue.isInitialized) {
          const report = await Report.findById(reportId);
          if (!report) {
            throw new Error('Report not found');
          }

          // Determine processing tier
          const tier = report.determineProcessingTier ? report.determineProcessingTier() : 'standard';

          // Add to distributed queue
          await this.distributedQueue.addToQueue(tier, {
            reportId,
            phases,
            priority: report.genderSensitive || report.severity >= 4 ? 1 : 2
          });

          this.stats.processed++;
          return { success: true, tier, method: 'distributed' };
        }

        // Fallback to legacy queue
        if (this.fallbackQueue && this.fallbackQueue.isAvailable()) {
          await this.fallbackQueue.addJob('reportProcessing', {
            reportId,
            phases,
            priority: 2
          });

          this.stats.processed++;
          return { success: true, tier: 'fallback', method: 'legacy' };
        }

        // Direct processing fallback
        console.warn('⚠️ No queue available, processing directly');
        await this.processReportDirect(reportId, phases);

        this.stats.processed++;
        return { success: true, tier: 'direct', method: 'direct' };

      }, 'queue_report_processing', {
        maxRetries: 3,
        retryDelay: 1000,
        fallbackAllowed: true
      });

    } catch (error) {
      console.error('❌ Failed to queue report for processing:', error);
      this.stats.failed++;
      throw error;
    }
  }

  /**
   * PRESERVED: 📊 Get report processing statistics
   */
  getReportProcessingStats() {
    const uptime = Date.now() - this.stats.lastResetTime;
    const throughput = uptime > 0 ? (this.stats.processed / uptime) * 1000 * 60 : 0;

    return {
      ...this.stats,
      throughputPerMinute: throughput,
      uptime,
      queueStatus: this.distributedQueue ? 'distributed' :
        this.fallbackQueue ? 'fallback' : 'direct',
      isInitialized: this.isInitialized,
      // NEW: Connection health information
      connectionHealth: {
        isConnected: this.lastKnownConnectionState,
        lastCheck: new Date(this.lastConnectionCheck),
        totalErrors: Array.from(this.connectionErrors.values())
          .reduce((sum, count) => sum + count, 0),
        errorsByType: Object.fromEntries(this.connectionErrors)
      },
      fallbackStats: { ...this.fallbackStats }
    };
  }

  /**
   * PRESERVED: 👩 Get female safety statistics  
   */
  getFemaleSafetyStats() {
    return {
      emergencyReports: this.stats.emergency,
      totalProcessed: this.stats.processed,
      emergencyProcessingTime: this.stats.avgProcessingTime,
      queueStatus: this.distributedQueue ? 'distributed' : 'fallback',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * PRESERVED: 🔄 Direct processing fallback
   */
  async processReportDirect(reportId, phases) {
    try {
      // NEW: Use connection validation for database operations
      return await this.withConnectionValidation(async () => {
        const Report = require('../models/Report');
        const report = await Report.findById(reportId);
        if (!report) {
          throw new Error('Report not found');
        }

        // Update processing status
        await Report.findByIdAndUpdate(reportId, {
          $set: {
            'processingStatus.overallStatus': 'processed',
            'processingStatus.processingMode': 'direct',
            'processingStatus.lastUpdated': new Date()
          }
        });

        console.log(`✅ Report ${reportId} processed directly`);
        return { success: true };

      }, 'direct_processing', {
        maxRetries: 2,
        retryDelay: 1500,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error(`❌ Direct processing failed for ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * NEW: Start monitoring for offline report recovery
   */
  startOfflineRecoveryMonitoring() {
    // Check every 30 seconds for offline reports to process
    setInterval(async () => {
      try {
        if (global.offlineReports && global.offlineReports.length > 0) {
          await this.processOfflineReports();
        }
      } catch (error) {
        console.error('❌ Offline recovery monitoring error:', error.message);
      }
    }, 30000);
  }

  /**
   * NEW: Process offline reports when database becomes available
   */
  async processOfflineReports() {
    if (!global.offlineReports || global.offlineReports.length === 0) {
      return;
    }

    console.log(`🔄 Processing ${global.offlineReports.length} offline reports...`);

    const processed = [];
    const failed = [];

    for (const offlineReport of global.offlineReports) {
      try {
        // Check if database is now available
        const connectionAvailable = await this.validateDatabaseConnection('offline_recovery');
        
        if (connectionAvailable) {
          // Process the offline report
          const result = await this.processEmergencyReport(offlineReport.data, {
            isOfflineRecovery: true,
            originalOfflineId: offlineReport.id
          });

          processed.push({
            offlineId: offlineReport.id,
            newReportId: result.reportId,
            result
          });

          console.log(`✅ Offline report processed: ${offlineReport.id} -> ${result.reportId}`);

        } else {
          console.log('⚠️ Database still not available for offline report processing');
          break; // Stop processing if database is not available
        }

      } catch (error) {
        console.error(`❌ Failed to process offline report ${offlineReport.id}:`, error.message);
        failed.push({
          offlineId: offlineReport.id,
          error: error.message
        });
      }
    }

    // Remove successfully processed reports
    global.offlineReports = global.offlineReports.filter(report => 
      !processed.some(p => p.offlineId === report.id)
    );

    if (processed.length > 0) {
      console.log(`✅ Processed ${processed.length} offline reports successfully`);
    }
    if (failed.length > 0) {
      console.log(`❌ Failed to process ${failed.length} offline reports`);
    }

    return { processed, failed };
  }

  /**
   * PRESERVED: Analyze report to determine processing requirements
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
   * PRESERVED: Route report to appropriate processing tier
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
   * PRESERVED: Process via distributed queue system
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
   * PRESERVED: Process via fallback queue system
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
   * PRESERVED: Process report directly (synchronous)
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

  // =================================================================
  // === BANGLADESH-SPECIFIC ANALYSIS METHODS (ALL PRESERVED) =======
  // =================================================================

  /**
   * PRESERVED: Check if report is from Bangladesh
   */
  isWithinBangladesh(coordinates) {
    if (!coordinates || coordinates.length !== 2) return false;

    const [lng, lat] = coordinates;
    const bounds = this.bangladeshConfig.bounds;

    return lat >= bounds.minLat && lat <= bounds.maxLat &&
      lng >= bounds.minLng && lng <= bounds.maxLng;
  }

  /**
   * PRESERVED: Analyze location for priority zones
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
   * PRESERVED: Detect female safety reports
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
   * PRESERVED: Detect violence reports
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
   * PRESERVED: Check if report is a safety report
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
   * PRESERVED: Check if report requires background analysis
   */
  requiresBackgroundAnalysis(reportData) {
    return reportData.deviceFingerprint ||
      reportData.location?.coordinates ||
      reportData.severity === 'high' ||
      reportData.genderSensitive;
  }

  /**
   * PRESERVED: Check if report requires analytics
   */
  requiresAnalytics(reportData) {
    return true; // All reports contribute to analytics
  }

  /**
   * PRESERVED: Check if report is critical
   */
  isCriticalReport(reportData) {
    return this.isFemaleSafetyReport(reportData) ||
      this.isViolenceReport(reportData) ||
      reportData.severity === 'critical';
  }

  /**
   * PRESERVED: Calculate distance between two points (Haversine formula)
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
   * PRESERVED: Get processing delay based on tier
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
   * PRESERVED: Map tier to fallback queue type
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
   * PRESERVED: Calculate security score based on multiple factors
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
   * PRESERVED: Get area name from coordinates (simplified)
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
   * PRESERVED: Obfuscate location coordinates for privacy
   */
  obfuscateLocation(coordinates, radiusMeters = 100) {
    if (!coordinates || coordinates.length !== 2) return null;

    const [lng, lat] = coordinates;
    const obfuscation = (radiusMeters / 111000); // ~100m radius per degree

    return [
      lng + (Math.random() - 0.5) * obfuscation,
      lat + (Math.random() - 0.5) * obfuscation
    ];
  }

  /**
   * PRESERVED: Generate emergency message
   */
  generateEmergencyMessage(report) {
    const area = this.getAreaName(report.location);
    const time = new Date(report.timestamp).toLocaleTimeString();

    return `EMERGENCY: ${report.type} reported in ${area} at ${time}. Security score: ${report.securityScore}`;
  }

  /**
   * PRESERVED: Calculate safety impact
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
   * PRESERVED: Transport-related check
   */
  isTransportRelated(type) {
    return ['unsafe_transport', 'harassment'].includes(type);
  }

  /**
   * PRESERVED: Harassment type check
   */
  isHarassmentType(type) {
    return ['harassment', 'eve_teasing', 'stalking', 'inappropriate_behavior'].includes(type);
  }

  // =================================================================
  // === ENHANCED EMERGENCY PROCESSING WITH CONNECTION VALIDATION ===
  // =================================================================

  /**
   * ENHANCED: EMERGENCY PROCESSING with connection validation
   * Preserves all your original logic while adding connection safety
   */
  async processEmergencyReport(reportData, options = {}) {
    const startTime = Date.now();
    const reportId = reportData._id || reportData.id || `temp_${Date.now()}`;

    // PRESERVED: Check cache first (memory-efficient)
    const cached = this.recentlyProcessed.get(reportId);
    if (cached && Date.now() - cached.timestamp < 120000) { // 2 minutes cache
      console.log(`⚡ Using cached emergency result for ${reportId}`);
      return {
        ...cached.result,
        fromCache: true,
        processingTime: cached.processingTime
      };
    }

    // PRESERVED: Simple processing state check
    if (this.processingReports.has(reportId)) {
      console.log(`⚠️ Report ${reportId} already processing, waiting...`);
      return await this.processingReports.get(reportId);
    }

    // ENHANCED: Create processing promise with connection validation
    const processingPromise = Promise.race([
      this._processEmergencyInternal(reportData, options, startTime, reportId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Emergency processing timeout')), 30000)
      )
    ]);

    // Add start time for cleanup tracking
    processingPromise.startTime = Date.now();
    this.processingReports.set(reportId, processingPromise);

    try {
      const result = await processingPromise;

      // PRESERVED: Memory-efficient caching (circular buffer)
      this.addToCache(reportId, {
        result,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime
      });

      return result;

    } finally {
      // Always cleanup processing state
      this.processingReports.delete(reportId);
    }
  }

  /**
   * ENHANCED: Internal emergency processing with connection validation
   */
  async _processEmergencyInternal(reportData, options = {}, startTime, reportId) {
    try {
      console.log(`🚨 EMERGENCY: Processing critical report ${reportId}`);

      // ENHANCED: Wrap all database operations with connection validation
      return await this.withConnectionValidation(async () => {
        
        // 1. PRESERVED: Immediate validation and sanitization
        const sanitizedData = await this.sanitizeReportData(reportData);

        // 2. PRESERVED: Enhanced security analysis for emergency reports
        const securityAnalysis = await this.performEmergencySecurityAnalysis(sanitizedData);

        // 3. ENHANCED: Save to database with connection validation
        const savedReport = await this.saveReportWithConnectionValidation(sanitizedData, 'emergency');

        // 4. PRESERVED: Immediate notification system (non-blocking)
        setImmediate(() => {
          this.triggerEmergencyNotifications(savedReport).catch(error => {
            console.warn('⚠️ Emergency notifications failed:', error.message);
          });
        });

        // 5. PRESERVED: Real-time WebSocket updates (non-blocking)
        setImmediate(() => {
          this.broadcastEmergencyAlert(savedReport).catch(error => {
            console.warn('⚠️ Emergency broadcast failed:', error.message);
          });
        });

        // 6. PRESERVED: Queue background analysis (non-blocking) - ONLY if not already in emergency mode
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
          processingMode: options.isBackupProcessing ? 'backup' : 'primary_with_validation'
        };

      }, 'emergency_processing', {
        maxRetries: 3,
        retryDelay: 500,
        fallbackAllowed: true
      });

    } catch (error) {
      console.error('❌ Emergency report processing failed:', error.message);

      // ENHANCED: Use connection-aware fallback
      try {
        return await this.processEmergencyFallbackWithValidation(reportData, error);
      } catch (fallbackError) {
        console.error('❌ Emergency fallback also failed:', fallbackError.message);

        // ENHANCED: Last resort - offline processing
        return await this.processEmergencyOffline(reportData, error, fallbackError);
      }
    }
  }

  /**
   * NEW: Connection-validated database save operation
   */
  async saveReportWithConnectionValidation(reportData, priority = 'standard') {
    return await this.withConnectionValidation(async () => {
      const Report = require('../models/Report');
      
      // Ensure we have a valid report instance
      let report;
      if (reportData instanceof mongoose.Document) {
        report = reportData;
      } else {
        report = new Report({
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

          // Processing status tracking
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
        });
      }

      // Add processing metadata
      report.processedAt = new Date();
      report.processingPriority = priority;
      report.processingVersion = '2.0';

      // Save with connection validation
      const savedReport = await report.save();
      
      console.log(`💾 Report saved successfully: ${savedReport._id} (${priority} priority)`);
      return savedReport;

    }, 'database_save', {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackAllowed: false // No fallback for save operations
    });
  }

  /**
   * NEW: Enhanced emergency fallback with connection awareness
   */
  async processEmergencyFallbackWithValidation(reportData, originalError) {
    console.log('🚨 FALLBACK: Emergency processing with connection validation');
    
    this.fallbackStats.totalAttempts++;

    try {
      // Check if database is available for fallback processing
      const connectionAvailable = await this.validateDatabaseConnection('emergency_fallback');
      
      if (connectionAvailable) {
        // Database available - try simplified processing
        return await this.withConnectionValidation(async () => {
          const Report = require('../models/Report');
          
          // Minimal report processing
          const minimalReport = {
            ...reportData,
            type: this.getValidType(reportData.type),
            status: 'processed_fallback',
            timestamp: new Date(),
            processingNote: `Fallback processing due to: ${originalError.message}`,
            fallbackProcessing: true
          };

          const report = new Report(minimalReport);
          const savedReport = await report.save();

          // Send minimal notifications
          await this.sendMinimalNotifications(savedReport);

          this.fallbackStats.successfulFallbacks++;
          console.log(`✅ Emergency fallback processing completed: ${savedReport._id}`);

          return {
            success: true,
            reportId: savedReport._id,
            processingMode: 'fallback_with_database',
            originalError: originalError.message,
            fallbackProcessing: true
          };

        }, 'emergency_fallback', {
          maxRetries: 2,
          retryDelay: 2000,
          fallbackAllowed: false
        });

      } else {
        // Database not available - process offline
        throw new Error('Database not available for fallback processing');
      }

    } catch (error) {
      this.fallbackStats.failedFallbacks++;
      console.error('❌ Emergency fallback with validation failed:', error.message);
      throw new Error(`Emergency fallback failed: ${error.message}`);
    }
  }

  /**
   * NEW: Process emergency report completely offline (no database)
   */
  async processEmergencyOffline(reportData, originalError, fallbackError) {
    console.log('🆘 OFFLINE: Processing emergency report without database');

    try {
      const reportId = reportData._id || `offline_${Date.now()}`;
      
      // Store in memory temporarily
      const offlineReport = {
        id: reportId,
        data: reportData,
        timestamp: new Date(),
        originalError: originalError.message,
        fallbackError: fallbackError.message,
        processingMode: 'offline_emergency'
      };

      // Add to offline queue (in memory)
      if (!global.offlineReports) {
        global.offlineReports = [];
      }
      global.offlineReports.push(offlineReport);

      // Send console alert
      console.log(`🚨 OFFLINE EMERGENCY ALERT: ${reportData.type} report ${reportId} stored offline`);

      // Try to send basic email notification (if email service works without DB)
      setImmediate(() => {
        this.sendOfflineEmergencyAlert(offlineReport).catch(error => {
          console.warn('⚠️ Offline email alert failed:', error.message);
        });
      });

      return {
        success: true,
        reportId: reportId,
        processingMode: 'offline_emergency',
        storedOffline: true,
        originalError: originalError.message,
        fallbackError: fallbackError.message,
        note: 'Report stored offline - will be processed when database is available'
      };

    } catch (error) {
      console.error('❌ Offline emergency processing failed:', error.message);
      
      // Absolute last resort - just return error info
      return {
        success: false,
        processingMode: 'complete_failure',
        originalError: originalError.message,
        fallbackError: fallbackError.message,
        offlineError: error.message,
        reportData: reportData,
        timestamp: new Date(),
        note: 'Complete processing failure - manual intervention required'
      };
    }
  }

  /**
   * NEW: Send offline emergency alert via email (bypassing database)
   */
  async sendOfflineEmergencyAlert(offlineReport) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) return;

      const EmailService = require('../services/emailService');
      
      await EmailService.sendFallbackAlertEmail(adminEmail, {
        reportId: offlineReport.id,
        type: offlineReport.data.type || 'unknown',
        timestamp: offlineReport.timestamp,
        fallbackReason: 'Complete database failure - report stored offline',
        originalError: offlineReport.originalError,
        fallbackError: offlineReport.fallbackError
      });

      console.log('📧 Offline emergency alert sent via email');

    } catch (error) {
      console.error('❌ Offline email alert failed:', error.message);
    }
  }

  /**
   * PRESERVED: EMERGENCY FALLBACK: Process immediately when queue fails
   */
  async processEmergencyFallback(reportData) {
    console.log(`🚨 FALLBACK: Emergency processing for ${reportData._id || 'new'}`);

    try {
      // ENHANCED: Use connection validation for fallback processing
      return await this.withConnectionValidation(async () => {
        const Report = require('../models/Report');

        const minimalReport = {
          type: this.getValidType(reportData.type),
          description: reportData.description || 'Emergency report',
          location: reportData.location || { 
            type: 'Point',
            coordinates: [90.4125, 23.8103] // Dhaka center
          },
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

      }, 'emergency_fallback', {
        maxRetries: 2,
        retryDelay: 1500,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Emergency fallback failed:', error);
      throw new Error(`Complete processing failure: ${error.message}`);
    }
  }

  // =================================================================
  // === PRESERVED PROCESSING METHODS WITH CONNECTION VALIDATION ====
  // =================================================================

  /**
   * ENHANCED: STANDARD PROCESSING with connection validation
   */
  async processStandardReport(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📊 STANDARD: Processing safety report ${reportData._id}`);

      // ENHANCED: Wrap database operations with connection validation
      return await this.withConnectionValidation(async () => {
        
        // 1. PRESERVED: Standard validation and sanitization
        const sanitizedData = await this.sanitizeReportData(reportData);

        // 2. PRESERVED: Security and fraud analysis
        const securityAnalysis = await this.performStandardSecurityAnalysis(sanitizedData);

        // 3. ENHANCED: Save to database with connection validation
        const savedReport = await this.saveReportWithConnectionValidation(sanitizedData, 'standard');

        // 4. PRESERVED: Standard notification system
        await this.triggerStandardNotifications(savedReport);

        // 5. PRESERVED: WebSocket updates for map
        await this.broadcastMapUpdate(savedReport);

        // 6. PRESERVED: Queue background analysis
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

      }, 'standard_processing', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: true
      });

    } catch (error) {
      console.error('❌ Standard report processing failed:', error);
      throw error;
    }
  }

  /**
   * ENHANCED: BACKGROUND PROCESSING with connection validation
   */
  async processBackgroundAnalysis(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`⚙️ BACKGROUND: Processing analysis for ${reportData._id}`);

      const analysisResults = {};

      // 1. PRESERVED: Deep security analysis
      if (options.includeSecurityAnalysis !== false) {
        analysisResults.security = await this.performDeepSecurityAnalysis(reportData);
      }

      // 2. PRESERVED: Location enrichment
      if (reportData.location?.coordinates) {
        analysisResults.location = await this.enrichLocationData(reportData.location.coordinates);
      }

      // 3. PRESERVED: Trend analysis
      analysisResults.trends = await this.analyzeTrends(reportData);

      // 4. PRESERVED: Device analysis
      if (reportData.deviceFingerprint) {
        analysisResults.device = await this.analyzeDeviceFingerprint(reportData.deviceFingerprint);
      }

      // 5. ENHANCED: Update report with analysis results (with connection validation)
      await this.updateReportWithAnalysisValidated(reportData._id, analysisResults);

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
   * ENHANCED: ANALYTICS PROCESSING with connection validation
   */
  async processAnalytics(reportData, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`📈 ANALYTICS: Processing metrics for ${reportData._id}`);

      // ENHANCED: Wrap analytics updates with connection validation
      return await this.withConnectionValidation(async () => {
        
        // 1. PRESERVED: Update aggregation counters
        await this.updateAnalyticsCounters(reportData);

        // 2. PRESERVED: Update trend data
        await this.updateTrendData(reportData);

        // 3. PRESERVED: Update safety score for area
        if (reportData.location?.coordinates) {
          await this.updateAreaSafetyScore(reportData.location.coordinates, reportData);
        }

        // 4. PRESERVED: Update female safety metrics
        if (reportData.genderSensitive) {
          await this.updateFemaleSafetyMetrics(reportData);
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Analytics processing completed in ${processingTime}ms`);

        this.stats.analytics = (this.stats.analytics || 0) + 1;

        return {
          success: true,
          reportId: reportData._id,
          processingTime,
          analyticsUpdated: true
        };

      }, 'analytics_processing', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Analytics processing failed:', error);
      throw error;
    }
  }

  /**
   * NEW: Update report with analysis results (with connection validation)
   */
  async updateReportWithAnalysisValidated(reportId, analysisResults) {
    return await this.withConnectionValidation(async () => {
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

    }, 'update_report_analysis', {
      maxRetries: 2,
      retryDelay: 1000,
      fallbackAllowed: false
    });
  }

  // =================================================================
  // === PRESERVED MEMORY MANAGEMENT & CACHE METHODS ===============
  // =================================================================

  /**
   * PRESERVED: Memory-efficient cache management
   */
  addToCache(reportId, entry) {
    // Implement circular buffer for fixed memory usage
    if (this.recentlyProcessed.size >= this.MAX_RECENT_CACHE) {
      const oldestKey = this.recentlyProcessedOrder.shift();
      if (oldestKey) {
        this.recentlyProcessed.delete(oldestKey);
      }
    }

    this.recentlyProcessed.set(reportId, entry);
    this.recentlyProcessedOrder.push(reportId);
  }

  /**
   * PRESERVED: Memory-efficient cleanup (replaces individual setTimeout calls)
   */
  setupMemoryEfficientCleanup() {
    // Single interval for all cleanup (not individual timeouts)
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const CACHE_TTL = 2 * 60 * 1000; // Reduced to 2 minutes

      // Cleanup recently processed with circular buffer approach
      const expiredKeys = [];
      for (const [reportId, entry] of this.recentlyProcessed.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
          expiredKeys.push(reportId);
        }
      }

      // Remove expired entries
      expiredKeys.forEach(key => {
        this.recentlyProcessed.delete(key);
        const orderIndex = this.recentlyProcessedOrder.indexOf(key);
        if (orderIndex !== -1) {
          this.recentlyProcessedOrder.splice(orderIndex, 1);
        }
      });

      // Enforce maximum cache size (circular buffer)
      while (this.recentlyProcessed.size > this.MAX_RECENT_CACHE) {
        const oldestKey = this.recentlyProcessedOrder.shift();
        if (oldestKey) {
          this.recentlyProcessed.delete(oldestKey);
        }
      }

      // Cleanup stale processing entries
      const processingExpiredKeys = [];
      for (const [reportId, promise] of this.processingReports.entries()) {
        // Check if promise has been pending too long (potential memory leak)
        if (promise.startTime && (now - promise.startTime > 60000)) { // 1 minute timeout
          processingExpiredKeys.push(reportId);
        }
      }

      // Cleanup emergency processing set (size limit)
      if (this.emergencyProcessingSet.size > this.MAX_EMERGENCY_SET_SIZE) {
        console.log(`🧹 Emergency set cleanup: ${this.emergencyProcessingSet.size} entries`);
        this.emergencyProcessingSet.clear();
      }

      processingExpiredKeys.forEach(key => {
        this.processingReports.delete(key);
      });

      // NEW: Clean up old connection errors
      for (const [operationType, count] of this.connectionErrors.entries()) {
        if (count > 100) { // Reset very high error counts
          this.connectionErrors.set(operationType, 10);
        }
      }

      // Log cleanup stats in development
      if (process.env.NODE_ENV === 'development' && expiredKeys.length > 0) {
        console.log(`🧹 Cleaned up ${expiredKeys.length} cache entries, ${processingExpiredKeys.length} stale processing`);
      }

    }, 30000); // Every 30 seconds instead of per-request timeouts
  }

  /**
   * PRESERVED: Cleanup method for graceful shutdown
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear all memory structures
    this.recentlyProcessed.clear();
    this.recentlyProcessedOrder.length = 0;
    this.processingReports.clear();
    this.connectionErrors.clear();

    console.log('✅ Report processor memory cleanup completed');
  }

  /**
   * NEW: Get processor statistics including connection health
   */
  getStats() {
    const connectionHealth = this.lastKnownConnectionState;
    const totalConnectionErrors = Array.from(this.connectionErrors.values())
      .reduce((sum, count) => sum + count, 0);

    return {
      ...this.stats,
      connectionHealth: {
        isConnected: connectionHealth,
        lastCheck: new Date(this.lastConnectionCheck),
        totalErrors: totalConnectionErrors,
        errorsByType: Object.fromEntries(this.connectionErrors)
      },
      fallbackStats: { ...this.fallbackStats },
      memory: {
        recentlyProcessed: this.recentlyProcessed.size,
        activeProcessing: this.processingReports.size,
        offlineReports: global.offlineReports?.length || 0
      }
    };
  }

  /**
   * NEW: Graceful shutdown with connection cleanup
   */
  async shutdown() {
    console.log('🔄 Shutting down enhanced report processor...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Process any remaining offline reports
    if (global.offlineReports && global.offlineReports.length > 0) {
      console.log('🔄 Processing remaining offline reports...');
      await this.processOfflineReports();
    }

    // Clear memory
    this.cleanup();
    
    console.log('✅ Enhanced report processor shutdown complete');
  }

  // =================================================================
  // === PRESERVED DATA SANITIZATION HELPERS ========================
  // =================================================================

  /**
   * PRESERVED: Sanitize text
   */
  sanitizeText(text) {
    if (!text) return '';

    return text
      .toString()
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[^\w\s\u0980-\u09FF.,!?;:()\-]/g, '') // Allow Bengali chars
      .substring(0, 2000); // Limit length
  }

  /**
   * PRESERVED: Sanitize location
   */
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

  /**
   * PRESERVED: Sanitize submission data
   */
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

  /**
   * PRESERVED: Sanitize images
   */
  sanitizeImages(images) {
    if (!Array.isArray(images)) return [];

    return images
      .filter(img => img && typeof img === 'string')
      .slice(0, 5) // Limit to 5 images
      .map(img => this.sanitizeText(img));
  }

  /**
   * PRESERVED: Sanitize contact
   */
  sanitizeContact(contact) {
    if (!contact) return null;

    return {
      phone: contact.phone ? this.sanitizeText(contact.phone).substring(0, 20) : undefined,
      email: contact.email ? this.sanitizeText(contact.email).substring(0, 100) : undefined
    };
  }

  /**
   * PRESERVED: Sanitize report data for processing
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

  // =================================================================
  // === PRESERVED NOTIFICATION METHODS =============================
  // =================================================================

  /**
   * PRESERVED: Send minimal notifications
   */
  async sendMinimalNotifications(report) {
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

  // =================================================================
  // === PRESERVED MONITORING AND STATISTICS ========================
  // =================================================================

  /**
   * PRESERVED: Setup monitoring
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
   * PRESERVED: Update processing statistics
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
   * PRESERVED: Log processing statistics
   */
  logProcessingStatistics() {
    const uptime = Date.now() - this.stats.lastResetTime;
    const throughput = (this.stats.processed / uptime) * 1000 * 60; // per minute

    console.log('📊 Report Processing Statistics:', {
      ...this.stats,
      throughputPerMinute: throughput.toFixed(2),
      uptime: `${Math.round(uptime / 60000)} minutes`,
      connectionHealth: this.lastKnownConnectionState ? 'connected' : 'disconnected',
      fallbackStats: this.fallbackStats
    });
  }

  /**
   * PRESERVED: Reset statistics
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
   * ENHANCED: Get current statistics
   */
  getStatistics() {
    const uptime = Date.now() - this.stats.lastResetTime;
    const throughput = uptime > 0 ? (this.stats.processed / uptime) * 1000 * 60 : 0;

    return {
      ...this.stats,
      throughputPerMinute: throughput,
      uptime,
      queueStatus: this.distributedQueue ? 'distributed' :
        this.fallbackQueue ? 'fallback' : 'direct',
      isInitialized: this.isInitialized,
      // NEW: Enhanced connection health information
      connectionHealth: {
        isConnected: this.lastKnownConnectionState,
        lastCheck: new Date(this.lastConnectionCheck),
        totalErrors: Array.from(this.connectionErrors.values())
          .reduce((sum, count) => sum + count, 0),
        errorsByType: Object.fromEntries(this.connectionErrors)
      },
      fallbackStats: { ...this.fallbackStats },
      memory: {
        recentlyProcessed: this.recentlyProcessed.size,
        activeProcessing: this.processingReports.size,
        offlineReports: global.offlineReports?.length || 0
      }
    };
  }

  /**
   * PRESERVED: Initialize fallback mode
   */
  async initializeFallbackMode() {
    console.warn('⚠️ Initializing report processor in fallback mode');

    this.distributedQueue = null;
    this.fallbackQueue = null;

    // Ensure basic functionality
    this.isInitialized = true;

    console.log('✅ Report processor running in fallback mode (direct processing only)');
  }

  // =================================================================
  // === PRESERVED ANALYSIS HELPER METHODS ==========================
  // =================================================================

  /**
   * PRESERVED: Analyze report content for credibility
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
   * PRESERVED: Analyze location credibility
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
   * PRESERVED: Analyze submission time patterns
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
   * PRESERVED: Calculate overall analysis score
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

  // =================================================================
  // === PRESERVED SECURITY ANALYSIS METHODS ========================
  // =================================================================

  /**
   * PRESERVED: Emergency security analysis
   */
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

  /**
   * PRESERVED: Standard security analysis
   */
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
            const deviceScore = device.securityProfile?.trustScore || 50;
            score += (deviceScore - 50) * 0.3; // 30% weight from device trust

            if (device.securityProfile?.riskLevel === 'high') {
              score -= 20;
              flags.push('high_risk_device');
            } else if (device.securityProfile?.riskLevel === 'low') {
              score += 10;
              flags.push('trusted_device');
            }

            if (device.securityProfile?.quarantineStatus === 'quarantined') {
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

  /**
   * PRESERVED: Deep security analysis (placeholder for complex analysis)
   */
  async performDeepSecurityAnalysis(reportData) {
    try {
      console.log(`🔍 Deep security analysis for report ${reportData._id}`);

      let score = 50; // Starting score
      const flags = [];
      const analysisDetails = {};

      // 1. Advanced content analysis
      const contentAnalysis = this.analyzeReportContent(reportData.description);
      analysisDetails.content = contentAnalysis;
      score += contentAnalysis.credibilityScore;
      flags.push(...contentAnalysis.flags);

      // 2. Location analysis
      if (reportData.location?.coordinates) {
        const locationAnalysis = await this.analyzeLocationCredibility(reportData.location.coordinates);
        analysisDetails.location = locationAnalysis;
        score += locationAnalysis.credibilityBonus;
        flags.push(...locationAnalysis.flags);
      }

      // 3. Time analysis
      const timeAnalysis = this.analyzeSubmissionTime(reportData.timestamp);
      analysisDetails.time = timeAnalysis;
      score += timeAnalysis.credibilityModifier;
      flags.push(...timeAnalysis.flags);

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

  // =================================================================
  // === PRESERVED NOTIFICATION METHODS =============================
  // =================================================================

  /**
   * PRESERVED: 🚨 CRITICAL FIX: Enhanced emergency notifications (non-blocking)
   */
  async triggerEmergencyNotifications(report) {
    try {
      console.log(`🚨 EMERGENCY ALERT: Report ${report._id} requires immediate attention`);

      const notifications = [];

      // 1. WebSocket emergency broadcast (keep blocking - it's fast)
      try {
        const socketHandler = global.socketHandler || require('../websocket/scaledSocketHandler');
        if (socketHandler && typeof socketHandler.emergencyBroadcast === 'function') {
          await Promise.race([
            socketHandler.emergencyBroadcast({
              reportId: report._id,
              type: report.type,
              severity: report.severity,
              location: report.location,
              message: `Emergency report: ${report.type} in ${this.getAreaName(report.location)}`,
              timestamp: new Date()
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket timeout')), 5000))
          ]);
          notifications.push('websocket_broadcast');
        }
      } catch (error) {
        console.warn('⚠️ WebSocket emergency broadcast failed:', error.message);
      }

      // 2. 🚨 CRITICAL FIX: Email notifications - FIRE AND FORGET (non-blocking)
      try {
        const EmailService = require('../services/emailService');

        // Get admin emails from environment or database
        const adminEmails = process.env.ADMIN_EMERGENCY_EMAILS?.split(',') ||
          [process.env.ADMIN_EMAIL].filter(Boolean);

        if (adminEmails.length > 0) {
          // Fire emails asynchronously WITHOUT awaiting (this is the key fix)
          setImmediate(async () => {
            try {
              // Send emails in parallel with timeout protection
              const emailPromises = adminEmails.map(email =>
                Promise.race([
                  EmailService.sendEmergencyAlertEmail(email, {
                    reportId: report._id,
                    type: report.type,
                    severity: report.severity,
                    location: this.getAreaName(report.location),
                    timestamp: report.timestamp,
                    securityScore: report.securityScore
                  }),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Email timeout')), 15000)
                  )
                ]).catch(error => {
                  console.warn(`⚠️ Emergency email to ${email} failed:`, error.message);
                  return { success: false, error: error.message };
                })
              );

              // Wait for all emails with overall timeout
              const emailResults = await Promise.race([
                Promise.allSettled(emailPromises),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('All emails timeout')), 30000)
                )
              ]);

              const successCount = emailResults.filter(result =>
                result.status === 'fulfilled' && result.value?.success
              ).length;

              console.log(`📧 Emergency emails: ${successCount}/${adminEmails.length} sent successfully`);

            } catch (error) {
              console.warn('⚠️ Background emergency email batch failed:', error.message);
            }
          });

          notifications.push('admin_emails');
        }
      } catch (error) {
        console.warn('⚠️ Emergency email notifications failed:', error.message);
      }

      // 3. ✅ PRESERVED: Queue SMS notifications (if SMS service available)
      try {
        if (this.distributedQueue) {
          await Promise.race([
            this.distributedQueue.addJob('emergencyReports', {
              type: 'sms_notification',
              reportId: report._id,
              urgency: 'critical'
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('SMS queue timeout')), 3000))
          ]);
          notifications.push('sms_queued');
        }
      } catch (error) {
        console.warn('⚠️ SMS notification queueing failed:', error.message);
      }

      // 4. ✅ PRESERVED: Admin dashboard notifications
      try {
        const socketHandler = global.socketHandler;
        if (socketHandler && typeof socketHandler.emitToAdmins === 'function') {
          await Promise.race([
            socketHandler.emitToAdmins('emergency_report_alert', {
              reportId: report._id,
              type: report.type,
              severity: report.severity,
              location: report.location,
              securityScore: report.securityScore,
              requiresImmediate: true
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Admin notification timeout')), 3000))
          ]);
          notifications.push('admin_dashboard');
        }
      } catch (error) {
        console.warn('⚠️ Admin dashboard notification failed:', error.message);
      }

      // 5. ✅ PRESERVED: Console fallback
      console.log(`🚨 EMERGENCY PROTOCOL ACTIVATED: ${report.type} report ${report._id}`);
      notifications.push('console_alert');

      console.log(`✅ Emergency notifications triggered: ${notifications.join(', ')}`);

      return {
        success: true,
        notified: notifications,
        count: notifications.length,
        emailsProcessingAsync: adminEmails?.length || 0
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

  /**
   * PRESERVED: Standard notification system
   */
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

  /**
   * PRESERVED: Broadcast emergency alert
   */
  async broadcastEmergencyAlert(report) {
    try {
      const socketHandler = global.socketHandler;

      if (socketHandler) {
        // Use existing emergencyBroadcast method
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

      console.log(`⚠️ Emergency broadcast skipped - WebSocket unavailable`);
      return { success: false, broadcasted: false, reason: 'websocket_unavailable' };

    } catch (error) {
      console.error('❌ Emergency broadcast failed:', error);
      return { success: false, error: error.message, broadcasted: false };
    }
  }

  /**
   * PRESERVED: Broadcast map update
   */
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

  /**
   * PRESERVED: Queue background analysis
   */
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

  // =================================================================
  // === PRESERVED ANALYTICS UPDATE METHODS =========================
  // =================================================================

  /**
   * PRESERVED: Update analytics counters
   */
  async updateAnalyticsCounters(reportData) {
    try {
      console.log(`📈 Updating analytics counters for report type: ${reportData.type}`);

      // ENHANCED: Wrap analytics updates with connection validation
      return await this.withConnectionValidation(async () => {
        
        // Update daily counters
        const today = new Date().toISOString().split('T')[0];
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

        console.log(`✅ Analytics counters updated for ${reportData.type}`);

        return {
          success: true,
          countersUpdated: ['daily', 'type', 'severity']
        };

      }, 'analytics_update', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Analytics counter update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * PRESERVED: Update trend data
   */
  async updateTrendData(reportData) {
    try {
      console.log(`📊 Updating trend data for ${reportData.type}`);

      // ENHANCED: Wrap trend updates with connection validation
      return await this.withConnectionValidation(async () => {
        
        const mongoose = require('mongoose');
        const hour = new Date(reportData.timestamp).getHours();
        const today = new Date().toISOString().split('T')[0];

        // Update hourly trends
        await mongoose.connection.db.collection('hourly_trends').updateOne(
          { date: today, hour: hour },
          {
            $inc: {
              totalReports: 1,
              [`types.${reportData.type}`]: 1,
              [`severitySum`]: reportData.severity
            },
            $set: { lastUpdated: new Date() },
            $setOnInsert: { date: today, hour: hour, createdAt: new Date() }
          },
          { upsert: true }
        );

        console.log(`✅ Trend data updated for ${reportData.type}`);

        return {
          success: true,
          trendsUpdated: ['hourly', 'daily', 'location']
        };

      }, 'trend_update', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Trend data update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * PRESERVED: Update area safety score
   */
  async updateAreaSafetyScore(coordinates, reportData) {
    try {
      console.log(`🏠 Updating area safety score for coordinates: ${coordinates}`);

      // ENHANCED: Wrap safety score updates with connection validation
      return await this.withConnectionValidation(async () => {
        
        const [lng, lat] = coordinates;
        const safetyImpact = this.calculateSafetyImpact(reportData);
        const SafeZone = require('../models/SafeZone');

        // Find nearby safe zones to update
        const nearbyZones = await SafeZone.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: 1000 // 1km radius
            }
          }
        });

        const updatedZones = [];

        // Update each nearby zone's safety score
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

        console.log(`✅ Area safety score updated for ${updatedZones.length} zones`);

        return {
          success: true,
          updatedZones: updatedZones.length,
          zones: updatedZones,
          safetyImpact: safetyImpact
        };

      }, 'area_safety_update', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Area safety score update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * PRESERVED: Update female safety metrics
   */
  async updateFemaleSafetyMetrics(reportData) {
    try {
      console.log(`👩 Updating female safety metrics for ${reportData.type}`);

      // ENHANCED: Wrap female safety updates with connection validation
      return await this.withConnectionValidation(async () => {
        
        const mongoose = require('mongoose');
        const today = new Date().toISOString().split('T')[0];

        // Update female safety counters
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

        // Update location-specific female safety
        if (reportData.location?.coordinates) {
          const area = this.getAreaName(reportData.location);
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

        console.log(`✅ Female safety metrics updated for ${reportData.type}`);

        return {
          success: true,
          metricsUpdated: ['counters', 'location', 'time_patterns']
        };

      }, 'female_safety_update', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Female safety metrics update failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =================================================================
  // === PRESERVED PLACEHOLDER ANALYSIS METHODS =====================
  // =================================================================

  /**
   * PRESERVED: Enriched location data (simplified implementation)
   */
  async enrichLocationData(coordinates) {
    try {
      console.log(`📍 Enriching location data for coordinates: ${coordinates}`);

      const [lng, lat] = coordinates;
      const enrichedData = {
        originalCoordinates: coordinates,
        enrichedAt: new Date()
      };

      // Simple area identification
      enrichedData.address = { area: this.getAreaName({ coordinates }) };

      // Simple safety assessment
      enrichedData.areaSafetyAssessment = { score: 70 }; // Default score

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

  /**
   * PRESERVED: Analyze trends (simplified implementation)
   */
  async analyzeTrends(reportData) {
    try {
      console.log(`📊 Analyzing trends for report ${reportData._id}`);

      // ENHANCED: Wrap trend analysis with connection validation
      return await this.withConnectionValidation(async () => {
        
        const Report = require('../models/Report');
        const trends = {
          analyzedAt: new Date(),
          reportType: reportData.type,
          location: reportData.location,
          patterns: {}
        };

        // Simple temporal trends
        const recentReports = await Report.find({
          type: reportData.type,
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }).limit(20);

        trends.patterns.temporal = {
          totalIncidents: recentReports.length
        };

        console.log(`✅ Trend analysis completed for ${reportData.type}`);

        return {
          success: true,
          trends: trends,
          riskLevel: recentReports.length > 10 ? 'high' : 'medium'
        };

      }, 'trend_analysis', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Trend analysis failed:', error);
      return {
        success: false,
        trends: { error: error.message },
        analyzed: false
      };
    }
  }

  /**
   * PRESERVED: Analyze device fingerprint (simplified implementation)
   */
  async analyzeDeviceFingerprint(deviceFingerprint) {
    try {
      console.log(`🔍 Analyzing device fingerprint: ${deviceFingerprint}`);

      // ENHANCED: Wrap device analysis with connection validation
      return await this.withConnectionValidation(async () => {
        
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
          deviceProfile: {
            trustScore: device.securityProfile?.trustScore || 50,
            riskLevel: device.securityProfile?.riskLevel || 'medium'
          }
        };

        console.log(`✅ Device fingerprint analysis completed for ${deviceFingerprint}`);

        return {
          success: true,
          analyzed: true,
          analysis: analysis,
          riskAssessment: analysis.deviceProfile.riskLevel
        };

      }, 'device_analysis', {
        maxRetries: 2,
        retryDelay: 1000,
        fallbackAllowed: false
      });

    } catch (error) {
      console.error('❌ Device fingerprint analysis failed:', error);
      return {
        success: false,
        analyzed: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance with all preserved functionality
const reportProcessor = new ReportProcessor();

module.exports = {
  reportProcessor,
  ReportProcessor,
  queueReportForProcessing: (...args) => reportProcessor.queueReportForProcessing(...args),
  getReportProcessingStats: () => reportProcessor.getReportProcessingStats(),
  getFemaleSafetyStats: () => reportProcessor.getFemaleSafetyStats()
};