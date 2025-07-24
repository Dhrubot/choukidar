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
      this.cacheStats.deletes++;
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

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(keys);
      this.cacheStats.deletes += result;
      return result;
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
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    if (!cacheLayer.isConnected) return next();

    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(req)
      : cacheLayer.generateKey('api', req.originalUrl, JSON.stringify(req.query));

    // Try to get cached response
    const cached = await cacheLayer.get(key);
    if (cached) {
      return res.json(cached);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        cacheLayer.set(key, data, ttl).catch(console.error);
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