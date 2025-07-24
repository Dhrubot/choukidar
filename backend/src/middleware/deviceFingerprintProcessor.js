// === backend/src/services/deviceFingerprintProcessor.js ===
// Background Device Fingerprint Processor - PRODUCTION READY
// Fully integrated with CacheLayer, ProductionLogger, and Redis Queue

const DeviceFingerprint = require('../models/DeviceFingerprint');
const { productionLogger } = require('../utils/productionLogger');
const { cacheLayer } = require('../middleware/cacheLayer');
const crypto = require('crypto');

/**
 * Enhanced Background Device Fingerprint Processor
 * Features: Redis-backed queue, horizontal scaling, graceful shutdown, health monitoring
 */
class DeviceFingerprintProcessor {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
    this.shutdownInitiated = false;
    this.activeJobs = new Map(); // Track active processing jobs
    
    // Configuration
    this.config = {
      batchSize: parseInt(process.env.PROCESSOR_BATCH_SIZE) || 5,
      processingInterval: parseInt(process.env.PROCESSOR_INTERVAL) || 3000,
      maxConcurrentJobs: parseInt(process.env.PROCESSOR_MAX_CONCURRENT) || 3,
      redisQueueKey: 'safestreets:device:processing:queue',
      heartbeatInterval: 30000, // 30 seconds
      jobTimeout: 120000, // 2 minutes
      retryAttempts: 3
    };
    
    // Statistics tracking
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      averageProcessingTime: 0,
      queueLength: 0,
      activeJobs: 0,
      lastProcessedAt: null,
      startTime: Date.now()
    };
    
    // Processor identification for distributed processing
    this.processId = `${process.pid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Bind methods to preserve context
    this.gracefulShutdown = this.gracefulShutdown.bind(this);
    
    // Start background processor
    this.initialize();
  }

  /**
   * Initialize the processor with Redis queue and health monitoring
   */
  async initialize() {
    try {
      // Wait for cache layer to be ready
      if (!cacheLayer.isConnected) {
        productionLogger.warn('DeviceFingerprintProcessor: Waiting for Redis connection...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Register processor in Redis for distributed coordination
      await this.registerProcessor();
      
      // Start processing loops
      this.startBackgroundProcessor();
      this.startHeartbeat();
      this.startQueueMaintenance();
      
      // Setup graceful shutdown handlers
      process.on('SIGTERM', this.gracefulShutdown);
      process.on('SIGINT', this.gracefulShutdown);
      process.on('uncaughtException', (error) => {
        productionLogger.emergency('Uncaught exception in DeviceFingerprintProcessor', { error: error.message });
        this.gracefulShutdown();
      });

      productionLogger.info('DeviceFingerprintProcessor: Initialized successfully', {
        processId: this.processId,
        config: this.config
      });
      
    } catch (error) {
      productionLogger.error('DeviceFingerprintProcessor: Initialization failed', {
        error: error.message
      });
    }
  }

  /**
   * Register this processor instance in Redis for coordination
   */
  async registerProcessor() {
    const registrationKey = `safestreets:processors:${this.processId}`;
    const registrationData = {
      processId: this.processId,
      pid: process.pid,
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      config: this.config,
      stats: this.stats
    };

    try {
      await cacheLayer.set(registrationKey, registrationData, 60); // 1 minute TTL
      productionLogger.debug('Processor registered', { processId: this.processId });
    } catch (error) {
      productionLogger.warn('Failed to register processor', { error: error.message });
    }
  }

  /**
   * Get priority level for different analysis types
   */
  getPriority(analysisType) {
    const priorities = {
      'critical': 100,    // Immediate security threats
      'high_risk': 80,    // High anomaly scores
      'coordinated_attack': 90, // Coordinated attack detection
      'cross_device': 70, // Cross-device correlation
      'full': 50,         // Regular detailed analysis
      'maintenance': 30,  // Maintenance tasks
      'periodic': 20      // Scheduled maintenance
    };
    return priorities[analysisType] || 50;
  }

  /**
   * Queue a device fingerprint for detailed analysis (Redis-backed)
   */
  async queueForDetailedAnalysis(fingerprintId, analysisType = 'full', priority = null) {
    const jobPriority = priority || this.getPriority(analysisType);
    const jobId = crypto.randomUUID();
    
    const job = {
      id: jobId,
      fingerprintId,
      analysisType,
      priority: jobPriority,
      queuedAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.retryAttempts,
      processedBy: null,
      status: 'queued'
    };

    try {
      // Add to Redis queue with priority scoring
      const queueKey = this.config.redisQueueKey;
      const score = Date.now() + (1000000 - jobPriority); // Higher priority = lower score for Redis ZSET
      
      await cacheLayer.client.zadd(queueKey, score, JSON.stringify(job));
      
      // Update local queue length for stats
      this.stats.queueLength = await cacheLayer.client.zcard(queueKey);
      
      productionLogger.debug('Job queued for device analysis', {
        jobId,
        fingerprintId,
        analysisType,
        priority: jobPriority,
        queueLength: this.stats.queueLength
      });

      return jobId;
      
    } catch (error) {
      productionLogger.error('Failed to queue device for analysis', {
        error: error.message,
        fingerprintId,
        analysisType
      });
      
      // Fallback to in-memory queue
      this.processingQueue.push(job);
      this.processingQueue.sort((a, b) => b.priority - a.priority);
      
      return jobId;
    }
  }

  /**
   * Start the main background processor loop
   */
  startBackgroundProcessor() {
    const processingLoop = async () => {
      if (this.shutdownInitiated) return;
      
      try {
        if (!this.isProcessing && this.activeJobs.size < this.config.maxConcurrentJobs) {
          await this.processBatch();
        }
      } catch (error) {
        productionLogger.error('Processing loop error', { error: error.message });
      }
      
      // Schedule next iteration
      if (!this.shutdownInitiated) {
        setTimeout(processingLoop, this.config.processingInterval);
      }
    };

    processingLoop();
    productionLogger.info('DeviceFingerprintProcessor: Background processor started');
  }

  /**
   * Start heartbeat for distributed coordination
   */
  startHeartbeat() {
    const heartbeatLoop = async () => {
      if (this.shutdownInitiated) return;
      
      try {
        await this.sendHeartbeat();
        await this.cleanupStaleProcessors();
      } catch (error) {
        productionLogger.warn('Heartbeat error', { error: error.message });
      }
      
      if (!this.shutdownInitiated) {
        setTimeout(heartbeatLoop, this.config.heartbeatInterval);
      }
    };

    heartbeatLoop();
  }

  /**
   * Send heartbeat to Redis
   */
  async sendHeartbeat() {
    const registrationKey = `safestreets:processors:${this.processId}`;
    const heartbeatData = {
      processId: this.processId,
      pid: process.pid,
      lastHeartbeat: Date.now(),
      stats: this.stats,
      activeJobs: this.activeJobs.size
    };

    try {
      await cacheLayer.set(registrationKey, heartbeatData, 90); // 90 second TTL
    } catch (error) {
      productionLogger.debug('Heartbeat failed', { error: error.message });
    }
  }

  /**
   * Clean up stale processor registrations
   */
  async cleanupStaleProcessors() {
    try {
      const processorKeys = await cacheLayer.client.keys('safestreets:processors:*');
      const staleThreshold = Date.now() - (this.config.heartbeatInterval * 3); // 3 missed heartbeats
      
      for (const key of processorKeys) {
        try {
          const processorData = await cacheLayer.get(key);
          if (processorData && processorData.lastHeartbeat < staleThreshold) {
            await cacheLayer.delete(key);
            productionLogger.info('Cleaned up stale processor', { 
              processId: processorData.processId 
            });
          }
        } catch (error) {
          // Key might have been deleted, ignore
        }
      }
    } catch (error) {
      productionLogger.debug('Processor cleanup error', { error: error.message });
    }
  }

  /**
   * Start queue maintenance for job cleanup and rebalancing
   */
  startQueueMaintenance() {
    const maintenanceLoop = async () => {
      if (this.shutdownInitiated) return;
      
      try {
        await this.cleanupExpiredJobs();
        await this.rebalanceFailedJobs();
        await this.updateQueueStats();
      } catch (error) {
        productionLogger.warn('Queue maintenance error', { error: error.message });
      }
      
      if (!this.shutdownInitiated) {
        setTimeout(maintenanceLoop, 60000); // Run every minute
      }
    };

    setTimeout(maintenanceLoop, 60000); // Start after 1 minute
  }

  /**
   * Clean up expired and failed jobs
   */
  async cleanupExpiredJobs() {
    try {
      const queueKey = this.config.redisQueueKey;
      const expiredThreshold = Date.now() - (this.config.jobTimeout * 2);
      
      // Remove jobs older than 2x timeout
      const expiredCount = await cacheLayer.client.zremrangebyscore(
        queueKey, 
        '-inf', 
        expiredThreshold
      );
      
      if (expiredCount > 0) {
        productionLogger.info('Cleaned up expired jobs', { expiredCount });
      }
    } catch (error) {
      productionLogger.debug('Job cleanup error', { error: error.message });
    }
  }

  /**
   * Rebalance failed jobs back to queue
   */
  async rebalanceFailedJobs() {
    try {
      const failedJobsKey = 'safestreets:device:processing:failed';
      const failedJobs = await cacheLayer.client.lrange(failedJobsKey, 0, -1);
      
      for (const jobStr of failedJobs) {
        try {
          const job = JSON.parse(jobStr);
          
          // Retry if within attempt limit
          if (job.attempts < job.maxAttempts) {
            job.attempts++;
            job.status = 'retrying';
            job.queuedAt = new Date();
            
            // Re-queue with lower priority
            const score = Date.now() + (1000000 - (job.priority - 10));
            await cacheLayer.client.zadd(this.config.redisQueueKey, score, JSON.stringify(job));
            
            // Remove from failed queue
            await cacheLayer.client.lrem(failedJobsKey, 1, jobStr);
            
            productionLogger.info('Requeued failed job', {
              jobId: job.id,
              attempt: job.attempts,
              maxAttempts: job.maxAttempts
            });
          }
        } catch (error) {
          productionLogger.debug('Failed to requeue job', { error: error.message });
        }
      }
    } catch (error) {
      productionLogger.debug('Job rebalancing error', { error: error.message });
    }
  }

  /**
   * Update queue statistics
   */
  async updateQueueStats() {
    try {
      this.stats.queueLength = await cacheLayer.client.zcard(this.config.redisQueueKey);
      this.stats.activeJobs = this.activeJobs.size;
      
      // Cache stats for monitoring
      await cacheLayer.set(
        `safestreets:processor:stats:${this.processId}`,
        this.stats,
        300 // 5 minutes
      );
    } catch (error) {
      productionLogger.debug('Stats update error', { error: error.message });
    }
  }

  /**
   * Process a batch of queued fingerprints
   */
  async processBatch() {
    if (this.isProcessing || this.shutdownInitiated) return;
    
    this.isProcessing = true;
    
    try {
      // Get jobs from Redis queue
      const jobs = await this.getJobsFromQueue();
      
      if (jobs.length === 0) {
        this.isProcessing = false;
        return;
      }

      productionLogger.debug('Processing batch', { 
        jobCount: jobs.length,
        processId: this.processId 
      });

      // Process jobs concurrently with limit
      const processingPromises = jobs.map(job => this.processJob(job));
      await Promise.allSettled(processingPromises);
      
      this.stats.lastProcessedAt = new Date();
      
    } catch (error) {
      productionLogger.error('Batch processing error', { error: error.message });
      this.stats.totalErrors++;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get jobs from Redis queue
   */
  async getJobsFromQueue() {
    try {
      const queueKey = this.config.redisQueueKey;
      const batchSize = Math.min(
        this.config.batchSize,
        this.config.maxConcurrentJobs - this.activeJobs.size
      );
      
      if (batchSize <= 0) return [];

      // Get highest priority jobs (lowest scores)
      const jobStrings = await cacheLayer.client.zpopmin(queueKey, batchSize);
      
      const jobs = [];
      for (let i = 0; i < jobStrings.length; i += 2) {
        try {
          const jobStr = jobStrings[i];
          const job = JSON.parse(jobStr);
          job.processedBy = this.processId;
          job.startedAt = new Date();
          jobs.push(job);
        } catch (error) {
          productionLogger.warn('Invalid job in queue', { error: error.message });
        }
      }
      
      return jobs;
      
    } catch (error) {
      productionLogger.error('Failed to get jobs from queue', { error: error.message });
      
      // Fallback to in-memory queue
      const jobs = this.processingQueue.splice(0, this.config.batchSize);
      return jobs;
    }
  }

  /**
   * Process a single job with timeout and error handling
   */
  async processJob(job) {
    const startTime = Date.now();
    
    try {
      // Add to active jobs tracking
      this.activeJobs.set(job.id, {
        ...job,
        startTime,
        timeout: setTimeout(() => {
          productionLogger.warn('Job timeout', { jobId: job.id, fingerprintId: job.fingerprintId });
          this.handleJobFailure(job, new Error('Job timeout'));
        }, this.config.jobTimeout)
      });

      // Process the job based on type
      await this.processDetailedAnalysis(job);
      
      // Job completed successfully
      const duration = Date.now() - startTime;
      this.handleJobSuccess(job, duration);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      productionLogger.error('Job processing failed', {
        jobId: job.id,
        fingerprintId: job.fingerprintId,
        error: error.message,
        duration
      });
      
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Handle successful job completion
   */
  handleJobSuccess(job, duration) {
    // Clear timeout
    const activeJob = this.activeJobs.get(job.id);
    if (activeJob?.timeout) {
      clearTimeout(activeJob.timeout);
    }
    
    // Remove from active jobs
    this.activeJobs.delete(job.id);
    
    // Update statistics
    this.stats.totalProcessed++;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + duration) / this.stats.totalProcessed;
    
    productionLogger.debug('Job completed successfully', {
      jobId: job.id,
      fingerprintId: job.fingerprintId,
      duration,
      analysisType: job.analysisType
    });
  }

  /**
   * Handle job failure with retry logic
   */
  async handleJobFailure(job, error) {
    // Clear timeout
    const activeJob = this.activeJobs.get(job.id);
    if (activeJob?.timeout) {
      clearTimeout(activeJob.timeout);
    }
    
    // Remove from active jobs
    this.activeJobs.delete(job.id);
    
    // Update statistics
    this.stats.totalErrors++;
    
    try {
      // Add to failed jobs for potential retry
      const failedJob = {
        ...job,
        error: error.message,
        failedAt: new Date(),
        processedBy: this.processId
      };
      
      await cacheLayer.client.lpush(
        'safestreets:device:processing:failed',
        JSON.stringify(failedJob)
      );
      
      // Limit failed job queue size
      await cacheLayer.client.ltrim('safestreets:device:processing:failed', 0, 999);
      
    } catch (cacheError) {
      productionLogger.debug('Failed to cache failed job', { error: cacheError.message });
    }
  }

  /**
   * Perform detailed analysis on a device fingerprint
   */
  async processDetailedAnalysis(job) {
    const { fingerprintId, analysisType } = job;
    
    try {
      const device = await DeviceFingerprint.findOne({ fingerprintId });
      if (!device) {
        throw new Error(`Device not found: ${fingerprintId}`);
      }

      // Skip if device was recently updated (avoid race conditions)
      if (device.updatedAt > job.queuedAt) {
        productionLogger.debug('Device updated since job queued, skipping', {
          fingerprintId,
          deviceUpdated: device.updatedAt,
          jobQueued: job.queuedAt
        });
        return;
      }

      let analysisResults = {};

      switch (analysisType) {
        case 'critical':
          analysisResults = await this.performCriticalAnalysis(device);
          break;
        case 'high_risk':
          analysisResults = await this.performHighRiskAnalysis(device);
          break;
        case 'coordinated_attack':
          analysisResults = await this.performCoordinatedAttackAnalysis(device);
          break;
        case 'cross_device':
          analysisResults = await this.performCrossDeviceAnalysis(device);
          break;
        case 'full':
          analysisResults = await this.performFullAnalysis(device);
          break;
        case 'maintenance':
          analysisResults = await this.performMaintenanceAnalysis(device);
          break;
        case 'periodic':
          analysisResults = await this.performPeriodicAnalysis(device);
          break;
        default:
          analysisResults = await this.performFullAnalysis(device);
      }

      // Update device with analysis results
      if (Object.keys(analysisResults).length > 0) {
        await DeviceFingerprint.updateOne(
          { fingerprintId },
          { 
            $set: {
              ...analysisResults,
              'processingStatus.lastDetailedAnalysis': new Date(),
              'processingStatus.analysisInProgress': false,
              needsDetailedAnalysis: false
            }
          }
        );

        // Log significant findings
        if (analysisResults['securityProfile.riskLevel'] === 'critical') {
          productionLogger.security('Critical security analysis completed', {
            fingerprintId,
            analysisType,
            results: analysisResults
          });
        }
      }

    } catch (error) {
      productionLogger.error('Device analysis failed', {
        fingerprintId,
        analysisType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Critical security analysis for immediate threats
   */
  async performCriticalAnalysis(device) {
    const results = {};

    try {
      // Check for immediate security threats
      if (device.networkProfile.torDetected && device.locationProfile.crossBorderActivity) {
        results['securityProfile.riskLevel'] = 'critical';
        results['securityProfile.quarantineStatus'] = true;
        results['securityProfile.quarantineReason'] = 'Tor + Cross-border activity detected';
        results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Critical Threat Detected'];
      }

      // Check for coordinated attack patterns
      const recentSimilarDevices = await DeviceFingerprint.countDocuments({
        'deviceSignature.userAgentHash': device.deviceSignature.userAgentHash,
        'networkProfile.ipHash': device.networkProfile.ipHash,
        createdAt: { $gte: new Date(Date.now() - 3600000) }, // Last hour
        fingerprintId: { $ne: device.fingerprintId }
      });

      if (recentSimilarDevices > 5) {
        results['threatIntelligence.coordinatedAttackParticipant'] = true;
        results['deviceAnomalyScore'] = Math.min(100, device.deviceAnomalyScore + 25);
        results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Coordinated Attack Suspected'];
      }

      // Check for botnet behavior patterns
      if (device.behaviorProfile.humanBehaviorScore < 10 && device.securityProfile.totalReportsSubmitted > 20) {
        results['threatIntelligence.botnetMember'] = true;
        results['securityProfile.riskLevel'] = 'critical';
        results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Botnet Behavior'];
      }

      // Cache threat analysis
      await cacheLayer.cacheSecurityAnalysis(device.fingerprintId, {
        level: 'critical',
        results,
        timestamp: new Date()
      });

    } catch (error) {
      productionLogger.error('Critical analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * High-risk analysis for devices with elevated anomaly scores
   */
  async performHighRiskAnalysis(device) {
    const results = {};

    try {
      // Analyze behavior patterns over time
      const behaviorHistory = await this.analyzeBehaviorHistory(device);
      if (behaviorHistory.isAnomalous) {
        results['behaviorProfile.anomalousPatterns'] = behaviorHistory.patterns;
        results['securityProfile.riskLevel'] = 'high';
      }

      // Cross-reference with threat intelligence
      const threatMatch = await this.checkThreatIntelligence(device);
      if (threatMatch) {
        results['threatIntelligence.matches'] = threatMatch;
        results['threatIntelligence.threatConfidence'] = threatMatch.confidence;
      }

      // Advanced device fingerprint analysis
      const fpAnalysis = await this.analyzeDeviceFingerprint(device);
      if (fpAnalysis.suspicious) {
        results['deviceAnomalyScore'] = Math.min(100, device.deviceAnomalyScore + fpAnalysis.anomalyIncrease);
        results['moderatorAlerts'] = [...(device.moderatorAlerts || []), ...fpAnalysis.alerts];
      }

    } catch (error) {
      productionLogger.error('High-risk analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Coordinated attack analysis
   */
  async performCoordinatedAttackAnalysis(device) {
    const results = {};

    try {
      // Find similar devices in recent timeframe
      const timeWindow = 2 * 60 * 60 * 1000; // 2 hours
      const similarDevices = await DeviceFingerprint.find({
        fingerprintId: { $ne: device.fingerprintId },
        'activityHistory.lastSeen': { $gte: new Date(Date.now() - timeWindow) },
        $or: [
          { 'networkProfile.ipHash': device.networkProfile.ipHash },
          { 'deviceSignature.userAgentHash': device.deviceSignature.userAgentHash },
          { 'behaviorProfile.humanBehaviorScore': { $gte: device.behaviorProfile.humanBehaviorScore - 5, $lte: device.behaviorProfile.humanBehaviorScore + 5 } }
        ]
      }).limit(20);

      if (similarDevices.length >= 3) {
        // Analyze for coordinated patterns
        const coordinated = this.detectCoordinatedBehavior(device, similarDevices);
        
        if (coordinated.isCoordinated) {
          results['threatIntelligence.coordinatedAttackParticipant'] = true;
          results['threatIntelligence.massReportingCampaign'] = coordinated.massReporting;
          results['securityProfile.riskLevel'] = 'high';
          results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Coordinated Attack Pattern'];
          
          // Update related devices
          this.flagRelatedDevices(similarDevices, 'coordinated_attack');
        }
      }

    } catch (error) {
      productionLogger.error('Coordinated attack analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Cross-device correlation analysis
   */
  async performCrossDeviceAnalysis(device) {
    const results = {};

    try {
      // Get correlated devices
      const correlatedDevices = await DeviceFingerprint.analyzeCorrelatedDevices(device.fingerprintId);
      
      if (correlatedDevices.length > 0) {
        const highCorrelation = correlatedDevices.filter(c => c.correlationScore > 70);
        
        if (highCorrelation.length > 0) {
          results['crossDeviceCorrelation.relatedDevices'] = highCorrelation.map(c => c.fingerprintId);
          results['crossDeviceCorrelation.correlationConfidence'] = Math.max(...highCorrelation.map(c => c.correlationScore));
          results['crossDeviceCorrelation.lastCorrelationUpdate'] = new Date();
          
          // Analyze trust patterns across devices
          const avgTrustScore = highCorrelation.reduce((sum, c) => sum + c.trustScore, device.securityProfile.trustScore) / (highCorrelation.length + 1);
          
          if (avgTrustScore < 40) {
            results['securityProfile.riskLevel'] = 'high';
            results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Multi-Device Low Trust'];
          }
        }
      }

    } catch (error) {
      productionLogger.error('Cross-device analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Full comprehensive analysis
   */
  async performFullAnalysis(device) {
    const results = {};

    try {
      // Comprehensive device consistency check
      const consistencyScore = await this.calculateDeviceConsistency(device);
      results['analytics.deviceConsistencyScore'] = consistencyScore;

      // Geographic analysis
      const geoAnalysis = await this.performGeographicAnalysis(device);
      results['locationProfile.geoAnalysis'] = geoAnalysis;

      // Behavioral modeling
      const behaviorModel = await this.updateBehaviorModel(device);
      results['behaviorProfile.model'] = behaviorModel;

      // Network analysis
      const networkAnalysis = await this.analyzeNetworkPatterns(device);
      if (networkAnalysis.suspicious) {
        results['networkProfile.suspiciousHeaders'] = networkAnalysis.suspiciousHeaders;
        results['deviceAnomalyScore'] = Math.min(100, device.deviceAnomalyScore + networkAnalysis.anomalyIncrease);
      }

      // Submission pattern analysis
      const patternAnalysis = this.analyzeSubmissionPatterns(device);
      if (patternAnalysis.suspicious) {
        results['submissionPattern.suspiciousTimePatterns'] = true;
        results['moderatorAlerts'] = [...(device.moderatorAlerts || []), 'Suspicious Time Patterns'];
      }

    } catch (error) {
      productionLogger.error('Full analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Maintenance analysis for cleanup and optimization
   */
  async performMaintenanceAnalysis(device) {
    const results = {};

    try {
      // Clean up old validation history
      if (device.securityProfile.validationHistory?.length > 100) {
        const cleanedHistory = device.securityProfile.validationHistory
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100);
        
        results['securityProfile.validationHistory'] = cleanedHistory;
      }

      // Clean up old location history
      if (device.locationProfile.locationHistory?.length > 50) {
        const cleanedHistory = device.locationProfile.locationHistory
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
        
        results['locationProfile.locationHistory'] = cleanedHistory;
      }

      // Update analytics
      const analytics = await this.updateAnalytics(device);
      if (analytics) {
        Object.keys(analytics).forEach(key => {
          results[`analytics.${key}`] = analytics[key];
        });
      }

    } catch (error) {
      productionLogger.error('Maintenance analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  /**
   * Periodic analysis for long-term patterns
   */
  async performPeriodicAnalysis(device) {
    const results = {};

    try {
      // Decay old anomaly scores
      if (device.deviceAnomalyScore > 0) {
        const daysSinceLastUpdate = (Date.now() - device.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUpdate > 7) {
          const decayAmount = Math.min(device.deviceAnomalyScore, daysSinceLastUpdate * 0.5);
          results['deviceAnomalyScore'] = Math.max(0, device.deviceAnomalyScore - decayAmount);
        }
      }

      // Update long-term trust score
      const longTermTrust = await this.calculateLongTermTrust(device);
      if (Math.abs(longTermTrust - device.securityProfile.trustScore) > 5) {
        results['securityProfile.trustScore'] = longTermTrust;
      }

      // Review quarantine status
      if (device.securityProfile.quarantineStatus && device.securityProfile.quarantineUntil) {
        if (new Date() > device.securityProfile.quarantineUntil) {
          results['securityProfile.quarantineStatus'] = false;
          results['securityProfile.quarantineUntil'] = null;
          results['securityProfile.quarantineReason'] = null;
          
          productionLogger.info('Quarantine automatically lifted during periodic review', {
            fingerprintId: device.fingerprintId
          });
        }
      }

      // Schedule next periodic analysis
      results['processingStatus.nextScheduledAnalysis'] = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 1 week

    } catch (error) {
      productionLogger.error('Periodic analysis failed', {
        fingerprintId: device.fingerprintId,
        error: error.message
      });
    }

    return results;
  }

  // ========================================
  // ANALYSIS HELPER METHODS
  // ========================================

  /**
   * Analyze behavior patterns over time
   */
  async analyzeBehaviorHistory(device) {
    const patterns = [];
    let isAnomalous = false;

    try {
      // Check typing speed consistency
      if (device.behaviorProfile.averageTypingSpeed > 0) {
        if (device.behaviorProfile.averageTypingSpeed > 150) {
          patterns.push('superhuman_typing_speed');
          isAnomalous = true;
        }
      }

      // Check session patterns
      if (device.behaviorProfile.sessionLength > 0) {
        const avgSession = device.behaviorProfile.sessionLength;
        if (avgSession < 10 || avgSession > 480) { // Less than 10 seconds or more than 8 hours
          patterns.push('unusual_session_length');
          isAnomalous = true;
        }
      }

      // Check reporting frequency
      const hourlyAvg = device.submissionPattern.hourlyDistribution.reduce((sum, count) => sum + count, 0) / 24;
      if (hourlyAvg > 5) { // More than 5 reports per hour on average
        patterns.push('excessive_reporting_frequency');
        isAnomalous = true;
      }

      // Check for bot-like patterns
      if (device.behaviorProfile.humanBehaviorScore < 30) {
        patterns.push('low_human_behavior_score');
        isAnomalous = true;
      }

    } catch (error) {
      productionLogger.debug('Behavior history analysis error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return { isAnomalous, patterns };
  }

  /**
   * Check against threat intelligence feeds
   */
  async checkThreatIntelligence(device) {
    try {
      // Check IP hash against known threat lists
      const ipThreatKey = `threat:ip:${device.networkProfile.ipHash}`;
      const ipThreat = await cacheLayer.get(ipThreatKey);
      
      if (ipThreat) {
        return {
          source: 'ip_blacklist',
          confidence: ipThreat.confidence || 80,
          type: 'malicious_ip',
          details: ipThreat.details
        };
      }

      // Check user agent against known bot signatures
      const userAgentHash = device.deviceSignature.userAgentHash;
      const uaThreatKey = `threat:ua:${userAgentHash}`;
      const uaThreat = await cacheLayer.get(uaThreatKey);
      
      if (uaThreat) {
        return {
          source: 'user_agent_blacklist',
          confidence: uaThreat.confidence || 70,
          type: 'bot_signature',
          details: uaThreat.details
        };
      }

      // Check for known attack patterns
      const devicePattern = `${device.deviceSignature.screenResolution}_${device.networkProfile.estimatedCountry}_${device.behaviorProfile.humanBehaviorScore}`;
      const patternKey = `threat:pattern:${crypto.createHash('md5').update(devicePattern).digest('hex')}`;
      const patternThreat = await cacheLayer.get(patternKey);
      
      if (patternThreat) {
        return {
          source: 'attack_pattern',
          confidence: patternThreat.confidence || 60,
          type: 'coordinated_attack',
          details: patternThreat.details
        };
      }

    } catch (error) {
      productionLogger.debug('Threat intelligence check error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return null;
  }

  /**
   * Analyze device fingerprint for suspicious characteristics
   */
  async analyzeDeviceFingerprint(device) {
    let suspicious = false;
    let anomalyIncrease = 0;
    const alerts = [];

    try {
      // Check for headless browser indicators
      if (device.deviceSignature.webglFingerprint === 'null' && 
          device.deviceSignature.audioFingerprint === 'null') {
        suspicious = true;
        anomalyIncrease += 15;
        alerts.push('Headless Browser Detected');
      }

      // Check for automation indicators
      if (device.deviceSignature.pluginsInstalled?.length === 0 && 
          device.deviceSignature.fontsAvailable?.length < 10) {
        suspicious = true;
        anomalyIncrease += 10;
        alerts.push('Automation Tools Detected');
      }

      // Check for spoofed characteristics
      if (device.deviceSignature.platform && device.deviceSignature.userAgent) {
        const platformMismatch = this.detectPlatformMismatch(
          device.deviceSignature.platform, 
          device.deviceSignature.userAgent
        );
        
        if (platformMismatch) {
          suspicious = true;
          anomalyIncrease += 12;
          alerts.push('Platform Spoofing Detected');
        }
      }

      // Check for unusual screen resolutions
      if (device.deviceSignature.screenResolution) {
        const unusualResolution = this.isUnusualResolution(device.deviceSignature.screenResolution);
        if (unusualResolution) {
          suspicious = true;
          anomalyIncrease += 8;
          alerts.push('Unusual Screen Resolution');
        }
      }

    } catch (error) {
      productionLogger.debug('Device fingerprint analysis error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return { suspicious, anomalyIncrease, alerts };
  }

  /**
   * Detect coordinated behavior patterns
   */
  detectCoordinatedBehavior(device, similarDevices) {
    let isCoordinated = false;
    let massReporting = false;

    try {
      // Check for synchronized reporting times
      const deviceReportTimes = device.submissionPattern.peakHours || [];
      let synchronizedDevices = 0;

      similarDevices.forEach(similarDevice => {
        const similarPeakHours = similarDevice.submissionPattern.peakHours || [];
        const overlap = deviceReportTimes.filter(hour => similarPeakHours.includes(hour));
        
        if (overlap.length >= 2) { // At least 2 hours overlap
          synchronizedDevices++;
        }
      });

      if (synchronizedDevices >= 2) {
        isCoordinated = true;
      }

      // Check for mass reporting campaigns
      const totalReports = similarDevices.reduce((sum, d) => sum + (d.analytics.totalReports || 0), device.analytics.totalReports || 0);
      const avgReports = totalReports / (similarDevices.length + 1);
      
      if (avgReports > 50 && synchronizedDevices >= 2) {
        massReporting = true;
        isCoordinated = true;
      }

      // Check for similar behavior scores (indicating automated behavior)
      const behaviorScores = [device.behaviorProfile.humanBehaviorScore, ...similarDevices.map(d => d.behaviorProfile.humanBehaviorScore)];
      const avgBehaviorScore = behaviorScores.reduce((sum, score) => sum + score, 0) / behaviorScores.length;
      const variance = behaviorScores.reduce((sum, score) => sum + Math.pow(score - avgBehaviorScore, 2), 0) / behaviorScores.length;
      
      if (variance < 25 && avgBehaviorScore < 40) { // Low variance and low human score
        isCoordinated = true;
      }

    } catch (error) {
      productionLogger.debug('Coordinated behavior detection error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return { isCoordinated, massReporting };
  }

  /**
   * Flag related devices for further analysis
   */
  async flagRelatedDevices(devices, flagType) {
    try {
      const bulkOps = devices.map(device => ({
        updateOne: {
          filter: { fingerprintId: device.fingerprintId },
          update: {
            $push: { 
              'moderatorAlerts': `Related to ${flagType}`,
              'threatIntelligence.suspiciousPatterns': flagType
            },
            $inc: { 'deviceAnomalyScore': 10 }
          }
        }
      }));

      if (bulkOps.length > 0) {
        await DeviceFingerprint.bulkWrite(bulkOps);
        productionLogger.info('Related devices flagged', {
          flagType,
          deviceCount: bulkOps.length
        });
      }
    } catch (error) {
      productionLogger.error('Failed to flag related devices', {
        error: error.message,
        flagType
      });
    }
  }

  /**
   * Calculate device consistency score
   */
  async calculateDeviceConsistency(device) {
    let consistencyScore = 100;

    try {
      // Check signature consistency over time
      if (device.previousSignature) {
        const changes = [
          device.deviceSignature.userAgent !== device.previousSignature.userAgent,
          device.deviceSignature.screenResolution !== device.previousSignature.screenResolution,
          device.deviceSignature.timezone !== device.previousSignature.timezone,
          device.deviceSignature.platform !== device.previousSignature.platform
        ].filter(Boolean).length;

        consistencyScore -= changes * 15; // Deduct 15 points per change
      }

      // Check location consistency
      if (device.locationProfile.locationJumps > 5) {
        consistencyScore -= device.locationProfile.locationJumps * 2;
      }

      // Check network consistency
      if (device.networkProfile.vpnSuspected || device.networkProfile.proxyDetected) {
        consistencyScore -= 20;
      }

      consistencyScore = Math.max(0, Math.min(100, consistencyScore));

    } catch (error) {
      productionLogger.debug('Device consistency calculation error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
      consistencyScore = 50; // Default on error
    }

    return consistencyScore;
  }

  /**
   * Perform geographic analysis
   */
  async performGeographicAnalysis(device) {
    const analysis = {
      region: 'Unknown',
      confidence: 0,
      riskFactors: []
    };

    try {
      // Analyze location patterns
      if (device.locationProfile.crossBorderActivity) {
        analysis.riskFactors.push('cross_border_activity');
      }

      if (device.locationProfile.locationJumps > 3) {
        analysis.riskFactors.push('frequent_location_changes');
      }

      if (device.locationProfile.gpsAccuracy > 1000) {
        analysis.riskFactors.push('poor_gps_accuracy');
      }

      // Determine region confidence
      if (device.bangladeshProfile.likelyFromBangladesh) {
        analysis.region = 'Bangladesh';
        analysis.confidence = device.bangladeshProfile.culturalContextMatch || 50;
        
        if (device.bangladeshProfile.estimatedDivision) {
          analysis.region += ` (${device.bangladeshProfile.estimatedDivision})`;
        }
      } else {
        analysis.region = device.networkProfile.estimatedCountry || 'Unknown';
        analysis.confidence = 30; // Lower confidence for non-Bangladesh users
      }

      // Cross-border suspicion analysis
      if (device.bangladeshProfile.crossBorderSuspicion > 50) {
        analysis.riskFactors.push('cross_border_suspicion');
        analysis.confidence = Math.max(0, analysis.confidence - 20);
      }

    } catch (error) {
      productionLogger.debug('Geographic analysis error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return analysis;
  }

  /**
   * Update behavior model
   */
  async updateBehaviorModel(device) {
    const model = {
      type: 'unknown',
      confidence: 0
    };

    try {
      const humanScore = device.behaviorProfile.humanBehaviorScore || 50;
      const reportCount = device.analytics.totalReports || 0;
      const sessionLength = device.behaviorProfile.sessionLength || 0;

      // Classify user type based on patterns
      if (humanScore > 80 && reportCount > 0 && sessionLength > 60) {
        model.type = 'engaged_human';
        model.confidence = 90;
      } else if (humanScore < 20 && reportCount > 20) {
        model.type = 'automated_bot';
        model.confidence = 85;
      } else if (reportCount > 100 && sessionLength < 30) {
        model.type = 'report_farm';
        model.confidence = 75;
      } else if (humanScore > 60 && reportCount < 5) {
        model.type = 'casual_user';
        model.confidence = 70;
      } else if (humanScore < 40 && device.networkProfile.vpnSuspected) {
        model.type = 'suspicious_user';
        model.confidence = 65;
      } else {
        model.type = 'normal_user';
        model.confidence = 60;
      }

    } catch (error) {
      productionLogger.debug('Behavior model update error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return model;
  }

  /**
   * Analyze network patterns
   */
  async analyzeNetworkPatterns(device) {
    let suspicious = false;
    let anomalyIncrease = 0;
    const suspiciousHeaders = [];

    try {
      // Check for VPN/Proxy usage patterns
      if (device.networkProfile.vpnSuspected && device.networkProfile.torDetected) {
        suspicious = true;
        anomalyIncrease += 20;
        suspiciousHeaders.push('multiple_anonymization_tools');
      }

      // Check for unusual network provider patterns
      if (device.networkProfile.networkProvider) {
        const providerKey = `network:provider:${device.networkProfile.networkProvider}`;
        const providerStats = await cacheLayer.get(providerKey);
        
        if (providerStats && providerStats.suspiciousActivityRate > 70) {
          suspicious = true;
          anomalyIncrease += 10;
          suspiciousHeaders.push('high_risk_network_provider');
        }
      }

      // Check for rapid IP changes
      if (device.networkProfile.ipHash && device.previousSignature?.ipHash) {
        if (device.networkProfile.ipHash !== device.previousSignature.ipHash) {
          const timeDiff = Date.now() - device.previousSignature.timestamp.getTime();
          if (timeDiff < 3600000) { // IP changed within 1 hour
            suspicious = true;
            anomalyIncrease += 15;
            suspiciousHeaders.push('rapid_ip_change');
          }
        }
      }

    } catch (error) {
      productionLogger.debug('Network pattern analysis error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return { suspicious, anomalyIncrease, suspiciousHeaders };
  }

  /**
   * Analyze submission patterns for suspicious timing
   */
  analyzeSubmissionPatterns(device) {
    let suspicious = false;

    try {
      const hourlyDist = device.submissionPattern.hourlyDistribution || Array(24).fill(0);
      const totalReports = hourlyDist.reduce((sum, count) => sum + count, 0);
      
      if (totalReports === 0) return { suspicious: false };

      // Check for highly concentrated activity
      const maxHourly = Math.max(...hourlyDist);
      const concentration = maxHourly / totalReports;
      
      if (concentration > 0.5 && totalReports > 10) { // More than 50% of reports in one hour
        suspicious = true;
      }

      // Check for unnatural patterns (e.g., exactly every 2 hours)
      const nonZeroHours = hourlyDist.filter(count => count > 0).length;
      if (nonZeroHours > 0 && totalReports > 20) {
        const avgReportsPerActiveHour = totalReports / nonZeroHours;
        const variance = hourlyDist.reduce((sum, count) => {
          return sum + Math.pow(count - avgReportsPerActiveHour, 2);
        }, 0) / 24;
        
        if (variance < 1 && avgReportsPerActiveHour > 5) { // Very low variance, high activity
          suspicious = true;
        }
      }

    } catch (error) {
      productionLogger.debug('Submission pattern analysis error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return { suspicious };
  }

  /**
   * Update analytics data
   */
  async updateAnalytics(device) {
    const analytics = {};

    try {
      // Calculate approval rate
      if (device.securityProfile.totalReportsSubmitted > 0) {
        analytics.approvalRate = (device.securityProfile.approvedReports / device.securityProfile.totalReportsSubmitted) * 100;
      } else {
        analytics.approvalRate = 0;
      }

      // Calculate engagement metrics
      if (device.activityHistory.totalSessions > 0) {
        analytics.averageSessionDuration = device.activityHistory.totalPageViews / device.activityHistory.totalSessions;
        analytics.bounceRate = (device.activityHistory.totalSessions - device.activityHistory.totalPageViews) / device.activityHistory.totalSessions * 100;
      }

      // Update reporting patterns
      const hourlyDist = device.submissionPattern.hourlyDistribution || Array(24).fill(0);
      const totalReports = hourlyDist.reduce((sum, count) => sum + count, 0);
      
      if (totalReports > 0) {
        analytics.dailyAverage = totalReports / Math.max(1, (Date.now() - device.activityHistory.firstSeen.getTime()) / (1000 * 60 * 60 * 24));
        analytics.weeklyAverage = analytics.dailyAverage * 7;
        analytics.monthlyAverage = analytics.dailyAverage * 30;
      }

    } catch (error) {
      productionLogger.debug('Analytics update error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return analytics;
  }

  /**
   * Calculate long-term trust based on historical behavior
   */
  async calculateLongTermTrust(device) {
    let longTermTrust = device.securityProfile.trustScore || 50;

    try {
      const accountAge = (Date.now() - device.activityHistory.firstSeen.getTime()) / (1000 * 60 * 60 * 24); // Days
      const totalReports = device.securityProfile.totalReportsSubmitted || 0;
      const approvedReports = device.securityProfile.approvedReports || 0;

      // Age bonus (up to 20 points for accounts > 90 days old)
      if (accountAge > 30) {
        const ageBonus = Math.min(20, (accountAge / 90) * 20);
        longTermTrust += ageBonus;
      }

      // Consistency bonus (up to 15 points for consistent good behavior)
      if (totalReports > 20) {
        const approvalRate = approvedReports / totalReports;
        if (approvalRate > 0.8) {
          longTermTrust += 15;
        } else if (approvalRate > 0.6) {
          longTermTrust += 10;
        }
      }

      // Penalty for recent security violations
      const recentViolations = device.securityProfile.securityViolations?.filter(violation => {
        const violationDate = new Date(violation.timestamp || Date.now() - 86400000); // Default to 1 day ago
        return (Date.now() - violationDate.getTime()) < (30 * 24 * 60 * 60 * 1000); // Last 30 days
      }) || [];

      longTermTrust -= recentViolations.length * 10;

      // Cap the score
      longTermTrust = Math.max(0, Math.min(100, longTermTrust));

    } catch (error) {
      productionLogger.debug('Long-term trust calculation error', { 
        error: error.message,
        fingerprintId: device.fingerprintId 
      });
    }

    return longTermTrust;
  }

  /**
   * Helper method to detect platform mismatches
   */
  detectPlatformMismatch(platform, userAgent) {
    try {
      const platformLower = platform.toLowerCase();
      const userAgentLower = userAgent.toLowerCase();

      if (platformLower.includes('win') && !userAgentLower.includes('windows')) {
        return true;
      }
      if (platformLower.includes('mac') && !userAgentLower.includes('mac') && !userAgentLower.includes('darwin')) {
        return true;
      }
      if (platformLower.includes('linux') && !userAgentLower.includes('linux')) {
        return true;
      }
      if (platformLower.includes('android') && !userAgentLower.includes('android')) {
        return true;
      }
      if (platformLower.includes('iphone') && !userAgentLower.includes('iphone')) {
        return true;
      }
    } catch (error) {
      // Ignore errors in platform detection
    }

    return false;
  }

  /**
   * Helper method to detect unusual screen resolutions
   */
  isUnusualResolution(resolution) {
    const commonResolutions = [
      '1920x1080', '1366x768', '1440x900', '1280x1024', '1024x768',
      '1600x900', '1680x1050', '1280x800', '1536x864', '1280x720',
      '2560x1440', '3840x2160', '1920x1200', '2560x1080', '1400x1050'
    ];

    return !commonResolutions.includes(resolution);
  }

  // ========================================
  // PROCESSOR MANAGEMENT METHODS
  // ========================================

  /**
   * Get processor statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.processingQueue.length + this.stats.queueLength,
      activeJobs: this.activeJobs.size,
      processId: this.processId,
      uptime: Date.now() - this.stats.startTime,
      isShuttingDown: this.shutdownInitiated
    };
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      const redisHealth = await cacheLayer.healthCheck();
      const queueLength = await cacheLayer.client.zcard(this.config.redisQueueKey);
      
      return {
        status: this.shutdownInitiated ? 'shutting_down' : 'healthy',
        processId: this.processId,
        uptime: Date.now() - this.stats.startTime,
        stats: this.stats,
        redis: redisHealth,
        queue: {
          length: queueLength,
          activeJobs: this.activeJobs.size
        },
        lastProcessed: this.stats.lastProcessedAt
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        processId: this.processId
      };
    }
  }

  /**
   * Graceful shutdown handling
   */
  async gracefulShutdown() {
    if (this.shutdownInitiated) return;
    
    this.shutdownInitiated = true;
    productionLogger.info('DeviceFingerprintProcessor: Initiating graceful shutdown', {
      processId: this.processId,
      activeJobs: this.activeJobs.size
    });

    try {
      // Wait for active jobs to complete (with timeout)
      const shutdownTimeout = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (this.activeJobs.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
        productionLogger.info('Waiting for active jobs to complete', {
          activeJobs: this.activeJobs.size,
          remainingTime: shutdownTimeout - (Date.now() - startTime)
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Cancel remaining jobs
      if (this.activeJobs.size > 0) {
        productionLogger.warn('Cancelling remaining active jobs', {
          jobCount: this.activeJobs.size
        });
        
        for (const [jobId, jobData] of this.activeJobs) {
          if (jobData.timeout) {
            clearTimeout(jobData.timeout);
          }
          
          // Return job to queue for retry
          try {
            const job = {
              ...jobData,
              status: 'cancelled',
              attempts: jobData.attempts || 0
            };
            
            const score = Date.now() + (1000000 - job.priority);
            await cacheLayer.client.zadd(this.config.redisQueueKey, score, JSON.stringify(job));
          } catch (error) {
            productionLogger.error('Failed to requeue cancelled job', {
              jobId,
              error: error.message
            });
          }
        }
        
        this.activeJobs.clear();
      }

      // Unregister processor
      const registrationKey = `safestreets:processors:${this.processId}`;
      await cacheLayer.delete(registrationKey);
      
      // Update device processing status
      await DeviceFingerprint.handleGracefulShutdown();
      
      productionLogger.info('DeviceFingerprintProcessor: Graceful shutdown completed', {
        processId: this.processId,
        totalProcessed: this.stats.totalProcessed,
        totalErrors: this.stats.totalErrors
      });

    } catch (error) {
      productionLogger.error('Error during graceful shutdown', {
        error: error.message,
        processId: this.processId
      });
    } finally {
      process.exit(0);
    }
  }

  /**
   * Force restart processor (for admin control)
   */
  async restart() {
    productionLogger.info('DeviceFingerprintProcessor: Manual restart initiated', {
      processId: this.processId
    });
    
    await this.gracefulShutdown();
  }

  /**
   * Pause processing (for maintenance)
   */
  pause() {
    this.isProcessing = true; // This will prevent new batches from starting
    productionLogger.info('DeviceFingerprintProcessor: Processing paused', {
      processId: this.processId
    });
  }

  /**
   * Resume processing
   */
  resume() {
    this.isProcessing = false;
    productionLogger.info('DeviceFingerprintProcessor: Processing resumed', {
      processId: this.processId
    });
  }

  /**
   * Clear processing queue (emergency function)
   */
  async clearQueue() {
    try {
      const clearedCount = await cacheLayer.client.del(this.config.redisQueueKey);
      this.processingQueue = [];
      
      productionLogger.warn('Processing queue cleared', {
        clearedCount,
        processId: this.processId
      });
      
      return clearedCount;
    } catch (error) {
      productionLogger.error('Failed to clear queue', {
        error: error.message,
        processId: this.processId
      });
      throw error;
    }
  }
}

// Singleton instance
const deviceFingerprintProcessor = new DeviceFingerprintProcessor();

// Export the processor and class
module.exports = {
  deviceFingerprintProcessor,
  DeviceFingerprintProcessor
};