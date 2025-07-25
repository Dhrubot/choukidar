// === backend/src/monitoring/healthChecks.js ===
// Comprehensive Health Monitoring for SafeStreets Bangladesh
// Monitors all critical systems for 8000+ user capacity

const mongoose = require('mongoose');
const { cacheLayer } = require('../middleware/cacheLayer');
const { redisCluster } = require('../config/redisCluster');
const { circuitBreakerManager } = require('../middleware/circuitBreaker');
const { replicationManager } = require('../services/replicationManager');
const os = require('os');
const { productionLogger } = require('../utils/productionLogger');

class HealthMonitor {
  constructor() {
    this.checks = new Map();
    this.history = [];
    this.maxHistorySize = 100;
    
    // Health thresholds
    this.thresholds = {
      cpu: 80, // CPU usage %
      memory: 85, // Memory usage %
      diskSpace: 90, // Disk usage %
      responseTime: 3000, // API response time ms
      errorRate: 5, // Error rate %
      queueDepth: 1000, // Max queue depth
      connectionPool: 90, // Connection pool usage %
      replicationLag: 5000 // Max replication lag ms
    };

    // Component weights for overall health score
    this.weights = {
      api: 0.25,
      database: 0.20,
      cache: 0.15,
      queue: 0.10,
      websocket: 0.10,
      system: 0.10,
      replication: 0.10
    };

    // Monitoring state
    this.monitoring = {
      isRunning: false,
      interval: null,
      checkInterval: 30000, // 30 seconds
      alertCooldown: new Map()
    };

    // Register default health checks
    this.registerDefaultChecks();
  }

  /**
   * Register all default health checks
   */
  registerDefaultChecks() {
    // API Health
    this.registerCheck('api', async () => {
      const startTime = Date.now();
      
      try {
        // Simple API test
        const response = await fetch('http://localhost:5000/api/health');
        const responseTime = Date.now() - startTime;
        
        return {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime,
          statusCode: response.status,
          details: {
            responseTime: `${responseTime}ms`,
            healthy: responseTime < this.thresholds.responseTime
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - startTime
        };
      }
    });

    // Database Health
    this.registerCheck('database', async () => {
      try {
        const startTime = Date.now();
        
        // Check MongoDB connection
        const mongoState = mongoose.connection.readyState;
        const isConnected = mongoState === 1;
        
        // Ping database
        let pingTime = null;
        if (isConnected) {
          await mongoose.connection.db.admin().ping();
          pingTime = Date.now() - startTime;
        }
        
        // Get connection pool stats
        const poolStats = this.getMongoPoolStats();
        
        // Check database size
        const dbStats = isConnected ? 
          await mongoose.connection.db.stats() : null;

        return {
          status: isConnected ? 'healthy' : 'unhealthy',
          connected: isConnected,
          pingTime,
          poolUtilization: poolStats.utilization,
          details: {
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoState],
            connections: poolStats,
            dataSize: dbStats ? this.formatBytes(dbStats.dataSize) : 'N/A',
            indexSize: dbStats ? this.formatBytes(dbStats.indexSize) : 'N/A'
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Cache Health
    this.registerCheck('cache', async () => {
      try {
        const health = await cacheLayer.healthCheck();
        const stats = cacheLayer.cacheStats;
        
        const hitRate = stats.hits > 0 ? 
          (stats.hits / (stats.hits + stats.misses) * 100) : 0;

        return {
          status: health.status === 'connected' ? 'healthy' : 'unhealthy',
          latency: parseInt(health.latency),
          hitRate: hitRate.toFixed(2) + '%',
          details: {
            ...health,
            operations: stats.hits + stats.misses + stats.sets + stats.deletes,
            efficiency: hitRate > 70 ? 'excellent' : hitRate > 50 ? 'good' : 'poor'
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    // Queue Health
    this.registerCheck('queue', async () => {
      try {
        const { queueService } = require('../services/queueService');
        const stats = await queueService.getQueueStats();
        
        const totalPending = Object.values(stats.queues)
          .reduce((sum, q) => sum + q.pending, 0);

        const isHealthy = totalPending < this.thresholds.queueDepth &&
                         stats.failedJobs < 100;

        return {
          status: isHealthy ? 'healthy' : 'degraded',
          totalPending,
          activeJobs: stats.activeJobs,
          failedJobs: stats.failedJobs,
          details: {
            processed: stats.processed,
            failed: stats.failed,
            avgProcessingTime: stats.avgProcessingTime.toFixed(2) + 'ms',
            queues: stats.queues
          }
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });

    // WebSocket Health
    this.registerCheck('websocket', async () => {
      try {
        const socketHandler = global.socketHandler;
        
        if (!socketHandler) {
          return {
            status: 'unhealthy',
            error: 'WebSocket handler not initialized'
          };
        }

        const health = await socketHandler.healthCheck();
        
        return {
          status: health.status,
          connections: health.localConnections,
          totalConnections: health.totalConnections,
          details: {
            metrics: health.metrics,
            uptime: this.formatUptime(health.uptime)
          }
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });

    // System Resources
    this.registerCheck('system', async () => {
      try {
        const cpuUsage = this.getCPUUsage();
        const memUsage = this.getMemoryUsage();
        const diskUsage = await this.getDiskUsage();
        
        const isHealthy = cpuUsage < this.thresholds.cpu &&
                         memUsage.percentage < this.thresholds.memory &&
                         diskUsage.percentage < this.thresholds.diskSpace;

        return {
          status: isHealthy ? 'healthy' : 'degraded',
          cpu: cpuUsage.toFixed(2) + '%',
          memory: memUsage.percentage.toFixed(2) + '%',
          disk: diskUsage.percentage.toFixed(2) + '%',
          details: {
            cpu: {
              cores: os.cpus().length,
              model: os.cpus()[0].model,
              usage: cpuUsage.toFixed(2) + '%'
            },
            memory: {
              total: this.formatBytes(memUsage.total),
              used: this.formatBytes(memUsage.used),
              free: this.formatBytes(memUsage.free)
            },
            disk: {
              total: this.formatBytes(diskUsage.total),
              used: this.formatBytes(diskUsage.used),
              free: this.formatBytes(diskUsage.free)
            },
            uptime: this.formatUptime(os.uptime() * 1000),
            loadAverage: os.loadavg()
          }
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });

    // Replication Health
    this.registerCheck('replication', async () => {
      try {
        const health = await replicationManager.healthCheck();
        const isHealthy = health.status === 'healthy' && 
                         health.secondaries >= 1;

        return {
          status: isHealthy ? 'healthy' : health.status,
          primary: health.primary,
          secondaries: health.secondaries,
          details: health.stats
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });

    // Circuit Breakers
    this.registerCheck('circuitBreakers', async () => {
      try {
        const health = circuitBreakerManager.getSystemHealth();
        
        return {
          status: health.status,
          score: health.score,
          openCircuits: health.openCircuits,
          details: health.circuits
        };
      } catch (error) {
        return {
          status: 'error',
          error: error.message
        };
      }
    });
  }

  /**
   * Register a custom health check
   */
  registerCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
    console.log(`✅ Health check registered: ${name}`);
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    const startTime = Date.now();

    // Run all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await checkFn();
        results[name] = {
          ...result,
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message,
          timestamp: new Date()
        };
      }
    });

    await Promise.all(checkPromises);

    // Calculate overall health
    const overall = this.calculateOverallHealth(results);
    
    // Store in history
    this.addToHistory({
      timestamp: new Date(),
      overall,
      checks: results
    });

    // Check for alerts
    this.checkForAlerts(results, overall);

    return {
      status: overall.status,
      score: overall.score,
      timestamp: new Date(),
      checks: results,
      summary: overall.summary
    };
  }

  /**
   * Calculate overall health score
   */
  calculateOverallHealth(results) {
    let totalScore = 0;
    let totalWeight = 0;
    const summary = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      error: 0
    };

    Object.entries(results).forEach(([component, result]) => {
      const weight = this.weights[component] || 0.1;
      totalWeight += weight;

      // Calculate component score
      let score = 0;
      switch (result.status) {
        case 'healthy':
          score = 100;
          summary.healthy++;
          break;
        case 'degraded':
          score = 50;
          summary.degraded++;
          break;
        case 'unhealthy':
          score = 25;
          summary.unhealthy++;
          break;
        case 'error':
          score = 0;
          summary.error++;
          break;
      }

      totalScore += score * weight;
    });

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    
    let status = 'healthy';
    if (overallScore < 50) status = 'critical';
    else if (overallScore < 70) status = 'unhealthy';
    else if (overallScore < 90) status = 'degraded';

    return {
      score: overallScore.toFixed(2),
      status,
      summary
    };
  }

  /**
   * Check for alerts
   */
  checkForAlerts(results, overall) {
    const now = Date.now();
    const cooldownPeriod = 300000; // 5 minutes

    // Check overall health
    if (overall.status === 'critical' || overall.status === 'unhealthy') {
      const lastAlert = this.monitoring.alertCooldown.get('overall');
      
      if (!lastAlert || now - lastAlert > cooldownPeriod) {
        this.sendAlert('overall', overall.status, {
          score: overall.score,
          summary: overall.summary
        });
        this.monitoring.alertCooldown.set('overall', now);
      }
    }

    // Check individual components
    Object.entries(results).forEach(([component, result]) => {
      if (result.status === 'unhealthy' || result.status === 'error') {
        const lastAlert = this.monitoring.alertCooldown.get(component);
        
        if (!lastAlert || now - lastAlert > cooldownPeriod) {
          this.sendAlert(component, result.status, result);
          this.monitoring.alertCooldown.set(component, now);
        }
      }
    });
  }

  /**
   * Send alert
   */
  sendAlert(component, status, details) {
    const alert = {
      component,
      status,
      details,
      timestamp: new Date(),
      severity: status === 'critical' ? 'critical' : 'high'
    };

    console.error(`🚨 HEALTH ALERT: ${component} is ${status}`, details);
    
    productionLogger.error('Health check alert', alert);

    // In production, send notifications via email/SMS/Slack
    // this.notificationService.sendAlert(alert);
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    if (this.monitoring.isRunning) {
      console.log('⚠️ Health monitoring already running');
      return;
    }

    this.monitoring.isRunning = true;
    
    // Run initial check
    this.runAllChecks().then(result => {
      console.log('🏥 Initial health check:', {
        status: result.status,
        score: result.score
      });
    });

    // Schedule periodic checks
    this.monitoring.interval = setInterval(async () => {
      await this.runAllChecks();
    }, this.monitoring.checkInterval);

    console.log('✅ Health monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoring.interval) {
      clearInterval(this.monitoring.interval);
      this.monitoring.interval = null;
    }
    
    this.monitoring.isRunning = false;
    console.log('🛑 Health monitoring stopped');
  }

  /**
   * Get health history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Add to history
   */
  addToHistory(entry) {
    this.history.push(entry);
    
    // Maintain max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Utility methods
   */
  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - ~~(100 * totalIdle / totalTick);
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total,
      free,
      used,
      percentage: (used / total) * 100
    };
  }

  async getDiskUsage() {
    // Simplified disk usage - in production use 'diskusage' npm package
    const total = 100 * 1024 * 1024 * 1024; // 100GB example
    const free = 30 * 1024 * 1024 * 1024; // 30GB example
    const used = total - free;

    return {
      total,
      free,
      used,
      percentage: (used / total) * 100
    };
  }

  getMongoPoolStats() {
    // Get MongoDB connection pool stats
    const topology = mongoose.connection.client?.topology;
    
    if (!topology || !topology.s || !topology.s.servers) {
      return { utilization: 0, active: 0, available: 0 };
    }

    const servers = Array.from(topology.s.servers.values());
    let totalConnections = 0;
    let availableConnections = 0;

    servers.forEach(server => {
      if (server.s && server.s.pool) {
        totalConnections += server.s.pool.totalConnectionCount || 0;
        availableConnections += server.s.pool.availableConnectionCount || 0;
      }
    });

    const maxPoolSize = 100; // From mongodbOptimizations.js
    const utilization = (totalConnections / maxPoolSize) * 100;

    return {
      utilization,
      active: totalConnections - availableConnections,
      available: availableConnections,
      total: totalConnections
    };
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Express endpoint handler
   */
  async getHealthEndpoint(req, res) {
    try {
      const health = await this.runAllChecks();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  }

  /**
   * Prometheus metrics endpoint
   */
  async getMetricsEndpoint(req, res) {
    try {
      const health = await this.runAllChecks();
      const metrics = [];

      // Overall health metric
      metrics.push(`# HELP safestreets_health_score Overall health score (0-100)`);
      metrics.push(`# TYPE safestreets_health_score gauge`);
      metrics.push(`safestreets_health_score ${health.score}`);

      // Component health metrics
      Object.entries(health.checks).forEach(([component, check]) => {
        const status = check.status === 'healthy' ? 1 : 0;
        metrics.push(`safestreets_component_health{component="${component}"} ${status}`);
        
        // Component-specific metrics
        if (component === 'api' && check.responseTime) {
          metrics.push(`safestreets_api_response_time_ms ${check.responseTime}`);
        }
        
        if (component === 'database' && check.pingTime) {
          metrics.push(`safestreets_db_ping_time_ms ${check.pingTime}`);
        }
        
        if (component === 'cache' && check.hitRate) {
          const rate = parseFloat(check.hitRate);
          metrics.push(`safestreets_cache_hit_rate ${rate}`);
        }
        
        if (component === 'system') {
          const cpu = parseFloat(check.cpu);
          const memory = parseFloat(check.memory);
          const disk = parseFloat(check.disk);
          
          metrics.push(`safestreets_cpu_usage_percent ${cpu}`);
          metrics.push(`safestreets_memory_usage_percent ${memory}`);
          metrics.push(`safestreets_disk_usage_percent ${disk}`);
        }
      });

      res.set('Content-Type', 'text/plain');
      res.send(metrics.join('\n'));

    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  }
}

// Export singleton instance
const healthMonitor = new HealthMonitor();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  healthMonitor.startMonitoring();
}

module.exports = {
  healthMonitor,
  
  // Express middleware
  healthCheckMiddleware: () => {
    return async (req, res) => {
      await healthMonitor.getHealthEndpoint(req, res);
    };
  },
  
  metricsMiddleware: () => {
    return async (req, res) => {
      await healthMonitor.getMetricsEndpoint(req, res);
    };
  },
  
  // Quick access methods
  runHealthCheck: () => healthMonitor.runAllChecks(),
  startMonitoring: () => healthMonitor.startMonitoring(),
  stopMonitoring: () => healthMonitor.stopMonitoring(),
  getHealthHistory: (limit) => healthMonitor.getHistory(limit),
  registerCustomCheck: (name, fn) => healthMonitor.registerCheck(name, fn)
};