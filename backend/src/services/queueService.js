// === backend/src/services/queueService.js ===
// Asynchronous Queue Processing for SafeStreets Bangladesh
// Handles heavy operations without blocking main threads

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
    this.workerCount = 4; // Number of concurrent workers per queue
    this.activeJobs = new Map();
    
    // Queue statistics
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      avgProcessingTime: 0
    };

    // Dead letter queue for failed jobs
    this.deadLetterQueue = 'queue:failed';
    this.maxRetries = 3;
  }

  /**
   * Initialize queue processors
   */
  async initialize() {
    console.log('🚀 Initializing queue service...');

    // Register default processors
    this.registerDefaultProcessors();

    // Start processing queues
    this.startProcessing();

    // Monitor queue health
    this.startHealthMonitoring();

    console.log('✅ Queue service initialized');
  }

  /**
   * Add job to queue with priority
   */
  async addJob(queueName, jobData, options = {}) {
    const {
      priority = 5, // 1-10, where 1 is highest priority
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
      // Add to priority queue using sorted set
      const score = this.calculatePriorityScore(priority, job.processingAfter);
      await cacheLayer.zadd(queueName, score, JSON.stringify(job));

      console.log(`📥 Job ${job.id} added to ${queueName} queue`);
      return job.id;

    } catch (error) {
      console.error('❌ Error adding job to queue:', error);
      throw error;
    }
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
   * Start processing all queues
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
   * Process jobs from a specific queue
   */
  async processQueue(queueName, workerId) {
    while (this.isProcessing) {
      try {
        // Get next job from priority queue
        const jobs = await cacheLayer.zpopmin(queueName, 1);
        
        if (!jobs || jobs.length === 0) {
          // No jobs available, wait before checking again
          await this.sleep(1000);
          continue;
        }

        const jobData = JSON.parse(jobs[0].value);
        const job = {
          ...jobData,
          workerId,
          startedAt: Date.now()
        };

        // Check if job should be processed yet (for delayed jobs)
        if (job.processingAfter > Date.now()) {
          // Re-add to queue with same priority
          await cacheLayer.zadd(queueName, jobs[0].score, JSON.stringify(jobData));
          await this.sleep(100);
          continue;
        }

        // Mark job as active
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
   * Execute a single job
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

      console.log(`✅ Job ${job.id} completed in ${processingTime}ms`);

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
   * Handle failed jobs with retry logic
   */
  async handleJobFailure(job, queueName, error) {
    this.stats.failed++;

    if (job.retries > 0) {
      // Retry the job with exponential backoff
      job.retries--;
      job.lastError = error.message;
      job.processingAfter = Date.now() + this.calculateBackoff(job.maxRetries - job.retries);
      
      const score = this.calculatePriorityScore(job.priority, job.processingAfter);
      await cacheLayer.zadd(queueName, score, JSON.stringify(job));
      
      this.stats.retried++;
      console.log(`🔄 Job ${job.id} scheduled for retry (${job.retries} retries left)`);
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetter(job, error);
      console.error(`💀 Job ${job.id} moved to dead letter queue after ${job.maxRetries} retries`);
    }
  }

  /**
   * Move failed job to dead letter queue
   */
  async moveToDeadLetter(job, error) {
    const deadJob = {
      ...job,
      failedAt: Date.now(),
      error: error.message,
      stack: error.stack
    };

    await cacheLayer.lpush(this.deadLetterQueue, JSON.stringify(deadJob));
    
    // Alert if critical job fails
    if (job.priority <= 3) {
      productionLogger.error('Critical job failed', {
        jobId: job.id,
        queue: job.queue,
        error: error.message
      });
    }
  }

  /**
   * Register default processors
   */
  registerDefaultProcessors() {
    // Report processing
    this.registerProcessor(this.queues.reportProcessing, async (data, job) => {
      const Report = require('../models/Report');
      const report = await Report.findById(data.reportId);
      
      if (!report) throw new Error('Report not found');

      // Process report (validation, enrichment, etc.)
      report.processingStatus = 'completed';
      report.processedAt = new Date();
      await report.save();

      // Invalidate relevant caches
      await cacheLayer.deletePattern('reports:*');
      await cacheLayer.deletePattern('map:*');
    });

    // Image optimization
    this.registerProcessor(this.queues.imageOptimization, async (data, job) => {
      // Simulate image processing (in production, use sharp or similar)
      console.log(`🖼️ Optimizing image: ${data.imageUrl}`);
      
      // In production, this would:
      // 1. Download image from Cloudinary
      // 2. Optimize using sharp
      // 3. Upload back to Cloudinary
      // 4. Update database with optimized URL
      
      await this.sleep(1000); // Simulate processing
    });

    // Analytics aggregation
    this.registerProcessor(this.queues.analytics, async (data, job) => {
      const Report = require('../models/Report');
      
      // Aggregate analytics data
      const analytics = await Report.aggregate([
        { $match: { status: 'approved', timestamp: { $gte: new Date(Date.now() - 86400000) } } },
        { $group: { _id: '$type', count: { $sum: 1 }, avgSeverity: { $avg: '$severity' } } }
      ]);

      // Store in cache
      await cacheLayer.set('analytics:daily:' + new Date().toISOString().split('T')[0], analytics, 86400);
    });

    // Notification delivery
    this.registerProcessor(this.queues.notifications, async (data, job) => {
      const { type, recipient, message } = data;
      
      // In production, integrate with FCM/WebPush
      console.log(`📱 Sending ${type} notification to ${recipient}: ${message}`);
      
      // Simulate notification delivery
      await this.sleep(500);
    });

    // Device fingerprint analysis
    this.registerProcessor(this.queues.deviceAnalysis, async (data, job) => {
      const DeviceFingerprint = require('../models/DeviceFingerprint');
      
      const device = await DeviceFingerprint.findOne({ fingerprintId: data.fingerprintId });
      if (!device) throw new Error('Device not found');

      // Queue for detailed background analysis
      await device.queueForProcessing('full', 'medium');
    });

    // Email delivery
    this.registerProcessor(this.queues.emailDelivery, async (data, job) => {
      const emailService = require('./emailService');
      
      await emailService.sendEmail(data.to, data.subject, data.html);
    });

    // Audit log processing
    this.registerProcessor(this.queues.auditLogs, async (data, job) => {
      const AuditLog = require('../models/AuditLog');
      
      // Create audit log entry
      await AuditLog.create(data);
      
      // Alert on high severity events
      if (data.severity === 'critical') {
        await this.addJob(this.queues.notifications, {
          type: 'security_alert',
          recipient: 'admin',
          message: `Critical security event: ${data.actionType}`
        }, { priority: 1 });
      }
    });

    // Safe zone updates
    this.registerProcessor(this.queues.safezoneUpdates, async (data, job) => {
      // Invalidate all safe zone caches
      await cacheLayer.deletePattern('safezones:*');
      await cacheLayer.deletePattern('map:safezones:*');
      
      // Preload updated data
      const { preloadCache } = require('../middleware/advancedCaching');
      await preloadCache();
    });
  }

  /**
   * Calculate priority score for sorted set
   */
  calculatePriorityScore(priority, timestamp) {
    // Lower score = higher priority
    // Combine priority and timestamp for FIFO within same priority
    return (priority * 1e13) + timestamp;
  }

  /**
   * Calculate exponential backoff
   */
  calculateBackoff(attempt) {
    return Math.min(300000, Math.pow(2, attempt) * 1000); // Max 5 minutes
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
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {
      ...this.stats,
      queues: {}
    };

    // Get queue lengths
    for (const [queueType, queueName] of Object.entries(this.queues)) {
      const length = await cacheLayer.zcard(queueName);
      stats.queues[queueType] = {
        pending: length,
        processor: this.processors.has(queueName)
      };
    }

    // Active jobs
    stats.activeJobs = this.activeJobs.size;

    // Dead letter queue size
    const deadLetterSize = await cacheLayer.llen(this.deadLetterQueue);
    stats.failedJobs = deadLetterSize;

    return stats;
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      const stats = await this.getQueueStats();
      
      // Alert if queues are backing up
      for (const [queueType, queueStats] of Object.entries(stats.queues)) {
        if (queueStats.pending > 1000) {
          console.warn(`⚠️ Queue ${queueType} is backing up: ${queueStats.pending} pending jobs`);
        }
      }

      // Alert if too many failed jobs
      if (stats.failedJobs > 100) {
        console.error(`❌ High number of failed jobs: ${stats.failedJobs}`);
      }

      // Log stats in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Queue Statistics:', JSON.stringify(stats, null, 2));
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down queue service...');
    this.isProcessing = false;

    // Wait for active jobs to complete
    const timeout = setTimeout(() => {
      console.warn('⚠️ Force shutting down queue service');
      process.exit(1);
    }, 30000); // 30 second grace period

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
  
  // Quick functions
  addJob: (queue, data, options) => queueService.addJob(queue, data, options),
  registerProcessor: (queue, processor) => queueService.registerProcessor(queue, processor),
  getQueueStats: () => queueService.getQueueStats(),
  
  // Queue names for easy access
  QUEUES: queueService.queues
};