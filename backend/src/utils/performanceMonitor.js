// === backend/src/utils/performanceMonitor.js ===
// Production Performance Monitoring for SafeStreets Bangladesh
// Tracks database optimization, Redis caching, and API performance gains

const mongoose = require('mongoose');
const { cacheLayer } = require('../middleware/cacheLayer');

/**
 * Performance Monitoring System
 * Tracks: Database queries, cache performance, API response times, WebSocket metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      database: {
        queryCount: 0,
        avgQueryTime: 0,
        slowQueries: [],
        indexUsage: new Map(),
        optimizedQueries: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        patternInvalidations: 0
      },
      api: {
        totalRequests: 0,
        avgResponseTime: 0,
        routeMetrics: new Map(),
        errorRate: 0
      },
      websocket: {
        activeConnections: 0,
        messagesPerSecond: 0,
        scalingEvents: 0
      }
    };
    
    this.startTime = Date.now();
    this.isEnabled = process.env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true';
  }

  /**
   * Database Performance Tracking
   */
  trackDatabaseQuery(operation, collection, duration, wasOptimized = false) {
    if (!this.isEnabled) return;

    this.metrics.database.queryCount++;
    this.metrics.database.avgQueryTime = 
      (this.metrics.database.avgQueryTime + duration) / 2;

    if (wasOptimized) {
      this.metrics.database.optimizedQueries++;
    }

    // Track slow queries (>100ms)
    if (duration > 100) {
      this.metrics.database.slowQueries.push({
        operation,
        collection,
        duration,
        timestamp: new Date(),
        wasOptimized
      });

      // Keep only last 50 slow queries
      if (this.metrics.database.slowQueries.length > 50) {
        this.metrics.database.slowQueries.shift();
      }
    }

    // Track index usage
    const key = `${collection}.${operation}`;
    const current = this.metrics.database.indexUsage.get(key) || 0;
    this.metrics.database.indexUsage.set(key, current + 1);
  }

  /**
   * Cache Performance Tracking
   */
  trackCacheOperation(operation, key, duration, hit = false) {
    if (!this.isEnabled) return;

    if (operation === 'get') {
      if (hit) {
        this.metrics.cache.hits++;
      } else {
        this.metrics.cache.misses++;
      }
      
      const total = this.metrics.cache.hits + this.metrics.cache.misses;
      this.metrics.cache.hitRate = (this.metrics.cache.hits / total) * 100;
    }

    this.metrics.cache.avgResponseTime = 
      (this.metrics.cache.avgResponseTime + duration) / 2;
  }

  /**
   * API Performance Tracking
   */
  trackApiRequest(route, method, duration, statusCode) {
    if (!this.isEnabled) return;

    this.metrics.api.totalRequests++;
    this.metrics.api.avgResponseTime = 
      (this.metrics.api.avgResponseTime + duration) / 2;

    // Track per-route metrics
    const routeKey = `${method} ${route}`;
    const routeMetric = this.metrics.api.routeMetrics.get(routeKey) || {
      count: 0,
      avgDuration: 0,
      errors: 0
    };

    routeMetric.count++;
    routeMetric.avgDuration = (routeMetric.avgDuration + duration) / 2;
    
    if (statusCode >= 400) {
      routeMetric.errors++;
    }

    this.metrics.api.routeMetrics.set(routeKey, routeMetric);

    // Calculate error rate
    const totalErrors = Array.from(this.metrics.api.routeMetrics.values())
      .reduce((sum, metric) => sum + metric.errors, 0);
    this.metrics.api.errorRate = (totalErrors / this.metrics.api.totalRequests) * 100;
  }

  /**
   * WebSocket Performance Tracking
   */
  trackWebSocketEvent(event, data = {}) {
    if (!this.isEnabled) return;

    switch (event) {
      case 'connection':
        this.metrics.websocket.activeConnections++;
        break;
      case 'disconnect':
        this.metrics.websocket.activeConnections--;
        break;
      case 'message':
        this.metrics.websocket.messagesPerSecond++;
        break;
      case 'scaling':
        this.metrics.websocket.scalingEvents++;
        break;
    }
  }

  /**
   * Generate Performance Report
   */
  generateReport() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = uptime / (1000 * 60 * 60);

    return {
      timestamp: new Date().toISOString(),
      uptime: {
        milliseconds: uptime,
        hours: uptimeHours.toFixed(2)
      },
      database: {
        ...this.metrics.database,
        queriesPerHour: (this.metrics.database.queryCount / uptimeHours).toFixed(2),
        optimizationRate: (
          (this.metrics.database.optimizedQueries / this.metrics.database.queryCount) * 100
        ).toFixed(2) + '%',
        topSlowQueries: this.metrics.database.slowQueries
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
      },
      cache: {
        ...this.metrics.cache,
        hitRate: this.metrics.cache.hitRate.toFixed(2) + '%',
        efficiency: this.metrics.cache.hitRate > 70 ? 'Excellent' : 
                   this.metrics.cache.hitRate > 50 ? 'Good' : 'Needs Improvement'
      },
      api: {
        ...this.metrics.api,
        requestsPerHour: (this.metrics.api.totalRequests / uptimeHours).toFixed(2),
        errorRate: this.metrics.api.errorRate.toFixed(2) + '%',
        topRoutes: Array.from(this.metrics.api.routeMetrics.entries())
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 10)
          .map(([route, metrics]) => ({ route, ...metrics }))
      },
      websocket: {
        ...this.metrics.websocket,
        avgMessagesPerSecond: (this.metrics.websocket.messagesPerSecond / uptimeHours).toFixed(2)
      },
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate Performance Recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Database recommendations
    if (this.metrics.database.avgQueryTime > 50) {
      recommendations.push({
        category: 'Database',
        priority: 'High',
        message: 'Average query time is high. Consider adding more indexes or optimizing queries.',
        metric: `${this.metrics.database.avgQueryTime.toFixed(2)}ms avg`
      });
    }

    // Cache recommendations
    if (this.metrics.cache.hitRate < 70) {
      recommendations.push({
        category: 'Cache',
        priority: 'Medium',
        message: 'Cache hit rate is below optimal. Consider increasing TTL or improving cache keys.',
        metric: `${this.metrics.cache.hitRate.toFixed(2)}% hit rate`
      });
    }

    // API recommendations
    if (this.metrics.api.errorRate > 5) {
      recommendations.push({
        category: 'API',
        priority: 'High',
        message: 'Error rate is high. Check logs for recurring issues.',
        metric: `${this.metrics.api.errorRate.toFixed(2)}% error rate`
      });
    }

    // WebSocket recommendations
    if (this.metrics.websocket.activeConnections > 1000) {
      recommendations.push({
        category: 'WebSocket',
        priority: 'Medium',
        message: 'High connection count. Ensure Redis scaling is working properly.',
        metric: `${this.metrics.websocket.activeConnections} active connections`
      });
    }

    return recommendations;
  }

  /**
   * Export metrics for external monitoring tools
   */
  exportMetrics() {
    return {
      'safestreets.database.queries.total': this.metrics.database.queryCount,
      'safestreets.database.queries.avg_time': this.metrics.database.avgQueryTime,
      'safestreets.database.queries.optimized_rate': 
        (this.metrics.database.optimizedQueries / this.metrics.database.queryCount) * 100,
      'safestreets.cache.hit_rate': this.metrics.cache.hitRate,
      'safestreets.cache.avg_response_time': this.metrics.cache.avgResponseTime,
      'safestreets.api.requests.total': this.metrics.api.totalRequests,
      'safestreets.api.avg_response_time': this.metrics.api.avgResponseTime,
      'safestreets.api.error_rate': this.metrics.api.errorRate,
      'safestreets.websocket.active_connections': this.metrics.websocket.activeConnections,
      'safestreets.websocket.messages_per_second': this.metrics.websocket.messagesPerSecond
    };
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  reset() {
    this.metrics = {
      database: {
        queryCount: 0,
        avgQueryTime: 0,
        slowQueries: [],
        indexUsage: new Map(),
        optimizedQueries: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        patternInvalidations: 0
      },
      api: {
        totalRequests: 0,
        avgResponseTime: 0,
        routeMetrics: new Map(),
        errorRate: 0
      },
      websocket: {
        activeConnections: 0,
        messagesPerSecond: 0,
        scalingEvents: 0
      }
    };
    this.startTime = Date.now();
  }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  performanceMonitor
};
