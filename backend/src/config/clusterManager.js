// === backend/src/config/clusterManager.js ===
// Cluster Manager for SafeStreets Bangladesh
// Utilizes all CPU cores for handling 8000+ concurrent users

const cluster = require('cluster');
const os = require('os');
const { productionLogger } = require('../utils/productionLogger');

class ClusterManager {
  constructor() {
    this.numCPUs = os.cpus().length;
    this.workers = new Map();
    this.restartAttempts = new Map();
    this.maxRestartAttempts = 3;
    this.restartDelay = 5000; // 5 seconds
  }

  /**
   * Initialize cluster with optimized worker management
   */
  async initialize() {
    if (cluster.isMaster) {
      await this.setupMaster();
    } else {
      await this.setupWorker();
    }
  }

  /**
   * Master process setup
   */
  async setupMaster() {
    console.log(`🚀 Master ${process.pid} is running`);
    console.log(`💻 Spawning ${this.numCPUs} workers for ${os.totalmem() / 1024 / 1024 / 1024}GB RAM system`);

    // Fork workers for each CPU core
    for (let i = 0; i < this.numCPUs; i++) {
      this.forkWorker(i);
    }

    // Handle worker lifecycle events
    cluster.on('exit', (worker, code, signal) => {
      console.log(`❌ Worker ${worker.process.pid} died (${signal || code})`);
      this.handleWorkerDeath(worker);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown());
    process.on('SIGINT', () => this.gracefulShutdown());

    // Monitor system health
    this.startHealthMonitoring();

    // Load balancing optimization
    this.optimizeLoadBalancing();
  }

  /**
   * Fork a new worker with environment configuration
   */
  forkWorker(workerId) {
    const worker = cluster.fork({
      WORKER_ID: workerId,
      NODE_ENV: process.env.NODE_ENV,
      // Assign Redis DB based on worker ID for sharding
      REDIS_DB: workerId % 16
    });

    this.workers.set(worker.process.pid, {
      id: workerId,
      startTime: Date.now(),
      requests: 0,
      errors: 0
    });

    // Worker message handling
    worker.on('message', (msg) => {
      if (msg.cmd === 'notifyRequest') {
        this.workers.get(worker.process.pid).requests++;
      } else if (msg.cmd === 'notifyError') {
        this.workers.get(worker.process.pid).errors++;
      }
    });

    console.log(`✅ Worker ${workerId} (PID: ${worker.process.pid}) spawned`);
  }

  /**
   * Handle worker death and restart strategy
   */
  handleWorkerDeath(worker) {
    const workerInfo = this.workers.get(worker.process.pid);
    if (!workerInfo) return;

    const workerId = workerInfo.id;
    const attempts = this.restartAttempts.get(workerId) || 0;

    this.workers.delete(worker.process.pid);

    if (attempts < this.maxRestartAttempts) {
      this.restartAttempts.set(workerId, attempts + 1);
      
      setTimeout(() => {
        console.log(`🔄 Restarting worker ${workerId} (attempt ${attempts + 1}/${this.maxRestartAttempts})`);
        this.forkWorker(workerId);
      }, this.restartDelay);
    } else {
      console.error(`❌ Worker ${workerId} exceeded max restart attempts. Manual intervention required.`);
      productionLogger.error('Worker exceeded max restart attempts', {
        workerId,
        attempts: this.maxRestartAttempts
      });
    }
  }

  /**
   * Worker process setup
   */
  async setupWorker() {
    const workerId = process.env.WORKER_ID;
    console.log(`👷 Worker ${workerId} (PID: ${process.pid}) started`);

    // Import and start the Express server
    require('../../server');

    // Notify master of requests for load balancing
    process.on('message', (msg) => {
      if (msg.cmd === 'shutdown') {
        this.workerGracefulShutdown();
      }
    });

    // Monitor worker health
    this.monitorWorkerHealth();
  }

  /**
   * Health monitoring for master process
   */
  startHealthMonitoring() {
    setInterval(() => {
      const stats = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        workers: Array.from(this.workers.entries()).map(([pid, info]) => ({
          pid,
          ...info,
          uptime: Date.now() - info.startTime,
          requestsPerSecond: info.requests / ((Date.now() - info.startTime) / 1000)
        }))
      };

      // Log cluster health
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Cluster Health:', JSON.stringify(stats, null, 2));
      }

      // Check for unhealthy workers
      stats.workers.forEach(worker => {
        if (worker.errors > 100 || worker.requestsPerSecond < 1) {
          console.warn(`⚠️ Unhealthy worker detected: PID ${worker.pid}`);
        }
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Monitor individual worker health
   */
  monitorWorkerHealth() {
    let requestCount = 0;
    let errorCount = 0;

    setInterval(() => {
      // Send stats to master
      process.send({ 
        cmd: 'workerStats', 
        stats: {
          requests: requestCount,
          errors: errorCount,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      });

      // Reset counters
      requestCount = 0;
      errorCount = 0;
    }, 10000); // Every 10 seconds

    // Intercept requests and errors
    process.on('request', () => requestCount++);
    process.on('error', () => errorCount++);
  }

  /**
   * Optimize load balancing between workers
   */
  optimizeLoadBalancing() {
    // Enable scheduling policy for better distribution
    cluster.schedulingPolicy = cluster.SCHED_RR; // Round-robin

    // Custom load balancing based on worker stats
    setInterval(() => {
      const workerStats = Array.from(this.workers.entries())
        .map(([pid, info]) => ({
          pid,
          load: info.requests / ((Date.now() - info.startTime) / 1000),
          errors: info.errors
        }))
        .sort((a, b) => a.load - b.load);

      // Log load distribution
      if (process.env.NODE_ENV === 'development') {
        console.log('⚖️ Load Distribution:', workerStats);
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown for master
   */
  async gracefulShutdown() {
    console.log('🛑 Received shutdown signal, gracefully shutting down cluster...');

    // Signal all workers to shutdown
    for (const worker of Object.values(cluster.workers)) {
      worker.send({ cmd: 'shutdown' });
    }

    // Wait for workers to finish
    setTimeout(() => {
      process.exit(0);
    }, 10000); // 10 second grace period
  }

  /**
   * Graceful shutdown for worker
   */
  workerGracefulShutdown() {
    console.log(`🛑 Worker ${process.pid} shutting down gracefully...`);
    
    // Stop accepting new connections
    if (global.server) {
      global.server.close(() => {
        process.exit(0);
      });
    }

    // Force exit after timeout
    setTimeout(() => {
      console.error('❌ Worker forced shutdown');
      process.exit(1);
    }, 5000);
  }

  /**
   * Get cluster statistics
   */
  getStats() {
    if (!cluster.isMaster) {
      return { error: 'Stats only available on master process' };
    }

    return {
      workers: this.workers.size,
      totalRequests: Array.from(this.workers.values()).reduce((sum, w) => sum + w.requests, 0),
      totalErrors: Array.from(this.workers.values()).reduce((sum, w) => sum + w.errors, 0),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

// Export singleton instance
const clusterManager = new ClusterManager();

module.exports = {
  clusterManager,
  
  // Quick initialization function
  initializeCluster: async () => {
    return await clusterManager.initialize();
  }
};