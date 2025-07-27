// === src/utils/connectionRecovery.js ===
// CRITICAL FIX: Automatic Connection Recovery System
// Handles connection drops and automatic reconnection during high load
// Prevents cascading failures and maintains system stability

const mongoose = require('mongoose');
const EventEmitter = require('events');
const { connectionPoolManager } = require('../config/connectionPoolManager');
const { databaseHealthChecker } = require('../middleware/databaseHealthChecker');

class ConnectionRecoveryManager extends EventEmitter {
  constructor() {
    super();
    
    this.isRecovering = false;
    this.recoveryAttempts = 0;
    this.maxRecoveryAttempts = 10;
    this.recoveryDelay = 2000; // Start with 2 seconds
    this.maxRecoveryDelay = 60000; // Cap at 1 minute
    
    // Recovery statistics
    this.stats = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      longestDowntime: 0,
      currentDowntimeStart: null,
      averageRecoveryTime: 0,
      lastRecoveryTime: null
    };
    
    // Connection monitoring
    this.connectionHistory = [];
    this.maxHistorySize = 100;
    this.monitoringInterval = null;
    this.isMonitoring = false;
    
    // Recovery strategies
    this.recoveryStrategies = [
      'simple_reconnect',
      'pool_reset',
      'full_restart',
      'graceful_degradation'
    ];
    this.currentStrategyIndex = 0;
    
    // Alerting system
    this.alertThresholds = {
      maxDowntime: 30000,      // 30 seconds
      maxFailedAttempts: 5,
      criticalDowntime: 120000  // 2 minutes
    };
    
    this.setupEventListeners();
  }

  /**
   * Initialize connection recovery manager
   */
  initialize() {
    console.log('🛡️ Initializing connection recovery manager...');
    
    this.startConnectionMonitoring();
    this.setupRecoveryTriggers();
    
    console.log('✅ Connection recovery manager initialized');
  }

  /**
   * Setup event listeners for connection monitoring
   */
  setupEventListeners() {
    // Listen to connection pool events
    connectionPoolManager.on('connectionLost', () => {
      this.handleConnectionLoss();
    });
    
    connectionPoolManager.on('connectionError', (error) => {
      this.handleConnectionError(error);
    });
    
    connectionPoolManager.on('circuitBreakerOpen', () => {
      this.handleCircuitBreakerOpen();
    });
    
    // Listen to mongoose events
    mongoose.connection.on('disconnected', () => {
      this.handleMongooseDisconnect();
    });
    
    mongoose.connection.on('error', (error) => {
      this.handleMongooseError(error);
    });
    
    mongoose.connection.on('reconnected', () => {
      this.handleSuccessfulReconnection();
    });
  }

  /**
   * Start continuous connection monitoring
   */
  startConnectionMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(async () => {
      await this.performConnectionHealthCheck();
    }, 5000); // Check every 5 seconds
    
    console.log('📊 Connection monitoring started');
  }

  /**
   * Perform connection health check
   */
  async performConnectionHealthCheck() {
    try {
      const healthStatus = await databaseHealthChecker.performHealthCheck();
      
      // Add to history
      this.addToConnectionHistory({
        timestamp: Date.now(),
        healthy: healthStatus.healthy,
        responseTime: healthStatus.responseTime,
        connectionState: mongoose.connection.readyState
      });
      
      // Check if recovery is needed
      if (!healthStatus.healthy && !this.isRecovering) {
        console.log('⚠️ Connection health check failed - triggering recovery');
        await this.triggerRecovery('health_check_failure');
      }
      
    } catch (error) {
      console.error('❌ Connection health check error:', error.message);
      
      if (!this.isRecovering) {
        await this.triggerRecovery('health_check_error');
      }
    }
  }

  /**
   * Add entry to connection history
   */
  addToConnectionHistory(entry) {
    this.connectionHistory.push(entry);
    
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Handle connection loss
   */
  async handleConnectionLoss() {
    console.log('📡 Connection lost detected');
    
    this.stats.currentDowntimeStart = Date.now();
    this.emit('connectionLost', { timestamp: Date.now() });
    
    if (!this.isRecovering) {
      await this.triggerRecovery('connection_lost');
    }
  }

  /**
   * Handle connection errors
   */
  async handleConnectionError(error) {
    console.error('📡 Connection error detected:', error.message);
    
    if (!this.isRecovering) {
      await this.triggerRecovery('connection_error', error);
    }
  }

  /**
   * Handle circuit breaker opening
   */
  async handleCircuitBreakerOpen() {
    console.log('🔴 Circuit breaker opened - initiating recovery');
    
    if (!this.isRecovering) {
      await this.triggerRecovery('circuit_breaker_open');
    }
  }

  /**
   * Handle mongoose disconnect
   */
  async handleMongooseDisconnect() {
    console.log('📡 Mongoose disconnected');
    
    if (!this.isRecovering) {
      await this.triggerRecovery('mongoose_disconnect');
    }
  }

  /**
   * Handle mongoose errors
   */
  async handleMongooseError(error) {
    console.error('📡 Mongoose error:', error.message);
    
    if (!this.isRecovering) {
      await this.triggerRecovery('mongoose_error', error);
    }
  }

  /**
   * Handle successful reconnection
   */
  handleSuccessfulReconnection() {
    console.log('✅ Connection successfully recovered');
    
    if (this.stats.currentDowntimeStart) {
      const downtime = Date.now() - this.stats.currentDowntimeStart;
      this.stats.longestDowntime = Math.max(this.stats.longestDowntime, downtime);
      this.stats.currentDowntimeStart = null;
      
      console.log(`📊 Downtime: ${downtime}ms`);
    }
    
    this.isRecovering = false;
    this.recoveryAttempts = 0;
    this.currentStrategyIndex = 0;
    this.stats.successfulRecoveries++;
    this.stats.lastRecoveryTime = Date.now();
    
    this.emit('connectionRecovered', { 
      timestamp: Date.now(),
      recoveryAttempts: this.recoveryAttempts
    });
  }

  /**
   * Trigger recovery process
   */
  async triggerRecovery(reason, error = null) {
    if (this.isRecovering) {
      console.log('🔄 Recovery already in progress, skipping trigger');
      return;
    }
    
    console.log(`🔄 Triggering connection recovery due to: ${reason}`);
    
    this.isRecovering = true;
    this.stats.totalRecoveries++;
    
    const recoveryStartTime = Date.now();
    
    try {
      await this.executeRecoveryStrategy(reason, error);
      
      const recoveryTime = Date.now() - recoveryStartTime;
      this.updateAverageRecoveryTime(recoveryTime);
      
    } catch (recoveryError) {
      console.error('❌ Recovery process failed:', recoveryError.message);
      this.stats.failedRecoveries++;
      
      // Check if we should alert
      await this.checkAlertThresholds();
      
      this.isRecovering = false;
    }
  }

  /**
   * Execute recovery strategy
   */
  async executeRecoveryStrategy(reason, originalError) {
    const maxAttempts = this.maxRecoveryAttempts;
    
    while (this.recoveryAttempts < maxAttempts && this.isRecovering) {
      this.recoveryAttempts++;
      
      const strategy = this.getCurrentStrategy();
      console.log(`🔧 Recovery attempt ${this.recoveryAttempts}/${maxAttempts} using strategy: ${strategy}`);
      
      try {
        const success = await this.executeStrategy(strategy, reason, originalError);
        
        if (success) {
          console.log('✅ Recovery strategy succeeded');
          return;
        } else {
          console.log('⚠️ Recovery strategy failed, trying next');
          this.moveToNextStrategy();
        }
        
      } catch (error) {
        console.error(`❌ Recovery strategy ${strategy} failed:`, error.message);
        this.moveToNextStrategy();
      }
      
      // Wait before next attempt
      const delay = this.calculateRecoveryDelay();
      console.log(`⏳ Waiting ${delay}ms before next recovery attempt...`);
      await this.sleep(delay);
    }
    
    // All recovery attempts failed
    console.error('❌ All recovery attempts failed');
    await this.handleRecoveryFailure(reason, originalError);
  }

  /**
   * Get current recovery strategy
   */
  getCurrentStrategy() {
    return this.recoveryStrategies[this.currentStrategyIndex];
  }

  /**
   * Move to next recovery strategy
   */
  moveToNextStrategy() {
    this.currentStrategyIndex = (this.currentStrategyIndex + 1) % this.recoveryStrategies.length;
  }

  /**
   * Execute specific recovery strategy
   */
  async executeStrategy(strategy, reason, originalError) {
    switch (strategy) {
      case 'simple_reconnect':
        return await this.simpleReconnect();
        
      case 'pool_reset':
        return await this.resetConnectionPool();
        
      case 'full_restart':
        return await this.fullConnectionRestart();
        
      case 'graceful_degradation':
        return await this.enableGracefulDegradation();
        
      default:
        console.error(`❌ Unknown recovery strategy: ${strategy}`);
        return false;
    }
  }

  /**
   * Simple reconnect strategy
   */
  async simpleReconnect() {
    try {
      console.log('🔌 Attempting simple reconnect...');
      
      // Check if already connected
      if (mongoose.connection.readyState === 1) {
        console.log('✅ Already connected');
        return true;
      }
      
      // Try to reconnect
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        await this.sleep(1000);
      }
      
      await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 150,
        minPoolSize: 20,
        socketTimeoutMS: 30000,
        serverSelectionTimeoutMS: 3000
      });
      
      // Verify connection
      await mongoose.connection.db.admin().ping();
      
      console.log('✅ Simple reconnect successful');
      return true;
      
    } catch (error) {
      console.error('❌ Simple reconnect failed:', error.message);
      return false;
    }
  }

  /**
   * Reset connection pool strategy
   */
  async resetConnectionPool() {
    try {
      console.log('🔄 Resetting connection pool...');
      
      // Use connection pool manager to reset
      await connectionPoolManager.shutdown();
      await this.sleep(2000);
      
      await connectionPoolManager.initialize(process.env.MONGODB_URI);
      
      // Verify connection
      const healthStatus = await databaseHealthChecker.performHealthCheck();
      
      if (healthStatus.healthy) {
        console.log('✅ Connection pool reset successful');
        return true;
      } else {
        console.log('❌ Connection pool reset failed health check');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Connection pool reset failed:', error.message);
      return false;
    }
  }

  /**
   * Full connection restart strategy
   */
  async fullConnectionRestart() {
    try {
      console.log('🔄 Performing full connection restart...');
      
      // Close all connections
      await this.closeAllConnections();
      await this.sleep(5000);
      
      // Reinitialize everything
      await connectionPoolManager.initialize(process.env.MONGODB_URI);
      await databaseHealthChecker.initialize();
      
      // Verify connection
      const healthStatus = await databaseHealthChecker.performHealthCheck();
      
      if (healthStatus.healthy) {
        console.log('✅ Full connection restart successful');
        return true;
      } else {
        console.log('❌ Full connection restart failed health check');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Full connection restart failed:', error.message);
      return false;
    }
  }

  /**
   * Enable graceful degradation strategy
   */
  async enableGracefulDegradation() {
    try {
      console.log('🆘 Enabling graceful degradation mode...');
      
      // Set system to degraded mode
      global.systemDegraded = true;
      global.degradationReason = 'database_connection_failure';
      global.degradationStartTime = Date.now();
      
      // Notify report processor to use offline mode
      const { reportProcessor } = require('../middleware/reportProcessor');
      if (reportProcessor && typeof reportProcessor.enableOfflineMode === 'function') {
        await reportProcessor.enableOfflineMode();
      }
      
      // Emit degradation event
      this.emit('systemDegraded', {
        timestamp: Date.now(),
        reason: 'database_connection_failure'
      });
      
      console.log('✅ Graceful degradation enabled');
      return true;
      
    } catch (error) {
      console.error('❌ Graceful degradation failed:', error.message);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections() {
    try {
      console.log('🔌 Closing all database connections...');
      
      // Close mongoose connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      
      // Close any additional connections
      await connectionPoolManager.shutdown();
      
      console.log('✅ All connections closed');
      
    } catch (error) {
      console.error('❌ Error closing connections:', error.message);
      throw error;
    }
  }

  /**
   * Calculate recovery delay with exponential backoff
   */
  calculateRecoveryDelay() {
    const baseDelay = this.recoveryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.recoveryAttempts - 1);
    const jitter = Math.random() * 1000;
    
    return Math.min(exponentialDelay + jitter, this.maxRecoveryDelay);
  }

  /**
   * Update average recovery time
   */
  updateAverageRecoveryTime(newTime) {
    const alpha = 0.1;
    this.stats.averageRecoveryTime = alpha * newTime + (1 - alpha) * this.stats.averageRecoveryTime;
  }

  /**
   * Handle recovery failure
   */
  async handleRecoveryFailure(reason, originalError) {
    console.error('💥 Connection recovery completely failed');
    
    this.isRecovering = false;
    this.stats.failedRecoveries++;
    
    // Enable emergency degradation mode
    await this.enableEmergencyMode(reason, originalError);
    
    // Send critical alerts
    await this.sendCriticalAlerts(reason, originalError);
    
    this.emit('recoveryFailed', {
      timestamp: Date.now(),
      reason,
      originalError: originalError?.message,
      attempts: this.recoveryAttempts
    });
  }

  /**
   * Enable emergency mode
   */
  async enableEmergencyMode(reason, originalError) {
    try {
      console.log('🚨 Enabling emergency mode - complete database failure');
      
      global.emergencyMode = true;
      global.emergencyReason = reason;
      global.emergencyStartTime = Date.now();
      
      // Notify all systems to go into emergency mode
      this.emit('emergencyMode', {
        timestamp: Date.now(),
        reason,
        originalError: originalError?.message
      });
      
      console.log('🚨 Emergency mode enabled');
      
    } catch (error) {
      console.error('❌ Failed to enable emergency mode:', error.message);
    }
  }

  /**
   * Send critical alerts
   */
  async sendCriticalAlerts(reason, originalError) {
    try {
      console.log('📧 Sending critical database failure alerts...');
      
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const EmailService = require('../services/emailService');
        
        // Try to send critical alert email
        try {
          await EmailService.sendCriticalSystemAlert(adminEmail, {
            alertType: 'DATABASE_CONNECTION_FAILURE',
            reason,
            originalError: originalError?.message,
            recoveryAttempts: this.recoveryAttempts,
            downtime: this.stats.currentDowntimeStart ? 
              Date.now() - this.stats.currentDowntimeStart : 0,
            timestamp: new Date(),
            systemStats: this.getRecoveryStats()
          });
          
          console.log('📧 Critical alert email sent');
          
        } catch (emailError) {
          console.error('❌ Failed to send critical alert email:', emailError.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to send critical alerts:', error.message);
    }
  }

  /**
   * Check alert thresholds
   */
  async checkAlertThresholds() {
    const now = Date.now();
    
    // Check downtime threshold
    if (this.stats.currentDowntimeStart) {
      const downtime = now - this.stats.currentDowntimeStart;
      
      if (downtime > this.alertThresholds.criticalDowntime) {
        await this.sendDowntimeAlert('critical', downtime);
      } else if (downtime > this.alertThresholds.maxDowntime) {
        await this.sendDowntimeAlert('warning', downtime);
      }
    }
    
    // Check failed attempts threshold
    if (this.recoveryAttempts >= this.alertThresholds.maxFailedAttempts) {
      await this.sendFailedAttemptsAlert();
    }
  }

  /**
   * Send downtime alert
   */
  async sendDowntimeAlert(severity, downtime) {
    try {
      console.log(`⚠️ ${severity.toUpperCase()} downtime alert: ${downtime}ms`);
      
      this.emit('downtimeAlert', {
        severity,
        downtime,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Failed to send downtime alert:', error.message);
    }
  }

  /**
   * Send failed attempts alert
   */
  async sendFailedAttemptsAlert() {
    try {
      console.log(`⚠️ Failed recovery attempts alert: ${this.recoveryAttempts} attempts`);
      
      this.emit('failedAttemptsAlert', {
        attempts: this.recoveryAttempts,
        maxAttempts: this.maxRecoveryAttempts,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Failed to send failed attempts alert:', error.message);
    }
  }

  /**
   * Setup recovery triggers
   */
  setupRecoveryTriggers() {
    // Trigger recovery on repeated health check failures
    let consecutiveFailures = 0;
    
    databaseHealthChecker.on('healthCheckFailed', () => {
      consecutiveFailures++;
      
      if (consecutiveFailures >= 3 && !this.isRecovering) {
        console.log('🔄 Triggering recovery due to consecutive health check failures');
        this.triggerRecovery('consecutive_health_failures');
      }
    });
    
    databaseHealthChecker.on('healthCheckPassed', () => {
      consecutiveFailures = 0;
    });
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    const recentHistory = this.connectionHistory.slice(-10);
    const healthyCount = recentHistory.filter(entry => entry.healthy).length;
    const healthRate = recentHistory.length > 0 ? 
      (healthyCount / recentHistory.length * 100) : 0;
    
    return {
      totalRecoveries: this.stats.totalRecoveries,
      successfulRecoveries: this.stats.successfulRecoveries,
      failedRecoveries: this.stats.failedRecoveries,
      successRate: this.stats.totalRecoveries > 0 ? 
        (this.stats.successfulRecoveries / this.stats.totalRecoveries * 100) : 0,
      longestDowntime: this.stats.longestDowntime,
      averageRecoveryTime: Math.round(this.stats.averageRecoveryTime),
      currentDowntime: this.stats.currentDowntimeStart ? 
        Date.now() - this.stats.currentDowntimeStart : 0,
      isRecovering: this.isRecovering,
      recoveryAttempts: this.recoveryAttempts,
      recentHealthRate: healthRate.toFixed(1) + '%',
      lastRecoveryTime: this.stats.lastRecoveryTime ? 
        new Date(this.stats.lastRecoveryTime) : null
    };
  }

  /**
   * Get connection history summary
   */
  getConnectionHistory(limit = 20) {
    return this.connectionHistory.slice(-limit).map(entry => ({
      timestamp: new Date(entry.timestamp),
      healthy: entry.healthy,
      responseTime: entry.responseTime,
      connectionState: this.getConnectionStateString(entry.connectionState)
    }));
  }

  /**
   * Get connection state as string
   */
  getConnectionStateString(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return states[state] || 'unknown';
  }

  /**
   * Test recovery system
   */
  async testRecoverySystem() {
    console.log('🧪 Testing connection recovery system...');
    
    try {
      // Simulate connection loss
      console.log('🔌 Simulating connection loss...');
      await this.triggerRecovery('test_recovery');
      
      console.log('✅ Recovery system test completed');
      return true;
      
    } catch (error) {
      console.error('❌ Recovery system test failed:', error.message);
      return false;
    }
  }

  /**
   * Force recovery
   */
  async forceRecovery(reason = 'manual_trigger') {
    console.log(`🔧 Forcing connection recovery: ${reason}`);
    
    if (this.isRecovering) {
      console.log('⚠️ Recovery already in progress');
      return false;
    }
    
    await this.triggerRecovery(reason);
    return true;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down connection recovery manager...');
    
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    this.isRecovering = false;
    
    console.log('✅ Connection recovery manager shutdown complete');
  }
}

// Export singleton instance
const connectionRecoveryManager = new ConnectionRecoveryManager();

module.exports = {
  connectionRecoveryManager,
  ConnectionRecoveryManager
};