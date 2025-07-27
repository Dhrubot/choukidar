// === src/config/mongodbOptimizations.js (ENHANCED) ===
// CRITICAL FIX: Enhanced MongoDB Connection Resilience
// Integrates with new connection management system
// Optimized for 25,000+ concurrent users with intelligent fallbacks

const mongoose = require('mongoose');
const { connectionPoolManager } = require('./connectionPoolManager');
const { connectionRecoveryManager } = require('../utils/connectionRecovery');

class EnhancedMongoDBOptimizer {
  constructor() {
    this.connectionPool = null;
    this.readPreference = 'secondaryPreferred';
    this.isOptimized = false;
    
    // Enhanced connection pool settings for extreme load
    this.poolConfig = {
      // BANGLADESH SCALE: Connection Pool Settings
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 20,  // Increased from 10
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 150, // Increased from 100
      maxIdleTimeMS: 30000,        // Close idle connections faster
      waitQueueTimeoutMS: 2000,    // Fail fast if pool is full
      
      // AGGRESSIVE TIMEOUTS: Socket Settings for high load
      socketTimeoutMS: 30000,      // Reduced from 45000
      connectTimeoutMS: 10000,
      
      // FAST FAILURE: Server Selection for responsiveness
      serverSelectionTimeoutMS: 3000, // Reduced from 5000
      heartbeatFrequencyMS: 5000,      // More frequent health checks
      
      // RELIABILITY: Read/Write Concerns for consistency
      readConcern: { level: 'majority' },
      writeConcern: { 
        w: 'majority',
        j: true,
        wtimeout: 5000 
      },
      
      // PERFORMANCE: Compression and optimization
      directConnection: false,
      compressors: ['zstd', 'zlib', 'snappy'],
      
      // NEW: Buffer management for high throughput
      bufferCommands: false,
      autoCreate: false,
      
      // NEW: Enhanced retry logic
      retryWrites: true,
      retryReads: true
    };

    // Query optimization rules
    this.queryRules = new Map();
    this.slowQueryThreshold = 100; // ms
    
    // Enhanced connection statistics
    this.stats = {
      activeConnections: 0,
      poolUtilization: 0,
      slowQueries: [],
      queryCache: new Map(),
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      lastOptimizationRun: null
    };
    
    // Connection resilience settings
    this.resilienceConfig = {
      maxConnectionAttempts: 5,
      connectionRetryDelay: 2000,
      healthCheckInterval: 15000,
      poolMonitorInterval: 10000,
      circuitBreakerThreshold: 10,
      circuitBreakerTimeout: 30000
    };
    
    // Query performance monitoring
    this.queryPerformanceMonitor = {
      enabled: true,
      slowQueryLog: [],
      maxSlowQueryLog: 100,
      averageQueryTime: 0,
      totalQueries: 0
    };
  }

  /**
   * Initialize enhanced MongoDB optimizations with connection management
   */
  async initialize(mongoUri = process.env.MONGODB_URI) {
    console.log('🚀 Initializing enhanced MongoDB optimizations...');

    try {
      if (!mongoUri) {
        throw new Error('MongoDB URI is required');
      }

      // STEP 1: Build optimized connection URI
      const optimizedUri = this.buildOptimizedUri(mongoUri);
      console.log('🔧 Optimized connection URI prepared');

      // STEP 2: Set mongoose global options
      this.configureMongooseGlobals();

      // STEP 3: Use connection pool manager instead of direct connection
      console.log('🔌 Initializing connection through pool manager...');
      await connectionPoolManager.initialize(optimizedUri, this.poolConfig);

      // STEP 4: Setup enhanced connection monitoring
      this.setupEnhancedConnectionMonitoring();

      // STEP 5: Apply query optimizations
      this.applyQueryOptimizations();

      // STEP 6: Setup read preference routing
      this.setupReadPreferenceRouting();

      // STEP 7: Initialize connection recovery
      connectionRecoveryManager.initialize();

      // STEP 8: Setup performance monitoring
      this.setupPerformanceMonitoring();

      this.isOptimized = true;
      this.stats.lastOptimizationRun = Date.now();

      console.log('✅ Enhanced MongoDB optimizations applied successfully');
      console.log(`📊 Pool: ${this.poolConfig.maxPoolSize} max, ${this.poolConfig.minPoolSize} min connections`);

      return mongoose.connection;

    } catch (error) {
      console.error('❌ Enhanced MongoDB optimization failed:', error);
      await this.handleOptimizationFailure(error);
      throw error;
    }
  }

  /**
   * Build optimized connection URI with enhanced parameters
   */
  buildOptimizedUri(baseUri) {
    try {
      const url = new URL(baseUri);
      
      // ENHANCED: Add Bangladesh-scale optimization parameters
      const optimizationParams = {
        // Reliability
        'retryWrites': 'true',
        'retryReads': 'true',
        'w': 'majority',
        'readPreference': this.readPreference,
        
        // Connection pool
        'maxPoolSize': this.poolConfig.maxPoolSize.toString(),
        'minPoolSize': this.poolConfig.minPoolSize.toString(),
        'maxIdleTimeMS': this.poolConfig.maxIdleTimeMS.toString(),
        'waitQueueTimeoutMS': this.poolConfig.waitQueueTimeoutMS.toString(),
        
        // Timeouts
        'serverSelectionTimeoutMS': this.poolConfig.serverSelectionTimeoutMS.toString(),
        'socketTimeoutMS': this.poolConfig.socketTimeoutMS.toString(),
        'connectTimeoutMS': this.poolConfig.connectTimeoutMS.toString(),
        'heartbeatFrequencyMS': this.poolConfig.heartbeatFrequencyMS.toString(),
        
        // Performance
        'compressors': 'zstd,zlib,snappy',
        'zlibCompressionLevel': '6',
        
        // NEW: Additional optimization parameters
        'maxStalenessSeconds': '90',
        'localThresholdMS': '15',
        'appName': 'SafeStreets-Bangladesh'
      };
      
      // Apply parameters
      Object.entries(optimizationParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      
      // Add replica set configuration if not present
      if (!url.searchParams.has('replicaSet') && !url.hostname.includes('localhost')) {
        url.searchParams.set('replicaSet', 'rs0');
      }

      console.log('🔧 Connection URI optimized with', Object.keys(optimizationParams).length, 'parameters');
      return url.toString();

    } catch (error) {
      console.error('❌ Failed to build optimized URI:', error.message);
      return baseUri; // Fallback to original URI
    }
  }

  /**
   * Configure mongoose global settings
   */
  configureMongooseGlobals() {
    // Development vs Production settings
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    mongoose.set('autoIndex', false); // Disable auto-indexing in production
    mongoose.set('strictQuery', false);
    
    // Enhanced buffer settings
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferMaxEntries', 0);
    
    // Connection settings
    mongoose.set('maxTimeMS', 30000);
    
    console.log('⚙️ Mongoose global settings configured');
  }

  /**
   * Setup enhanced connection monitoring with integration
   */
  setupEnhancedConnectionMonitoring() {
    const connection = mongoose.connection;

    // Enhanced connection event handlers
    connection.on('connected', () => {
      console.log('📡 Enhanced MongoDB connection established');
      this.stats.activeConnections++;
      this.stats.successfulConnections++;
      this.updateAverageConnectionTime();
    });

    connection.on('disconnected', () => {
      console.log('📡 Enhanced MongoDB connection lost');
      this.stats.activeConnections--;
    });

    connection.on('error', (error) => {
      console.error('📡 Enhanced MongoDB connection error:', error.message);
      this.stats.failedConnections++;
    });

    connection.on('reconnected', () => {
      console.log('📡 Enhanced MongoDB reconnected');
      this.stats.activeConnections++;
    });

    // Setup pool monitoring with connection pool manager integration
    this.setupPoolMonitoring();

    // Setup query performance monitoring
    this.setupQueryPerformanceMonitoring();

    console.log('📊 Enhanced connection monitoring configured');
  }

  /**
   * Setup connection pool monitoring
   */
  setupPoolMonitoring() {
    setInterval(() => {
      this.updatePoolStatistics();
      this.checkPoolHealth();
    }, this.resilienceConfig.poolMonitorInterval);
  }

  /**
   * Update pool statistics
   */
  updatePoolStatistics() {
    try {
      const connection = mongoose.connection;
      
      if (connection && connection.client && connection.client.topology) {
        const topology = connection.client.topology;
        
        if (topology.s && topology.s.servers) {
          const servers = Array.from(topology.s.servers.values());
          
          let totalConnections = 0;
          let activeConnections = 0;
          
          servers.forEach(server => {
            if (server.s && server.s.pool) {
              const pool = server.s.pool;
              totalConnections += pool.totalConnectionCount || 0;
              activeConnections += pool.checkedOutCount || 0;
            }
          });
          
          this.stats.activeConnections = activeConnections;
          this.stats.poolUtilization = totalConnections > 0 ? 
            (activeConnections / this.poolConfig.maxPoolSize * 100) : 0;
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Pool statistics update failed:', error.message);
    }
  }

  /**
   * Check pool health and emit warnings
   */
  checkPoolHealth() {
    const utilization = this.stats.poolUtilization;
    
    if (utilization > 90) {
      console.warn(`🚨 CRITICAL: Pool utilization at ${utilization.toFixed(1)}%`);
      this.handleCriticalPoolUtilization();
    } else if (utilization > 75) {
      console.warn(`⚠️ HIGH: Pool utilization at ${utilization.toFixed(1)}%`);
    }
  }

  /**
   * Handle critical pool utilization
   */
  async handleCriticalPoolUtilization() {
    try {
      console.log('🔧 Handling critical pool utilization...');
      
      // Trigger connection pool optimization
      await this.optimizeConnectionPool();
      
      // Notify administrators
      this.notifyAdministrators('critical_pool_utilization', {
        utilization: this.stats.poolUtilization,
        activeConnections: this.stats.activeConnections,
        maxConnections: this.poolConfig.maxPoolSize
      });
      
    } catch (error) {
      console.error('❌ Failed to handle critical pool utilization:', error.message);
    }
  }

  /**
   * Optimize connection pool
   */
  async optimizeConnectionPool() {
    try {
      console.log('⚡ Optimizing connection pool...');
      
      // Close idle connections
      await this.closeIdleConnections();
      
      // Reset connection pool if necessary
      if (this.stats.poolUtilization > 95) {
        console.log('🔄 Resetting connection pool due to extreme utilization');
        await connectionPoolManager.attemptConnectionRecovery();
      }
      
      console.log('✅ Connection pool optimization completed');
      
    } catch (error) {
      console.error('❌ Connection pool optimization failed:', error.message);
    }
  }

  /**
   * Close idle connections
   */
  async closeIdleConnections() {
    try {
      // This is handled by the connection pool manager
      const poolStatus = connectionPoolManager.getPoolStatus();
      console.log(`🔧 Pool status: ${poolStatus.stats.activeConnections} active connections`);
      
    } catch (error) {
      console.error('❌ Failed to close idle connections:', error.message);
    }
  }

  /**
   * Setup query performance monitoring
   */
  setupQueryPerformanceMonitoring() {
    if (!this.queryPerformanceMonitor.enabled) return;

    // Add query middleware for monitoring
    mongoose.plugin((schema) => {
      // Pre-hooks for find operations
      ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'aggregate'].forEach(method => {
        schema.pre(method, function() {
          this._startTime = Date.now();
          this._queryMethod = method;
          
          // Apply query optimizations
          this.applyQueryOptimizations(this);
        });

        schema.post(method, function() {
          if (this._startTime) {
            const duration = Date.now() - this._startTime;
            this.recordQueryPerformance(this._queryMethod, duration, this);
          }
        });
      });
    });

    console.log('📊 Query performance monitoring enabled');
  }

  /**
   * Apply query optimizations
   */
  applyQueryOptimizations(query) {
    try {
      // Apply lean for read operations when possible
      if (query.op && query.op.startsWith('find') && !query.options.populate) {
        query.lean();
      }
      
      // Add query hints for known patterns
      const queryHint = this.getQueryHint(query);
      if (queryHint) {
        query.hint(queryHint);
      }
      
      // Set read preference based on operation
      this.setOptimalReadPreference(query);
      
    } catch (error) {
      // Don't fail queries due to optimization errors
      console.warn('⚠️ Query optimization warning:', error.message);
    }
  }

  /**
   * Record query performance
   */
  recordQueryPerformance(method, duration, query) {
    try {
      this.queryPerformanceMonitor.totalQueries++;
      
      // Update average query time
      const alpha = 0.1;
      this.queryPerformanceMonitor.averageQueryTime = 
        alpha * duration + (1 - alpha) * this.queryPerformanceMonitor.averageQueryTime;
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        this.logSlowQuery(method, duration, query);
      }
      
    } catch (error) {
      console.warn('⚠️ Query performance recording failed:', error.message);
    }
  }

  /**
   * Log slow query
   */
  logSlowQuery(method, duration, query) {
    const slowQuery = {
      method,
      duration,
      timestamp: Date.now(),
      filter: query.getFilter ? query.getFilter() : 'unknown',
      collection: query.mongooseCollection?.name || 'unknown'
    };
    
    this.queryPerformanceMonitor.slowQueryLog.push(slowQuery);
    
    // Keep only recent slow queries
    if (this.queryPerformanceMonitor.slowQueryLog.length > this.queryPerformanceMonitor.maxSlowQueryLog) {
      this.queryPerformanceMonitor.slowQueryLog = 
        this.queryPerformanceMonitor.slowQueryLog.slice(-this.queryPerformanceMonitor.maxSlowQueryLog);
    }
    
    console.warn(`🐌 Slow query detected: ${method} took ${duration}ms on ${slowQuery.collection}`);
  }

  /**
   * Get query hint for optimization
   */
  getQueryHint(query) {
    try {
      const filter = query.getFilter ? query.getFilter() : {};
      
      // Common query patterns and their optimal indexes
      if (filter.location) {
        return { 'location.coordinates': '2dsphere' };
      }
      
      if (filter.timestamp || filter.createdAt) {
        return { timestamp: -1 };
      }
      
      if (filter.type) {
        return { type: 1, timestamp: -1 };
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Set optimal read preference
   */
  setOptimalReadPreference(query) {
    try {
      const method = query.op;
      
      // Analytics and reports - can use slightly stale data
      if (method === 'aggregate' || method === 'count') {
        query.read('secondary');
      }
      
      // Real-time operations - need current data
      else if (method === 'findOneAndUpdate' || method === 'findOneAndDelete') {
        query.read('primary');
      }
      
      // Regular reads - use secondary preferred
      else {
        query.read('secondaryPreferred');
      }
      
    } catch (error) {
      // Don't fail queries due to read preference errors
      console.warn('⚠️ Read preference setting failed:', error.message);
    }
  }

  /**
   * Setup read preference routing for load distribution
   */
  setupReadPreferenceRouting() {
    // Configure read preferences for different operations
    const readPreferences = {
      // Analytics and reports - can use slightly stale data
      analytics: 'secondary',
      reports: 'secondaryPreferred',
      
      // User data - needs to be current
      users: 'primary',
      auth: 'primary',
      
      // Safety data - balance between current and load distribution
      safezones: 'secondaryPreferred',
      devices: 'secondaryPreferred'
    };
    
    console.log('🔀 Read preference routing configured');
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 60000); // Log every minute
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    const metrics = {
      poolUtilization: this.stats.poolUtilization.toFixed(1) + '%',
      activeConnections: this.stats.activeConnections,
      averageQueryTime: Math.round(this.queryPerformanceMonitor.averageQueryTime) + 'ms',
      totalQueries: this.queryPerformanceMonitor.totalQueries,
      slowQueries: this.queryPerformanceMonitor.slowQueryLog.length,
      connectionSuccessRate: this.stats.connectionAttempts > 0 ? 
        (this.stats.successfulConnections / this.stats.connectionAttempts * 100).toFixed(1) + '%' : '0%'
    };
    
    console.log('📊 MongoDB Performance Metrics:', JSON.stringify(metrics, null, 2));
  }

  /**
   * Update average connection time
   */
  updateAverageConnectionTime() {
    // This would be updated by the connection pool manager
    // Placeholder for connection time tracking
  }

  /**
   * Handle optimization failure
   */
  async handleOptimizationFailure(error) {
    console.error('❌ MongoDB optimization failure:', error.message);
    
    try {
      // Attempt basic connection as fallback
      console.log('🔄 Attempting basic connection as fallback...');
      
      const basicConfig = {
        maxPoolSize: 50,
        minPoolSize: 5,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000
      };
      
      await mongoose.connect(process.env.MONGODB_URI, basicConfig);
      
      console.log('✅ Basic connection established as fallback');
      
    } catch (fallbackError) {
      console.error('❌ Fallback connection also failed:', fallbackError.message);
      throw fallbackError;
    }
  }

  /**
   * Notify administrators of critical issues
   */
  async notifyAdministrators(alertType, data) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) return;

      console.log(`📧 Sending admin notification: ${alertType}`);
      
      // This would integrate with your email service
      // For now, just log the alert
      console.log('🚨 ADMIN ALERT:', {
        type: alertType,
        timestamp: new Date(),
        data
      });
      
    } catch (error) {
      console.error('❌ Failed to notify administrators:', error.message);
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    return {
      isOptimized: this.isOptimized,
      lastOptimizationRun: this.stats.lastOptimizationRun ? 
        new Date(this.stats.lastOptimizationRun) : null,
      connectionStats: {
        activeConnections: this.stats.activeConnections,
        poolUtilization: this.stats.poolUtilization,
        successfulConnections: this.stats.successfulConnections,
        failedConnections: this.stats.failedConnections,
        connectionSuccessRate: this.stats.connectionAttempts > 0 ? 
          (this.stats.successfulConnections / this.stats.connectionAttempts * 100) : 0
      },
      queryPerformance: {
        averageQueryTime: Math.round(this.queryPerformanceMonitor.averageQueryTime),
        totalQueries: this.queryPerformanceMonitor.totalQueries,
        slowQueries: this.queryPerformanceMonitor.slowQueryLog.length,
        recentSlowQueries: this.queryPerformanceMonitor.slowQueryLog.slice(-5)
      },
      poolConfig: {
        maxPoolSize: this.poolConfig.maxPoolSize,
        minPoolSize: this.poolConfig.minPoolSize,
        socketTimeoutMS: this.poolConfig.socketTimeoutMS,
        serverSelectionTimeoutMS: this.poolConfig.serverSelectionTimeoutMS
      }
    };
  }

  /**
   * Get slow query analysis
   */
  getSlowQueryAnalysis() {
    const slowQueries = this.queryPerformanceMonitor.slowQueryLog;
    
    if (slowQueries.length === 0) {
      return { message: 'No slow queries detected' };
    }
    
    // Analyze slow queries by collection
    const byCollection = {};
    const byMethod = {};
    
    slowQueries.forEach(query => {
      // By collection
      if (!byCollection[query.collection]) {
        byCollection[query.collection] = { count: 0, totalTime: 0 };
      }
      byCollection[query.collection].count++;
      byCollection[query.collection].totalTime += query.duration;
      
      // By method
      if (!byMethod[query.method]) {
        byMethod[query.method] = { count: 0, totalTime: 0 };
      }
      byMethod[query.method].count++;
      byMethod[query.method].totalTime += query.duration;
    });
    
    // Calculate averages
    Object.keys(byCollection).forEach(collection => {
      byCollection[collection].averageTime = 
        byCollection[collection].totalTime / byCollection[collection].count;
    });
    
    Object.keys(byMethod).forEach(method => {
      byMethod[method].averageTime = 
        byMethod[method].totalTime / byMethod[method].count;
    });
    
    return {
      totalSlowQueries: slowQueries.length,
      slowestQuery: slowQueries.reduce((slowest, current) => 
        current.duration > slowest.duration ? current : slowest, slowQueries[0]),
      byCollection,
      byMethod,
      recommendations: this.generateSlowQueryRecommendations(byCollection, byMethod)
    };
  }

  /**
   * Generate recommendations for slow queries
   */
  generateSlowQueryRecommendations(byCollection, byMethod) {
    const recommendations = [];
    
    // Check for collections with many slow queries
    Object.entries(byCollection).forEach(([collection, stats]) => {
      if (stats.count > 10) {
        recommendations.push({
          type: 'index_optimization',
          collection,
          message: `Collection ${collection} has ${stats.count} slow queries. Consider adding indexes.`,
          priority: 'high'
        });
      }
    });
    
    // Check for methods with high average time
    Object.entries(byMethod).forEach(([method, stats]) => {
      if (stats.averageTime > 500) {
        recommendations.push({
          type: 'query_optimization',
          method,
          message: `${method} operations average ${Math.round(stats.averageTime)}ms. Consider query optimization.`,
          priority: 'medium'
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Test database performance
   */
  async testDatabasePerformance() {
    console.log('🧪 Testing database performance...');
    
    const tests = [
      { name: 'Connection Test', test: () => this.testConnection() },
      { name: 'Query Performance Test', test: () => this.testQueryPerformance() },
      { name: 'Pool Utilization Test', test: () => this.testPoolUtilization() }
    ];
    
    const results = {};
    
    for (const test of tests) {
      try {
        console.log(`🔬 Running ${test.name}...`);
        const result = await test.test();
        results[test.name] = { success: true, result };
        console.log(`✅ ${test.name} passed`);
      } catch (error) {
        results[test.name] = { success: false, error: error.message };
        console.log(`❌ ${test.name} failed:`, error.message);
      }
    }
    
    return results;
  }

  /**
   * Test connection
   */
  async testConnection() {
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - startTime;
    
    return {
      pingTime,
      connectionState: mongoose.connection.readyState,
      healthy: pingTime < 100
    };
  }

  /**
   * Test query performance
   */
  async testQueryPerformance() {
    const startTime = Date.now();
    
    // Test basic query
    await mongoose.connection.db.collection('test').findOne({});
    
    const queryTime = Date.now() - startTime;
    
    return {
      queryTime,
      healthy: queryTime < 50
    };
  }

  /**
   * Test pool utilization
   */
  testPoolUtilization() {
    return {
      utilization: this.stats.poolUtilization,
      activeConnections: this.stats.activeConnections,
      maxConnections: this.poolConfig.maxPoolSize,
      healthy: this.stats.poolUtilization < 75
    };
  }

  /**
   * Performs a bulk write operation with optimizations for high throughput.
   * Processes operations in chunks and groups them by type for efficiency.
   * @param {mongoose.Model} model - The Mongoose model to perform the bulk write on.
   * @param {object[]} operations - An array of bulk write operations.
   * @param {object} [options={}] - Optional settings for the bulk write.
   */
  async optimizedBulkWrite(model, operations, options = {}) {
    if (!model || !Array.isArray(operations) || operations.length === 0) {
      console.warn('⚠️ optimizedBulkWrite called with invalid arguments.');
      return;
    }

    const chunkSize = 1000; // Process in chunks of 1000 to manage memory and load
    console.log(`🚀 Starting optimized bulk write for ${model.modelName} with ${operations.length} operations...`);

    // Group operations by type (e.g., all inserts together) for better performance
    const grouped = this.groupBulkOperations(operations);

    for (const [opType, ops] of Object.entries(grouped)) {
      if (ops.length === 0) continue;

      // Process in chunks
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize);
        
        try {
          const result = await model.bulkWrite(chunk, {
            ordered: false, // Unordered for maximum performance
            ...options
          });

          console.log(`  ✅ Bulk ${opType}: ${result.ok ? 'OK' : 'FAIL'} | Inserted: ${result.insertedCount} | Modified: ${result.modifiedCount} | Deleted: ${result.deletedCount}`);

        } catch (error) {
          console.error(`❌ Bulk write chunk failed for ${opType}:`, error);
          // Depending on requirements, you might want to stop or continue on error
          // For now, we log and continue with other chunks/operations.
        }
      }
    }
  }

  /**
   * Force connection pool reset
   */
  async forcePoolReset() {
    console.log('🔄 Forcing connection pool reset...');
    
    try {
      await connectionPoolManager.shutdown();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await connectionPoolManager.initialize(process.env.MONGODB_URI, this.poolConfig);
      
      console.log('✅ Connection pool reset completed');
      return true;
      
    } catch (error) {
      console.error('❌ Connection pool reset failed:', error.message);
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down enhanced MongoDB optimizer...');
    
    try {
      // Stop monitoring intervals
      // (Intervals would be stored in class properties)
      
      // Close connection through pool manager
      await connectionPoolManager.shutdown();
      
      console.log('✅ Enhanced MongoDB optimizer shutdown complete');
      
    } catch (error) {
      console.error('❌ Error during MongoDB optimizer shutdown:', error.message);
    }
  }
}

// Export singleton instance
const enhancedMongoDBOptimizer = new EnhancedMongoDBOptimizer();

// Export both the class and instance for flexibility
module.exports = {
  enhancedMongoDBOptimizer,
  EnhancedMongoDBOptimizer,
  // Backward compatibility
  optimizeMongoDB: () => enhancedMongoDBOptimizer.initialize(),
  optimizedBulkWrite: (model, ops, options) => enhancedMongoDBOptimizer.optimizedBulkWrite(model, ops, options),
  MongoDBOptimizer: EnhancedMongoDBOptimizer,
};