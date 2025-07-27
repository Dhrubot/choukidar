// === src/middleware/databaseHealthChecker.js ===
// CRITICAL FIX: Real-time Database Health Monitoring
// Prevents database operations during connection issues
// Provides early warning system for connection pool problems

const mongoose = require('mongoose');
const { connectionPoolManager } = require('../config/connectionPoolManager');

class DatabaseHealthChecker {
  constructor() {
    this.isHealthy = true;
    this.lastHealthCheck = Date.now();
    this.healthHistory = [];
    this.alertThresholds = {
      responseTime: 1000,    // 1 second
      poolUtilization: 85,   // 85%
      errorRate: 10,         // 10%
      consecutiveFailures: 3
    };
    
    this.metrics = {
      totalChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastSuccessfulCheck: Date.now(),
      consecutiveFailures: 0,
      healthScore: 100
    };
    
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    // Setup connection pool event listeners
    this.setupPoolEventListeners();
  }

  /**
   * Initialize database health monitoring
   */
  initialize() {
    console.log('🏥 Initializing database health checker...');
    
    this.startContinuousMonitoring();
    console.log('✅ Database health checker initialized');
  }

  /**
   * Check if database is ready for operations
   */
  async isDatabaseReady() {
    try {
      // Quick connection state check
      if (mongoose.connection.readyState !== 1) {
        return {
          ready: false,
          reason: 'Database not connected',
          connectionState: this.getConnectionStateString()
        };
      }
      
      // Check connection pool health
      const poolStatus = connectionPoolManager.getPoolStatus();
      
      if (poolStatus.circuitBreaker.isOpen) {
        return {
          ready: false,
          reason: 'Circuit breaker is open',
          retryAfter: 30000 // 30 seconds
        };
      }
      
      if (poolStatus.stats.poolUtilization > this.alertThresholds.poolUtilization) {
        return {
          ready: false,
          reason: 'Connection pool near capacity',
          utilization: poolStatus.stats.poolUtilization,
          recommendation: 'Retry with backoff'
        };
      }
      
      // Check recent health history
      if (this.metrics.consecutiveFailures >= this.alertThresholds.consecutiveFailures) {
        return {
          ready: false,
          reason: 'Multiple consecutive health check failures',
          failures: this.metrics.consecutiveFailures
        };
      }
      
      return {
        ready: true,
        healthScore: this.metrics.healthScore,
        poolUtilization: poolStatus.stats.poolUtilization
      };
      
    } catch (error) {
      return {
        ready: false,
        reason: 'Health check failed',
        error: error.message
      };
    }
  }

  /**
   * Perform comprehensive database health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      this.metrics.totalChecks++;
      
      // 1. Check connection state
      if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
      }
      
      // 2. Ping database
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      const pingTime = Date.now() - pingStart;
      
      // 3. Test simple query
      const queryStart = Date.now();
      await mongoose.connection.db.collection('health_check').findOne({}, { _id: 1 });
      const queryTime = Date.now() - queryStart;
      
      const totalResponseTime = Date.now() - startTime;
      
      // Update metrics
      this.updateHealthMetrics(true, totalResponseTime);
      
      const healthResult = {
        healthy: true,
        timestamp: Date.now(),
        responseTime: totalResponseTime,
        pingTime,
        queryTime,
        connectionState: mongoose.connection.readyState,
        poolStatus: connectionPoolManager.getPoolStatus(),
        healthScore: this.metrics.healthScore
      };
      
      // Add to history
      this.addToHealthHistory(healthResult);
      
      // Check for performance issues
      if (totalResponseTime > this.alertThresholds.responseTime) {
        console.warn(`⚠️ Database slow response: ${totalResponseTime}ms`);
        healthResult.warning = 'Slow response time';
      }
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      return healthResult;
      
    } catch (error) {
      const totalResponseTime = Date.now() - startTime;
      
      // Update metrics for failure
      this.updateHealthMetrics(false, totalResponseTime);
      
      const healthResult = {
        healthy: false,
        timestamp: Date.now(),
        error: error.message,
        responseTime: totalResponseTime,
        connectionState: mongoose.connection.readyState,
        consecutiveFailures: this.metrics.consecutiveFailures,
        healthScore: this.metrics.healthScore
      };
      
      this.addToHealthHistory(healthResult);
      this.isHealthy = false;
      
      console.error('❌ Database health check failed:', error.message);
      
      return healthResult;
    }
  }

  /**
   * Update health metrics
   */
  updateHealthMetrics(success, responseTime) {
    // Update average response time (exponential moving average)
    const alpha = 0.1;
    this.metrics.averageResponseTime = alpha * responseTime + 
      (1 - alpha) * this.metrics.averageResponseTime;
    
    if (success) {
      this.metrics.consecutiveFailures = 0;
      this.metrics.lastSuccessfulCheck = Date.now();
      
      // Improve health score gradually
      this.metrics.healthScore = Math.min(100, this.metrics.healthScore + 5);
      
    } else {
      this.metrics.failedChecks++;
      this.metrics.consecutiveFailures++;
      
      // Decrease health score based on consecutive failures
      const penalty = Math.min(20, this.metrics.consecutiveFailures * 5);
      this.metrics.healthScore = Math.max(0, this.metrics.healthScore - penalty);
    }
    
    // Calculate overall error rate
    const errorRate = (this.metrics.failedChecks / this.metrics.totalChecks) * 100;
    
    // Adjust health score based on error rate
    if (errorRate > this.alertThresholds.errorRate) {
      this.metrics.healthScore = Math.max(0, this.metrics.healthScore - 10);
    }
  }

  /**
   * Add result to health history
   */
  addToHealthHistory(healthResult) {
    this.healthHistory.push(healthResult);
    
    // Keep only last 50 checks
    if (this.healthHistory.length > 50) {
      this.healthHistory = this.healthHistory.slice(-50);
    }
  }

  /**
   * Start continuous monitoring
   */
  startContinuousMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Run health checks every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health monitoring error:', error.message);
      }
    }, 10000);
    
    console.log('📊 Database health monitoring started');
  }

  /**
   * Stop continuous monitoring
   */
  stopContinuousMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('📊 Database health monitoring stopped');
  }

  /**
   * Setup connection pool event listeners
   */
  setupPoolEventListeners() {
    connectionPoolManager.on('connected', () => {
      console.log('✅ Database health: Connection established');
      this.isHealthy = true;
    });
    
    connectionPoolManager.on('connectionLost', () => {
      console.log('❌ Database health: Connection lost');
      this.isHealthy = false;
    });
    
    connectionPoolManager.on('poolAlert', (alert) => {
      console.log(`⚠️ Database health: Pool alert - ${alert.message}`);
      
      if (alert.level === 'critical') {
        this.metrics.healthScore = Math.max(0, this.metrics.healthScore - 20);
      }
    });
    
    connectionPoolManager.on('circuitBreakerOpen', () => {
      console.log('🔴 Database health: Circuit breaker opened');
      this.isHealthy = false;
      this.metrics.healthScore = 0;
    });
  }

  /**
   * Get connection state as human-readable string
   */
  getConnectionStateString() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return states[mongoose.connection.readyState] || 'unknown';
  }

  /**
   * Get detailed health status
   */
  getHealthStatus() {
    const recentChecks = this.healthHistory.slice(-10);
    const recentSuccessRate = recentChecks.length > 0 ? 
      (recentChecks.filter(check => check.healthy).length / recentChecks.length * 100) : 0;
    
    return {
      isHealthy: this.isHealthy,
      healthScore: this.metrics.healthScore,
      connectionState: this.getConnectionStateString(),
      metrics: {
        ...this.metrics,
        recentSuccessRate: recentSuccessRate.toFixed(1) + '%',
        averageResponseTime: Math.round(this.metrics.averageResponseTime),
        timeSinceLastSuccess: Date.now() - this.metrics.lastSuccessfulCheck
      },
      poolStatus: connectionPoolManager.getPoolStatus(),
      recentHistory: recentChecks.slice(-5) // Last 5 checks
    };
  }

  /**
   * Get health check trends
   */
  getHealthTrends() {
    const last24Hours = this.healthHistory.filter(
      check => Date.now() - check.timestamp < 24 * 60 * 60 * 1000
    );
    
    if (last24Hours.length === 0) {
      return { message: 'No data available' };
    }
    
    const successCount = last24Hours.filter(check => check.healthy).length;
    const successRate = (successCount / last24Hours.length * 100).toFixed(1);
    const averageResponseTime = last24Hours.reduce((sum, check) => sum + check.responseTime, 0) / last24Hours.length;
    
    return {
      period: '24 hours',
      totalChecks: last24Hours.length,
      successRate: successRate + '%',
      averageResponseTime: Math.round(averageResponseTime) + 'ms',
      trend: this.calculateTrend(last24Hours)
    };
  }

  /**
   * Calculate health trend
   */
  calculateTrend(checks) {
    if (checks.length < 10) return 'insufficient_data';
    
    const firstHalf = checks.slice(0, Math.floor(checks.length / 2));
    const secondHalf = checks.slice(Math.floor(checks.length / 2));
    
    const firstHalfSuccess = firstHalf.filter(check => check.healthy).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(check => check.healthy).length / secondHalf.length;
    
    const difference = secondHalfSuccess - firstHalfSuccess;
    
    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Database operation wrapper with health check
   */
  async withHealthCheck(operation, options = {}) {
    const { timeout = 5000, retries = 3 } = options;
    
    // Check if database is ready
    const readiness = await this.isDatabaseReady();
    
    if (!readiness.ready) {
      throw new Error(`Database not ready: ${readiness.reason}`);
    }
    
    // Execute operation with timeout
    return Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    console.log('🔄 Shutting down database health checker...');
    this.stopContinuousMonitoring();
    console.log('✅ Database health checker shutdown complete');
  }
}

/**
 * Express middleware for database health checking
 */
function databaseHealthMiddleware(options = {}) {
  const { 
    skipPaths = ['/api/health', '/api/status'],
    enableHealthHeaders = true,
    fastFail = true 
  } = options;
  
  return async (req, res, next) => {
    // Skip health check for certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    try {
      // Quick readiness check for high-performance operations
      const readiness = await databaseHealthChecker.isDatabaseReady();
      
      if (!readiness.ready) {
        if (fastFail) {
          return res.status(503).json({
            error: 'Database unavailable',
            reason: readiness.reason,
            retryAfter: readiness.retryAfter || 5000,
            timestamp: new Date().toISOString()
          });
        } else {
          // Log warning but continue (for non-critical operations)
          console.warn(`⚠️ Database health warning for ${req.path}: ${readiness.reason}`);
        }
      }
      
      // Add health information to response headers
      if (enableHealthHeaders && readiness.ready) {
        res.set({
          'X-DB-Health-Score': readiness.healthScore,
          'X-DB-Pool-Utilization': readiness.poolUtilization?.toFixed(1) || '0'
        });
      }
      
      // Add database health check wrapper to request
      req.dbHealthCheck = (operation, options) => 
        databaseHealthChecker.withHealthCheck(operation, options);
      
      next();
      
    } catch (error) {
      console.error('❌ Database health middleware error:', error.message);
      
      if (fastFail) {
        return res.status(503).json({
          error: 'Database health check failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    }
  };
}

// Export singleton instance
const databaseHealthChecker = new DatabaseHealthChecker();

module.exports = {
  databaseHealthChecker,
  DatabaseHealthChecker,
  databaseHealthMiddleware
};