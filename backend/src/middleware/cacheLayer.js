// === backend/src/middleware/cacheLayer.js ===
// Redis Caching Layer for SafeStreets Bangladesh
// Solves WebSocket scaling and database performance issues

const redis = require('redis');

/**
 * Advanced Redis Caching Layer
 * Handles: API response caching, WebSocket state management, session storage
 */
class CacheLayer {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      // Create Redis client with connection options
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max Redis reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }

          this.reconnectAttempts++;
          const delay = Math.min(options.attempt * 100, 3000);
          console.log(`🔄 Redis reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
          return delay;
        },
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('🔌 Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis client error:', error);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔌 Redis client disconnected');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();

      // Test connection
      await this.client.ping();
      console.log('✅ Redis cache layer initialized successfully');

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis cache layer:', error);
      // Continue without Redis if connection fails
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(type, identifier, suffix = '') {
    const prefix = 'safestreets';
    return `${prefix}:${type}:${identifier}${suffix ? ':' + suffix : ''}`;
  }

  /**
   * Get data from cache
   */
  async get(key, parseJSON = true) {
    if (!this.isConnected) return null;

    try {
      const data = await this.client.get(key);

      if (data === null) {
        this.cacheStats.misses++;
        return null;
      }

      this.cacheStats.hits++;
      return parseJSON ? JSON.parse(data) : data;
    } catch (error) {
      console.error(`❌ Cache get error for key ${key}:`, error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set(key, data, ttl = 3600, stringifyJSON = true) {
    if (!this.isConnected) return false;

    try {
      const value = stringifyJSON ? JSON.stringify(data) : data;

      if (ttl > 0) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }

      this.cacheStats.sets++;
      return true;
    } catch (error) {
      console.error(`❌ Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key) {
    if (!this.isConnected) return false;

    try {
      const result = await this.client.del(key);
      if (result > 0) {
        this.cacheStats.deletes++;
      }
      return result > 0;
    } catch (error) {
      console.error(`❌ Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async deletePattern(pattern) {
    if (!this.isConnected) return 0;

    let cursor = '0';
    const keysToDelete = [];

    try {
      do {
        const reply = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        cursor = reply.cursor;
        if (reply.keys.length > 0) {
          keysToDelete.push(...reply.keys)
        }
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        const deletedCount = await this.client.del(keysToDelete)
        this.cacheStats.deletes += deletedCount;
        console.log(`🗑️ Invalidated ${deletedCount} cache entries for pattern: ${pattern}`);
        return deletedCount
      }

      return 0;

    } catch (error) {
      console.error(`❌ Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache API responses
   */
  async cacheApiResponse(endpoint, params, data, ttl = 300) {
    const key = this.generateKey('api', endpoint, JSON.stringify(params));
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(endpoint, params) {
    const key = this.generateKey('api', endpoint, JSON.stringify(params));
    return await this.get(key);
  }

  /**
   * WebSocket session management
   */
  async setWebSocketSession(socketId, sessionData, ttl = 86400) {
    const key = this.generateKey('websocket', 'session', socketId);
    return await this.set(key, sessionData, ttl);
  }

  async getWebSocketSession(socketId) {
    const key = this.generateKey('websocket', 'session', socketId);
    return await this.get(key);
  }

  async deleteWebSocketSession(socketId) {
    const key = this.generateKey('websocket', 'session', socketId);
    return await this.delete(key);
  }

  /**
   * Real-time event caching for WebSocket
   */
  async cacheRealtimeEvent(eventType, eventData, ttl = 3600) {
    const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const key = this.generateKey('realtime', eventType, eventId);
    await this.set(key, { ...eventData, eventId, timestamp: new Date() }, ttl);

    // Also add to event stream for subscribers
    const streamKey = this.generateKey('stream', eventType);
    await this.client.lPush(streamKey, JSON.stringify({ eventId, timestamp: new Date() }));
    await this.client.lTrim(streamKey, 0, 999); // Keep last 1000 events

    return eventId;
  }

  /**
   * Get recent real-time events
   */
  async getRecentEvents(eventType, limit = 50) {
    const streamKey = this.generateKey('stream', eventType);
    try {
      const events = await this.client.lRange(streamKey, 0, limit - 1);
      const eventData = [];

      for (const eventRef of events) {
        const ref = JSON.parse(eventRef);
        const eventKey = this.generateKey('realtime', eventType, ref.eventId);
        const event = await this.get(eventKey);
        if (event) {
          eventData.push(event);
        }
      }

      return eventData;
    } catch (error) {
      console.error(`❌ Error getting recent events for ${eventType}:`, error);
      return [];
    }
  }

  /**
   * Map data caching (for expensive geo queries)
   */
  async cacheMapData(bounds, filters, data, ttl = 600) {
    const key = this.generateKey('map', 'data', `${bounds}_${JSON.stringify(filters)}`);
    return await this.set(key, data, ttl);
  }

  async getCachedMapData(bounds, filters) {
    const key = this.generateKey('map', 'data', `${bounds}_${JSON.stringify(filters)}`);
    return await this.get(key);
  }

  /**
   * Security data caching
   */
  async cacheSecurityAnalysis(deviceFingerprint, analysis, ttl = 1800) {
    const key = this.generateKey('security', 'analysis', deviceFingerprint);
    return await this.set(key, analysis, ttl);
  }

  async getCachedSecurityAnalysis(deviceFingerprint) {
    const key = this.generateKey('security', 'analysis', deviceFingerprint);
    return await this.get(key);
  }

  /**
   * Rate limiting using Redis
   */
  async checkRateLimit(identifier, limit, window, type = 'general') {
    if (!this.isConnected) return { allowed: true, remaining: limit };

    const key = this.generateKey('ratelimit', type, identifier);

    try {
      const current = await this.client.incr(key);

      if (current === 1) {
        await this.client.expire(key, window);
      }

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return {
        allowed,
        remaining,
        current,
        resetTime: Date.now() + (window * 1000)
      };
    } catch (error) {
      console.error(`❌ Rate limit check error for ${identifier}:`, error);
      return { allowed: true, remaining: limit };
    }
  }

  /**
   * Admin statistics caching
   */
  async cacheAdminStats(statsType, data, ttl = 300) {
    const key = this.generateKey('admin', 'stats', statsType);
    return await this.set(key, data, ttl);
  }

  async getCachedAdminStats(statsType) {
    const key = this.generateKey('admin', 'stats', statsType);
    return await this.get(key);
  }

  /**
   * Invalidate caches when data changes
   */
  async invalidateReportCaches(reportId) {
    // Invalidate map data caches
    await this.deletePattern(this.generateKey('map', 'data', '*'));

    // Invalidate admin stats
    await this.deletePattern(this.generateKey('admin', 'stats', '*'));

    // Invalidate specific report cache
    await this.delete(this.generateKey('report', 'detail', reportId));

    console.log(`🗑️ Invalidated caches for report ${reportId}`);
  }

  async invalidateUserCaches(userId) {
    // Invalidate user-specific caches
    await this.deletePattern(this.generateKey('user', '*', userId));

    // Invalidate admin stats that depend on user data
    await this.deletePattern(this.generateKey('admin', 'stats', 'users'));

    console.log(`🗑️ Invalidated caches for user ${userId}`);
  }

  /**
   * Distributed lock for critical operations
   */
  async acquireLock(resource, ttl = 30, retries = 3) {
    if (!this.isConnected) return null;

    const lockKey = this.generateKey('lock', resource);
    const lockValue = `${process.pid}_${Date.now()}_${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.client.set(lockKey, lockValue, 'EX', ttl, 'NX');
        if (result === 'OK') {
          return {
            key: lockKey,
            value: lockValue,
            acquired: true,
            ttl
          };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      } catch (error) {
        console.error(`❌ Lock acquisition error (attempt ${i + 1}):`, error);
      }
    }

    return { acquired: false };
  }

  async releaseLock(lock) {
    if (!this.isConnected || !lock.acquired) return false;

    try {
      // Use Lua script to ensure atomic release
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, 1, lock.key, lock.value);
      return result === 1;
    } catch (error) {
      console.error('❌ Lock release error:', error);
      return false;
    }
  }

  /**
 * Bumps the version for a given cache namespace.
 * This is a highly performant way to invalidate a group of caches.
 */
  async bumpVersion(namespace) {
    if (!this.isConnected) return 1;
    const key = this.generateKey('version', namespace);
    return this.client.incr(key);
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isConnected) return { status: 'disconnected' };

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      return {
        status: 'connected',
        latency: `${latency}ms`,
        memoryUsage,
        stats: this.cacheStats
      };
    } catch (error) {
      console.error('❌ Cache health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Scans for keys matching a pattern without blocking the server.
   * @param {string} pattern - The pattern to match (e.g., 'user:*')
   * @returns {Promise<string[]>} - An array of matching keys.
   */
  async scanKeys(pattern) {
    if (!this.isConnected) return [];
    const keys = [];
    let cursor = '0';
    do {
      const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Adds a member to a Redis Sorted Set (for priority queues).
   * @param {string} key - The key of the sorted set.
   * @param {number} score - The priority score.
   * @param {string} value - The member to add.
   */
  async zadd(key, score, value) {
    if (!this.isConnected) return 0;
    return this.client.zAdd(key, { score, value });
  }

  /**
   * Gets the number of members in a Sorted Set.
   * @param {string} key - The key of the sorted set.
   */
  async zcard(key) {
    if (!this.isConnected) return 0;
    return this.client.zCard(key);
  }

  /**
   * Removes and returns members with the lowest scores from a Sorted Set.
   * @param {string} key - The key of the sorted set.
   * @param {number} count - The number of members to pop.
   */
  async zpopmin(key, count) {
    if (!this.isConnected) return [];
    return this.client.zPopMin(key, count);
  }

  /**
   * Prepends one or more values to a List (for failed job queues).
   * @param {string} key - The key of the list.
   * @param {string|string[]} value - The value(s) to prepend.
   */
  async lpush(key, value) {
    if (!this.isConnected) return 0;
    return this.client.lPush(key, value);
  }

  /**
   * Removes elements from a List.
   * @param {string} key - The key of the list.
   * @param {number} count - The number of elements to remove.
   * @param {string} value - The value to remove.
   */
  async lrem(key, count, value) {
    if (!this.isConnected) return 0;
    return this.client.lRem(key, count, value);
  }

  /**
   * Trims a List to a specified range.
   * @param {string} key - The key of the list.
   * @param {number} start - The start index.
   * @param {number} stop - The stop index.
   */
  async ltrim(key, start, stop) {
    if (!this.isConnected) return 'OK';
    return this.client.lTrim(key, start, stop);
  }

  /**
 *  ===
 * Removes all members in a sorted set within the given scores.
 * @param {string} key The key of the sorted set.
 * @param {number|string} min The minimum score (e.g., '-inf' or a timestamp).
 * @param {number|string} max The maximum score (e.g., '+inf' or a timestamp).
 * @returns {Promise<number>} The number of members removed.
 */
  async zRemRangeByScore(key, min, max) {
    if (!this.isConnected) return 0;

    try {
      // The node-redis v4/v5 command is camelCased: zRemRangeByScore
      const removedCount = await this.client.zRemRangeByScore(key, min, max);
      if (removedCount > 0) {
        this.cacheStats.deletes += removedCount;
      }
      return removedCount;
    } catch (error) {
      console.error(`❌ Cache zRemRangeByScore error for key ${key}:`, error);
      return 0; // Return 0 on error
    }
  }

  /**
 * === NEW METHOD TO SUPPORT DeviceFingerprintProcessor ===
 * Gets a range of elements from a list.
 * @param {string} key The key of the list.
 * @param {number} start The start index.
 * @param {number} stop The stop index (e.g., -1 for the end of the list).
 * @returns {Promise<string[]>} An array of elements in the specified range.
 */
  async lRange(key, start, stop) {
    if (!this.isConnected) return [];

    try {
      // The node-redis v4/v5 command is camelCased: lRange
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      console.error(`❌ Cache lRange error for key ${key}:`, error);
      return []; // Return empty array on error
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        console.log('✅ Redis cache layer shutdown gracefully');
      } catch (error) {
        console.error('❌ Error during Redis shutdown:', error);
      }
    }
  }
}


// Export singleton instance
const cacheLayer = new CacheLayer();

/**
 * Express middleware for response caching
 */
const cacheMiddleware = (ttl = 300, keyGenerator = null, versionNamespace = null) => {
  return async (req, res, next) => {
    if (!cacheLayer.isConnected) return next();

    // 1. Generate the base key
    const baseKey = keyGenerator
      ? keyGenerator(req)
      : cacheLayer.generateKey('api', req.originalUrl);

    // 2. Append the version number if a namespace is provided
    let versionedKey = baseKey;
    if (versionNamespace) {
      const version = await cacheLayer.get(`safestreets:version:${versionNamespace}`, false) || 'v1';
      versionedKey = `${baseKey}:${version}`;
    }

    // 3. Try to get the cached response
    const cached = await cacheLayer.get(versionedKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');

    // 4. Override res.json to cache the new response
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode === 200) {
        cacheLayer.set(versionedKey, data, ttl).catch(console.error);
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Rate limiting middleware using Redis
 */
const rateLimitMiddleware = (options = {}) => {
  const { limit = 100, window = 900, keyGenerator = null, type = 'general' } = options;

  return async (req, res, next) => {
    const identifier = keyGenerator
      ? keyGenerator(req)
      : req.ip || 'unknown';

    const result = await cacheLayer.checkRateLimit(identifier, limit, window, type);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
};

module.exports = {
  CacheLayer,
  cacheLayer,
  cacheMiddleware,
  rateLimitMiddleware,

  // Initialize cache layer
  async initializeCache() {
    return await cacheLayer.initialize();
  },

  // Health check
  async cacheHealthCheck() {
    return await cacheLayer.healthCheck();
  }
};