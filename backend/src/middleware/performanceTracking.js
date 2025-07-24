// === backend/src/middleware/performanceTracking.js ===
// Performance Tracking Middleware for SafeStreets Bangladesh
// Automatically tracks API performance, database queries, and cache operations

const { performanceMonitor } = require('../utils/performanceMonitor');

/**
 * API Performance Tracking Middleware
 * Automatically tracks request duration and response codes
 */
const trackApiPerformance = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Track the API request
    performanceMonitor.trackApiRequest(
      req.route?.path || req.path,
      req.method,
      duration,
      res.statusCode
    );
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Database Query Tracking Wrapper
 * Wraps Mongoose queries to track performance
 */
const trackDatabaseQuery = (originalQuery, operation, collection) => {
  return function(...args) {
    const startTime = Date.now();
    
    // Execute original query
    const result = originalQuery.apply(this, args);
    
    // If it's a promise (most Mongoose operations)
    if (result && typeof result.then === 'function') {
      return result.then(data => {
        const duration = Date.now() - startTime;
        
        // Check if query used optimized indexes (simplified heuristic)
        const wasOptimized = duration < 50 || collection === 'optimized';
        
        performanceMonitor.trackDatabaseQuery(
          operation,
          collection,
          duration,
          wasOptimized
        );
        
        return data;
      }).catch(error => {
        const duration = Date.now() - startTime;
        performanceMonitor.trackDatabaseQuery(
          operation,
          collection,
          duration,
          false
        );
        throw error;
      });
    }
    
    // For synchronous operations
    const duration = Date.now() - startTime;
    performanceMonitor.trackDatabaseQuery(
      operation,
      collection,
      duration,
      duration < 50
    );
    
    return result;
  };
};

/**
 * Cache Operation Tracking Wrapper
 * Wraps cache operations to track performance
 */
const trackCacheOperation = (originalMethod, operation) => {
  return function(key, ...args) {
    const startTime = Date.now();
    
    // Execute original cache operation
    const result = originalMethod.apply(this, [key, ...args]);
    
    // If it's a promise
    if (result && typeof result.then === 'function') {
      return result.then(data => {
        const duration = Date.now() - startTime;
        const hit = operation === 'get' && data !== null && data !== undefined;
        
        performanceMonitor.trackCacheOperation(
          operation,
          key,
          duration,
          hit
        );
        
        return data;
      }).catch(error => {
        const duration = Date.now() - startTime;
        performanceMonitor.trackCacheOperation(
          operation,
          key,
          duration,
          false
        );
        throw error;
      });
    }
    
    // For synchronous operations
    const duration = Date.now() - startTime;
    const hit = operation === 'get' && result !== null && result !== undefined;
    
    performanceMonitor.trackCacheOperation(
      operation,
      key,
      duration,
      hit
    );
    
    return result;
  };
};

/**
 * Initialize Performance Tracking
 * Sets up automatic tracking for database and cache operations
 */
const initializePerformanceTracking = () => {
  // Only enable in production or when explicitly enabled
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MONITORING !== 'true') {
    console.log('📊 Performance monitoring disabled (development mode)');
    return;
  }

  console.log('📊 Initializing performance monitoring...');

  // Track Mongoose operations
  const mongoose = require('mongoose');
  if (mongoose.Query) {
    // Wrap common query methods
    const queryMethods = ['find', 'findOne', 'findById', 'aggregate', 'countDocuments', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'];
    
    queryMethods.forEach(method => {
      if (mongoose.Query.prototype[method]) {
        const original = mongoose.Query.prototype[method];
        mongoose.Query.prototype[method] = trackDatabaseQuery(original, method, 'query');
      }
    });
  }

  // Track cache operations if available
  try {
    const { cacheLayer } = require('../middleware/cacheLayer');
    
    if (cacheLayer && cacheLayer.get) {
      cacheLayer.get = trackCacheOperation(cacheLayer.get.bind(cacheLayer), 'get');
      cacheLayer.set = trackCacheOperation(cacheLayer.set.bind(cacheLayer), 'set');
      cacheLayer.delete = trackCacheOperation(cacheLayer.delete.bind(cacheLayer), 'delete');
    }
  } catch (error) {
    console.warn('⚠️ Could not initialize cache tracking:', error.message);
  }

  console.log('✅ Performance monitoring initialized');
};

/**
 * Performance Summary Middleware
 * Adds performance headers to responses
 */
const addPerformanceHeaders = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' || process.env.SHOW_PERFORMANCE_HEADERS === 'true') {
    const report = performanceMonitor.generateReport();
    
    // Add null checks to prevent toFixed() errors
    const dbQueries = report.database?.queryCount || 0;
    const cacheHitRate = typeof report.cache?.hitRateNumeric === 'number' ? report.cache.hitRateNumeric : 0;
    const avgResponseTime = typeof report.api?.avgResponseTime === 'number' ? report.api.avgResponseTime : 0;
    
    res.setHeader('X-DB-Queries', dbQueries);
    res.setHeader('X-Cache-Hit-Rate', cacheHitRate.toFixed(2) + '%');
    res.setHeader('X-Avg-Response-Time', avgResponseTime.toFixed(2) + 'ms');
  }
  
  next();
};

/**
 * WebSocket Performance Tracking
 * Tracks WebSocket events for scaling metrics
 */
const trackWebSocketEvent = (event, data = {}) => {
  performanceMonitor.trackWebSocketEvent(event, data);
};

module.exports = {
  trackApiPerformance,
  trackDatabaseQuery,
  trackCacheOperation,
  initializePerformanceTracking,
  addPerformanceHeaders,
  trackWebSocketEvent
};
