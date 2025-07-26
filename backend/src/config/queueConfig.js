// === src/config/queueConfig.js ===
// BANGLADESH-SCALE QUEUE CONFIGURATION
// Optimized for 25,000+ concurrent users with smart resource allocation

const queueConfig = {
  // Redis connection configuration for Bull queues
  redis: {
    port: parseInt(process.env.REDIS_PORT) || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_QUEUE_DB) || 1, // Separate DB for queues
    
    // Connection pool settings for high load
    family: 4,
    keepAlive: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxLoadingTimeout: 0,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    
    // High performance settings
    dropBufferSupport: false,
    enableOfflineQueue: false,
    
    // Clustering support
    enableReadyCheck: false,
    maxLoadingTimeout: 0
  },

  // Worker concurrency based on server capacity
  workers: {
    // CRITICAL: Female safety & emergency reports
    emergency: {
      concurrency: parseInt(process.env.EMERGENCY_WORKERS) || 15,
      priority: 1,
      description: 'Emergency female safety reports',
      maxConcurrentJobs: 50,
      stalledInterval: 30 * 1000,
      maxStalledCount: 1
    },

    // HIGH: Standard safety reports
    standard: {
      concurrency: parseInt(process.env.STANDARD_WORKERS) || 25,
      priority: 2,
      description: 'Standard safety reports',
      maxConcurrentJobs: 100,
      stalledInterval: 60 * 1000,
      maxStalledCount: 2
    },

    // MEDIUM: Background processing
    background: {
      concurrency: parseInt(process.env.BACKGROUND_WORKERS) || 8,
      priority: 3,
      description: 'Background analysis tasks',
      maxConcurrentJobs: 30,
      stalledInterval: 120 * 1000,
      maxStalledCount: 3
    },

    // LOW: Analytics and metrics
    analytics: {
      concurrency: parseInt(process.env.ANALYTICS_WORKERS) || 3,
      priority: 4,
      description: 'Analytics and reporting',
      maxConcurrentJobs: 10,
      stalledInterval: 300 * 1000,
      maxStalledCount: 1
    },

    // Email notifications
    email: {
      concurrency: parseInt(process.env.EMAIL_WORKERS) || 5,
      priority: 3,
      description: 'Email delivery',
      maxConcurrentJobs: 20,
      stalledInterval: 90 * 1000,
      maxStalledCount: 2
    },

    // Device analysis
    device: {
      concurrency: parseInt(process.env.DEVICE_WORKERS) || 6,
      priority: 3,
      description: 'Device fingerprint analysis',
      maxConcurrentJobs: 25,
      stalledInterval: 120 * 1000,
      maxStalledCount: 2
    }
  },

  // Job settings per queue type
  jobSettings: {
    emergencyReports: {
      removeOnComplete: 100,   // Keep recent completions for analysis
      removeOnFail: 200,       // Keep failures for debugging
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      // CRITICAL: No delay for emergency reports
      delay: 0,
      // High priority
      priority: 1,
      // Job TTL: 5 minutes max processing time
      ttl: 5 * 60 * 1000,
      // Repeat failed jobs quickly
      repeat: {
        every: 30000, // 30 seconds
        limit: 3
      }
    },

    standardReports: {
      removeOnComplete: 150,
      removeOnFail: 100,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      // Small delay to batch similar reports
      delay: 1000,
      priority: 2,
      ttl: 10 * 60 * 1000,  // 10 minutes max
      repeat: {
        every: 60000, // 1 minute
        limit: 2
      }
    },

    backgroundTasks: {
      removeOnComplete: 50,
      removeOnFail: 50,
      attempts: 1,
      backoff: {
        type: 'fixed',
        delay: 5000
      },
      // Delay background tasks to prioritize real-time reports
      delay: 5000,
      priority: 3,
      ttl: 30 * 60 * 1000,  // 30 minutes max
      repeat: {
        every: 300000, // 5 minutes
        limit: 1
      }
    },

    analyticsQueue: {
      removeOnComplete: 25,
      removeOnFail: 25,
      attempts: 1,
      backoff: {
        type: 'fixed',
        delay: 10000
      },
      // Significant delay for analytics - not time sensitive
      delay: 30000,
      priority: 4,
      ttl: 60 * 60 * 1000,  // 1 hour max
      repeat: {
        every: 600000, // 10 minutes
        limit: 1
      }
    },

    emailQueue: {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      // Small delay to batch emails
      delay: 2000,
      priority: 2,
      ttl: 15 * 60 * 1000,  // 15 minutes max
      repeat: {
        every: 120000, // 2 minutes
        limit: 3
      }
    },

    deviceAnalysis: {
      removeOnComplete: 30,
      removeOnFail: 60,
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 8000
      },
      // Delay device analysis - not immediately critical
      delay: 10000,
      priority: 3,
      ttl: 20 * 60 * 1000,  // 20 minutes max
      repeat: {
        every: 240000, // 4 minutes
        limit: 2
      }
    }
  },

  // Queue-specific settings
  queueSettings: {
    emergencyReports: {
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      },
      settings: {
        stalledInterval: 30 * 1000,
        maxStalledCount: 1,
        retryProcessDelay: 5000
      },
      // Advanced settings for emergency queue
      advanced: {
        checkStalledJobs: true,
        maxConcurrency: 50,
        drainDelay: 5
      }
    },

    standardReports: {
      defaultJobOptions: {
        removeOnComplete: 150,
        removeOnFail: 100,
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 }
      },
      settings: {
        stalledInterval: 60 * 1000,
        maxStalledCount: 2,
        retryProcessDelay: 10000
      },
      advanced: {
        checkStalledJobs: true,
        maxConcurrency: 100,
        drainDelay: 10
      }
    },

    backgroundTasks: {
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 1,
        delay: 5000
      },
      settings: {
        stalledInterval: 120 * 1000,
        maxStalledCount: 3,
        retryProcessDelay: 30000
      },
      advanced: {
        checkStalledJobs: true,
        maxConcurrency: 30,
        drainDelay: 30
      }
    },

    analyticsQueue: {
      defaultJobOptions: {
        removeOnComplete: 25,
        removeOnFail: 25,
        attempts: 1,
        delay: 30000
      },
      settings: {
        stalledInterval: 300 * 1000,
        maxStalledCount: 1,
        retryProcessDelay: 60000
      },
      advanced: {
        checkStalledJobs: false,
        maxConcurrency: 10,
        drainDelay: 60
      }
    },

    emailQueue: {
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      },
      settings: {
        stalledInterval: 90 * 1000,
        maxStalledCount: 2,
        retryProcessDelay: 15000
      },
      advanced: {
        checkStalledJobs: true,
        maxConcurrency: 20,
        drainDelay: 15
      }
    },

    deviceAnalysis: {
      defaultJobOptions: {
        removeOnComplete: 30,
        removeOnFail: 60,
        attempts: 2,
        delay: 10000
      },
      settings: {
        stalledInterval: 120 * 1000,
        maxStalledCount: 2,
        retryProcessDelay: 20000
      },
      advanced: {
        checkStalledJobs: true,
        maxConcurrency: 25,
        drainDelay: 20
      }
    }
  },

  // Monitoring and health check settings
  monitoring: {
    // Health check intervals
    healthCheckInterval: 30000,      // 30 seconds
    statsReportInterval: 300000,     // 5 minutes
    performanceCheckInterval: 60000, // 1 minute
    
    // Alert thresholds
    alerts: {
      // Queue length alerts
      emergencyQueueLimit: 10,     // Alert if >10 emergency jobs waiting
      standardQueueLimit: 100,     // Alert if >100 standard jobs waiting
      backgroundQueueLimit: 500,   // Alert if >500 background jobs waiting
      
      // Processing time alerts
      emergencyProcessingLimit: 5000,   // 5 seconds max for emergency
      standardProcessingLimit: 15000,   // 15 seconds max for standard
      backgroundProcessingLimit: 60000, // 60 seconds max for background
      
      // Error rate alerts
      errorRateThreshold: 0.05,    // Alert if >5% error rate
      stalledJobsThreshold: 5,     // Alert if >5 stalled jobs
      
      // Memory usage alerts
      memoryUsageThreshold: 0.8,   // Alert if >80% memory usage
      redisMemoryThreshold: 0.9    // Alert if >90% Redis memory usage
    },
    
    // Metrics collection
    metrics: {
      collectInterval: 10000,      // Collect metrics every 10 seconds
      retentionPeriod: 86400000,   // Keep metrics for 24 hours
      aggregationWindow: 300000,   // 5-minute aggregation windows
      
      // Performance targets
      targets: {
        emergencyProcessingTime: 2000,   // Target: <2 seconds
        standardProcessingTime: 8000,    // Target: <8 seconds
        backgroundProcessingTime: 30000, // Target: <30 seconds
        overallThroughput: 1000,         // Target: 1000 jobs/minute
        errorRate: 0.01                  // Target: <1% error rate
      }
    }
  },

  // Environment-specific overrides
  environments: {
    development: {
      workers: {
        emergency: { concurrency: 2 },
        standard: { concurrency: 3 },
        background: { concurrency: 2 },
        analytics: { concurrency: 1 },
        email: { concurrency: 1 },
        device: { concurrency: 1 }
      },
      monitoring: {
        healthCheckInterval: 10000,  // More frequent in dev
        statsReportInterval: 60000   // More frequent reporting
      }
    },

    staging: {
      workers: {
        emergency: { concurrency: 5 },
        standard: { concurrency: 8 },
        background: { concurrency: 3 },
        analytics: { concurrency: 2 },
        email: { concurrency: 2 },
        device: { concurrency: 2 }
      }
    },

    production: {
      // Use full settings from above
      workers: {
        emergency: { concurrency: 15 },
        standard: { concurrency: 25 },
        background: { concurrency: 8 },
        analytics: { concurrency: 3 },
        email: { concurrency: 5 },
        device: { concurrency: 6 }
      },
      
      // Production-specific optimizations
      redis: {
        // Additional production Redis settings
        maxMemoryPolicy: 'allkeys-lru',
        maxMemory: '2gb',
        
        // Connection pooling for production
        poolSize: 20,
        connectionName: 'choukidar-queue-pool',
        
        // Persistence settings
        save: '60 1000',  // Save if 1000 keys change in 60 seconds
        
        // Security
        requirepass: process.env.REDIS_PASSWORD
      }
    }
  },

  // Bull Board (Queue Dashboard) configuration
  dashboard: {
    enabled: process.env.QUEUE_DASHBOARD_ENABLED !== 'false',
    path: '/api/queues/dashboard',
    username: process.env.QUEUE_DASHBOARD_USER || 'admin',
    password: process.env.QUEUE_DASHBOARD_PASS || 'admin123',
    
    // Security settings
    security: {
      enableCSRF: true,
      sessionSecret: process.env.QUEUE_DASHBOARD_SECRET || 'queue-secret-key',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === 'production'
    }
  },

  // Scaling configuration
  scaling: {
    // Auto-scaling settings
    autoScale: {
      enabled: process.env.QUEUE_AUTO_SCALE === 'true',
      scaleUpThreshold: 0.8,    // Scale up if queue utilization >80%
      scaleDownThreshold: 0.3,  // Scale down if queue utilization <30%
      cooldownPeriod: 300000,   // 5 minutes between scaling events
      maxWorkers: {
        emergency: 30,
        standard: 50,
        background: 15,
        analytics: 5,
        email: 10,
        device: 12
      },
      minWorkers: {
        emergency: 2,
        standard: 3,
        background: 1,
        analytics: 1,
        email: 1,
        device: 1
      }
    },
    
    // Load balancing
    loadBalancing: {
      strategy: 'round-robin', // Options: 'round-robin', 'least-busy', 'weighted'
      healthCheckEnabled: true,
      healthCheckInterval: 30000,
      
      // Circuit breaker settings
      circuitBreaker: {
        enabled: true,
        errorThreshold: 0.1,      // 10% error rate
        openTimeout: 60000,       // 1 minute
        halfOpenRetries: 5
      }
    }
  }
};

/**
 * Get configuration for current environment
 */
function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  const baseConfig = { ...queueConfig };
  
  if (queueConfig.environments[env]) {
    // Deep merge environment-specific settings
    const envConfig = queueConfig.environments[env];
    
    // Merge worker settings
    if (envConfig.workers) {
      Object.keys(envConfig.workers).forEach(workerType => {
        baseConfig.workers[workerType] = {
          ...baseConfig.workers[workerType],
          ...envConfig.workers[workerType]
        };
      });
    }
    
    // Merge other settings
    if (envConfig.monitoring) {
      baseConfig.monitoring = {
        ...baseConfig.monitoring,
        ...envConfig.monitoring
      };
    }
    
    if (envConfig.redis) {
      baseConfig.redis = {
        ...baseConfig.redis,
        ...envConfig.redis
      };
    }
  }
  
  return baseConfig;
}

/**
 * Validate queue configuration
 */
function validateConfig(config = queueConfig) {
  const errors = [];
  
  // Validate Redis connection
  if (!config.redis.host || !config.redis.port) {
    errors.push('Redis host and port are required');
  }
  
  // Validate worker concurrency
  Object.entries(config.workers).forEach(([workerType, workerConfig]) => {
    if (!workerConfig.concurrency || workerConfig.concurrency < 1) {
      errors.push(`Invalid concurrency for ${workerType}: ${workerConfig.concurrency}`);
    }
  });
  
  // Validate monitoring settings
  if (!config.monitoring.healthCheckInterval || config.monitoring.healthCheckInterval < 1000) {
    errors.push('Health check interval must be at least 1000ms');
  }
  
  if (errors.length > 0) {
    throw new Error(`Queue configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

/**
 * Get total worker capacity
 */
function getTotalWorkerCapacity(config = queueConfig) {
  return Object.values(config.workers).reduce((total, worker) => {
    return total + worker.concurrency;
  }, 0);
}

/**
 * Get memory usage estimate
 */
function getMemoryEstimate(config = queueConfig) {
  const totalWorkers = getTotalWorkerCapacity(config);
  const baseMemoryPerWorker = 50; // MB per worker estimate
  const redisMemory = 512; // MB for Redis
  const appMemory = 256; // MB for main application
  
  return {
    totalWorkers,
    estimatedMemoryMB: (totalWorkers * baseMemoryPerWorker) + redisMemory + appMemory,
    breakdown: {
      workers: totalWorkers * baseMemoryPerWorker,
      redis: redisMemory,
      application: appMemory
    }
  };
}

module.exports = {
  queueConfig,
  getEnvironmentConfig,
  validateConfig,
  getTotalWorkerCapacity,
  getMemoryEstimate
};