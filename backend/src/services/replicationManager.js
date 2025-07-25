// === backend/src/services/replicationManager.js ===
// Database Replication Manager for SafeStreets Bangladesh
// Manages MongoDB replica sets and read distribution

const mongoose = require('mongoose');
const { productionLogger } = require('../utils/productionLogger');

class ReplicationManager {
  constructor() {
    this.replicaSet = null;
    this.readPreferences = {
      primary: 'primary',
      primaryPreferred: 'primaryPreferred',
      secondary: 'secondary',
      secondaryPreferred: 'secondaryPreferred',
      nearest: 'nearest'
    };
    
    // Read distribution strategy
    this.readDistribution = {
      // Critical writes and immediately consistent reads
      critical: {
        preference: this.readPreferences.primary,
        tags: []
      },
      // User authentication and profile
      authentication: {
        preference: this.readPreferences.primaryPreferred,
        tags: []
      },
      // Reports and real-time data
      realtime: {
        preference: this.readPreferences.primaryPreferred,
        tags: [{ purpose: 'reporting' }]
      },
      // Analytics and aggregations
      analytics: {
        preference: this.readPreferences.secondary,
        tags: [{ purpose: 'analytics' }]
      },
      // Historical data and archives
      historical: {
        preference: this.readPreferences.secondary,
        tags: [{ purpose: 'archive' }]
      },
      // Geographic queries
      geographic: {
        preference: this.readPreferences.nearest,
        tags: [{ region: 'bangladesh' }]
      }
    };

    // Replication monitoring
    this.monitoring = {
      replicationLag: new Map(),
      memberHealth: new Map(),
      lastCheck: null,
      alertThreshold: 10000 // 10 seconds lag threshold
    };

    // Statistics
    this.stats = {
      primaryReads: 0,
      secondaryReads: 0,
      replicationLagEvents: 0,
      failoverEvents: 0
    };
  }

  /**
   * Initialize replication monitoring
   */
  async initialize() {
    console.log('🚀 Initializing replication manager...');

    try {
      // Get replica set status
      await this.checkReplicaSetStatus();

      // Setup monitoring
      this.startMonitoring();

      // Configure read preferences for models
      this.configureModelReadPreferences();

      console.log('✅ Replication manager initialized');
      return true;

    } catch (error) {
      console.error('❌ Replication manager initialization failed:', error);
      return false;
    }
  }

  /**
   * Check replica set status
   */
  async checkReplicaSetStatus() {
    try {
      const admin = mongoose.connection.db.admin();
      const status = await admin.command({ replSetGetStatus: 1 });

      this.replicaSet = {
        set: status.set,
        members: status.members,
        primary: status.members.find(m => m.stateStr === 'PRIMARY'),
        secondaries: status.members.filter(m => m.stateStr === 'SECONDARY'),
        arbiters: status.members.filter(m => m.stateStr === 'ARBITER')
      };

      // Update member health
      status.members.forEach(member => {
        this.monitoring.memberHealth.set(member.name, {
          state: member.stateStr,
          health: member.health,
          uptime: member.uptime,
          lastHeartbeat: member.lastHeartbeatRecv,
          pingMs: member.pingMs
        });
      });

      console.log(`📊 Replica set "${this.replicaSet.set}" status:`, {
        primary: this.replicaSet.primary?.name,
        secondaries: this.replicaSet.secondaries.length,
        totalMembers: this.replicaSet.members.length
      });

      return status;

    } catch (error) {
      console.error('❌ Error checking replica set status:', error);
      throw error;
    }
  }

  /**
   * Calculate replication lag
   */
  async checkReplicationLag() {
    try {
      const admin = mongoose.connection.db.admin();
      const status = await admin.command({ replSetGetStatus: 1 });

      const primary = status.members.find(m => m.stateStr === 'PRIMARY');
      if (!primary) {
        console.warn('⚠️ No primary found in replica set');
        return;
      }

      const primaryOpTime = primary.optime?.ts;
      
      status.members.forEach(member => {
        if (member.stateStr === 'SECONDARY') {
          const secondaryOpTime = member.optime?.ts;
          
          if (primaryOpTime && secondaryOpTime) {
            const lag = primaryOpTime.getHighBits() - secondaryOpTime.getHighBits();
            this.monitoring.replicationLag.set(member.name, lag);

            // Alert if lag exceeds threshold
            if (lag > this.monitoring.alertThreshold) {
              this.stats.replicationLagEvents++;
              console.error(`🚨 High replication lag on ${member.name}: ${lag}ms`);
              
              productionLogger.error('High replication lag detected', {
                member: member.name,
                lag,
                threshold: this.monitoring.alertThreshold
              });
            }
          }
        }
      });

      this.monitoring.lastCheck = new Date();

    } catch (error) {
      console.error('❌ Error checking replication lag:', error);
    }
  }

  /**
   * Configure read preferences for Mongoose models
   */
  configureModelReadPreferences() {
    // Map models to read preferences
    const modelPreferences = {
      // Critical models - always read from primary
      User: this.readDistribution.critical,
      Admin: this.readDistribution.critical,
      AuditLog: this.readDistribution.critical,
      
      // Authentication related
      DeviceFingerprint: this.readDistribution.authentication,
      RefreshToken: this.readDistribution.authentication,
      
      // Real-time data
      Report: this.readDistribution.realtime,
      SafeZone: this.readDistribution.realtime,
      
      // Analytics models
      AnalyticsReport: this.readDistribution.analytics,
      AggregatedData: this.readDistribution.analytics,
      
      // Historical/Archive
      ArchivedReport: this.readDistribution.historical,
      BackupLog: this.readDistribution.historical
    };

    // Apply read preferences to models
    Object.entries(modelPreferences).forEach(([modelName, distribution]) => {
      try {
        const model = mongoose.model(modelName);
        
        // Set default read preference
        model.read(distribution.preference, distribution.tags);
        
        console.log(`📖 Configured ${modelName} with ${distribution.preference} read preference`);
      } catch (error) {
        // Model might not exist yet
      }
    });
  }

  /**
   * Get optimal read preference based on query type
   */
  getReadPreference(queryType, options = {}) {
    const { consistency = 'eventual', maxStaleness = 90 } = options;

    // Determine distribution based on query type
    let distribution = this.readDistribution.realtime;

    switch (queryType) {
      case 'auth':
      case 'user':
        distribution = this.readDistribution.authentication;
        break;
      case 'analytics':
      case 'aggregate':
        distribution = this.readDistribution.analytics;
        break;
      case 'archive':
      case 'historical':
        distribution = this.readDistribution.historical;
        break;
      case 'geo':
      case 'nearby':
        distribution = this.readDistribution.geographic;
        break;
      case 'critical':
      case 'transaction':
        distribution = this.readDistribution.critical;
        break;
    }

    // Override if strong consistency required
    if (consistency === 'strong') {
      distribution = this.readDistribution.critical;
    }

    // Track statistics
    if (distribution.preference === 'primary' || distribution.preference === 'primaryPreferred') {
      this.stats.primaryReads++;
    } else {
      this.stats.secondaryReads++;
    }

    return {
      readPreference: distribution.preference,
      readPreferenceTags: distribution.tags,
      maxStalenessSeconds: maxStaleness
    };
  }

  /**
   * Execute query with intelligent routing
   */
  async executeWithRouting(model, operation, ...args) {
    const queryType = this.detectQueryType(operation, args);
    const readPref = this.getReadPreference(queryType);

    // Apply read preference to query
    let query = model[operation](...args);
    
    if (query.read && typeof query.read === 'function') {
      query = query.read(readPref.readPreference, readPref.readPreferenceTags);
    }

    return await query.exec();
  }

  /**
   * Detect query type from operation
   */
  detectQueryType(operation, args) {
    // Authentication operations
    if (operation.includes('User') || operation.includes('Auth')) {
      return 'auth';
    }

    // Analytics operations
    if (operation === 'aggregate' || operation.includes('Analytics')) {
      return 'analytics';
    }

    // Geographic operations
    if (args[0]?.location?.$near || args[0]?.$geoNear) {
      return 'geo';
    }

    // Transaction operations
    if (operation.includes('Transaction') || operation.includes('Payment')) {
      return 'critical';
    }

    // Default to realtime
    return 'realtime';
  }

  /**
   * Start monitoring replication
   */
  startMonitoring() {
    // Monitor replica set status
    setInterval(async () => {
      await this.checkReplicaSetStatus();
      await this.checkReplicationLag();
    }, 10000); // Every 10 seconds

    // Monitor for topology changes
    mongoose.connection.on('topologyChanged', (event) => {
      console.log('🔄 Topology changed:', event);
      this.handleTopologyChange(event);
    });

    // Monitor for primary stepdown
    mongoose.connection.on('serverDescriptionChanged', (event) => {
      if (event.previousDescription.type === 'RSPrimary' && 
          event.newDescription.type !== 'RSPrimary') {
        this.handlePrimaryStepdown(event);
      }
    });
  }

  /**
   * Handle topology changes
   */
  handleTopologyChange(event) {
    console.log('🔄 Handling topology change...');
    
    // Refresh replica set status
    this.checkReplicaSetStatus().catch(console.error);
    
    // Log the change
    productionLogger.warn('MongoDB topology changed', {
      type: event.type,
      servers: event.servers
    });
  }

  /**
   * Handle primary stepdown
   */
  handlePrimaryStepdown(event) {
    this.stats.failoverEvents++;
    
    console.error('🚨 Primary stepdown detected!');
    
    productionLogger.error('MongoDB primary stepdown', {
      previousPrimary: event.previousDescription.address,
      event: event.newDescription
    });

    // Notify application of failover
    process.emit('mongodb:failover', {
      timestamp: new Date(),
      previousPrimary: event.previousDescription.address
    });
  }

  /**
   * Force read from primary (for critical operations)
   */
  async readFromPrimary(model, operation, ...args) {
    const query = model[operation](...args);
    return await query.read('primary').exec();
  }

  /**
   * Distribute reads across secondaries
   */
  async distributeRead(model, operation, ...args) {
    // Round-robin across healthy secondaries
    const healthySecondaries = Array.from(this.monitoring.memberHealth.entries())
      .filter(([name, health]) => health.state === 'SECONDARY' && health.health === 1)
      .map(([name]) => name);

    if (healthySecondaries.length === 0) {
      // Fallback to primary
      return this.readFromPrimary(model, operation, ...args);
    }

    // Select secondary based on round-robin
    const selectedIndex = this.stats.secondaryReads % healthySecondaries.length;
    const selectedSecondary = healthySecondaries[selectedIndex];

    const query = model[operation](...args);
    return await query.read('secondary', [{ server: selectedSecondary }]).exec();
  }

  /**
   * Get replication statistics
   */
  getStats() {
    const totalReads = this.stats.primaryReads + this.stats.secondaryReads;
    const primaryReadRatio = totalReads > 0 
      ? (this.stats.primaryReads / totalReads * 100).toFixed(2) + '%'
      : '0%';

    const lagStats = Array.from(this.monitoring.replicationLag.entries())
      .map(([member, lag]) => ({ member, lag }));

    return {
      ...this.stats,
      primaryReadRatio,
      totalReads,
      replicationLag: lagStats,
      memberHealth: Array.from(this.monitoring.memberHealth.entries()),
      lastCheck: this.monitoring.lastCheck,
      replicaSet: this.replicaSet ? {
        name: this.replicaSet.set,
        primary: this.replicaSet.primary?.name,
        secondaryCount: this.replicaSet.secondaries?.length || 0
      } : null
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await this.checkReplicaSetStatus();
      
      const healthy = status.members.some(m => m.stateStr === 'PRIMARY') &&
                     status.members.filter(m => m.stateStr === 'SECONDARY').length >= 1;

      return {
        status: healthy ? 'healthy' : 'degraded',
        replicaSet: status.set,
        members: status.members.length,
        primary: status.members.find(m => m.stateStr === 'PRIMARY')?.name,
        secondaries: status.members.filter(m => m.stateStr === 'SECONDARY').length,
        stats: this.getStats()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        stats: this.getStats()
      };
    }
  }
}

// Export singleton instance
const replicationManager = new ReplicationManager();

module.exports = {
  replicationManager,
  
  // Quick access methods
  initializeReplication: () => replicationManager.initialize(),
  getReadPreference: (queryType, options) => replicationManager.getReadPreference(queryType, options),
  executeWithRouting: (model, operation, ...args) => replicationManager.executeWithRouting(model, operation, ...args),
  forceReadFromPrimary: (model, operation, ...args) => replicationManager.readFromPrimary(model, operation, ...args),
  distributeRead: (model, operation, ...args) => replicationManager.distributeRead(model, operation, ...args),
  getReplicationStats: () => replicationManager.getStats(),
  checkReplicationHealth: () => replicationManager.healthCheck()
};