// === backend/src/config/mongodbOptimizations.js ===
// MongoDB Performance Optimizations for SafeStreets Bangladesh
// Handles connection pooling, read replicas, and query optimization

const mongoose = require('mongoose');

class MongoDBOptimizer {
  constructor() {
    this.connectionPool = null;
    this.readPreference = 'secondaryPreferred';
    this.isOptimized = false;
    
    // Connection pool settings for high concurrency
    this.poolConfig = {
      // Connection Pool Settings
      minPoolSize: 10,
      maxPoolSize: 100, // Increased for 8000+ users
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 5000,
      
      // Socket Settings
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      
      // Server Selection
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      
      // Read/Write Concerns for consistency
      readConcern: { level: 'majority' },
      writeConcern: { 
        w: 'majority',
        j: true,
        wtimeout: 5000 
      },
      
      // Performance optimizations
      directConnection: false,
      compressors: ['zstd', 'zlib', 'snappy']
    };

    // Query optimization rules
    this.queryRules = new Map();
    this.slowQueryThreshold = 100; // ms
    
    // Connection statistics
    this.stats = {
      activeConnections: 0,
      poolUtilization: 0,
      slowQueries: [],
      queryCache: new Map()
    };
  }

  /**
   * Initialize optimized MongoDB connection
   */
  async initialize(mongoUri = process.env.MONGODB_URI) {
    console.log('🚀 Initializing MongoDB optimizations...');

    try {
      // Build optimized connection URI
      const optimizedUri = this.buildOptimizedUri(mongoUri);

      // Set mongoose options
      mongoose.set('debug', process.env.NODE_ENV === 'development');
      mongoose.set('autoIndex', false); // Disable auto-indexing in production
      mongoose.set('strictQuery', false);

      // Configure connection with optimizations
      const options = {
        ...this.poolConfig,
        // Additional Mongoose-specific options
        bufferCommands: false,
        autoCreate: false,
        maxPoolSize: this.poolConfig.maxPoolSize,
        minPoolSize: this.poolConfig.minPoolSize,
        socketTimeoutMS: this.poolConfig.socketTimeoutMS,
        serverSelectionTimeoutMS: this.poolConfig.serverSelectionTimeoutMS
      };

      // Connect with retry logic
      await this.connectWithRetry(optimizedUri, options);

      // Setup connection monitoring
      this.setupConnectionMonitoring();

      // Apply query optimizations
      this.applyQueryOptimizations();

      // Setup read preference routing
      this.setupReadPreferenceRouting();

      this.isOptimized = true;
      console.log('✅ MongoDB optimizations applied successfully');

      return mongoose.connection;

    } catch (error) {
      console.error('❌ MongoDB optimization failed:', error);
      throw error;
    }
  }

  /**
   * Build optimized connection URI with replica set
   */
  buildOptimizedUri(baseUri) {
    const url = new URL(baseUri);
    
    // Add optimization parameters
    url.searchParams.set('retryWrites', 'true');
    url.searchParams.set('w', 'majority');
    url.searchParams.set('readPreference', this.readPreference);
    url.searchParams.set('maxPoolSize', this.poolConfig.maxPoolSize);
    url.searchParams.set('minPoolSize', this.poolConfig.minPoolSize);
    url.searchParams.set('compressors', 'zstd,zlib,snappy');
    
    // Add replica set configuration if not present
    if (!url.searchParams.has('replicaSet')) {
      url.searchParams.set('replicaSet', 'rs0');
    }

    return url.toString();
  }

  /**
   * Connect with exponential backoff retry
   */
  async connectWithRetry(uri, options, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await mongoose.connect(uri, options);
        console.log(`✅ MongoDB connected on attempt ${attempt}`);
        return;
      } catch (error) {
        console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    const connection = mongoose.connection;

    // Monitor connection events
    connection.on('connected', () => {
      console.log('✅ MongoDB connection established');
      this.stats.activeConnections++;
    });

    connection.on('disconnected', () => {
      console.log('❌ MongoDB connection lost');
      this.stats.activeConnections--;
    });

    connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    // Monitor connection pool
    if (connection.client) {
      const topology = connection.client.topology;
      
      if (topology) {
        topology.on('serverOpening', () => {
          this.stats.activeConnections++;
        });

        topology.on('serverClosed', () => {
          this.stats.activeConnections--;
        });

        // Monitor pool utilization
        setInterval(() => {
          if (topology.s && topology.s.servers) {
            const servers = Array.from(topology.s.servers.values());
            const totalConnections = servers.reduce((sum, server) => {
              return sum + (server.s.pool ? server.s.pool.totalConnectionCount : 0);
            }, 0);
            
            this.stats.poolUtilization = (totalConnections / this.poolConfig.maxPoolSize) * 100;
          }
        }, 10000); // Check every 10 seconds
      }
    }
  }

  /**
   * Apply query optimizations
   */
  applyQueryOptimizations() {
    // Add query middleware for monitoring
    mongoose.plugin((schema) => {
      // Pre-hooks for find operations
      ['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete'].forEach(method => {
        schema.pre(method, function() {
          this._startTime = Date.now();
          
          // Apply query optimizations
          if (this.options) {
            // Always use lean for read operations when possible
            if (method.startsWith('find') && !this.options.populate) {
              this.lean();
            }
            
            // Add query hints for known patterns
            const queryHint = this.getQueryHint();
            if (queryHint) {
              this.hint(queryHint);
            }
          }
        });

        schema.post(method, function() {
          const duration = Date.now() - this._startTime;
          
          // Log slow queries
          if (duration > this.slowQueryThreshold) {
            this.logSlowQuery(method, duration);
          }
        });
      });
    });
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
      authentication: 'primary',
      
      // Public data - can use secondary
      safezones: 'secondary',
      publicMaps: 'secondary'
    };

    // Apply read preferences to models
    mongoose.connection.on('connected', () => {
      for (const [modelName, readPref] of Object.entries(readPreferences)) {
        try {
          const model = mongoose.model(modelName);
          if (model) {
            model.read(readPref);
          }
        } catch (error) {
          // Model might not exist yet
        }
      }
    });
  }

  /**
   * Get query hint based on query pattern
   */
  getQueryHint() {
    const query = this.getFilter();
    
    // Define hints for common query patterns
    if (query.location && query.location.$near) {
      return { '2dsphere': 1 };
    }
    
    if (query.timestamp && (query.timestamp.$gte || query.timestamp.$lte)) {
      return { timestamp: -1 };
    }
    
    if (query.userType && query.status) {
      return { userType: 1, status: 1 };
    }
    
    return null;
  }

  /**
   * Log slow queries for analysis
   */
  logSlowQuery(method, duration) {
    const query = {
      method,
      duration,
      filter: this.getFilter(),
      options: this.options,
      timestamp: new Date()
    };

    this.stats.slowQueries.push(query);

    // Keep only last 100 slow queries
    if (this.stats.slowQueries.length > 100) {
      this.stats.slowQueries.shift();
    }

    console.warn(`⚠️ Slow query detected: ${method} took ${duration}ms`);
  }

  /**
   * Create optimized aggregation pipeline
   */
  createOptimizedPipeline(stages) {
    const optimizedStages = [];

    // Add $match stage as early as possible
    const matchStage = stages.find(stage => stage.$match);
    if (matchStage) {
      optimizedStages.push(matchStage);
    }

    // Add index hints for geo queries
    const geoStage = stages.find(stage => stage.$geoNear);
    if (geoStage) {
      geoStage.$geoNear.spherical = true;
      geoStage.$geoNear.query = geoStage.$geoNear.query || {};
      optimizedStages.unshift(geoStage);
    }

    // Add remaining stages
    stages.forEach(stage => {
      if (stage !== matchStage && stage !== geoStage) {
        optimizedStages.push(stage);
      }
    });

    // Add allowDiskUse for large aggregations
    return {
      pipeline: optimizedStages,
      options: {
        allowDiskUse: true,
        maxTimeMS: 30000,
        cursor: { batchSize: 1000 }
      }
    };
  }

  /**
   * Bulk write optimization
   */
  async optimizedBulkWrite(model, operations, options = {}) {
    const bulkOps = [];
    const chunkSize = 1000; // Process in chunks

    // Group operations by type for better performance
    const grouped = this.groupBulkOperations(operations);

    for (const [opType, ops] of Object.entries(grouped)) {
      // Process in chunks to avoid memory issues
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize);
        
        try {
          const result = await model.bulkWrite(chunk, {
            ordered: false, // Unordered for better performance
            writeConcern: { w: 1 }, // Relaxed write concern for bulk ops
            ...options
          });

          console.log(`✅ Bulk ${opType}: ${result.modifiedCount} modified, ${result.insertedCount} inserted`);
        } catch (error) {
          console.error(`❌ Bulk write error:`, error);
          throw error;
        }
      }
    }
  }

  /**
   * Group bulk operations by type
   */
  groupBulkOperations(operations) {
    const grouped = {
      insertOne: [],
      updateOne: [],
      updateMany: [],
      deleteOne: [],
      deleteMany: [],
      replaceOne: []
    };

    operations.forEach(op => {
      const opType = Object.keys(op)[0];
      if (grouped[opType]) {
        grouped[opType].push(op);
      }
    });

    return grouped;
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      ...this.stats,
      connectionState: mongoose.connection.readyState,
      poolUtilizationPercent: this.stats.poolUtilization.toFixed(2) + '%',
      slowQueryCount: this.stats.slowQueries.length,
      recentSlowQueries: this.stats.slowQueries.slice(-10)
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Ping the database
      await mongoose.connection.db.admin().ping();
      
      // Check replica set status
      const status = await mongoose.connection.db.admin().replSetGetStatus();
      
      return {
        status: 'healthy',
        replSetStatus: status,
        stats: this.getStats()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        stats: this.getStats()
      };
    }
  }
}

// Export singleton instance
const mongoOptimizer = new MongoDBOptimizer();

module.exports = {
  mongoOptimizer,
  
  // Quick initialization
  optimizeMongoDB: () => mongoOptimizer.initialize(),
  
  // Utility functions
  createOptimizedPipeline: (stages) => mongoOptimizer.createOptimizedPipeline(stages),
  optimizedBulkWrite: (model, ops, options) => mongoOptimizer.optimizedBulkWrite(model, ops, options),
  getMongoStats: () => mongoOptimizer.getStats()
};