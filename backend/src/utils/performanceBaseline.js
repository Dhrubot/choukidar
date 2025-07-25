// === backend/src/utils/performanceBaseline.js ===
// Performance Baseline Analyzer for Choukidar Backend
// Establishes baseline metrics before optimization to measure improvements

const mongoose = require('mongoose');
const { cacheLayer } = require('../middleware/cacheLayer');
const { productionLogger } = require('./productionLogger');

class PerformanceBaseline {
  constructor() {
    this.baseline = {
      timestamp: new Date().toISOString(),
      database: {
        collections: {},
        indexes: {},
        connectionPool: {},
        queryPerformance: {},
        avgQueryTime: 0,
        slowQueries: []
      },
      middleware: {
        stackAnalysis: [],
        averageOverhead: 0,
        heaviestMiddleware: []
      },
      cache: {
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
        inefficientPatterns: []
      },
      routes: {
        slowestEndpoints: [],
        errorProneRoutes: [],
        highTrafficRoutes: []
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        arrayBuffers: 0
      },
      recommendations: []
    };
    
    this.testQueries = [
      // Common query patterns from load test failures
      { collection: 'reports', query: { status: 'pending' }, name: 'pending_reports' },
      { collection: 'reports', query: { 'location.coordinates': { $near: { $geometry: { type: 'Point', coordinates: [90.4125, 23.8103] }, $maxDistance: 1000 } } }, name: 'location_reports' },
      { collection: 'safezones', query: { status: 'active' }, name: 'active_safezones' },
      { collection: 'users', query: { userType: 'admin' }, name: 'admin_users' },
      { collection: 'devicefingerprints', query: { 'securityProfile.riskLevel': 'high' }, name: 'high_risk_devices' }
    ];
  }

  /**
   * Run complete baseline analysis
   */
  async runCompleteBaseline() {
    console.log('🎯 Starting Performance Baseline Analysis...');
    console.log('=' * 60);

    try {
      // 1. Database Analysis
      await this.analyzeDatabasePerformance();
      
      // 2. Index Analysis  
      await this.analyzeIndexEfficiency();
      
      // 3. Connection Pool Analysis
      await this.analyzeConnectionPool();
      
      // 4. Query Performance Analysis
      await this.analyzeQueryPerformance();
      
      // 5. Cache Analysis
      await this.analyzeCachePerformance();
      
      // 6. Memory Analysis
      this.analyzeMemoryUsage();
      
      // 7. Generate Recommendations
      this.generateRecommendations();
      
      // 8. Save Baseline
      await this.saveBaseline();
      
      // 9. Display Results
      this.displayBaseline();
      
      return this.baseline;
      
    } catch (error) {
      console.error('❌ Baseline analysis failed:', error);
      productionLogger.error('Baseline analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze database collection performance
   */
  async analyzeDatabasePerformance() {
    console.log('📊 Analyzing database performance...');
    
    // Wait for database connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Waiting for database connection...');
      await new Promise(resolve => {
        if (mongoose.connection.readyState === 1) {
          resolve();
        } else {
          mongoose.connection.once('connected', resolve);
        }
      });
    }
    
    const collections = ['users', 'reports', 'safezones', 'devicefingerprints', 'auditlogs'];
    
    for (const collectionName of collections) {
      try {
        // Use mongoose.connection.db (compatible with Mongoose 8.x)
        if (!mongoose.connection.db) {
          throw new Error('Database connection not available');
        }
        
        const collection = mongoose.connection.db.collection(collectionName);
        
        // Simple document count and index count (more reliable)
        const documentCount = await collection.countDocuments();
        const indexes = await collection.indexes();
        
        // Get basic collection stats
        let stats = {};
        try {
          // Try modern approach first
          const statsResult = await collection.aggregate([
            { $collStats: { storageStats: {} } }
          ]).toArray();
          stats = statsResult[0]?.storageStats || {};
        } catch (error) {
          // Fallback for older MongoDB versions
          console.log(`  ℹ️ Using fallback stats for ${collectionName}`);
          stats = {
            count: documentCount,
            avgObjSize: 1000, // Estimate
            size: documentCount * 1000,
            totalIndexSize: 0
          };
        }
        
        this.baseline.database.collections[collectionName] = {
          documentCount: stats.count || documentCount,
          avgDocumentSize: stats.avgObjSize || 0,
          totalSize: stats.size || 0,
          indexCount: indexes.length,
          indexSize: stats.totalIndexSize || 0,
          indexSizeRatio: stats.size > 0 ? ((stats.totalIndexSize || 0) / stats.size * 100).toFixed(2) + '%' : '0%'
        };
        
        console.log(`  ✅ ${collectionName}: ${stats.count || documentCount} docs, ${indexes.length} indexes`);
        
      } catch (error) {
        console.error(`  ❌ Error analyzing ${collectionName}:`, error.message);
        this.baseline.database.collections[collectionName] = { 
          error: error.message,
          documentCount: 0,
          indexCount: 0
        };
      }
    }
  }

  /**
   * Analyze index efficiency
   */
  async analyzeIndexEfficiency() {
    console.log('🗂️ Analyzing index efficiency...');
    
    const collections = ['users', 'reports', 'safezones', 'devicefingerprints', 'auditlogs'];
    
    for (const collectionName of collections) {
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not available');
        }
        
        const collection = mongoose.connection.db.collection(collectionName);
        const indexes = await collection.indexes();
        
        // Analyze each index
        const indexAnalysis = indexes.map(index => ({
          name: index.name,
          keys: Object.keys(index.key || {}),
          unique: index.unique || false,
          sparse: index.sparse || false,
          background: index.background || false,
          size: index.size || 'unknown'
        }));
        
        // Identify potential redundant indexes
        const redundantIndexes = this.findRedundantIndexes(indexAnalysis);
        
        this.baseline.database.indexes[collectionName] = {
          total: indexes.length,
          indexes: indexAnalysis,
          redundant: redundantIndexes,
          efficiency: this.calculateIndexEfficiency(indexAnalysis)
        };
        
        console.log(`  📋 ${collectionName}: ${indexes.length} indexes, ${redundantIndexes.length} potentially redundant`);
        
      } catch (error) {
        console.error(`  ❌ Index analysis failed for ${collectionName}:`, error.message);
        this.baseline.database.indexes[collectionName] = {
          total: 0,
          indexes: [],
          redundant: [],
          efficiency: 0,
          error: error.message
        };
      }
    }
  }

  /**
   * Analyze connection pool performance
   */
  async analyzeConnectionPool() {
    console.log('🔗 Analyzing connection pool...');
    
    try {
      // Get connection state and configuration (Mongoose 8.x compatible)
      const connectionState = mongoose.connection.readyState;
      const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      
      // Try to get server status if available
      let connectionStats = {};
      try {
        if (mongoose.connection.db) {
          const serverStatus = await mongoose.connection.db.admin().serverStatus();
          connectionStats = serverStatus.connections || {};
        }
      } catch (error) {
        // Server status might not be available, use defaults
        connectionStats = { current: 'unknown', available: 'unknown' };
      }
      
      const poolStats = {
        connectionState: stateNames[connectionState] || 'unknown',
        currentConnections: connectionStats.current || 'unknown',
        availableConnections: connectionStats.available || 'unknown',
        totalCreated: connectionStats.totalCreated || 'unknown',
        // Get configuration from your server.js connection options
        maxPoolSize: 100, // From your server.js
        minPoolSize: 10,  // From your server.js
        socketTimeout: 45000, // From your server.js
        serverSelectionTimeout: 5000 // From your server.js
      };
      
      this.baseline.database.connectionPool = poolStats;
      
      console.log(`  🔗 Connection: ${poolStats.connectionState}`);
      console.log(`  📊 Pool: ${poolStats.currentConnections} active, ${poolStats.availableConnections} available`);
      
    } catch (error) {
      console.error('  ❌ Connection pool analysis failed:', error.message);
      this.baseline.database.connectionPool = { 
        error: error.message,
        connectionState: 'error'
      };
    }
  }

  /**
   * Analyze query performance with test queries
   */
  async analyzeQueryPerformance() {
    console.log('⚡ Running query performance tests...');
    
    const queryResults = [];
    let totalTime = 0;
    
    for (const testQuery of this.testQueries) {
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not available');
        }
        
        const collection = mongoose.connection.db.collection(testQuery.collection);
        
        const startTime = Date.now();
        const results = await collection.find(testQuery.query).limit(10).toArray();
        const executionTime = Date.now() - startTime;
        
        const queryResult = {
          name: testQuery.name,
          collection: testQuery.collection,
          executionTime,
          resultCount: results.length,
          performance: executionTime < 50 ? 'excellent' : 
                      executionTime < 100 ? 'good' : 
                      executionTime < 200 ? 'fair' : 'poor'
        };
        
        queryResults.push(queryResult);
        totalTime += executionTime;
        
        console.log(`  ⏱️ ${testQuery.name}: ${executionTime}ms (${queryResult.performance})`);
        
      } catch (error) {
        console.error(`  ❌ Query failed ${testQuery.name}:`, error.message);
        queryResults.push({
          name: testQuery.name,
          collection: testQuery.collection,
          error: error.message,
          executionTime: 0,
          performance: 'failed'
        });
      }
    }
    
    this.baseline.database.queryPerformance = {
      testResults: queryResults,
      avgQueryTime: queryResults.length > 0 ? totalTime / queryResults.length : 0,
      slowQueries: queryResults.filter(q => q.executionTime && q.executionTime > 100)
    };
    
    this.baseline.database.avgQueryTime = totalTime / queryResults.length || 0;
  }

  /**
   * Analyze cache performance
   */
  async analyzeCachePerformance() {
    console.log('💾 Analyzing cache performance...');
    
    try {
      // Check if cacheLayer is imported and available
      if (typeof cacheLayer !== 'undefined' && cacheLayer && cacheLayer.isConnected) {
        const cacheHealth = await cacheLayer.healthCheck();
        const cacheStats = cacheLayer.cacheStats || {};
        
        const hitRate = cacheStats.hits && cacheStats.misses ? 
          (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2) + '%' : '0%';
        
        this.baseline.cache = {
          status: cacheHealth.status,
          hitRate,
          hits: cacheStats.hits || 0,
          misses: cacheStats.misses || 0,
          sets: cacheStats.sets || 0,
          deletes: cacheStats.deletes || 0,
          memoryUsage: cacheHealth.memoryUsage || 'unknown',
          latency: cacheHealth.latency || 'unknown'
        };
        
        console.log(`  📈 Cache: ${hitRate} hit rate, ${cacheHealth.latency} latency`);
        
      } else {
        // Try to check Redis connection manually
        let redisStatus = 'disconnected';
        try {
          // Check if Redis is available via environment or manual connection test
          const redis = require('redis');
          const testClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: { connectTimeout: 2000 }
          });
          
          await testClient.connect();
          await testClient.ping();
          redisStatus = 'available_but_not_initialized';
          await testClient.disconnect();
        } catch (error) {
          redisStatus = 'unavailable';
        }
        
        this.baseline.cache = { 
          status: redisStatus, 
          error: redisStatus === 'unavailable' ? 'Redis server not running' : 'CacheLayer not initialized',
          hitRate: '0%',
          recommendation: redisStatus === 'available_but_not_initialized' ? 
            'Redis server is running but cacheLayer is not initialized in the app' :
            'Install and start Redis server for massive performance gains'
        };
        
        console.log(`  ❌ Cache: ${redisStatus}`);
      }
      
    } catch (error) {
      console.error('  ❌ Cache analysis failed:', error.message);
      this.baseline.cache = { 
        error: error.message,
        status: 'error',
        hitRate: '0%'
      };
    }
  }

  /**
   * Analyze memory usage
   */
  analyzeMemoryUsage() {
    console.log('🧠 Analyzing memory usage...');
    
    const memUsage = process.memoryUsage();
    
    this.baseline.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100 // MB
    };
    
    console.log(`  💾 Heap: ${this.baseline.memory.heapUsed}MB used / ${this.baseline.memory.heapTotal}MB total`);
    console.log(`  📊 RSS: ${this.baseline.memory.rss}MB, External: ${this.baseline.memory.external}MB`);
  }

  /**
   * Generate optimization recommendations based on baseline
   */
  generateRecommendations() {
    console.log('💡 Generating optimization recommendations...');
    
    const recommendations = [];
    
    // Database recommendations
    Object.entries(this.baseline.database.collections).forEach(([collection, stats]) => {
      if (stats.indexCount && stats.indexCount > 10) {
        recommendations.push({
          priority: 'high',
          category: 'database',
          collection,
          issue: `Too many indexes (${stats.indexCount})`,
          recommendation: 'Optimize indexes, remove redundant ones',
          expectedImprovement: '40-60% write performance gain'
        });
      }
      
      if (stats.indexSizeRatio && parseFloat(stats.indexSizeRatio) > 50) {
        recommendations.push({
          priority: 'medium',
          category: 'database',
          collection,
          issue: `High index size ratio (${stats.indexSizeRatio})`,
          recommendation: 'Review index efficiency, consider compound indexes',
          expectedImprovement: '20-30% storage reduction'
        });
      }
    });
    
    // Query performance recommendations
    if (this.baseline.database.avgQueryTime > 100) {
      recommendations.push({
        priority: 'high',
        category: 'queries',
        issue: `Slow average query time (${this.baseline.database.avgQueryTime.toFixed(2)}ms)`,
        recommendation: 'Add compound indexes for common query patterns',
        expectedImprovement: '50-70% query speed improvement'
      });
    }
    
    // Cache recommendations
    if (this.baseline.cache.status === 'disconnected') {
      recommendations.push({
        priority: 'critical',
        category: 'cache',
        issue: 'Redis cache not connected',
        recommendation: 'Fix Redis connection for massive performance gain',
        expectedImprovement: '60-80% response time improvement'
      });
    } else if (parseFloat(this.baseline.cache.hitRate) < 60) {
      recommendations.push({
        priority: 'medium',
        category: 'cache',
        issue: `Low cache hit rate (${this.baseline.cache.hitRate})`,
        recommendation: 'Optimize cache strategy and TTL values',
        expectedImprovement: '30-50% cache efficiency gain'
      });
    }
    
    // Memory recommendations
    if (this.baseline.memory.heapUsed > 512) {
      recommendations.push({
        priority: 'medium',
        category: 'memory',
        issue: `High memory usage (${this.baseline.memory.heapUsed}MB)`,
        recommendation: 'Implement memory optimization and garbage collection tuning',
        expectedImprovement: '20-40% memory reduction'
      });
    }
    
    this.baseline.recommendations = recommendations;
    
    console.log(`  📝 Generated ${recommendations.length} optimization recommendations`);
  }

  /**
   * Save baseline to file for comparison
   */
  async saveBaseline() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const baselineDir = path.join(__dirname, '../../performance-baselines');
      await fs.mkdir(baselineDir, { recursive: true });
      
      const filename = `baseline-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(baselineDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(this.baseline, null, 2));
      
      console.log(`💾 Baseline saved to: ${filepath}`);
      
    } catch (error) {
      console.error('❌ Failed to save baseline:', error.message);
    }
  }

  /**
   * Display comprehensive baseline results
   */
  displayBaseline() {
    console.log('\n' + '=' * 80);
    console.log('🎯 CHOUKIDAR BACKEND PERFORMANCE BASELINE REPORT');
    console.log('=' * 80);
    
    // Database Summary
    console.log('\n📊 DATABASE PERFORMANCE:');
    console.log(`   Average Query Time: ${this.baseline.database.avgQueryTime.toFixed(2)}ms`);
    console.log(`   Collections Analyzed: ${Object.keys(this.baseline.database.collections).length}`);
    console.log(`   Total Indexes: ${Object.values(this.baseline.database.indexes).reduce((sum, col) => sum + (col.total || 0), 0)}`);
    
    // Cache Summary
    console.log('\n💾 CACHE PERFORMANCE:');
    console.log(`   Status: ${this.baseline.cache.status}`);
    console.log(`   Hit Rate: ${this.baseline.cache.hitRate || 'N/A'}`);
    console.log(`   Latency: ${this.baseline.cache.latency || 'N/A'}`);
    
    // Memory Summary
    console.log('\n🧠 MEMORY USAGE:');
    console.log(`   Heap Used: ${this.baseline.memory.heapUsed}MB`);
    console.log(`   RSS: ${this.baseline.memory.rss}MB`);
    
    // Top Recommendations
    console.log('\n💡 TOP OPTIMIZATION PRIORITIES:');
    const topRecommendations = this.baseline.recommendations
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .slice(0, 5);
    
    topRecommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
      console.log(`      → ${rec.recommendation}`);
      console.log(`      → Expected: ${rec.expectedImprovement}`);
    });
    
    console.log('\n' + '=' * 80);
    console.log('🚀 Ready to begin optimizations based on this baseline!');
    console.log('=' * 80 + '\n');
  }

  /**
   * Helper: Find redundant indexes
   */
  findRedundantIndexes(indexes) {
    const redundant = [];
    
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const index1 = indexes[i];
        const index2 = indexes[j];
        
        // Check if one index is a subset of another
        if (this.isIndexSubset(index1.keys, index2.keys)) {
          redundant.push({
            redundant: index1.name,
            supersededBy: index2.name,
            reason: 'Subset of compound index'
          });
        }
      }
    }
    
    return redundant;
  }

  /**
   * Helper: Check if one index is subset of another
   */
  isIndexSubset(keys1, keys2) {
    if (keys1.length >= keys2.length) return false;
    return keys1.every((key, index) => keys2[index] === key);
  }

  /**
   * Helper: Calculate index efficiency score
   */
  calculateIndexEfficiency(indexes) {
    if (indexes.length === 0) return 100;
    
    let score = 100;
    
    // Penalty for too many indexes
    if (indexes.length > 10) score -= (indexes.length - 10) * 5;
    
    // Bonus for compound indexes
    const compoundIndexes = indexes.filter(idx => idx.keys.length > 1);
    score += compoundIndexes.length * 2;
    
    // Penalty for single-field indexes on common fields
    const singleFieldIndexes = indexes.filter(idx => idx.keys.length === 1);
    if (singleFieldIndexes.length > 5) score -= (singleFieldIndexes.length - 5) * 3;
    
    return Math.max(0, Math.min(100, score));
  }
}

// Export for use in optimization scripts
module.exports = {
  PerformanceBaseline,
  
  // Quick baseline runner
  async runBaseline() {
    const baseline = new PerformanceBaseline();
    return await baseline.runCompleteBaseline();
  }
};