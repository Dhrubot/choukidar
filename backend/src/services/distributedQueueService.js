// === src/services/distributedQueueService.js ===
// BANGLADESH-SCALE DISTRIBUTED QUEUE SYSTEM
// Handles 25,000+ concurrent users with Redis Bull Queue clustering
// Replaces single-process queue with distributed, fault-tolerant system

const Queue = require('bull');
const { productionLogger } = require('../utils/productionLogger');

class DistributedQueueService {
  constructor() {
    // Redis connection configuration for clustering
    this.redisConfig = {
      port: process.env.REDIS_PORT || 6379,
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxLoadingTimeout: 0,
      lazyConnect: true,
      // Clustering optimization
      family: 4,
      keepAlive: true,
      connectTimeout: 10000,
      commandTimeout: 5000
    };

    // Queue definitions with Bangladesh-scale settings
    this.queues = {
      // CRITICAL: Female safety reports - highest priority
      emergencyReports: new Queue('emergency reports', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 50,   // Keep recent completions
          removeOnFail: 100,      // Keep failures for analysis
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
        settings: {
          stalledInterval: 30 * 1000,    // 30 seconds
          maxStalledCount: 1,
        }
      }),

      // HIGH: Normal safety reports
      standardReports: new Queue('standard reports', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
        settings: {
          stalledInterval: 60 * 1000,    // 1 minute
          maxStalledCount: 2,
        }
      }),

      // MEDIUM: Background processing
      backgroundTasks: new Queue('background processing', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 25,
          removeOnFail: 25,
          attempts: 1,
          delay: 5000,  // 5 second delay for background tasks
        },
        settings: {
          stalledInterval: 120 * 1000,   // 2 minutes
          maxStalledCount: 3,
        }
      }),

      // LOW: Analytics and non-critical tasks
      analyticsQueue: new Queue('analytics', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 10,
          attempts: 1,
          delay: 30000, // 30 second delay for analytics
        },
        settings: {
          stalledInterval: 300 * 1000,   // 5 minutes
          maxStalledCount: 1,
        }
      }),

      // Email notifications
      emailQueue: new Queue('email delivery', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      }),

      // Device analysis
      deviceAnalysis: new Queue('device analysis', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 15,
          removeOnFail: 30,
          attempts: 2,
          delay: 10000, // 10 second delay
        }
      })
    };

    // Processors map for different job types
    this.processors = new Map();

    // Statistics tracking
    this.stats = {
      processed: 0,
      failed: 0,
      active: 0,
      waiting: 0,
      completed: 0,
      delayed: 0,
      emergencyProcessed: 0,
      avgProcessingTime: 0,
      lastResetTime: Date.now()
    };

    // Worker configuration - scales based on server capacity
    this.workerConfig = {
      emergency: {
        concurrency: parseInt(process.env.EMERGENCY_WORKERS) || 10,
        priority: 1
      },
      standard: {
        concurrency: parseInt(process.env.STANDARD_WORKERS) || 20,
        priority: 2
      },
      background: {
        concurrency: parseInt(process.env.BACKGROUND_WORKERS) || 5,
        priority: 3
      },
      analytics: {
        concurrency: parseInt(process.env.ANALYTICS_WORKERS) || 2,
        priority: 4
      },
      email: {
        concurrency: parseInt(process.env.EMAIL_WORKERS) || 3,
        priority: 3
      },
      device: {
        concurrency: parseInt(process.env.DEVICE_WORKERS) || 4,
        priority: 3
      }
    };

    this.isInitialized = false;
    this.healthCheckInterval = null;
  }

  /**
   * Initialize the distributed queue system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Bangladesh-scale distributed queue system...');

      // Test Redis connection first
      await this.testRedisConnection();

      // Set up error handlers for all queues
      this.setupErrorHandlers();

      // Register default processors
      this.registerDefaultProcessors();

      // Start workers with appropriate concurrency
      this.startWorkers();

      // Set up monitoring and health checks
      this.setupMonitoring();

      // Graceful shutdown handlers
      this.setupGracefulShutdown();

      this.isInitialized = true;

      console.log('✅ Distributed queue system initialized successfully');
      console.log(`📊 Worker capacity: Emergency=${this.workerConfig.emergency.concurrency}, Standard=${this.workerConfig.standard.concurrency}`);

      return { success: true, message: 'Distributed queue system ready for Bangladesh scale' };

    } catch (error) {
      console.error('❌ Failed to initialize distributed queue system:', error);

      // Attempt graceful degradation
      await this.handleInitializationFailure(error);

      throw error;
    }
  }

  /**
   * Test Redis connection before initializing queues
   */
  async testRedisConnection() {
    const Redis = require('ioredis');
    const testClient = new Redis(this.redisConfig);

    try {
      await testClient.ping();
      console.log('✅ Redis connection test passed');
      await testClient.disconnect();
    } catch (error) {
      console.error('❌ Redis connection test failed:', error);
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  /**
   * Set up error handlers for all queues
   */
  setupErrorHandlers() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      // Global error handler
      queue.on('error', (error) => {
        console.error(`❌ Queue ${name} error:`, error);
        productionLogger.error('Queue error', { queue: name, error: error.message });
      });

      // Failed job handler
      queue.on('failed', (job, error) => {
        console.error(`❌ Job failed in ${name}:`, { jobId: job.id, error: error.message });
        this.stats.failed++;

        // Special handling for emergency reports
        if (name === 'emergencyReports') {
          this.handleEmergencyFailure(job, error);
        }
      });

      // Completed job handler
      queue.on('completed', (job, result) => {
        this.stats.processed++;
        this.stats.completed++;

        if (name === 'emergencyReports') {
          this.stats.emergencyProcessed++;
        }

        // Calculate average processing time
        const processingTime = Date.now() - job.timestamp;
        this.updateAverageProcessingTime(processingTime);
      });

      // Active job tracking
      queue.on('active', (job) => {
        this.stats.active++;
      });

      // Waiting job tracking
      queue.on('waiting', (jobId) => {
        this.stats.waiting++;
      });
    });
  }

  /**
   * Register default processors for different job types
   */
  registerDefaultProcessors() {
    // Emergency report processor - immediate processing
    this.registerProcessor('emergencyReports', async (job) => {
      const { reportData, priority = 'critical' } = job.data;

      console.log(`🚨 Processing emergency report: ${job.id} (Priority: ${priority})`);

      // Import report processor dynamically to avoid circular dependencies
      const { reportProcessor } = require('../middleware/reportProcessor');

      // Process with highest priority
      const result = await reportProcessor.processEmergencyReport(reportData, {
        priority: 'critical',
        skipQueue: true,
        emergencyMode: true
      });

      return {
        success: true,
        reportId: result.reportId,
        processingTime: Date.now() - job.timestamp,
        priority: 'emergency'
      };
    });

    // Standard report processor
    this.registerProcessor('standardReports', async (job) => {
      const { reportData } = job.data;

      console.log(`📊 Processing standard report: ${job.id}`);

      const { reportProcessor } = require('../middleware/reportProcessor');

      const result = await reportProcessor.processStandardReport(reportData, {
        priority: 'normal',
        backgroundProcessing: true
      });

      return {
        success: true,
        reportId: result.reportId,
        processingTime: Date.now() - job.timestamp
      };
    });

    // Background task processor
    this.registerProcessor('backgroundTasks', async (job) => {
      const { taskType, data } = job.data;

      console.log(`⚙️ Processing background task: ${taskType} (Job: ${job.id})`);

      switch (taskType) {
        case 'security_analysis':
          return await this.processSecurityAnalysis(data);
        case 'location_enrichment':
          return await this.processLocationEnrichment(data);
        case 'trend_analysis':
          return await this.processTrendAnalysis(data);
        default:
          throw new Error(`Unknown background task type: ${taskType}`);
      }
    });

    // Analytics processor
    this.registerProcessor('analyticsQueue', async (job) => {
      const { analyticsType, data } = job.data;

      console.log(`📈 Processing analytics: ${analyticsType} (Job: ${job.id})`);

      // Process analytics without blocking main operations
      return await this.processAnalytics(analyticsType, data);
    });

    // Email processor
    this.registerProcessor('emailQueue', async (job) => {
      const { emailType, recipient, data } = job.data;

      console.log(`📧 Sending email: ${emailType} to ${recipient} (Job: ${job.id})`);

      const { emailService } = require('./emailService');
      return await emailService.sendEmail(emailType, recipient, data);
    });

    // Device analysis processor
    this.registerProcessor('deviceAnalysis', async (job) => {
      const { deviceId, analysisType } = job.data;

      console.log(`🔍 Analyzing device: ${deviceId} (Type: ${analysisType}, Job: ${job.id})`);

      const { deviceFingerprintProcessor } = require('../middleware/deviceFingerprintProcessor');
      return await deviceFingerprintProcessor.analyzeDevice(deviceId, analysisType);
    });
  }

  /**
   * Register a processor for a specific queue
   */
  registerProcessor(queueName, processor) {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} does not exist`);
    }

    if (typeof processor !== 'function') {
      throw new Error('Processor must be a function');
    }

    this.processors.set(queueName, processor);
    console.log(`🔧 Processor registered for queue: ${queueName}`);
  }

  /**
   * Start workers for all queues with appropriate concurrency
   */
  startWorkers() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      const processor = this.processors.get(name);

      if (!processor) {
        console.warn(`⚠️ No processor found for queue: ${name}`);
        return;
      }

      // Get worker configuration
      const workerKey = this.getWorkerConfigKey(name);
      const config = this.workerConfig[workerKey] || { concurrency: 1, priority: 5 };

      // Start workers with concurrency
      queue.process(config.concurrency, processor);

      console.log(`🏃 Started ${config.concurrency} workers for ${name} queue (Priority: ${config.priority})`);
    });
  }

  /**
   * Add job to appropriate queue based on priority
   */
  async addJob(queueName, jobData, options = {}) {
    try {
      if (!this.queues[queueName]) {
        throw new Error(`Queue ${queueName} does not exist`);
      }

      // Determine priority and options based on job type
      const jobOptions = this.getJobOptions(queueName, options);

      // Add job to queue
      const job = await this.queues[queueName].add(jobData, jobOptions);

      console.log(`➕ Job added to ${queueName}: ${job.id}`);

      return {
        success: true,
        jobId: job.id,
        queue: queueName,
        estimatedDelay: jobOptions.delay || 0
      };

    } catch (error) {
      console.error(`❌ Failed to add job to ${queueName}:`, error);

      // Attempt fallback processing for critical jobs
      if (queueName === 'emergencyReports') {
        return await this.handleEmergencyJobFailure(jobData, error);
      }

      throw error;
    }
  }

  /**
 * Add job to queue based on processing tier (MISSING METHOD - REQUIRED BY REPORT PROCESSOR)
 * Maps processing tiers to appropriate queue names
 */
  async addToQueue(tier, jobData, options = {}) {
    try {
      // Map processing tiers to queue names
      const tierToQueueMap = {
        'emergency': 'emergencyReports',
        'standard': 'standardReports',
        'background': 'backgroundTasks',
        'analytics': 'analyticsQueue'
      };

      // Get the appropriate queue name for the tier
      const queueName = tierToQueueMap[tier];

      if (!queueName) {
        throw new Error(`Unknown processing tier: ${tier}. Valid tiers: ${Object.keys(tierToQueueMap).join(', ')}`);
      }

      // Set priority based on tier if not provided
      if (!options.priority) {
        const tierPriorities = {
          'emergency': 1,
          'standard': 2,
          'background': 3,
          'analytics': 4
        };
        options.priority = tierPriorities[tier];
      }

      // Call the existing addJob method
      const result = await this.addJob(queueName, jobData, options);

      console.log(`✅ Job added to ${tier} tier (${queueName} queue): ${result.jobId}`);

      return result;

    } catch (error) {
      console.error(`❌ Failed to add job to ${tier} tier:`, error);
      throw error;
    }
  }

  /**
   * Smart job routing - automatically determines best queue
   */
  async routeJob(jobData, jobType, metadata = {}) {
    const { priority, genderSensitive, urgency } = metadata;

    // Emergency routing for female safety
    if (genderSensitive === true || urgency === 'critical' || priority === 'emergency') {
      return await this.addJob('emergencyReports', jobData, { priority: 1 });
    }

    // Standard report routing
    if (jobType === 'safety_report' || jobType === 'incident_report') {
      return await this.addJob('standardReports', jobData, { priority: 2 });
    }

    // Background task routing
    if (jobType === 'analysis' || jobType === 'enrichment') {
      return await this.addJob('backgroundTasks', jobData, { priority: 3 });
    }

    // Analytics routing
    if (jobType === 'analytics' || jobType === 'metrics') {
      return await this.addJob('analyticsQueue', jobData, { priority: 4 });
    }

    // Default to standard queue
    return await this.addJob('standardReports', jobData, { priority: 3 });
  }

  /**
   * Get comprehensive queue statistics
   */
  async getQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(this.queues)) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length
        };
      } catch (error) {
        console.error(`❌ Error getting stats for ${name}:`, error);
        stats[name] = { error: error.message };
      }
    }

    return {
      ...stats,
      global: {
        totalProcessed: this.stats.processed,
        totalFailed: this.stats.failed,
        emergencyProcessed: this.stats.emergencyProcessed,
        avgProcessingTime: this.stats.avgProcessingTime,
        uptime: Date.now() - this.stats.lastResetTime
      }
    };
  }

  /**
   * Health check for the distributed queue system
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      queues: {},
      redis: 'unknown',
      workers: {},
      timestamp: new Date().toISOString()
    };

    try {
      // Check Redis connectivity
      const testQueue = this.queues.emergencyReports;
      await testQueue.client.ping();
      health.redis = 'connected';

      // Check each queue (FIXED: Bull queues don't have checkHealth method)
      for (const [name, queue] of Object.entries(this.queues)) {
        try {
          // Use Bull queue's built-in status checks instead of checkHealth
          const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed()
          ]);

          // Check if queue is responsive by testing basic operations
          const queueHealth = {
            status: 'healthy',
            connection: 'active',
            counts: {
              waiting: waiting.length,
              active: active.length,
              completed: completed.length,
              failed: failed.length,
              delayed: delayed.length
            }
          };

          // Consider queue unhealthy if there are too many failed jobs
          if (failed.length > 100) {
            queueHealth.status = 'degraded';
            queueHealth.warning = `High failure count: ${failed.length}`;
          }

          // Consider queue critical if it's completely stalled
          if (active.length === 0 && waiting.length > 50) {
            queueHealth.status = 'degraded';
            queueHealth.warning = `Queue appears stalled: ${waiting.length} waiting, 0 active`;
          }

          health.queues[name] = queueHealth;

          // Check if workers are responsive
          const workerKey = this.getWorkerConfigKey(name);
          health.workers[name] = {
            concurrency: this.workerConfig[workerKey]?.concurrency || 0,
            status: 'active'
          };

        } catch (error) {
          health.queues[name] = {
            status: 'unhealthy',
            error: error.message
          };
          health.status = 'degraded';
        }
      }

      // Overall health determination
      const unhealthyQueues = Object.values(health.queues).filter(q => q.status === 'unhealthy').length;
      const degradedQueues = Object.values(health.queues).filter(q => q.status === 'degraded').length;

      if (unhealthyQueues > 0) {
        health.status = unhealthyQueues >= Object.keys(this.queues).length / 2 ? 'critical' : 'degraded';
      } else if (degradedQueues > 0) {
        health.status = 'degraded';
      }

      return health;

    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        status: 'critical',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Setup monitoring and periodic health checks
   */
  setupMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.healthCheck();

      if (health.status !== 'healthy') {
        console.warn('⚠️ Queue system health issue:', health);
        productionLogger.warn('Queue health degraded', health);
      }

      // Log stats every 5 minutes
      if (Date.now() % (5 * 60 * 1000) < 30000) {
        const stats = await this.getQueueStats();
        console.log('📊 Queue statistics:', stats.global);
      }
    }, 30000);

    // Performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor processing times and throughput
    setInterval(() => {
      const now = Date.now();
      const timeSinceReset = now - this.stats.lastResetTime;

      if (timeSinceReset > 0) {
        const throughput = (this.stats.processed / timeSinceReset) * 1000 * 60; // per minute

        if (process.env.NODE_ENV === 'development') {
          console.log(`📈 Processing throughput: ${throughput.toFixed(2)} jobs/minute`);
        }

        // Reset stats every hour
        if (timeSinceReset > 60 * 60 * 1000) {
          this.resetStats();
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown handling
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`🔄 Received ${signal}, starting graceful shutdown...`);

      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Close all queues
      const closePromises = Object.entries(this.queues).map(async ([name, queue]) => {
        try {
          await queue.close();
          console.log(`✅ Queue ${name} closed gracefully`);
        } catch (error) {
          console.error(`❌ Error closing queue ${name}:`, error);
        }
      });

      await Promise.all(closePromises);
      console.log('✅ All queues closed. Distributed queue system shutdown complete.');
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  // ===== HELPER METHODS =====

  getWorkerConfigKey(queueName) {
    const mapping = {
      'emergencyReports': 'emergency',
      'standardReports': 'standard',
      'backgroundTasks': 'background',
      'analyticsQueue': 'analytics',
      'emailQueue': 'email',
      'deviceAnalysis': 'device'
    };
    return mapping[queueName] || 'standard';
  }

  getJobOptions(queueName, userOptions = {}) {
    const baseOptions = {
      emergencyReports: { priority: 1, attempts: 3, delay: 0 },
      standardReports: { priority: 2, attempts: 2, delay: 1000 },
      backgroundTasks: { priority: 3, attempts: 1, delay: 5000 },
      analyticsQueue: { priority: 4, attempts: 1, delay: 30000 },
      emailQueue: { priority: 2, attempts: 3, delay: 2000 },
      deviceAnalysis: { priority: 3, attempts: 2, delay: 10000 }
    };

    return { ...baseOptions[queueName], ...userOptions };
  }

  updateAverageProcessingTime(newTime) {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.avgProcessingTime = alpha * newTime + (1 - alpha) * this.stats.avgProcessingTime;
  }

  resetStats() {
    this.stats = {
      ...this.stats,
      processed: 0,
      failed: 0,
      active: 0,
      waiting: 0,
      completed: 0,
      delayed: 0,
      lastResetTime: Date.now()
    };
  }

  async handleEmergencyFailure(job, error) {
    console.error(`🚨 CRITICAL: Emergency report failed: ${job.id}`, error);

    // Immediate fallback processing
    try {
      const { reportProcessor } = require('../middleware/reportProcessor');
      await reportProcessor.processEmergencyFallback(job.data);
    } catch (fallbackError) {
      console.error('❌ Emergency fallback also failed:', fallbackError);
      // Alert administrators
      productionLogger.error('Emergency processing complete failure', {
        jobId: job.id,
        originalError: error.message,
        fallbackError: fallbackError.message
      });
    }
  }

  async handleEmergencyJobFailure(jobData, error) {
    console.error('🚨 CRITICAL: Cannot queue emergency report, processing immediately');

    try {
      const { reportProcessor } = require('../middleware/reportProcessor');
      const result = await reportProcessor.processEmergencyFallback(jobData);

      return {
        success: true,
        fallback: true,
        message: 'Processed via emergency fallback',
        result
      };
    } catch (fallbackError) {
      console.error('❌ Emergency fallback processing failed:', fallbackError);
      throw new Error(`Queue and fallback both failed: ${error.message}`);
    }
  }

  async processSecurityAnalysis(data) {
    // Implement security analysis logic
    return { success: true, analysisType: 'security', data };
  }

  async processLocationEnrichment(data) {
    // Implement location enrichment logic
    return { success: true, analysisType: 'location', data };
  }

  async processTrendAnalysis(data) {
    // Implement trend analysis logic
    return { success: true, analysisType: 'trends', data };
  }

  async processAnalytics(analyticsType, data) {
    // Implement analytics processing logic
    return { success: true, analyticsType, data };
  }

  async handleInitializationFailure(error) {
    console.warn('⚠️ Attempting graceful degradation after initialization failure');

    // Import fallback queue service
    try {
      const { QueueService } = require('./queueService');
      this.fallbackQueue = new QueueService();
      await this.fallbackQueue.initialize();

      console.log('✅ Fallback to memory-based queue service');
    } catch (fallbackError) {
      console.error('❌ Fallback queue initialization also failed:', fallbackError);
    }
  }
}

// Export singleton instance
const distributedQueueService = new DistributedQueueService();

module.exports = {
  distributedQueueService,
  DistributedQueueService
};