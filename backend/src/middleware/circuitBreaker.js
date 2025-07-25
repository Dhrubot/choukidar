// === backend/src/middleware/circuitBreaker.js ===
// Circuit Breaker Pattern for SafeStreets Bangladesh
// Prevents cascading failures and provides graceful degradation

const { productionLogger } = require('../utils/productionLogger');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    
    // Configuration
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 10000, // 10 seconds
      timeout: options.timeout || 3000, // 3 seconds
      volumeThreshold: options.volumeThreshold || 10, // Minimum requests before opening
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      fallback: options.fallback || null
    };

    // Metrics
    this.metrics = {
      failures: 0,
      successes: 0,
      rejections: 0,
      fallbacks: 0,
      timeouts: 0,
      lastFailureTime: null,
      totalRequests: 0
    };

    // State management
    this.nextAttempt = Date.now();
    this.halfOpenRequests = 0;
    this.maxHalfOpenRequests = 3;

    // Rolling window for error rate calculation
    this.rollingWindow = [];
    this.windowSize = 20;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, fallbackFn = null) {
    // Check if circuit should be opened
    this.evaluateHealth();

    if (this.state === 'OPEN') {
      // Check if we should try half-open
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
        console.log(`⚡ Circuit breaker ${this.name} attempting recovery (HALF_OPEN)`);
      } else {
        // Circuit is open, use fallback or reject
        return this.handleOpen(fallbackFn);
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenRequests >= this.maxHalfOpenRequests) {
      // Too many half-open requests, reject
      return this.handleOpen(fallbackFn);
    }

    // Try to execute the function
    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenRequests++;
      }

      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure(error);
      
      // Use fallback if available
      if (fallbackFn || this.options.fallback) {
        this.metrics.fallbacks++;
        const fallback = fallbackFn || this.options.fallback;
        return typeof fallback === 'function' ? await fallback(error) : fallback;
      }
      
      throw error;
    } finally {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenRequests--;
      }
    }
  }

  /**
   * Execute function with timeout protection
   */
  async executeWithTimeout(fn) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.metrics.timeouts++;
        reject(new Error(`Circuit breaker ${this.name} timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        const result = await fn();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.metrics.successes++;
    this.metrics.totalRequests++;
    this.addToRollingWindow(true);

    if (this.state === 'HALF_OPEN') {
      // Success in half-open state, close the circuit
      this.state = 'CLOSED';
      this.metrics.failures = 0;
      console.log(`✅ Circuit breaker ${this.name} recovered (CLOSED)`);
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.metrics.failures++;
    this.metrics.totalRequests++;
    this.metrics.lastFailureTime = Date.now();
    this.addToRollingWindow(false);

    console.error(`❌ Circuit breaker ${this.name} failure:`, error.message);

    if (this.state === 'HALF_OPEN') {
      // Failure in half-open state, reopen the circuit
      this.open();
    } else if (this.state === 'CLOSED') {
      // Check if we should open the circuit
      if (this.shouldOpen()) {
        this.open();
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  open() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.options.resetTimeout;
    
    console.error(`🚨 Circuit breaker ${this.name} OPENED! Will retry at ${new Date(this.nextAttempt).toISOString()}`);
    
    // Log critical event
    productionLogger.error('Circuit breaker opened', {
      name: this.name,
      failures: this.metrics.failures,
      errorRate: this.getErrorRate(),
      nextAttempt: new Date(this.nextAttempt)
    });
  }

  /**
   * Handle requests when circuit is open
   */
  async handleOpen(fallbackFn) {
    this.metrics.rejections++;
    
    if (fallbackFn || this.options.fallback) {
      this.metrics.fallbacks++;
      const fallback = fallbackFn || this.options.fallback;
      return typeof fallback === 'function' ? await fallback() : fallback;
    }
    
    throw new Error(`Circuit breaker ${this.name} is OPEN - Service unavailable`);
  }

  /**
   * Check if circuit should be opened
   */
  shouldOpen() {
    // Not enough requests to make a decision
    if (this.metrics.totalRequests < this.options.volumeThreshold) {
      return false;
    }

    // Check failure count threshold
    if (this.metrics.failures >= this.options.failureThreshold) {
      return true;
    }

    // Check error rate
    const errorRate = this.getErrorRate();
    return errorRate >= this.options.errorThresholdPercentage;
  }

  /**
   * Evaluate circuit health
   */
  evaluateHealth() {
    // Clean old entries from rolling window
    const cutoff = Date.now() - this.options.monitoringPeriod;
    this.rollingWindow = this.rollingWindow.filter(entry => entry.timestamp > cutoff);

    // Re-evaluate if circuit should be opened
    if (this.state === 'CLOSED' && this.shouldOpen()) {
      this.open();
    }
  }

  /**
   * Add request result to rolling window
   */
  addToRollingWindow(success) {
    this.rollingWindow.push({
      success,
      timestamp: Date.now()
    });

    // Keep window size limited
    if (this.rollingWindow.length > this.windowSize) {
      this.rollingWindow.shift();
    }
  }

  /**
   * Calculate current error rate
   */
  getErrorRate() {
    if (this.rollingWindow.length === 0) return 0;
    
    const failures = this.rollingWindow.filter(entry => !entry.success).length;
    return (failures / this.rollingWindow.length) * 100;
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      metrics: {
        ...this.metrics,
        errorRate: this.getErrorRate().toFixed(2) + '%',
        uptime: this.state === 'CLOSED' ? 'Healthy' : 'Degraded'
      },
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null,
      rollingWindowSize: this.rollingWindow.length
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = 'CLOSED';
    this.metrics = {
      failures: 0,
      successes: 0,
      rejections: 0,
      fallbacks: 0,
      timeouts: 0,
      lastFailureTime: null,
      totalRequests: 0
    };
    this.rollingWindow = [];
    this.halfOpenRequests = 0;
    
    console.log(`🔄 Circuit breaker ${this.name} reset`);
  }
}

/**
 * Circuit Breaker Manager
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
    this.globalConfig = {
      enableMonitoring: true,
      alertThreshold: 3, // Number of open circuits before alerting
      healthCheckInterval: 30000 // 30 seconds
    };
  }

  /**
   * Create or get a circuit breaker
   */
  create(name, options = {}) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
      
      console.log(`🔌 Circuit breaker created: ${name}`);
    }
    
    return this.breakers.get(name);
  }

  /**
   * Wrap a function with circuit breaker protection
   */
  wrap(name, fn, options = {}) {
    const breaker = this.create(name, options);
    
    return async (...args) => {
      return breaker.execute(async () => fn(...args), options.fallback);
    };
  }

  /**
   * Express middleware factory
   */
  middleware(name, options = {}) {
    const breaker = this.create(name, options);
    
    return async (req, res, next) => {
      try {
        await breaker.execute(async () => next());
      } catch (error) {
        // Check if it's a circuit breaker rejection
        if (error.message.includes('is OPEN')) {
          res.status(503).json({
            success: false,
            message: 'Service temporarily unavailable',
            error: 'Circuit breaker is open',
            retryAfter: breaker.nextAttempt
          });
        } else {
          next(error);
        }
      }
    };
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses() {
    const statuses = {};
    
    for (const [name, breaker] of this.breakers) {
      statuses[name] = breaker.getStatus();
    }
    
    return statuses;
  }

  /**
   * Get system health based on circuit breakers
   */
  getSystemHealth() {
    const statuses = this.getAllStatuses();
    const openCircuits = Object.values(statuses).filter(s => s.state === 'OPEN').length;
    const totalCircuits = Object.keys(statuses).length;
    
    let health = 'healthy';
    let score = 100;
    
    if (openCircuits > 0) {
      score = ((totalCircuits - openCircuits) / totalCircuits) * 100;
      
      if (openCircuits >= this.globalConfig.alertThreshold) {
        health = 'critical';
      } else if (openCircuits > 0) {
        health = 'degraded';
      }
    }
    
    return {
      status: health,
      score: score.toFixed(2),
      openCircuits,
      totalCircuits,
      circuits: statuses
    };
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    if (!this.globalConfig.enableMonitoring) return;
    
    setInterval(() => {
      const health = this.getSystemHealth();
      
      if (health.status === 'critical') {
        console.error('🚨 CRITICAL: Multiple circuit breakers open!', {
          openCircuits: health.openCircuits,
          score: health.score
        });
        
        productionLogger.error('System critical - multiple circuit breakers open', health);
      } else if (health.status === 'degraded') {
        console.warn('⚠️ System degraded - circuit breakers open', {
          openCircuits: health.openCircuits
        });
      }
    }, this.globalConfig.healthCheckInterval);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const [name, breaker] of this.breakers) {
      breaker.reset();
    }
    
    console.log('🔄 All circuit breakers reset');
  }
}

// Create singleton manager
const circuitBreakerManager = new CircuitBreakerManager();

// Start monitoring
circuitBreakerManager.startMonitoring();

// Export manager and utilities
module.exports = {
  CircuitBreaker,
  circuitBreakerManager,
  
  // Quick access methods
  createBreaker: (name, options) => circuitBreakerManager.create(name, options),
  wrapFunction: (name, fn, options) => circuitBreakerManager.wrap(name, fn, options),
  breakerMiddleware: (name, options) => circuitBreakerManager.middleware(name, options),
  getHealth: () => circuitBreakerManager.getSystemHealth(),
  
  // Predefined circuit breakers for common services
  breakers: {
    database: () => circuitBreakerManager.create('mongodb', {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000,
      fallback: { success: false, message: 'Database temporarily unavailable' }
    }),
    
    redis: () => circuitBreakerManager.create('redis', {
      failureThreshold: 10,
      resetTimeout: 20000,
      timeout: 2000,
      fallback: null // Let requests through without cache
    }),
    
    emailService: () => circuitBreakerManager.create('email', {
      failureThreshold: 3,
      resetTimeout: 60000,
      timeout: 10000,
      fallback: async () => {
        console.log('📧 Email queued for later delivery');
        return { queued: true };
      }
    }),
    
    cloudinary: () => circuitBreakerManager.create('cloudinary', {
      failureThreshold: 5,
      resetTimeout: 45000,
      timeout: 15000,
      fallback: { url: '/images/placeholder.jpg' }
    }),
    
    websocket: () => circuitBreakerManager.create('websocket', {
      failureThreshold: 10,
      resetTimeout: 10000,
      timeout: 1000,
      fallback: () => {
        console.log('🔌 WebSocket event dropped');
        return { dropped: true };
      }
    })
  }
};