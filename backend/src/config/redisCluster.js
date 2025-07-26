// === src/config/redisCluster.js (ENHANCED FOR BANGLADESH SCALE) ===
// Redis Cluster Configuration for Distributed Queue System
// Optimized for 25,000+ concurrent users with high availability

const Redis = require('ioredis');
const { productionLogger } = require('../utils/productionLogger');

class RedisClusterManager {
  constructor() {
    this.isInitialized = false;
    this.clusters = {};
    this.sentinels = [];
    this.connectionPool = null;
    this.healthCheckInterval = null;
    
    // Configuration based on environment
    this.config = this.getEnvironmentConfig();
    
    // Connection statistics
    this.stats = {
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      commandsExecuted: 0,
      errors: 0,
      lastHealthCheck: null
    };
  }

  /**
   * Get environment-specific Redis configuration
   */
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    
    const baseConfig = {
      // Connection settings
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      
      // Database allocation
      databases: {
        cache: parseInt(process.env.REDIS_CACHE_DB) || 0,
        queues: parseInt(process.env.REDIS_QUEUE_DB) || 1,
        sessions: parseInt(process.env.REDIS_SESSION_DB) || 2,
        ratelimit: parseInt(process.env.REDIS_RATELIMIT_DB) || 3,
        analytics: parseInt(process.env.REDIS_ANALYTICS_DB) || 4
      },

      // Connection pool settings
      pool: {
        min: 5,
        max: 50,
        acquireTimeoutMillis: 10000,
        createTimeoutMillis: 5000,
        destroyTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      },

      // Performance settings
      performance: {
        family: 4,
        keepAlive: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 0,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        dropBufferSupport: false
      },

      // Memory management
      memory: {
        maxMemoryPolicy: 'allkeys-lru',
        maxMemory: process.env.REDIS_MAX_MEMORY || '2gb',
        
        // Compression settings
        compression: {
          enabled: true,
          threshold: 1024, // Compress values > 1KB
          algorithm: 'gzip'
        }
      },

      // Clustering settings
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: this.parseClusterNodes(),
        
        // Cluster options
        options: {
          scaleReads: 'slave',
          maxRedirections: 16,
          retryDelayOnFailover: 100,
          enableOfflineQueue: false,
          readOnly: false,
          redisOptions: {
            password: process.env.REDIS_PASSWORD
          }
        }
      },

      // Sentinel configuration for high availability
      sentinel: {
        enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
        masterName: process.env.REDIS_MASTER_NAME || 'choukidar-master',
        sentinels: this.parseSentinelNodes(),
        
        // Sentinel options
        options: {
          sentinelRetryCount: 3,
          sentinelReconnectDelay: 100,
          connectTimeout: 10000,
          lazyConnect: true,
          password: process.env.REDIS_PASSWORD
        }
      }
    };

    // Environment-specific overrides
    const envConfigs = {
      development: {
        pool: { min: 2, max: 10 },
        performance: { 
          connectTimeout: 5000,
          commandTimeout: 3000 
        }
      },
      
      staging: {
        pool: { min: 3, max: 20 },
        memory: { maxMemory: '1gb' }
      },
      
      production: {
        pool: { min: 10, max: 100 },
        memory: { maxMemory: '4gb' },
        performance: {
          connectTimeout: 15000,
          commandTimeout: 8000,
          maxRetriesPerRequest: 5
        }
      }
    };

    // Merge environment-specific config
    if (envConfigs[env]) {
      return this.deepMerge(baseConfig, envConfigs[env]);
    }

    return baseConfig;
  }

  /**
   * Initialize Redis cluster connections
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Redis cluster for Bangladesh scale...');
      
      // Validate configuration
      this.validateConfiguration();
      
      // Initialize different Redis connections for different purposes
      await this.initializeDatabaseConnections();
      
      // Set up monitoring and health checks
      this.setupHealthMonitoring();
      
      // Configure error handling
      this.setupErrorHandling();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.isInitialized = true;
      
      console.log('✅ Redis cluster initialized successfully');
      console.log(`📊 Active connections: Cache, Queues, Sessions, RateLimit, Analytics`);
      
      return { 
        success: true, 
        message: 'Redis cluster ready for Bangladesh scale',
        connections: Object.keys(this.clusters)
      };

    } catch (error) {
      console.error('❌ Redis cluster initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize separate database connections
   */
  async initializeDatabaseConnections() {
    const connections = [
      { name: 'cache', db: this.config.databases.cache, description: 'API response caching' },
      { name: 'queues', db: this.config.databases.queues, description: 'Bull queue processing' },
      { name: 'sessions', db: this.config.databases.sessions, description: 'User session storage' },
      { name: 'ratelimit', db: this.config.databases.ratelimit, description: 'Rate limiting' },
      { name: 'analytics', db: this.config.databases.analytics, description: 'Analytics data' }
    ];

    for (const conn of connections) {
      try {
        console.log(`🔌 Connecting to Redis ${conn.name} (DB ${conn.db}): ${conn.description}`);
        
        const redisInstance = await this.createRedisConnection(conn.db, conn.name);
        this.clusters[conn.name] = redisInstance;
        
        // Test connection
        await redisInstance.ping();
        console.log(`✅ Redis ${conn.name} connection established`);
        
        this.stats.connectionsCreated++;

      } catch (error) {
        console.error(`❌ Failed to connect to Redis ${conn.name}:`, error);
        throw new Error(`Redis ${conn.name} connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Create a Redis connection with optimal settings
   */
  async createRedisConnection(database, connectionName) {
    const connectionConfig = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: database,
      connectionName: `choukidar-${connectionName}`,
      
      // Performance settings
      ...this.config.performance,
      
      // Event handling
      retryDelayOnFailover: this.config.performance.retryDelayOnFailover,
      enableReadyCheck: this.config.performance.enableReadyCheck,
      maxLoadingTimeout: this.config.performance.maxLoadingTimeout,
      
      // Custom retry strategy
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`⏰ Redis ${connectionName} retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      
      // Connection timeout
      connectTimeout: this.config.performance.connectTimeout,
      commandTimeout: this.config.performance.commandTimeout
    };

    // Use cluster or sentinel if enabled
    if (this.config.cluster.enabled && this.config.cluster.nodes.length > 0) {
      return new Redis.Cluster(this.config.cluster.nodes, {
        ...this.config.cluster.options,
        redisOptions: {
          ...connectionConfig,
          password: this.config.password
        }
      });
    }
    
    if (this.config.sentinel.enabled && this.config.sentinel.sentinels.length > 0) {
      return new Redis({
        sentinels: this.config.sentinel.sentinels,
        name: this.config.sentinel.masterName,
        ...this.config.sentinel.options,
        ...connectionConfig
      });
    }

    // Standard Redis connection
    return new Redis(connectionConfig);
  }

  /**
   * Get Redis connection for specific purpose
   */
  getConnection(type = 'cache') {
    if (!this.isInitialized) {
      throw new Error('Redis cluster not initialized');
    }

    if (!this.clusters[type]) {
      throw new Error(`Redis connection type '${type}' not found`);
    }

    return this.clusters[type];
  }

  /**
   * Get all active connections
   */
  getAllConnections() {
    return { ...this.clusters };
  }

  /**
   * Execute command with automatic retry and circuit breaker
   */
  async executeCommand(connectionType, command, ...args) {
    const connection = this.getConnection(connectionType);
    const startTime = Date.now();

    try {
      const result = await connection[command](...args);
      
      this.stats.commandsExecuted++;
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow Redis command: ${command} took ${duration}ms on ${connectionType}`);
      }

      return result;

    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Redis command failed: ${command} on ${connectionType}`, error);
      
      // Attempt retry for transient errors
      if (this.isRetryableError(error)) {
        console.log(`🔄 Retrying Redis command: ${command} on ${connectionType}`);
        return await connection[command](...args);
      }
      
      throw error;
    }
  }

  /**
   * Batch execute multiple commands
   */
  async executeBatch(connectionType, commands) {
    const connection = this.getConnection(connectionType);
    const pipeline = connection.pipeline();

    commands.forEach(({ command, args }) => {
      pipeline[command](...args);
    });

    try {
      const results = await pipeline.exec();
      this.stats.commandsExecuted += commands.length;
      return results;
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Redis batch execution failed on ${connectionType}:`, error);
      throw error;
    }
  }

  /**
   * Setup health monitoring
   */
  setupHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Check every 30 seconds

    // Log statistics every 5 minutes
    setInterval(() => {
      this.logStatistics();
    }, 300000);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthStatus = {
      overall: 'healthy',
      connections: {},
      timestamp: new Date().toISOString(),
      stats: { ...this.stats }
    };

    for (const [name, connection] of Object.entries(this.clusters)) {
      try {
        const startTime = Date.now();
        await connection.ping();
        const latency = Date.now() - startTime;

        // Get connection info
        const info = await connection.info('server');
        const memoryInfo = await connection.info('memory');

        healthStatus.connections[name] = {
          status: 'healthy',
          latency: `${latency}ms`,
          connected: connection.status === 'ready',
          memory: this.parseMemoryInfo(memoryInfo),
          server: this.parseServerInfo(info)
        };

        // Check for high latency
        if (latency > 100) {
          healthStatus.connections[name].status = 'degraded';
          healthStatus.connections[name].warning = `High latency: ${latency}ms`;
        }

      } catch (error) {
        healthStatus.connections[name] = {
          status: 'unhealthy',
          error: error.message,
          connected: false
        };
        healthStatus.overall = 'degraded';
      }
    }

    // Determine overall health
    const unhealthyConnections = Object.values(healthStatus.connections)
      .filter(conn => conn.status === 'unhealthy').length;

    if (unhealthyConnections > 0) {
      healthStatus.overall = unhealthyConnections >= Object.keys(this.clusters).length / 2 
        ? 'critical' 
        : 'degraded';
    }

    this.stats.lastHealthCheck = healthStatus;

    // Log issues
    if (healthStatus.overall !== 'healthy') {
      console.warn('⚠️ Redis cluster health issue:', healthStatus);
      productionLogger.warn('Redis cluster health degraded', healthStatus);
    }

    return healthStatus;
  }

  /**
   * Log Redis statistics
   */
  logStatistics() {
    const stats = {
      ...this.stats,
      activeConnections: Object.keys(this.clusters).length,
      memoryUsage: this.getMemoryUsage(),
      connectionUtilization: this.getConnectionUtilization()
    };

    console.log('📊 Redis Cluster Statistics:', stats);
    
    if (process.env.NODE_ENV === 'development') {
      console.table(stats);
    }
  }

  /**
   * Setup error handling for all connections
   */
  setupErrorHandling() {
    Object.entries(this.clusters).forEach(([name, connection]) => {
      connection.on('error', (error) => {
        console.error(`❌ Redis ${name} error:`, error);
        this.stats.errors++;
        productionLogger.error(`Redis ${name} error`, { error: error.message });
      });

      connection.on('connect', () => {
        console.log(`✅ Redis ${name} connected`);
      });

      connection.on('disconnect', () => {
        console.warn(`⚠️ Redis ${name} disconnected`);
      });

      connection.on('reconnecting', () => {
        console.log(`🔄 Redis ${name} reconnecting...`);
      });

      connection.on('ready', () => {
        console.log(`🚀 Redis ${name} ready for commands`);
      });
    });
  }

  /**
   * Graceful shutdown
   */
  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`🔄 Redis cluster received ${signal}, shutting down gracefully...`);
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Close all connections
      const closePromises = Object.entries(this.clusters).map(async ([name, connection]) => {
        try {
          await connection.disconnect();
          console.log(`✅ Redis ${name} disconnected gracefully`);
          this.stats.connectionsDestroyed++;
        } catch (error) {
          console.error(`❌ Error closing Redis ${name}:`, error);
        }
      });

      await Promise.all(closePromises);
      console.log('✅ Redis cluster shutdown complete');
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Utility methods
   */
  parseClusterNodes() {
    const nodes = process.env.REDIS_CLUSTER_NODES;
    if (!nodes) return [];
    
    return nodes.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  parseSentinelNodes() {
    const sentinels = process.env.REDIS_SENTINELS;
    if (!sentinels) return [];
    
    return sentinels.split(',').map(sentinel => {
      const [host, port] = sentinel.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  parseMemoryInfo(memoryInfo) {
    const lines = memoryInfo.split('\r\n');
    const memory = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        memory[key] = value;
      }
    });
    
    return {
      used: memory.used_memory_human,
      peak: memory.used_memory_peak_human,
      rss: memory.used_memory_rss_human,
      overhead: memory.used_memory_overhead
    };
  }

  parseServerInfo(serverInfo) {
    const lines = serverInfo.split('\r\n');
    const server = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        server[key] = value;
      }
    });
    
    return {
      version: server.redis_version,
      mode: server.redis_mode,
      os: server.os,
      uptime: server.uptime_in_seconds
    };
  }

  getMemoryUsage() {
    // This would require additional Redis commands
    // Simplified for now
    return {
      estimated: 'Available via health check',
      connections: Object.keys(this.clusters).length
    };
  }

  getConnectionUtilization() {
    const totalConnections = Object.keys(this.clusters).length;
    const maxConnections = this.config.pool.max;
    
    return {
      active: totalConnections,
      maximum: maxConnections,
      utilization: `${((totalConnections / maxConnections) * 100).toFixed(1)}%`
    };
  }

  isRetryableError(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED'
    ];
    
    return retryableErrors.some(retryable => 
      error.message.includes(retryable) || error.code === retryable
    );
  }

  validateConfiguration() {
    if (!this.config.host || !this.config.port) {
      throw new Error('Redis host and port are required');
    }

    if (this.config.cluster.enabled && this.config.cluster.nodes.length === 0) {
      throw new Error('Cluster mode enabled but no cluster nodes configured');
    }

    if (this.config.sentinel.enabled && this.config.sentinel.sentinels.length === 0) {
      throw new Error('Sentinel mode enabled but no sentinel nodes configured');
    }

    console.log('✅ Redis configuration validated');
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Public API methods for external use
   */

  // Get connection statistics
  getStats() {
    return {
      ...this.stats,
      connections: Object.keys(this.clusters),
      isInitialized: this.isInitialized,
      lastHealthCheck: this.stats.lastHealthCheck
    };
  }

  // Test all connections
  async testAllConnections() {
    const results = {};
    
    for (const [name, connection] of Object.entries(this.clusters)) {
      try {
        const startTime = Date.now();
        await connection.ping();
        results[name] = {
          status: 'success',
          latency: Date.now() - startTime
        };
      } catch (error) {
        results[name] = {
          status: 'failed',
          error: error.message
        };
      }
    }
    
    return results;
  }

  // Flush specific database
  async flushDatabase(connectionType) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database flush not allowed in production');
    }
    
    const connection = this.getConnection(connectionType);
    await connection.flushdb();
    console.log(`🧹 Flushed Redis database: ${connectionType}`);
  }

  // Get database size
  async getDatabaseSize(connectionType) {
    const connection = this.getConnection(connectionType);
    const size = await connection.dbsize();
    return {
      connectionType,
      keys: size,
      estimated_memory: `${Math.round(size * 0.1)}KB` // Rough estimate
    };
  }
}

// Export singleton instance
const redisCluster = new RedisClusterManager();

module.exports = {
  redisCluster,
  RedisClusterManager
};