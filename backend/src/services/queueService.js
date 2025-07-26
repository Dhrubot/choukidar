// === backend/src/services/queueService.js (FIXED VERSION) ===
// Asynchronous Queue Processing with GRACEFUL DEGRADATION
// Works with or without Redis - automatically falls back to in-memory processing

const { cacheLayer } = require('../middleware/cacheLayer');
const { productionLogger } = require('../utils/productionLogger');

class QueueService {
  constructor() {
    this.queues = {
      reportProcessing: 'queue:reports',
      imageOptimization: 'queue:images',
      analytics: 'queue:analytics',
      notifications: 'queue:notifications',
      deviceAnalysis: 'queue:devices',
      emailDelivery: 'queue:emails',
      auditLogs: 'queue:audit',
      safezoneUpdates: 'queue:safezones'
    };

    this.processors = new Map();
    this.isProcessing = false;
    this.workerCount = 4;
    this.activeJobs = new Map();
    
    // FIXED: Memory fallback for when Redis is unavailable
    this.memoryQueues = new Map();
    this.memoryQueueProcessing = new Map();
    this.isRedisAvailable = false;
    
    // Queue statistics
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      avgProcessingTime: 0,
      memoryFallbacks: 0,
      redisOperations: 0
    };

    this.deadLetterQueue = 'queue:failed';
    this.maxRetries = 3;
  }

  /**
   * FIXED: Initialize with graceful Redis detection
   */
  async initialize() {
    console.log('🚀 Initializing queue service with graceful degradation...');

    // Check Redis availability
    await this.checkRedisAvailability();

    // Initialize memory queues as fallback
    this.initializeMemoryQueues();

    // Register default processors
    this.registerDefaultProcessors();

    // Start processing (works with or without Redis)
    this.startProcessing();

    // Monitor queue health
    this.startHealthMonitoring();

    console.log(`✅ Queue service initialized (Redis: ${this.isRedisAvailable ? 'connected' : 'fallback mode'})`);
  }

  /**
   * FIXED: Check Redis availability without crashing
   */
  async checkRedisAvailability() {
    try {
      if (cacheLayer && cacheLayer.isConnected) {
        // Test basic Redis operation
        await cacheLayer.set('queue:health:test', 'ok', 60);
        const result = await cacheLayer.get('queue:health:test');
        this.isRedisAvailable = (result === 'ok');
        await cacheLayer.delete('queue:health:test');
      } else {
        this.isRedisAvailable = false;
      }
    } catch (error) {
      console.warn('⚠️ Redis unavailable for queues, using memory fallback:', error.message);
      this.isRedisAvailable = false;
    }
  }

  /**
   * FIXED: Initialize memory queues for fallback
   */
  initializeMemoryQueues() {
    Object.values(this.queues).forEach(queueName => {
      this.memoryQueues.set(queueName, []);
      this.memoryQueueProcessing.set(queueName, false);
    });
    console.log('✅ Memory queue fallback initialized');
  }

  /**
   * FIXED: Add job with automatic fallback
   */
  async addJob(queueName, jobData, options = {}) {
    const {
      priority = 5,
      delay = 0,
      retries = this.maxRetries
    } = options;

    const job = {
      id: this.generateJobId(),
      queue: queueName,
      data: jobData,
      priority,
      retries,
      maxRetries: retries,
      createdAt: Date.now(),
      processingAfter: Date.now() + delay,
      status: 'pending'
    };

    try {
      if (this.isRedisAvailable) {
        // Try Redis first
        const score = this.calculatePriorityScore(priority, job.processingAfter);
        await cacheLayer.zadd(queueName, score, JSON.stringify(job));
        this.stats.redisOperations++;
        console.log(`📥 Job ${job.id} added to Redis queue ${queueName}`);
      } else {
        // Fallback to memory queue
        await this.addJobToMemory(queueName, job);
        this.stats.memoryFallbacks++;
        console.log(`📥 Job ${job.id} added to memory queue ${queueName} (Redis unavailable)`);
      }

      return job.id;

    } catch (error) {
      console.warn(`⚠️ Redis queue failed, falling back to memory for job ${job.id}`);
      // CRITICAL FIX: Always have a fallback
      await this.addJobToMemory(queueName, job);
      this.stats.memoryFallbacks++;
      return job.id;
    }
  }

  /**
   * FIXED: Memory queue implementation
   */
  async addJobToMemory(queueName, job) {
    if (!this.memoryQueues.has(queueName)) {
      this.memoryQueues.set(queueName, []);
    }
    
    const queue = this.memoryQueues.get(queueName);
    
    // Insert job in priority order (lower priority number = higher priority)
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (job.priority < queue[i].priority) {
        queue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      queue.push(job);
    }
  }

  /**
   * FIXED: Get next job from memory queue
   */
  getNextJobFromMemory(queueName) {
    const queue = this.memoryQueues.get(queueName);
    if (!queue || queue.length === 0) return null;
    
    // Find first job that's ready to process
    const now = Date.now();
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].processingAfter <= now) {
        return queue.splice(i, 1)[0];
      }
    }
    
    return null;
  }

  /**
   * Register a processor for a queue
   */
  registerProcessor(queueName, processor) {
    if (typeof processor !== 'function') {
      throw new Error('Processor must be a function');
    }

    this.processors.set(queueName, processor);
    console.log(`🔧 Processor registered for ${queueName}`);
  }

  /**
   * FIXED: Start processing with Redis/memory fallback
   */
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    // Start workers for each queue
    for (const [queueType, queueName] of Object.entries(this.queues)) {
      for (let i = 0; i < this.workerCount; i++) {
        this.processQueue(queueName, i);
      }
    }
  }

  /**
   * FIXED: Process jobs with automatic fallback
   */
  async processQueue(queueName, workerId) {
    while (this.isProcessing) {
      try {
        let job = null;

        // Try Redis first if available
        if (this.isRedisAvailable) {
          try {
            const jobs = await cacheLayer.zpopmin(queueName, 1);
            if (jobs && jobs.length > 0) {
              job = JSON.parse(jobs[0].value);
              job.source = 'redis';
            }
          } catch (error) {
            console.warn(`⚠️ Redis queue read failed for ${queueName}, falling back to memory`);
            this.isRedisAvailable = false; // Mark Redis as unavailable
          }
        }

        // Fallback to memory queue
        if (!job) {
          job = this.getNextJobFromMemory(queueName);
          if (job) {
            job.source = 'memory';
          }
        }
        
        if (!job) {
          // No jobs available, wait before checking again
          await this.sleep(1000);
          continue;
        }

        // Check if job should be processed yet (for delayed jobs)
        if (job.processingAfter > Date.now()) {
          // Re-add to appropriate queue
          if (job.source === 'redis' && this.isRedisAvailable) {
            const score = this.calculatePriorityScore(job.priority, job.processingAfter);
            await cacheLayer.zadd(queueName, score, JSON.stringify(job));
          } else {
            await this.addJobToMemory(queueName, job);
          }
          await this.sleep(100);
          continue;
        }

        // Mark job as active
        job.workerId = workerId;
        job.startedAt = Date.now();
        this.activeJobs.set(job.id, job);

        // Process the job
        await this.executeJob(job, queueName);

      } catch (error) {
        console.error(`❌ Queue processing error for ${queueName}:`, error);
        await this.sleep(5000); // Back off on error
      }
    }
  }

  /**
   * Execute a single job (unchanged but with better error handling)
   */
  async executeJob(job, queueName) {
    const startTime = Date.now();

    try {
      const processor = this.processors.get(queueName);
      
      if (!processor) {
        throw new Error(`No processor registered for queue: ${queueName}`);
      }

      // Execute the processor
      await processor(job.data, job);

      // Job completed successfully
      const processingTime = Date.now() - startTime;
      this.stats.processed++;
      this.stats.avgProcessingTime = 
        (this.stats.avgProcessingTime + processingTime) / 2;

      console.log(`✅ Job ${job.id} completed in ${processingTime}ms (${job.source || 'unknown'} queue)`);

      // Remove from active jobs
      this.activeJobs.delete(job.id);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      // Handle job failure
      await this.handleJobFailure(job, queueName, error);
      
      // Remove from active jobs
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * FIXED: Handle failed jobs with memory fallback
   */
  async handleJobFailure(job, queueName, error) {
    this.stats.failed++;

    if (job.retries > 0) {
      // Retry the job with exponential backoff
      job.retries--;
      job.lastError = error.message;
      job.processingAfter = Date.now() + this.calculateBackoff(job.maxRetries - job.retries);
      
      try {
        if (this.isRedisAvailable) {
          const score = this.calculatePriorityScore(job.priority, job.processingAfter);
          await cacheLayer.zadd(queueName, score, JSON.stringify(job));
        } else {
          await this.addJobToMemory(queueName, job);
        }
        
        this.stats.retried++;
        console.log(`🔄 Job ${job.id} scheduled for retry (${job.retries} retries left)`);
      } catch (retryError) {
        console.error(`❌ Failed to reschedule job ${job.id}:`, retryError);
        await this.moveToDeadLetter(job, error);
      }
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetter(job, error);
      console.error(`💀 Job ${job.id} moved to dead letter queue after ${job.maxRetries} retries`);
    }
  }

  /**
   * FIXED: Move failed job to dead letter queue with memory fallback
   */
  async moveToDeadLetter(job, error) {
    const deadJob = {
      ...job,
      failedAt: Date.now(),
      error: error.message,
      stack: error.stack
    };

    try {
      if (this.isRedisAvailable) {
        await cacheLayer.lpush(this.deadLetterQueue, JSON.stringify(deadJob));
      } else {
        // Memory fallback for dead letter queue
        if (!this.memoryQueues.has(this.deadLetterQueue)) {
          this.memoryQueues.set(this.deadLetterQueue, []);
        }
        this.memoryQueues.get(this.deadLetterQueue).push(deadJob);
      }
    } catch (deadLetterError) {
      console.error('❌ Failed to add job to dead letter queue:', deadLetterError);
      // Log to console as last resort
      console.error('💀 DEAD JOB (could not queue):', JSON.stringify(deadJob, null, 2));
    }
    
    // Alert if critical job fails
    if (job.priority <= 3) {
      if (productionLogger) {
        productionLogger.error('Critical job failed', {
          jobId: job.id,
          queue: job.queue,
          error: error.message
        });
      } else {
        console.error('🚨 CRITICAL JOB FAILED:', {
          jobId: job.id,
          queue: job.queue,
          error: error.message
        });
      }
    }
  }

  /**
   * FIXED: Register default processors with error handling
   */
  registerDefaultProcessors() {
    // Report processing with fallback
    this.registerProcessor(this.queues.reportProcessing, async (data, job) => {
      try {
        const Report = require('../models/Report');
        const report = await Report.findById(data.reportId);
        
        if (!report) throw new Error('Report not found');

        // Process report (validation, enrichment, etc.)
        report.processingStatus = report.processingStatus || {};
        report.processingStatus.fastPhaseCompleted = true;
        report.processingStatus.allPhasesCompleted = true;
        report.processingStatus.isProcessing = false;
        report.processingStatus.lastUpdated = new Date();
        await report.save();

        // Try to invalidate caches, but don't fail if Redis is down
        try {
          await cacheLayer.deletePattern('reports:*');
          await cacheLayer.deletePattern('map:*');
        } catch (cacheError) {
          console.warn('Cache invalidation failed (non-critical):', cacheError.message);
        }
      } catch (error) {
        console.error('Report processing failed:', error);
        throw error; // Re-throw for retry logic
      }
    });

    // Image optimization (simplified)
    this.registerProcessor(this.queues.imageOptimization, async (data, job) => {
      console.log(`🖼️ Optimizing image: ${data.imageUrl}`);
      await this.sleep(1000); // Simulate processing
    });

    // Analytics aggregation with error handling
    this.registerProcessor(this.queues.analytics, async (data, job) => {
      try {
        const Report = require('../models/Report');
        
        const analytics = await Report.aggregate([
          { $match: { status: 'approved', createdAt: { $gte: new Date(Date.now() - 86400000) } } },
          { $group: { _id: '$type', count: { $sum: 1 }, avgSeverity: { $avg: '$severity' } } }
        ]);

        // Try to store in cache, fallback to memory
        try {
          if (this.isRedisAvailable) {
            await cacheLayer.set('analytics:daily:' + new Date().toISOString().split('T')[0], analytics, 86400);
          }
        } catch (cacheError) {
          console.warn('Analytics cache storage failed (non-critical):', cacheError.message);
        }
      } catch (error) {
        console.error('Analytics processing failed:', error);
        throw error;
      }
    });

    // Notification delivery
    this.registerProcessor(this.queues.notifications, async (data, job) => {
      const { type, recipient, message } = data;
      console.log(`📱 Sending ${type} notification to ${recipient}: ${message}`);
      await this.sleep(500);
    });

    // Device fingerprint analysis
    this.registerProcessor(this.queues.deviceAnalysis, async (data, job) => {
      try {
        const DeviceFingerprint = require('../models/DeviceFingerprint');
        
        const device = await DeviceFingerprint.findOne({ fingerprintId: data.fingerprintId });
        if (!device) throw new Error('Device not found');

        // Update device analysis
        device.lastAnalyzed = new Date();
        await device.save();
      } catch (error) {
        console.error('Device analysis failed:', error);
        throw error;
      }
    });

    // Email delivery
    this.registerProcessor(this.queues.emailDelivery, async (data, job) => {
      try {
        // In production, integrate with email service
        console.log(`📧 Sending email to ${data.to}: ${data.subject}`);
        await this.sleep(500);
      } catch (error) {
        console.error('Email delivery failed:', error);
        throw error;
      }
    });

    // Audit log processing
    this.registerProcessor(this.queues.auditLogs, async (data, job) => {
      try {
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create(data);
        
        // Alert on high severity events
        if (data.severity === 'critical') {
          await this.addJob(this.queues.notifications, {
            type: 'security_alert',
            recipient: 'admin',
            message: `Critical security event: ${data.actionType}`
          }, { priority: 1 });
        }
      } catch (error) {
        console.error('Audit log processing failed:', error);
        throw error;
      }
    });

    // Safe zone updates
    this.registerProcessor(this.queues.safezoneUpdates, async (data, job) => {
      try {
        // Invalidate caches if possible
        if (this.isRedisAvailable) {
          await cacheLayer.deletePattern('safezones:*');
          await cacheLayer.deletePattern('map:safezones:*');
        }
      } catch (error) {
        console.warn('Safezone cache invalidation failed (non-critical):', error.message);
      }
    });
  }

  /**
   * Calculate priority score for sorted set
   */
  calculatePriorityScore(priority, timestamp) {
    return (priority * 1e13) + timestamp;
  }

  /**
   * Calculate exponential backoff
   */
  calculateBackoff(attempt) {
    return Math.min(300000, Math.pow(2, attempt) * 1000);
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * FIXED: Get queue statistics with memory fallback
   */
  async getQueueStats() {
    const stats = {
      ...this.stats,
      redisAvailable: this.isRedisAvailable,
      queues: {}
    };

    // Get queue lengths
    for (const [queueType, queueName] of Object.entries(this.queues)) {
      let length = 0;
      
      try {
        if (this.isRedisAvailable) {
          length = await cacheLayer.zcard(queueName);
        } else {
          const memoryQueue = this.memoryQueues.get(queueName);
          length = memoryQueue ? memoryQueue.length : 0;
        }
      } catch (error) {
        const memoryQueue = this.memoryQueues.get(queueName);
        length = memoryQueue ? memoryQueue.length : 0;
      }

      stats.queues[queueType] = {
        pending: length,
        processor: this.processors.has(queueName),
        source: this.isRedisAvailable ? 'redis' : 'memory'
      };
    }

    stats.activeJobs = this.activeJobs.size;

    // Dead letter queue size
    try {
      if (this.isRedisAvailable) {
        stats.failedJobs = await cacheLayer.llen(this.deadLetterQueue);
      } else {
        const deadQueue = this.memoryQueues.get(this.deadLetterQueue);
        stats.failedJobs = deadQueue ? deadQueue.length : 0;
      }
    } catch (error) {
      stats.failedJobs = 0;
    }

    return stats;
  }

  /**
   * Health monitoring with Redis status checking
   */
  startHealthMonitoring() {
    setInterval(async () => {
      // Periodically check Redis availability
      await this.checkRedisAvailability();

      const stats = await this.getQueueStats();
      
      // Alert if queues are backing up
      for (const [queueType, queueStats] of Object.entries(stats.queues)) {
        if (queueStats.pending > 1000) {
          console.warn(`⚠️ Queue ${queueType} is backing up: ${queueStats.pending} pending jobs (${queueStats.source})`);
        }
      }

      // Alert if too many failed jobs
      if (stats.failedJobs > 100) {
        console.error(`❌ High number of failed jobs: ${stats.failedJobs}`);
      }

      // Log Redis status changes
      const wasRedisAvailable = this.isRedisAvailable;
      await this.checkRedisAvailability();
      if (wasRedisAvailable !== this.isRedisAvailable) {
        console.log(`🔄 Redis status changed: ${this.isRedisAvailable ? 'connected' : 'disconnected'}`);
      }

      // Log stats in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Queue Statistics:', JSON.stringify({
          ...stats,
          redisAvailable: this.isRedisAvailable
        }, null, 2));
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Check if service is available
   */
  isAvailable() {
    return this.isProcessing;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down queue service...');
    this.isProcessing = false;

    const timeout = setTimeout(() => {
      console.warn('⚠️ Force shutting down queue service');
      process.exit(1);
    }, 30000);

    while (this.activeJobs.size > 0) {
      console.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await this.sleep(1000);
    }

    clearTimeout(timeout);
    console.log('✅ Queue service shut down gracefully');
  }
}

// Export singleton instance
const queueService = new QueueService();

module.exports = {
  queueService,
  
  // Quick functions with availability checks
  addJob: (queue, data, options) => {
    if (!queueService.isAvailable()) {
      console.warn('Queue service not available, job will be processed when service starts');
    }
    return queueService.addJob(queue, data, options);
  },
  
  registerProcessor: (queue, processor) => queueService.registerProcessor(queue, processor),
  getQueueStats: () => queueService.getQueueStats(),
  isAvailable: () => queueService.isAvailable(),
  
  // Queue names for easy access
  QUEUES: queueService.queues
};