// === backend/src/middleware/cacheLayer.js ===
// Best Redis Caching Layer - Enhanced with Full Backward Compatibility
// Combines all enhancements while maintaining exact compatibility with existing code

const redis = require('redis');

/**
 * Enhanced Redis Caching Layer with Full Backward Compatibility
 * Features: WebSocket sessions, real-time events, female safety, distributed locking
 * Maintains: Original method signatures, error handling patterns, export structure
 */
class CacheLayer {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    // Enhanced statistics (backward compatible + new features)
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,

      // Enhanced stats
      femaleSafetyCacheHits: 0,
      femaleSafetyCacheSets: 0,
      websocketSessions: 0,
      realtimeEvents: 0,
      locksAcquired: 0,
      lockFailures: 0,
      averageResponseTime: 0,
      lastResetAt: new Date()
    }

    // Configuration
    this.config = {
      defaultTTL: 3600,
      shortTTL: 300,
      longTTL: 86400,
      femaleSafetyTTL: 1800,
      websocketSessionTTL: 86400,
      realtimeEventTTL: 3600,
      maxEventsPerStream: 1000,
      defaultLockTTL: 30,
      maxLockRetries: 3,
      lockRetryDelay: 100
    };
  }

  /**
   * Initialize Redis connection
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Enhanced Cache Layer...');

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
          lazyConnect: true,
          keepAlive: true
        },
        database: parseInt(process.env.REDIS_DB) || 0
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('🔌 Redis client connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
        this.startMaintenanceTasks();
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
      console.log('✅ Enhanced Redis cache layer initialized successfully');
      this.isInitialized = true;

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
   * @param {string} type - Cache type (api, user, etc.)
   * @param {string} identifier - Unique identifier
   * @param {string} suffix - Optional suffix
   * @returns {string} Generated cache key
   */
  generateKey(type, identifier, suffix = '') {
    const prefix = 'safestreets';
    return `${prefix}:${type}:${identifier}${suffix ? ':' + suffix : ''}`;
  }

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @param {boolean} parseJSON - Whether to parse as JSON (default: true)
   * @returns {Promise<any|null>} Cached data or null if not found
   */
  async get(key, parseJSON = true) {
    if (!this.isConnected) return null;

    const startTime = Date.now();
    try {
      const data = await this.client.get(key);

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      if (data === null) {
        this.cacheStats.misses++;
        return null;
      }

      this.cacheStats.hits++;

      // Track female safety cache hits
      if (key.includes('female_safety')) {
        this.cacheStats.femaleSafetyCacheHits++;
      }

      return parseJSON ? JSON.parse(data) : data;
    } catch (error) {
      console.error(`❌ Cache get error for key ${key}:`, error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * Set data in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @param {boolean} stringifyJSON - Whether to stringify as JSON (default: true)
   * @returns {Promise<boolean>} Success status
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

      // Track female safety cache sets
      if (key.includes('female_safety')) {
        this.cacheStats.femaleSafetyCacheSets++;
      }

      return true;
    } catch (error) {
      console.error(`❌ Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete data from cache
   * @param {string} key - Cache key to delete
   * @returns {Promise<boolean>} True if key was deleted, false otherwise
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
   * Delete multiple keys matching a pattern
   * @param {string} pattern - Pattern to match (e.g., 'user:*')
   * @returns {Promise<number>} Number of keys deleted
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
          keysToDelete.push(...reply.keys);
        }
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        const deletedCount = await this.client.del(keysToDelete);
        this.cacheStats.deletes += deletedCount;
        console.log(`🗑️ Invalidated ${deletedCount} cache entries for pattern: ${pattern}`);
        return deletedCount;
      }

      return 0;

    } catch (error) {
      console.error(`❌ Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache API responses
   * @param {string} endpoint - API endpoint
   * @param {object} params - Request parameters
   * @param {any} data - Response data to cache
   * @param {number} ttl - Time to live in seconds (default: 300)
   * @returns {Promise<boolean>} Success status
   */
  async cacheApiResponse(endpoint, params, data, ttl = 300) {
    const key = this.generateKey('api', endpoint, JSON.stringify(params));
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached API response
   * @param {string} endpoint - API endpoint
   * @param {object} params - Request parameters
   * @returns {Promise<any|null>} Cached response or null
   */
  async getCachedApiResponse(endpoint, params) {
    const key = this.generateKey('api', endpoint, JSON.stringify(params));
    return await this.get(key);
  }

  /**
   * WebSocket session management - Set session data
   * @param {string} socketId - Socket ID
   * @param {object} sessionData - Session data to store
   * @param {number} ttl - Time to live in seconds (default: 86400)
   * @returns {Promise<boolean>} Success status
   */
  async setWebSocketSession(socketId, sessionData, ttl = 86400) {
    const key = this.generateKey('websocket', 'session', socketId);

    // Enhanced session data with female validator support
    const enhancedSessionData = {
      ...sessionData,
      createdAt: new Date(),
      lastActivity: new Date(),
      isFemaleValidator: sessionData.gender === 'female' && sessionData.canValidate,
      permissions: sessionData.permissions || [],
      validationStats: sessionData.validationStats || {
        totalValidations: 0,
        femaleSafetyValidations: 0,
        accuracyRate: 100
      }
    };

    const success = await this.set(key, enhancedSessionData, ttl);
    if (success) {
      this.cacheStats.websocketSessions++;

      // Track female validators separately
      if (enhancedSessionData.isFemaleValidator) {
        await this.addToFemaleValidatorPool(socketId, enhancedSessionData);
      }
    }

    return success;
  }

  /**
   * Get WebSocket session data
   * @param {string} socketId - Socket ID
   * @returns {Promise<object|null>} Session data or null
   */
  async getWebSocketSession(socketId) {
    const key = this.generateKey('websocket', 'session', socketId);
    return await this.get(key);
  }

  /**
   * Delete WebSocket session
   * @param {string} socketId - Socket ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebSocketSession(socketId) {
    const key = this.generateKey('websocket', 'session', socketId);

    // Remove from female validator pool if applicable
    const session = await this.getWebSocketSession(socketId);
    if (session && session.isFemaleValidator) {
      await this.removeFromFemaleValidatorPool(socketId);
    }

    const success = await this.delete(key);
    if (success) {
      this.cacheStats.websocketSessions = Math.max(0, this.cacheStats.websocketSessions - 1);
    }

    return success;
  }

  /**
 * Auto-select TTL based on key patterns (Enhanced feature)
 * @param {string} key - Cache key to analyze
 * @returns {number} Appropriate TTL in seconds
 */
  getAutoTTL(key) {
    if (key.includes('female_safety')) return this.config.femaleSafetyTTL;
    if (key.includes('websocket')) return this.config.websocketSessionTTL;
    if (key.includes('realtime')) return this.config.realtimeEventTTL;
    if (key.includes('validator')) return this.config.shortTTL;
    if (key.includes('stats') || key.includes('analytics')) return this.config.shortTTL;
    return this.config.defaultTTL;
  }

  /**
   * Test enhanced features on startup (non-critical)
   * @returns {Promise<void>}
   */
  async testEnhancedFeatures() {
    try {
      // Test distributed locking
      const testLock = await this.acquireLock('test_lock', 5, 1);
      if (testLock.acquired) {
        await this.releaseLock(testLock);
        console.log('✅ Distributed locking test passed');
      }

      // Test WebSocket session storage
      await this.setWebSocketSession('test_session', { test: true }, 60);
      const session = await this.getWebSocketSession('test_session');
      if (session && session.test) {
        await this.deleteWebSocketSession('test_session');
        console.log('✅ WebSocket session management test passed');
      }

      // Test real-time events
      const eventId = await this.cacheRealtimeEvent('test_event', { test: true }, 60);
      if (eventId) {
        console.log('✅ Real-time event caching test passed');
      }

    } catch (error) {
      console.warn('⚠️ Enhanced features test failed (non-critical):', error);
    }
  };

  /**
   * Add female validator to active pool
   * @param {string} socketId - Socket ID
   * @param {object} sessionData - Session data
   * @returns {Promise<void>}
   */
  async addToFemaleValidatorPool(socketId, sessionData) {
    const poolKey = this.generateKey('female_validators', 'active_pool');
    const validatorData = {
      socketId,
      userId: sessionData.userId,
      location: sessionData.location,
      trustScore: sessionData.trustScore || 50,
      availableAt: new Date(),
      validationStats: sessionData.validationStats
    };

    try {
      // Add to sorted set by trust score
      await this.client.zAdd(poolKey, {
        score: validatorData.trustScore,
        value: JSON.stringify(validatorData)
      });

      // Set expiration
      await this.client.expire(poolKey, this.config.websocketSessionTTL);
    } catch (error) {
      console.error(`❌ Error adding to female validator pool:`, error);
    }
  }

  /**
   * Remove female validator from pool
   * @param {string} socketId - Socket ID
   * @returns {Promise<void>}
   */
  async removeFromFemaleValidatorPool(socketId) {
    const poolKey = this.generateKey('female_validators', 'active_pool');

    try {
      // Find and remove the validator
      const validators = await this.client.zRange(poolKey, 0, -1);
      for (const validatorJson of validators) {
        const validator = JSON.parse(validatorJson);
        if (validator.socketId === socketId) {
          await this.client.zRem(poolKey, validatorJson);
          break;
        }
      }
    } catch (error) {
      console.error(`❌ Error removing from female validator pool:`, error);
    }
  }

  /**
   * Get available female validators
   * @param {string|null} location - Optional location filter
   * @param {number} minTrustScore - Minimum trust score (default: 50)
   * @param {number} limit - Maximum number of validators to return (default: 10)
   * @returns {Promise<Array>} Array of available validators
   */
  async getAvailableFemaleValidators(location = null, minTrustScore = 50, limit = 10) {
    const poolKey = this.generateKey('female_validators', 'active_pool');

    try {
      // Get validators above minimum trust score
      const validators = await this.client.zRangeByScore(poolKey, minTrustScore, '+inf', {
        LIMIT: { offset: 0, count: limit }
      });

      const availableValidators = validators.map(v => JSON.parse(v));

      // TODO: Add location-based filtering if needed

      return availableValidators;
    } catch (error) {
      console.error(`❌ Error getting female validators:`, error);
      return [];
    }
  }

  /**
   * Real-time event caching for WebSocket with priority
   * @param {string} eventType - Type of event
   * @param {object} eventData - Event data
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @returns {Promise<string>} Event ID
   */
  async cacheRealtimeEvent(eventType, eventData, ttl = 3600) {
    const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enhancedEventData = {
      ...eventData,
      eventId,
      timestamp: new Date(),
      eventType,
      priority: this.getEventPriority(eventType, eventData)
    };

    try {
      // Cache the individual event
      const eventKey = this.generateKey('realtime', eventType, eventId);
      await this.set(eventKey, enhancedEventData, ttl);

      // Add to event stream with priority
      const streamKey = this.generateKey('stream', eventType);
      const streamEntry = JSON.stringify({
        eventId,
        timestamp: enhancedEventData.timestamp,
        priority: enhancedEventData.priority
      });

      await this.client.zAdd(streamKey, {
        score: enhancedEventData.priority,
        value: streamEntry
      });

      // Trim to max events (keep highest priority)
      await this.client.zRemRangeByRank(streamKey, 0, -(this.config.maxEventsPerStream + 1));

      this.cacheStats.realtimeEvents++;

      return eventId;
    } catch (error) {
      console.error(`❌ Error caching realtime event:`, error);
      return eventId;
    }
  }

  /**
   * Determine event priority (higher number = higher priority)
   * @param {string} eventType - Event type
   * @param {object} eventData - Event data
   * @returns {number} Priority score
   */
  getEventPriority(eventType, eventData) {
    let basePriority = Date.now(); // Use timestamp as base

    // Female safety events get priority boost
    if (eventType.includes('female_safety') || eventData.isFemaleSafety) {
      basePriority += 1000000; // 1M priority boost
    }

    // Urgent events get boost
    if (eventData.priority === 'urgent' || eventData.severity >= 4) {
      basePriority += 500000; // 500K priority boost
    }

    // Security events get boost
    if (eventType.includes('security') || eventType.includes('attack')) {
      basePriority += 300000; // 300K priority boost
    }

    return basePriority;
  }

  /**
   * Get recent real-time events with priority sorting
   * @param {string} eventType - Event type to retrieve
   * @param {number} limit - Maximum number of events (default: 50)
   * @param {number|null} priorityFilter - Minimum priority filter
   * @returns {Promise<Array>} Array of events
   */
  async getRecentEvents(eventType, limit = 50, priorityFilter = null) {
    const streamKey = this.generateKey('stream', eventType);

    try {
      // Get events sorted by priority (highest first)
      const events = await this.client.zRevRange(streamKey, 0, limit - 1);
      const eventData = [];

      for (const eventRef of events) {
        const ref = JSON.parse(eventRef);

        // Apply priority filter if specified
        if (priorityFilter && ref.priority < priorityFilter) {
          continue;
        }

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
   * @param {string} bounds - Map bounds
   * @param {object} filters - Applied filters
   * @param {any} data - Map data to cache
   * @param {number} ttl - Time to live in seconds (default: 600)
   * @returns {Promise<boolean>} Success status
   */
  async cacheMapData(bounds, filters, data, ttl = 600) {
    const key = this.generateKey('map', 'data', `${bounds}_${JSON.stringify(filters)}`);
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached map data
   * @param {string} bounds - Map bounds
   * @param {object} filters - Applied filters
   * @returns {Promise<any|null>} Cached map data or null
   */
  async getCachedMapData(bounds, filters) {
    const key = this.generateKey('map', 'data', `${bounds}_${JSON.stringify(filters)}`);
    return await this.get(key);
  }

  /**
   * Security data caching
   * @param {string} deviceFingerprint - Device fingerprint
   * @param {object} analysis - Security analysis data
   * @param {number} ttl - Time to live in seconds (default: 1800)
   * @returns {Promise<boolean>} Success status
   */
  async cacheSecurityAnalysis(deviceFingerprint, analysis, ttl = 1800) {
    const key = this.generateKey('security', 'analysis', deviceFingerprint);
    const enhancedAnalysis = {
      ...analysis,
      cachedAt: new Date(),
      securityLevel: analysis.riskLevel || 'medium',
      lastUpdated: new Date()
    };
    return await this.set(key, enhancedAnalysis, ttl);
  }

  /**
   * Get cached security analysis
   * @param {string} deviceFingerprint - Device fingerprint
   * @returns {Promise<object|null>} Security analysis or null
   */
  async getCachedSecurityAnalysis(deviceFingerprint) {
    const key = this.generateKey('security', 'analysis', deviceFingerprint);
    return await this.get(key);
  }

  /**
   * Rate limiting using Redis
   * @param {string} identifier - Unique identifier (IP, user ID, etc.)
   * @param {number} limit - Request limit
   * @param {number} window - Time window in seconds
   * @param {string} type - Rate limit type (default: 'general')
   * @returns {Promise<object>} Rate limit result
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
   * @param {string} statsType - Type of statistics
   * @param {any} data - Statistics data
   * @param {number} ttl - Time to live in seconds (default: 300)
   * @returns {Promise<boolean>} Success status
   */
  async cacheAdminStats(statsType, data, ttl = 300) {
    const key = this.generateKey('admin', 'stats', statsType);
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached admin statistics
   * @param {string} statsType - Type of statistics
   * @returns {Promise<any|null>} Cached statistics or null
   */
  async getCachedAdminStats(statsType) {
    const key = this.generateKey('admin', 'stats', statsType);
    return await this.get(key);
  }

  /**
   * Female safety specific caching
   * @param {string} statsType - Type of female safety statistics
   * @param {any} data - Statistics data
   * @param {number} ttl - Time to live in seconds (default: 1800)
   * @returns {Promise<boolean>} Success status
   */
  async cacheFemaleSafetyStats(statsType, data, ttl = 1800) {
    const key = this.generateKey('female_safety', 'stats', statsType);
    const enhancedData = {
      ...data,
      cachedAt: new Date(),
      statsType,
      securityLevel: 'high'
    };
    return await this.set(key, enhancedData, ttl);
  }

  /**
   * Get cached female safety statistics
   * @param {string} statsType - Type of statistics
   * @returns {Promise<any|null>} Cached statistics or null
   */
  async getCachedFemaleSafetyStats(statsType) {
    const key = this.generateKey('female_safety', 'stats', statsType);
    return await this.get(key);
  }

  /**
   * Invalidate caches when data changes
   * @param {string} reportId - Report ID
   * @returns {Promise<void>}
   */
  async invalidateReportCaches(reportId) {
    await Promise.all([
      // Invalidate map data caches
      this.deletePattern(this.generateKey('map', 'data', '*')),

      // Invalidate admin stats
      this.deletePattern(this.generateKey('admin', 'stats', '*')),

      // Invalidate specific report cache
      this.delete(this.generateKey('report', 'detail', reportId)),

      // Invalidate API caches
      this.deletePattern(this.generateKey('api', '*')),

      // Female safety specific invalidation
      this.deletePattern(this.generateKey('female_safety', '*')),

      // Community validation caches
      this.deletePattern(this.generateKey('community', 'validation', '*'))
    ]);

    console.log(`🗑️ Invalidated caches for report ${reportId}`);
  }

  /**
   * Invalidate user-specific caches
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async invalidateUserCaches(userId) {
    await Promise.all([
      // Invalidate user-specific caches
      this.deletePattern(this.generateKey('user', '*', userId)),

      // Invalidate admin stats that depend on user data
      this.deletePattern(this.generateKey('admin', 'stats', 'users')),

      // Female validators may need refresh
      this.deletePattern(this.generateKey('female_validators', '*')),

      // Community validation caches
      this.deletePattern(this.generateKey('community', 'validation', '*'))
    ]);

    console.log(`🗑️ Invalidated caches for user ${userId}`);
  }

  /**
   * Distributed lock for critical operations
   * @param {string} resource - Resource to lock
   * @param {number} ttl - Lock TTL in seconds (default: 30)
   * @param {number} retries - Number of retries (default: 3)
   * @returns {Promise<object>} Lock result
   */
  async acquireLock(resource, ttl = 30, retries = 3) {
    if (!this.isConnected) return { acquired: false, reason: 'cache_disconnected' };

    const lockKey = this.generateKey('lock', resource);
    const lockValue = `${process.pid}_${Date.now()}_${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.client.set(lockKey, lockValue, 'EX', ttl, 'NX');

        if (result === 'OK') {
          this.cacheStats.locksAcquired++;
          return {
            key: lockKey,
            value: lockValue,
            acquired: true,
            ttl,
            acquiredAt: new Date()
          };
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, this.config.lockRetryDelay * (i + 1)));

      } catch (error) {
        console.error(`❌ Lock acquisition error (attempt ${i + 1}):`, error);
      }
    }

    this.cacheStats.lockFailures++;
    return {
      acquired: false,
      reason: 'max_retries_exceeded',
      attempts: retries
    };
  }

  /**
   * Release distributed lock
   * @param {object} lock - Lock object from acquireLock
   * @returns {Promise<boolean>} Success status
   */
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
   * Bumps the version for a given cache namespace
   * This is a highly performant way to invalidate a group of caches
   * @param {string} namespace - Cache namespace to bump version for
   * @returns {Promise<number>} New version number
   */
  async bumpVersion(namespace) {
    if (!this.isConnected) return 1;

    try {
      const key = this.generateKey('version', namespace);

      // Check if the key exists and validate its value
      const currentValue = await this.client.get(key);

      if (currentValue !== null) {
        // Check if the current value is a valid integer
        const parsedValue = parseInt(currentValue, 10);
        if (isNaN(parsedValue)) {
          console.warn(`⚠️ Invalid version value for namespace '${namespace}': ${currentValue}. Resetting to 1.`);
          // Reset to 1 if the value is not a valid integer
          await this.client.set(key, '1');
          const newVersion = await this.client.incr(key);
          console.log(`📈 Reset and bumped version for namespace '${namespace}' to ${newVersion}`);
          return newVersion;
        }
      }

      // If key doesn't exist or has valid integer, proceed with increment
      const newVersion = await this.client.incr(key);
      console.log(`📈 Bumped version for namespace '${namespace}' to ${newVersion}`);
      return newVersion;

    } catch (error) {
      console.error(`❌ Error bumping version for namespace ${namespace}:`, error);

      // Fallback: try to reset the key
      try {
        const key = this.generateKey('version', namespace);
        await this.client.set(key, '1');
        console.log(`🔧 Reset version key for namespace '${namespace}' due to error`);
        return 1;
      } catch (resetError) {
        console.error(`❌ Failed to reset version key for namespace ${namespace}:`, resetError);
        return 1;
      }
    }
  }

  /**
   * Health check
   * @returns {Promise<object>} Health status
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
   * Scans for keys matching a pattern without blocking the server
   * @param {string} pattern - The pattern to match (e.g., 'user:*')
   * @returns {Promise<string[]>} An array of matching keys
   */
  async scanKeys(pattern) {
    if (!this.isConnected) return [];
    const keys = [];
    let cursor = '0';

    try {
      do {
        const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        keys.push(...reply.keys);
      } while (cursor !== '0');
      return keys;
    } catch (error) {
      console.error(`❌ Error scanning keys for pattern ${pattern}:`, error);
      return [];
    }
  }

  /**
   * Adds a member to a Redis Sorted Set (for priority queues)
   * @param {string} key - The key of the sorted set
   * @param {number} score - The priority score
   * @param {string} value - The member to add
   * @returns {Promise<number>} Number of elements added
   */
  async zadd(key, score, value) {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zAdd(key, { score, value });
    } catch (error) {
      console.error(`❌ zadd error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Gets the number of members in a Sorted Set
   * @param {string} key - The key of the sorted set
   * @returns {Promise<number>} Number of elements in the sorted set
   */
  async zcard(key) {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zCard(key);
    } catch (error) {
      console.error(`❌ zcard error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Removes and returns members with the lowest scores from a Sorted Set
   * @param {string} key - The key of the sorted set
   * @param {number} count - The number of members to pop
   * @returns {Promise<Array>} Array of popped members
   */
  async zpopmin(key, count) {
    if (!this.isConnected) return [];

    try {
      return await this.client.zPopMin(key, count);
    } catch (error) {
      console.error(`❌ zpopmin error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Prepends one or more values to a List (for failed job queues)
   * @param {string} key - The key of the list
   * @param {string|string[]} value - The value(s) to prepend
   * @returns {Promise<number>} Length of the list after the push operation
   */
  async lpush(key, value) {
    if (!this.isConnected) return 0;

    try {
      return await this.client.lPush(key, value);
    } catch (error) {
      console.error(`❌ lpush error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Removes elements from a List
   * @param {string} key - The key of the list
   * @param {number} count - The number of elements to remove
   * @param {string} value - The value to remove
   * @returns {Promise<number>} Number of removed elements
   */
  async lrem(key, count, value) {
    if (!this.isConnected) return 0;

    try {
      return await this.client.lRem(key, count, value);
    } catch (error) {
      console.error(`❌ lrem error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Trims a List to a specified range
   * @param {string} key - The key of the list
   * @param {number} start - The start index
   * @param {number} stop - The stop index
   * @returns {Promise<string>} Always 'OK'
   */
  async ltrim(key, start, stop) {
    if (!this.isConnected) return 'OK';

    try {
      return await this.client.lTrim(key, start, stop);
    } catch (error) {
      console.error(`❌ ltrim error for key ${key}:`, error);
      return 'OK';
    }
  }

  /**
   * Removes all members in a sorted set within the given scores
   * @param {string} key - The key of the sorted set
   * @param {number|string} min - The minimum score (e.g., '-inf' or a timestamp)
   * @param {number|string} max - The maximum score (e.g., '+inf' or a timestamp)
   * @returns {Promise<number>} The number of members removed
   */
  async zRemRangeByScore(key, min, max) {
    if (!this.isConnected) return 0;

    try {
      const removedCount = await this.client.zRemRangeByScore(key, min, max);
      if (removedCount > 0) {
        this.cacheStats.deletes += removedCount;
      }
      return removedCount;
    } catch (error) {
      console.error(`❌ Cache zRemRangeByScore error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Gets a range of elements from a list
   * @param {string} key - The key of the list
   * @param {number} start - The start index
   * @param {number} stop - The stop index (e.g., -1 for the end of the list)
   * @returns {Promise<string[]>} An array of elements in the specified range
   */
  async lRange(key, start, stop) {
    if (!this.isConnected) return [];

    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      console.error(`❌ Cache lRange error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Gets a range of members in a sorted set, by score (with scores)
   * @param {string} key - The key of the sorted set
   * @param {number|string} min - Minimum score
   * @param {number|string} max - Maximum score
   * @param {object} options - Options like LIMIT
   * @returns {Promise<Array>} Array of members
   */
  async zRangeByScore(key, min, max, options = {}) {
    if (!this.isConnected) return [];

    try {
      return await this.client.zRangeByScore(key, min, max, options);
    } catch (error) {
      console.error(`❌ zRangeByScore error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Gets a range of members in a sorted set, by index, with scores ordered from high to low
   * @param {string} key - The key of the sorted set
   * @param {number} start - Start index
   * @param {number} stop - Stop index
   * @returns {Promise<Array>} Array of members in reverse order
   */
  async zRevRange(key, start, stop) {
    if (!this.isConnected) return [];

    try {
      return await this.client.zRevRange(key, start, stop);
    } catch (error) {
      console.error(`❌ zRevRange error for key ${key}:`, error);
      return [];
    }
  }

  /**
   * Removes one or more members from a sorted set
   * @param {string} key - The key of the sorted set
   * @param {...string} values - Members to remove
   * @returns {Promise<number>} Number of members removed
   */
  async zRem(key, ...values) {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zRem(key, values);
    } catch (error) {
      console.error(`❌ zRem error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Removes all elements in the sorted set stored at key with rank between start and stop
   * @param {string} key - The key of the sorted set
   * @param {number} start - Start rank
   * @param {number} stop - Stop rank
   * @returns {Promise<number>} Number of elements removed
   */
  async zRemRangeByRank(key, start, stop) {
    if (!this.isConnected) return 0;

    try {
      const removedCount = await this.client.zRemRangeByRank(key, start, stop);
      if (removedCount > 0) {
        this.cacheStats.deletes += removedCount;
      }
      return removedCount;
    } catch (error) {
      console.error(`❌ zRemRangeByRank error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Update response time statistics
   * @param {number} responseTime - Response time in milliseconds
   */
  updateResponseTime(responseTime) {
    if (this.cacheStats.averageResponseTime === 0) {
      this.cacheStats.averageResponseTime = responseTime;
    } else {
      this.cacheStats.averageResponseTime =
        (this.cacheStats.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
  }

  /**
   * Start maintenance tasks
   */
  startMaintenanceTasks() {
    // Event stream cleanup every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupEventStreams();
      } catch (error) {
        console.error('❌ Event stream cleanup error:', error);
      }
    }, 300000); // 5 minutes

    // Statistics reset every 24 hours
    setInterval(() => {
      this.resetStatistics();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Cleanup expired event streams
   */
  async cleanupEventStreams() {
    const pattern = this.generateKey('stream', '*');
    const streamKeys = await this.scanKeys(pattern);

    for (const streamKey of streamKeys) {
      try {
        // FIXED: Check Redis key type before attempting sorted set operations
        const keyType = await this.client.type(streamKey);

        if (keyType === 'zset') {
          // Only perform sorted set operations on actual sorted sets
          const cutoffScore = Date.now() - this.config.realtimeEventTTL * 1000;
          await this.zRemRangeByScore(streamKey, '-inf', cutoffScore);
        } else if (keyType !== 'none') {
          // For other data types, check if they're expired and delete if needed
          const ttl = await this.client.ttl(streamKey);
          if (ttl === -1) {
            // Key exists but has no expiration, set one
            await this.client.expire(streamKey, this.config.realtimeEventTTL);
          }
        }

      } catch (error) {
        console.error(`❌ Error cleaning up stream ${streamKey}:`, error);
      }
    }
  }

  /**
   * Reset statistics (keeping important counters)
   */
  resetStatistics() {
    const previousStats = { ...this.cacheStats };

    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      femaleSafetyCacheHits: 0,
      femaleSafetyCacheSets: 0,
      realtimeEvents: 0,
      locksAcquired: 0,
      lockFailures: 0,
      averageResponseTime: previousStats.averageResponseTime, // Keep average
      websocketSessions: previousStats.websocketSessions, // Keep current count
      lastResetAt: new Date()
    };

    console.log('📊 Cache statistics reset');
  }

  /**
   * Enhanced health check with feature testing
   * @returns {Promise<object>} Comprehensive health status
   */
  async getEnhancedHealthCheck() {
    if (!this.isConnected) return { status: 'disconnected' };

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

      // Test core features
      const featureHealth = {
        basicOperations: await this.testBasicOperations(),
        distributedLocking: await this.testDistributedLocking(),
        websocketSessions: await this.testWebSocketSessions(),
        realtimeEvents: await this.testRealtimeEvents(),
        femaleSafetyCaching: await this.testFemaleSafetyCaching()
      };

      // Calculate performance metrics
      const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
      const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests * 100) : 0;
      const totalLocks = this.cacheStats.locksAcquired + this.cacheStats.lockFailures;
      const lockSuccessRate = totalLocks > 0 ? (this.cacheStats.locksAcquired / totalLocks * 100) : 100;

      return {
        status: 'connected',
        latency: `${latency}ms`,
        memoryUsage,
        stats: this.cacheStats,
        featureHealth,
        performance: {
          hitRate: `${hitRate.toFixed(2)}%`,
          lockSuccessRate: `${lockSuccessRate.toFixed(2)}%`,
          averageResponseTime: `${this.cacheStats.averageResponseTime.toFixed(2)}ms`
        },
        uptime: Date.now() - this.cacheStats.lastResetAt.getTime()
      };

    } catch (error) {
      console.error('❌ Enhanced cache health check failed:', error);
      return {
        status: 'error',
        error: error.message,
        stats: this.cacheStats
      };
    }
  }

  /**
   * Test basic cache operations
   */
  async testBasicOperations() {
    try {
      const testKey = this.generateKey('health', 'test', 'basic');
      await this.set(testKey, { test: true }, 60);
      const result = await this.get(testKey);
      await this.delete(testKey);
      return result && result.test ? 'healthy' : 'degraded';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Test distributed locking functionality
   */
  async testDistributedLocking() {
    try {
      const lock = await this.acquireLock('health_test_lock', 5, 1);
      if (lock.acquired) {
        await this.releaseLock(lock);
        return 'healthy';
      }
      return 'degraded';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Test WebSocket session management
   */
  async testWebSocketSessions() {
    try {
      await this.setWebSocketSession('health_test', { test: true }, 60);
      const session = await this.getWebSocketSession('health_test');
      await this.deleteWebSocketSession('health_test');
      return session ? 'healthy' : 'degraded';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Test real-time events functionality
   */
  async testRealtimeEvents() {
    try {
      const eventId = await this.cacheRealtimeEvent('health_test', { test: true }, 60);
      return eventId ? 'healthy' : 'degraded';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Test female safety caching
   */
  async testFemaleSafetyCaching() {
    try {
      await this.cacheFemaleSafetyStats('health_test', { test: true }, 60);
      const data = await this.getCachedFemaleSafetyStats('health_test');
      return data ? 'healthy' : 'degraded';
    } catch (error) {
      return 'failed';
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.client && this.isConnected) {
      try {
        console.log('🔄 Shutting down cache layer...');

        // Clean up temporary data
        await this.deletePattern(this.generateKey('health', '*'));
        await this.deletePattern(this.generateKey('lock', '*'));

        // Disconnect
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
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @param {function|null} keyGenerator - Custom key generator function
 * @param {string|null} versionNamespace - Version namespace for cache invalidation
 * @returns {function} Express middleware function
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
    let versionNumber = 1;

    if (versionNamespace) {
      const versionKey = cacheLayer.generateKey('version', versionNamespace);
      const rawVersion = await cacheLayer.client.get(versionKey);

      if (rawVersion !== null) {
        const parsed = parseInt(rawVersion, 10);
        versionNumber = isNaN(parsed) ? 1 : parsed;
      }

      // Use just the number, not "v{number}"
      versionedKey = `${baseKey}:${versionNumber}`;
    }

    // 3. Check for female safety context (shorter TTL for sensitive data)
    if (req.query?.genderSensitive === 'true' || req.body?.genderSensitive) {
      ttl = Math.min(ttl, cacheLayer.config.femaleSafetyTTL);
    }

    // 4. Try to get the cached response
    const cached = await cacheLayer.get(versionedKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Source', 'redis');
      res.setHeader('X-Cache-Version', versionNumber.toString()); // NOW versionNumber is in scope
      return res.json(cached);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Version', versionNumber.toString()); // NOW versionNumber is in scope

    // 5. Override res.json to cache the new response
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
 * @param {object} options - Rate limiting options
 * @param {number} options.limit - Request limit (default: 100)
 * @param {number} options.window - Time window in seconds (default: 900)
 * @param {function|null} options.keyGenerator - Custom key generator
 * @param {string} options.type - Rate limit type (default: 'general')
 * @returns {function} Express middleware function
 */
const rateLimitMiddleware = (options = {}) => {
  const { limit = 100, window = 900, keyGenerator = null, type = 'general' } = options;

  return async (req, res, next) => {
    const identifier = keyGenerator
      ? keyGenerator(req)
      : req.ip || 'unknown';

    // Check if this is a female safety related request
    const isFemaleSafetyRequest = req.body?.genderSensitive ||
      req.query?.genderSensitive === 'true' ||
      req.path.includes('female-safety');

    const result = await cacheLayer.checkRateLimit(identifier, limit, window, type);

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      'X-RateLimit-Context': isFemaleSafetyRequest ? 'female-safety' : 'standard'
    });

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        message: isFemaleSafetyRequest ?
          'Rate limit exceeded for female safety request. Please try again shortly.' :
          'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        context: isFemaleSafetyRequest ? 'female-safety-priority' : 'standard'
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

  // Health check (backward compatible)
  async cacheHealthCheck() {
    return await cacheLayer.healthCheck();
  },

  // Enhanced health check
  async enhancedCacheHealthCheck() {
    return await cacheLayer.getEnhancedHealthCheck();
  },

  // Female safety specific exports
  async getFemaleValidatorPool(location, minTrustScore, limit) {
    return await cacheLayer.getAvailableFemaleValidators(location, minTrustScore, limit);
  },

  async cacheFemaleSafetyEvent(eventData, ttl) {
    return await cacheLayer.cacheRealtimeEvent('female_safety_report', eventData, ttl);
  },

  async getFemaleSafetyEvents(limit, priorityFilter) {
    return await cacheLayer.getRecentEvents('female_safety_report', limit, priorityFilter);
  },

  // WebSocket integration exports
  async manageWebSocketSession(action, socketId, sessionData, ttl) {
    switch (action) {
      case 'create':
        return await cacheLayer.setWebSocketSession(socketId, sessionData, ttl);
      case 'get':
        return await cacheLayer.getWebSocketSession(socketId);
      case 'delete':
        return await cacheLayer.deleteWebSocketSession(socketId);
      default:
        throw new Error(`Unknown WebSocket session action: ${action}`);
    }
  },

  // Distributed locking exports
  async acquireProcessingLock(resourceId, ttl, retries) {
    return await cacheLayer.acquireLock(`processing_${resourceId}`, ttl, retries);
  },

  async releaseProcessingLock(lock) {
    return await cacheLayer.releaseLock(lock);
  },

  // Real-time event exports
  async broadcastRealtimeEvent(eventType, eventData, ttl) {
    return await cacheLayer.cacheRealtimeEvent(eventType, eventData, ttl);
  },

  async getRealtimeEvents(eventType, limit, priorityFilter) {
    return await cacheLayer.getRecentEvents(eventType, limit, priorityFilter);
  },

  // Maintenance
  async performCacheMaintenance() {
    await cacheLayer.cleanupEventStreams();
    cacheLayer.resetStatistics();
  }
};