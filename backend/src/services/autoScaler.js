// === backend/src/services/autoScaler.js ===
// Dynamic Auto-Scaling for SafeStreets Bangladesh
// Automatically scales resources based on load

const { healthMonitor } = require('../monitoring/healthChecks');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { productionLogger } = require('../utils/productionLogger');

class AutoScaler {
  constructor() {
    // Scaling configuration
    this.config = {
      enabled: process.env.AUTO_SCALING_ENABLED === 'true',
      provider: process.env.SCALING_PROVIDER || 'docker', // docker, kubernetes, aws
      
      // Instance limits
      minInstances: parseInt(process.env.MIN_INSTANCES) || 2,
      maxInstances: parseInt(process.env.MAX_INSTANCES) || 10,
      
      // Scaling thresholds
      scaleUpThreshold: {
        cpu: 70,
        memory: 75,
        responseTime: 2000,
        queueDepth: 500,
        errorRate: 10
      },
      
      scaleDownThreshold: {
        cpu: 30,
        memory: 40,
        responseTime: 500,
        queueDepth: 100,
        errorRate: 1
      },
      
      // Timing configuration
      scaleUpCooldown: 180000, // 3 minutes
      scaleDownCooldown: 300000, // 5 minutes
      evaluationPeriod: 60000, // 1 minute
      consecutiveChecks: 3 // Number of checks before scaling
    };

    // Current state
    this.state = {
      currentInstances: 4, // Starting with 4 instances
      lastScaleUp: 0,
      lastScaleDown: 0,
      isScaling: false,
      consecutiveHighLoad: 0,
      consecutiveLowLoad: 0
    };

    // Metrics history
    this.metricsHistory = [];
    this.maxHistorySize = 20;

    // Scaling strategies
    this.strategies = {
      aggressive: {
        scaleUpIncrement: 2,
        scaleDownIncrement: 1,
        evaluationWindow: 3
      },
      moderate: {
        scaleUpIncrement: 1,
        scaleDownIncrement: 1,
        evaluationWindow: 5
      },
      conservative: {
        scaleUpIncrement: 1,
        scaleDownIncrement: 1,
        evaluationWindow: 10
      }
    };

    this.currentStrategy = 'moderate';

    // Statistics
    this.stats = {
      scaleUpEvents: 0,
      scaleDownEvents: 0,
      failedScalingAttempts: 0,
      totalInstanceHours: 0
    };
  }

  /**
   * Initialize auto-scaler
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('⚠️ Auto-scaling is disabled');
      return;
    }

    console.log('🚀 Initializing auto-scaler...');

    try {
      // Detect current instance count
      await this.detectCurrentInstances();

      // Start monitoring
      this.startMonitoring();

      console.log('✅ Auto-scaler initialized');
      console.log(`📊 Current instances: ${this.state.currentInstances}`);
      console.log(`📈 Scaling range: ${this.config.minInstances} - ${this.config.maxInstances}`);

    } catch (error) {
      console.error('❌ Auto-scaler initialization failed:', error);
    }
  }

  /**
   * Detect current running instances
   */
  async detectCurrentInstances() {
    try {
      switch (this.config.provider) {
        case 'docker':
          return await this.detectDockerInstances();
        case 'kubernetes':
          return await this.detectKubernetesInstances();
        case 'aws':
          return await this.detectAWSInstances();
        default:
          this.state.currentInstances = this.config.minInstances;
      }
    } catch (error) {
      console.error('❌ Error detecting instances:', error);
      this.state.currentInstances = this.config.minInstances;
    }
  }

  /**
   * Detect Docker instances
   */
  async detectDockerInstances() {
    try {
      const { stdout } = await execAsync('docker ps --filter "name=safestreets-app" --format "{{.Names}}" | wc -l');
      this.state.currentInstances = parseInt(stdout.trim()) || this.config.minInstances;
    } catch (error) {
      console.error('❌ Error detecting Docker instances:', error);
    }
  }

  /**
   * Start monitoring for auto-scaling
   */
  startMonitoring() {
    // Collect metrics periodically
    setInterval(async () => {
      await this.collectMetrics();
    }, this.config.evaluationPeriod);

    console.log('✅ Auto-scaling monitoring started');
  }

  /**
   * Collect system metrics
   */
  async collectMetrics() {
    try {
      // Get health metrics
      const health = await healthMonitor.runAllChecks();
      
      // Extract relevant metrics
      const metrics = {
        timestamp: Date.now(),
        cpu: this.extractCPU(health),
        memory: this.extractMemory(health),
        responseTime: this.extractResponseTime(health),
        queueDepth: this.extractQueueDepth(health),
        errorRate: this.extractErrorRate(health),
        overallScore: parseFloat(health.score)
      };

      // Add to history
      this.addToHistory(metrics);

      // Evaluate scaling needs
      await this.evaluateScaling(metrics);

    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
    }
  }

  /**
   * Extract metrics from health check
   */
  extractCPU(health) {
    const cpu = health.checks.system?.cpu;
    return cpu ? parseFloat(cpu) : 0;
  }

  extractMemory(health) {
    const memory = health.checks.system?.memory;
    return memory ? parseFloat(memory) : 0;
  }

  extractResponseTime(health) {
    return health.checks.api?.responseTime || 0;
  }

  extractQueueDepth(health) {
    return health.checks.queue?.totalPending || 0;
  }

  extractErrorRate(health) {
    // Calculate from recent history
    const recentErrors = this.metricsHistory.slice(-5)
      .reduce((sum, m) => sum + (m.errorRate || 0), 0);
    return recentErrors / Math.min(this.metricsHistory.length, 5);
  }

  /**
   * Evaluate if scaling is needed
   */
  async evaluateScaling(currentMetrics) {
    if (this.state.isScaling) {
      console.log('⏳ Scaling operation in progress, skipping evaluation');
      return;
    }

    const now = Date.now();
    
    // Check if we need to scale up
    if (this.shouldScaleUp(currentMetrics)) {
      this.state.consecutiveHighLoad++;
      this.state.consecutiveLowLoad = 0;

      if (this.state.consecutiveHighLoad >= this.config.consecutiveChecks) {
        if (now - this.state.lastScaleUp > this.config.scaleUpCooldown) {
          await this.scaleUp();
        } else {
          console.log('⏳ Scale up cooldown period active');
        }
      }
    }
    // Check if we need to scale down
    else if (this.shouldScaleDown(currentMetrics)) {
      this.state.consecutiveLowLoad++;
      this.state.consecutiveHighLoad = 0;

      if (this.state.consecutiveLowLoad >= this.config.consecutiveChecks) {
        if (now - this.state.lastScaleDown > this.config.scaleDownCooldown) {
          await this.scaleDown();
        } else {
          console.log('⏳ Scale down cooldown period active');
        }
      }
    }
    // Reset counters if metrics are normal
    else {
      this.state.consecutiveHighLoad = 0;
      this.state.consecutiveLowLoad = 0;
    }
  }

  /**
   * Check if we should scale up
   */
  shouldScaleUp(metrics) {
    const thresholds = this.config.scaleUpThreshold;
    
    return (
      metrics.cpu > thresholds.cpu ||
      metrics.memory > thresholds.memory ||
      metrics.responseTime > thresholds.responseTime ||
      metrics.queueDepth > thresholds.queueDepth ||
      metrics.errorRate > thresholds.errorRate
    ) && this.state.currentInstances < this.config.maxInstances;
  }

  /**
   * Check if we should scale down
   */
  shouldScaleDown(metrics) {
    const thresholds = this.config.scaleDownThreshold;
    
    return (
      metrics.cpu < thresholds.cpu &&
      metrics.memory < thresholds.memory &&
      metrics.responseTime < thresholds.responseTime &&
      metrics.queueDepth < thresholds.queueDepth &&
      metrics.errorRate < thresholds.errorRate
    ) && this.state.currentInstances > this.config.minInstances;
  }

  /**
   * Scale up instances
   */
  async scaleUp() {
    const strategy = this.strategies[this.currentStrategy];
    const increment = Math.min(
      strategy.scaleUpIncrement,
      this.config.maxInstances - this.state.currentInstances
    );

    if (increment <= 0) {
      console.log('⚠️ Already at maximum instances');
      return;
    }

    console.log(`📈 Scaling up by ${increment} instance(s)...`);
    this.state.isScaling = true;

    try {
      await this.performScaleUp(increment);
      
      this.state.currentInstances += increment;
      this.state.lastScaleUp = Date.now();
      this.state.consecutiveHighLoad = 0;
      this.stats.scaleUpEvents++;

      console.log(`✅ Scaled up to ${this.state.currentInstances} instances`);
      
      productionLogger.info('Auto-scaling: scaled up', {
        previousInstances: this.state.currentInstances - increment,
        currentInstances: this.state.currentInstances,
        increment
      });

    } catch (error) {
      console.error('❌ Scale up failed:', error);
      this.stats.failedScalingAttempts++;
      
      productionLogger.error('Auto-scaling: scale up failed', {
        error: error.message,
        targetInstances: this.state.currentInstances + increment
      });
    } finally {
      this.state.isScaling = false;
    }
  }

  /**
   * Scale down instances
   */
  async scaleDown() {
    const strategy = this.strategies[this.currentStrategy];
    const decrement = Math.min(
      strategy.scaleDownIncrement,
      this.state.currentInstances - this.config.minInstances
    );

    if (decrement <= 0) {
      console.log('⚠️ Already at minimum instances');
      return;
    }

    console.log(`📉 Scaling down by ${decrement} instance(s)...`);
    this.state.isScaling = true;

    try {
      await this.performScaleDown(decrement);
      
      this.state.currentInstances -= decrement;
      this.state.lastScaleDown = Date.now();
      this.state.consecutiveLowLoad = 0;
      this.stats.scaleDownEvents++;

      console.log(`✅ Scaled down to ${this.state.currentInstances} instances`);
      
      productionLogger.info('Auto-scaling: scaled down', {
        previousInstances: this.state.currentInstances + decrement,
        currentInstances: this.state.currentInstances,
        decrement
      });

    } catch (error) {
      console.error('❌ Scale down failed:', error);
      this.stats.failedScalingAttempts++;
      
      productionLogger.error('Auto-scaling: scale down failed', {
        error: error.message,
        targetInstances: this.state.currentInstances - decrement
      });
    } finally {
      this.state.isScaling = false;
    }
  }

  /**
   * Perform scale up based on provider
   */
  async performScaleUp(count) {
    switch (this.config.provider) {
      case 'docker':
        return await this.scaleUpDocker(count);
      case 'kubernetes':
        return await this.scaleUpKubernetes(count);
      case 'aws':
        return await this.scaleUpAWS(count);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Perform scale down based on provider
   */
  async performScaleDown(count) {
    switch (this.config.provider) {
      case 'docker':
        return await this.scaleDownDocker(count);
      case 'kubernetes':
        return await this.scaleDownKubernetes(count);
      case 'aws':
        return await this.scaleDownAWS(count);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Docker scaling implementation
   */
  async scaleUpDocker(count) {
    const currentCount = this.state.currentInstances;
    
    for (let i = 0; i < count; i++) {
      const instanceId = currentCount + i + 1;
      const port = 5000 + instanceId;
      
      const command = `docker run -d \
        --name safestreets-app${instanceId} \
        --network safestreets-network \
        -e NODE_ENV=production \
        -e SERVER_ID=app${instanceId} \
        -e PORT=${port} \
        -e WORKER_ID=${instanceId} \
        -e MONGODB_URI="${process.env.MONGODB_URI}" \
        -e REDIS_URL="${process.env.REDIS_URL}" \
        safestreets-backend:latest`;

      await execAsync(command);
      
      // Update nginx upstream
      await this.updateNginxUpstream('add', `app${instanceId}:${port}`);
    }
  }

  async scaleDownDocker(count) {
    const currentCount = this.state.currentInstances;
    
    for (let i = 0; i < count; i++) {
      const instanceId = currentCount - i;
      
      // Gracefully stop container
      await execAsync(`docker stop safestreets-app${instanceId} --time 30`);
      await execAsync(`docker rm safestreets-app${instanceId}`);
      
      // Update nginx upstream
      await this.updateNginxUpstream('remove', `app${instanceId}:${5000 + instanceId}`);
    }
  }

  /**
   * Update Nginx upstream configuration
   */
  async updateNginxUpstream(action, server) {
    // In production, this would update nginx config and reload
    console.log(`📝 Nginx upstream ${action}: ${server}`);
    
    try {
      // Reload nginx configuration
      await execAsync('docker exec safestreets-lb nginx -s reload');
    } catch (error) {
      console.error('❌ Error updating nginx:', error);
    }
  }

  /**
   * Add metrics to history
   */
  addToHistory(metrics) {
    this.metricsHistory.push(metrics);
    
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Get scaling statistics
   */
  getStats() {
    const uptimeHours = (Date.now() - (this.stats.startTime || Date.now())) / 3600000;
    const avgInstances = this.metricsHistory.length > 0
      ? this.metricsHistory.reduce((sum, m) => sum + (m.instances || this.state.currentInstances), 0) / this.metricsHistory.length
      : this.state.currentInstances;

    return {
      ...this.stats,
      currentInstances: this.state.currentInstances,
      instanceRange: `${this.config.minInstances} - ${this.config.maxInstances}`,
      avgInstances: avgInstances.toFixed(2),
      totalInstanceHours: (avgInstances * uptimeHours).toFixed(2),
      scalingStrategy: this.currentStrategy,
      isScaling: this.state.isScaling,
      lastScaleUp: this.state.lastScaleUp ? new Date(this.state.lastScaleUp) : null,
      lastScaleDown: this.state.lastScaleDown ? new Date(this.state.lastScaleDown) : null
    };
  }

  /**
   * Manual scaling controls
   */
  async manualScale(targetInstances) {
    if (targetInstances < this.config.minInstances || targetInstances > this.config.maxInstances) {
      throw new Error(`Target instances must be between ${this.config.minInstances} and ${this.config.maxInstances}`);
    }

    const difference = targetInstances - this.state.currentInstances;
    
    if (difference > 0) {
      await this.performScaleUp(difference);
      this.state.currentInstances = targetInstances;
    } else if (difference < 0) {
      await this.performScaleDown(Math.abs(difference));
      this.state.currentInstances = targetInstances;
    }

    return {
      success: true,
      currentInstances: this.state.currentInstances
    };
  }

  /**
   * Change scaling strategy
   */
  setStrategy(strategy) {
    if (!this.strategies[strategy]) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }

    this.currentStrategy = strategy;
    console.log(`📊 Scaling strategy changed to: ${strategy}`);
  }
}

// Export singleton instance
const autoScaler = new AutoScaler();

module.exports = {
  autoScaler,
  
  // Quick access methods
  initializeAutoScaling: () => autoScaler.initialize(),
  getScalingStats: () => autoScaler.getStats(),
  manualScale: (instances) => autoScaler.manualScale(instances),
  setScalingStrategy: (strategy) => autoScaler.setStrategy(strategy),
  
  // Constants
  SCALING_STRATEGIES: ['aggressive', 'moderate', 'conservative']
};