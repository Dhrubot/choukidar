// === backend/src/config/redisCluster.js ===
// Redis Cluster Configuration for SafeStreets Bangladesh
// Handles distributed caching for 8000+ concurrent users

const redis = require('redis');
const { productionLogger } = require('../utils/productionLogger');

class RedisClusterManager {
  constructor() {
    this.clients = new Map();
    this.isClusterMode = process.env.REDIS_CLUSTER_MODE === 'true';
    
    // Cluster configuration
    this.clusterConfig = {
      nodes: this.parseClusterNodes(),
      options: {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        slotsRefreshTimeout: 2000,
        clusterRetryStrategy: (times) => Math.min(times * 100, 3000),
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          tls: process.env.REDIS_TLS === 'true' ? {} : undefined
        }
      }
    };

    // Single instance configuration (fallback)
    this.singleConfig = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      options: {
        password: process.env.REDIS_PASSWORD,
        db: 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true; // Reconnect on READONLY errors
          }
          return false;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true
      }
    };

    // Sharding configuration
    this.shardConfig = {
      shards: 4,
      hashSlots: 16384,
      keyHasher: (key) => this.hashKey(key)
    };

    // Statistics
    this.stats = {
      operations: 0,
      errors: 0,
      connections: 0,
      shardDistribution: new Array(this.shardConfig.shards).fill(0)
    };
  }

  /**
   * Parse cluster nodes from environment
   */
  parseClusterNodes() {
    const nodesStr = process.env.REDIS_CLUSTER_NODES || '';
    if (!nodesStr) {
      return [
        { host: 'localhost', port: 7000 },
        { host: 'localhost', port: 7001 },
        { host: 'localhost', port: 7002 }
      ];
    }

    return nodesStr.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  /**
   * Initialize Redis cluster or single instance
   */
  async initialize() {
    console.log('🚀 Initializing Redis cluster manager...');

    try {
      if (this.isClusterMode) {
        await this.initializeCluster();
      } else {
        await this.initializeSingleWithSharding();
      }

      // Setup monitoring
      this.startMonitoring();

      console.log('✅ Redis cluster manager initialized');
      return true;

    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis cluster
   */
  async initializeCluster() {
    const { createCluster } = require('redis');

    console.log('🔧 Connecting to Redis cluster...');

    const cluster = createCluster({
      rootNodes: this.clusterConfig.nodes.map(node => ({
        url: `redis://${node.host}:${node.port}`
      })),
      ...this.clusterConfig.options
    });

    cluster.on('error', (err) => {
      console.error('❌ Redis Cluster Error:', err);
      this.stats.errors++;
    });

    await cluster.connect();

    this.clients.set('cluster', cluster);
    this.stats.connections = this.clusterConfig.nodes.length;

    console.log(`✅ Connected to Redis cluster with ${this.clusterConfig.nodes.length} nodes`);
  }

  /**
   * Initialize single Redis with client-side sharding
   */
  async initializeSingleWithSharding() {
    console.log('🔧 Setting up Redis with client-side sharding...');

    // Create multiple Redis clients for sharding
    for (let shard = 0; shard < this.shardConfig.shards; shard++) {
      const client = redis.createClient({
        ...this.singleConfig.options,
        url: this.singleConfig.url,
        database: shard // Use different databases for sharding
      });

      client.on('error', (err) => {
        console.error(`❌ Redis Shard ${shard} Error:`, err);
        this.stats.errors++;
      });

      client.on('ready', () => {
        console.log(`✅ Redis shard ${shard} connected`);
        this.stats.connections++;
      });

      await client.connect();
      this.clients.set(`shard_${shard}`, client);
    }

    console.log(`✅ Redis sharding initialized with ${this.shardConfig.shards} shards`);
  }

  /**
   * Get client for a specific key
   */
  getClient(key) {
    this.stats.operations++;

    if (this.isClusterMode) {
      return this.clients.get('cluster');
    }

    // Client-side sharding
    const shard = this.getShardForKey(key);
    this.stats.shardDistribution[shard]++;
    
    return this.clients.get(`shard_${shard}`);
  }

  /**
   * Get shard for a key using consistent hashing
   */
  getShardForKey(key) {
    const hash = this.hashKey(key);
    const slot = hash % this.shardConfig.hashSlots;
    const shard = Math.floor(slot / (this.shardConfig.hashSlots / this.shardConfig.shards));
    
    return Math.min(shard, this.shardConfig.shards - 1);
  }

  /**
   * CRC16 hash function for key distribution
   */
  hashKey(key) {
    let crc = 0;
    for (let i = 0; i < key.length; i++) {
      crc = ((crc << 8) ^ this.crc16Table[((crc >> 8) ^ key.charCodeAt(i)) & 0xFF]) & 0xFFFF;
    }
    return crc;
  }

  /**
   * Initialize CRC16 table
   */
  get crc16Table() {
    if (!this._crc16Table) {
      this._crc16Table = new Uint16Array(256);
      for (let i = 0; i < 256; i++) {
        let crc = i << 8;
        for (let j = 0; j < 8; j++) {
          crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        }
        this._crc16Table[i] = crc & 0xFFFF;
      }
    }
    return this._crc16Table;
  }

  /**
   * Enhanced cache operations with sharding
   */
  async get(key) {
    try {
      const client = this.getClient(key);
      return await client.get(key);
    } catch (error) {
      console.error(`❌ Redis GET error for key ${key}:`, error);
      this.stats.errors++;
      return null;
    }
  }

  async set(key, value, ttl) {
    try {
      const client = this.getClient(key);
      if (ttl > 0) {
        return await client.setEx(key, ttl, value);
      } else {
        return await client.set(key, value);
      }
    } catch (error) {
      console.error(`❌ Redis SET error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  async delete(key) {
    try {
      const client = this.getClient(key);
      return await client.del(key);
    } catch (error) {
      console.error(`❌ Redis DELETE error for key ${key}:`, error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Batch operations for performance
   */
  async mget(keys) {
    if (this.isClusterMode) {
      const client = this.clients.get('cluster');
      return await client.mGet(keys);
    }

    // Group keys by shard for client-side sharding
    const keysByShard = new Map();
    keys.forEach(key => {
      const shard = this.getShardForKey(key);
      if (!keysByShard.has(shard)) {
        keysByShard.set(shard, []);
      }
      keysByShard.get(shard).push(key);
    });

    // Execute mGet on each shard
    const results = await Promise.all(
      Array.from(keysByShard.entries()).map(async ([shard, shardKeys]) => {
        const client = this.clients.get(`shard_${shard}`);
        const values = await client.mGet(shardKeys);
        return shardKeys.map((key, index) => ({ key, value: values[index] }));
      })
    );

    // Reconstruct results in original order
    const resultMap = new Map(results.flat().map(r => [r.key, r.value]));
    return keys.map(key => resultMap.get(key));
  }

  async mset(keyValuePairs) {
    if (this.isClusterMode) {
      const client = this.clients.get('cluster');
      return await client.mSet(keyValuePairs);
    }

    // Group key-value pairs by shard
    const pairsByShard = new Map();
    keyValuePairs.forEach(pair => {
      const shard = this.getShardForKey(pair.key);
      if (!pairsByShard.has(shard)) {
        pairsByShard.set(shard, []);
      }
      pairsByShard.get(shard).push(pair);
    });

    // Execute mSet on each shard
    const results = await Promise.all(
      Array.from(pairsByShard.entries()).map(async ([shard, shardPairs]) => {
        const client = this.clients.get(`shard_${shard}`);
        return await client.mSet(shardPairs);
      })
    );

    return results.every(r => r === 'OK');
  }

  /**
   * Pipeline operations for atomic execution
   */
  async pipeline(operations) {
    if (this.isClusterMode) {
      const client = this.clients.get('cluster');
      const pipeline = client.multi();
      
      operations.forEach(op => {
        pipeline[op.command](...op.args);
      });
      
      return await pipeline.exec();
    }

    // Group operations by shard
    const opsByShard = new Map();
    operations.forEach(op => {
      const key = op.args[0]; // Assume first arg is the key
      const shard = this.getShardForKey(key);
      if (!opsByShard.has(shard)) {
        opsByShard.set(shard, []);
      }
      opsByShard.get(shard).push(op);
    });

    // Execute pipeline on each shard
    const results = await Promise.all(
      Array.from(opsByShard.entries()).map(async ([shard, shardOps]) => {
        const client = this.clients.get(`shard_${shard}`);
        const pipeline = client.multi();
        
        shardOps.forEach(op => {
          pipeline[op.command](...op.args);
        });
        
        return await pipeline.exec();
      })
    );

    return results.flat();
  }

  /**
   * Pub/Sub operations
   */
  async publish(channel, message) {
    // Publish to all shards for redundancy
    const promises = Array.from(this.clients.values()).map(client => 
      client.publish(channel, message)
    );
    
    const results = await Promise.all(promises);
    return results.reduce((sum, count) => sum + count, 0);
  }

  async subscribe(channel, callback) {
    // Subscribe on all clients
    const promises = Array.from(this.clients.entries()).map(async ([name, client]) => {
      const subscriber = client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        callback(message, name);
      });
      
      return subscriber;
    });
    
    return await Promise.all(promises);
  }

  /**
   * Health monitoring
   */
  startMonitoring() {
    setInterval(async () => {
      const health = await this.checkHealth();
      
      if (health.unhealthyClients > 0) {
        console.error(`❌ ${health.unhealthyClients} Redis clients are unhealthy`);
        productionLogger.error('Redis clients unhealthy', health);
      }
      
      // Log shard distribution in development
      if (process.env.NODE_ENV === 'development' && !this.isClusterMode) {
        console.log('📊 Shard distribution:', this.stats.shardDistribution);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Check health of all clients
   */
  async checkHealth() {
    const healthChecks = await Promise.all(
      Array.from(this.clients.entries()).map(async ([name, client]) => {
        try {
          await client.ping();
          return { name, healthy: true };
        } catch (error) {
          return { name, healthy: false, error: error.message };
        }
      })
    );

    const unhealthyClients = healthChecks.filter(h => !h.healthy);
    
    return {
      totalClients: healthChecks.length,
      healthyClients: healthChecks.filter(h => h.healthy).length,
      unhealthyClients: unhealthyClients.length,
      details: unhealthyClients,
      stats: this.getStats()
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    const errorRate = this.stats.operations > 0 
      ? (this.stats.errors / this.stats.operations * 100).toFixed(2) + '%'
      : '0%';

    return {
      ...this.stats,
      errorRate,
      shardBalance: this.calculateShardBalance(),
      mode: this.isClusterMode ? 'cluster' : 'sharded'
    };
  }

  /**
   * Calculate shard balance
   */
  calculateShardBalance() {
    if (this.isClusterMode) return 'N/A';

    const total = this.stats.shardDistribution.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'No data';

    const expectedPerShard = total / this.shardConfig.shards;
    const maxDeviation = Math.max(...this.stats.shardDistribution.map(count => 
      Math.abs(count - expectedPerShard)
    ));
    
    const balance = 100 - (maxDeviation / expectedPerShard * 100);
    return balance.toFixed(2) + '%';
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down Redis connections...');

    await Promise.all(
      Array.from(this.clients.values()).map(client => client.quit())
    );

    console.log('✅ Redis connections closed');
  }
}

// Export singleton instance
const redisCluster = new RedisClusterManager();

module.exports = {
  redisCluster,
  
  // Initialize function
  initializeRedisCluster: () => redisCluster.initialize(),
  
  // Direct access to operations
  redis: {
    get: (key) => redisCluster.get(key),
    set: (key, value, ttl) => redisCluster.set(key, value, ttl),
    delete: (key) => redisCluster.delete(key),
    mget: (keys) => redisCluster.mget(keys),
    mset: (pairs) => redisCluster.mset(pairs),
    pipeline: (ops) => redisCluster.pipeline(ops),
    publish: (channel, message) => redisCluster.publish(channel, message),
    subscribe: (channel, callback) => redisCluster.subscribe(channel, callback)
  },
  
  // Health and stats
  getRedisHealth: () => redisCluster.checkHealth(),
  getRedisStats: () => redisCluster.getStats()
};