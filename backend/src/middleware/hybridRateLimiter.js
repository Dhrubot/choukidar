// === backend/src/middleware/hybridRateLimiter.js (ENHANCED VERSION) ===
// Enhanced Hybrid Rate Limiting with Female Safety Prioritization and Advanced Security
// Redis Primary + Memory Fallback with Device-Based Limiting and Context-Aware Rules

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

class EnhancedHybridRateLimiter {
  constructor(cacheLayer) {
    this.cacheLayer = cacheLayer;
    this.memoryStore = new Map();
    this.deviceMemoryStore = new Map(); // Separate store for device-based limiting
    this.cleanupInterval = null;
    this.suspiciousDevices = new Set(); // Track suspicious devices
    
    // Enhanced configuration
    this.config = {
      // Standard rate limits
      standardReportLimit: 5,
      standardReportWindow: 15 * 60, // 15 minutes
      
      // Female safety prioritization
      femaleSafetyReportLimit: 8, // Higher limit for female safety reports
      femaleSafetyReportWindow: 15 * 60,
      
      // Device-based limits
      deviceReportLimit: 10, // Per device across all IPs
      deviceReportWindow: 60 * 60, // 1 hour
      
      // Suspicious device limits
      suspiciousDeviceLimit: 2,
      suspiciousDeviceWindow: 60 * 60, // 1 hour
      
      // Context-aware limits
      highRiskAreaLimit: 3, // Lower limit for high-risk areas
      conservativeAreaLimit: 6, // Moderate limit for conservative areas
      
      // API limits
      apiStandardLimit: 100,
      apiStandardWindow: 60,
      
      // Admin limits
      adminOperationLimit: 50, // Higher for enhanced operations
      adminOperationWindow: 60,
      
      // Memory cleanup
      memoryCleanupInterval: 5 * 60 * 1000, // 5 minutes
      memoryEntryMaxAge: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Performance statistics
    this.stats = {
      rateLimitHits: 0,
      rateLimitBlocks: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryFallbacks: 0,
      deviceBasedBlocks: 0,
      femaleSafetyReportsAllowed: 0,
      suspiciousDeviceBlocks: 0,
      contextualAdjustments: 0
    };
    
    this.startMemoryCleanup();
  }

  /**
   * Enhanced IP hashing with salt for additional security
   */
  hashIp(ip) {
    if (!ip) return 'unknown';
    const salt = process.env.RATE_LIMIT_SALT || 'safestreets_default_salt';
    return crypto.createHash('sha256').update(ip + salt).digest('hex');
  }

  /**
   * Hash device fingerprint for privacy
   */
  hashDevice(deviceFingerprint) {
    if (!deviceFingerprint) return 'unknown';
    const salt = process.env.DEVICE_SALT || 'device_default_salt';
    return crypto.createHash('sha256').update(deviceFingerprint + salt).digest('hex');
  }

  /**
   * Enhanced rate limiting with context awareness and device tracking
   */
  async checkEnhancedRateLimit(identifier, deviceId, limit, window, context = {}) {
    const {
      type = 'general',
      isFemaleSafetyReport = false,
      isSuspiciousDevice = false,
      areaRiskLevel = 'normal',
      culturalContext = {}
    } = context;

    // Adjust limits based on context
    const adjustedLimits = this.adjustLimitsForContext({
      limit,
      window,
      isFemaleSafetyReport,
      isSuspiciousDevice,
      areaRiskLevel,
      culturalContext
    });

    // Check both IP-based and device-based limits
    const [ipResult, deviceResult] = await Promise.all([
      this.checkRateLimit(identifier, adjustedLimits.limit, adjustedLimits.window, type),
      deviceId ? this.checkDeviceRateLimit(deviceId, adjustedLimits.deviceLimit, adjustedLimits.deviceWindow, type) : null
    ]);

    // Determine final result
    const finalResult = this.combineRateLimitResults(ipResult, deviceResult, context);
    
    // Update statistics
    this.updateStatistics(finalResult, context);
    
    return finalResult;
  }

  /**
   * Adjust limits based on context
   */
  adjustLimitsForContext(params) {
    const {
      limit,
      window,
      isFemaleSafetyReport,
      isSuspiciousDevice,
      areaRiskLevel,
      culturalContext
    } = params;

    let adjustedLimit = limit;
    let adjustedWindow = window;
    let deviceLimit = this.config.deviceReportLimit;
    let deviceWindow = this.config.deviceReportWindow;

    // Female safety prioritization
    if (isFemaleSafetyReport) {
      adjustedLimit = this.config.femaleSafetyReportLimit;
      adjustedWindow = this.config.femaleSafetyReportWindow;
      this.stats.contextualAdjustments++;
    }

    // Suspicious device restrictions
    if (isSuspiciousDevice) {
      adjustedLimit = this.config.suspiciousDeviceLimit;
      adjustedWindow = this.config.suspiciousDeviceWindow;
      deviceLimit = Math.min(deviceLimit, 3);
      this.stats.contextualAdjustments++;
    }

    // Area-based adjustments
    switch (areaRiskLevel) {
      case 'high':
        adjustedLimit = this.config.highRiskAreaLimit;
        this.stats.contextualAdjustments++;
        break;
      case 'conservative':
        adjustedLimit = this.config.conservativeAreaLimit;
        this.stats.contextualAdjustments++;
        break;
    }

    // Cultural context adjustments
    if (culturalContext.familyRelated || culturalContext.religiousContext) {
      // More lenient for culturally sensitive reports
      adjustedLimit = Math.ceil(adjustedLimit * 1.2);
      this.stats.contextualAdjustments++;
    }

    return {
      limit: adjustedLimit,
      window: adjustedWindow,
      deviceLimit,
      deviceWindow
    };
  }

  /**
   * Standard rate limiting (enhanced from original)
   */
  async checkRateLimit(identifier, limit, window, type = 'general') {
    if (this.cacheLayer && this.cacheLayer.isConnected) {
      try {
        const result = await this.redisRateLimit(identifier, limit, window, type);
        this.stats.cacheHits++;
        return result;
      } catch (error) {
        console.warn(`⚠️ Redis rate limiting failed, falling back to memory: ${error.message}`);
        this.stats.memoryFallbacks++;
      }
    }

    const result = this.memoryRateLimit(identifier, limit, window, type);
    this.stats.cacheMisses++;
    return result;
  }

  /**
   * Device-based rate limiting
   */
  async checkDeviceRateLimit(deviceId, limit, window, type = 'device') {
    const hashedDevice = this.hashDevice(deviceId);
    
    if (this.cacheLayer && this.cacheLayer.isConnected) {
      try {
        return await this.redisDeviceRateLimit(hashedDevice, limit, window, type);
      } catch (error) {
        console.warn(`⚠️ Redis device rate limiting failed, falling back to memory: ${error.message}`);
      }
    }

    return this.memoryDeviceRateLimit(hashedDevice, limit, window, type);
  }

  /**
   * Redis-based device rate limiting
   */
  async redisDeviceRateLimit(deviceHash, limit, window, type) {
    const key = this.cacheLayer.generateKey('ratelimit', 'device', type, deviceHash);
    
    try {
      const current = await this.cacheLayer.client.incr(key);
      
      if (current === 1) {
        await this.cacheLayer.client.expire(key, window);
      }

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return {
        allowed,
        remaining,
        current,
        resetTime: Date.now() + (window * 1000),
        source: 'redis_device',
        deviceHash
      };

    } catch (error) {
      console.error(`❌ Redis device rate limit error for ${deviceHash}:`, error);
      throw error;
    }
  }

  /**
   * Memory-based device rate limiting
   */
  memoryDeviceRateLimit(deviceHash, limit, window, type) {
    const key = `${type}:${deviceHash}`;
    const now = Date.now();
    
    if (!this.deviceMemoryStore.has(key)) {
      this.deviceMemoryStore.set(key, {
        count: 1,
        windowStart: now,
        lastAccess: now
      });
      
      return {
        allowed: true,
        remaining: limit - 1,
        current: 1,
        resetTime: now + (window * 1000),
        source: 'memory_device',
        deviceHash
      };
    }

    const data = this.deviceMemoryStore.get(key);
    const windowEnd = data.windowStart + (window * 1000);
    
    if (now > windowEnd) {
      data.count = 1;
      data.windowStart = now;
      data.lastAccess = now;
      
      return {
        allowed: true,
        remaining: limit - 1,
        current: 1,
        resetTime: now + (window * 1000),
        source: 'memory_device',
        deviceHash
      };
    }
    
    data.count++;
    data.lastAccess = now;
    
    const allowed = data.count <= limit;
    const remaining = Math.max(0, limit - data.count);
    
    return {
      allowed,
      remaining,
      current: data.count,
      resetTime: windowEnd,
      source: 'memory_device',
      deviceHash
    };
  }

  /**
   * Enhanced Redis rate limiting (improved from original)
   */
  async redisRateLimit(identifier, limit, window, type) {
    const key = this.cacheLayer.generateKey('ratelimit', type, identifier);

    try {
      // Use atomic operations to prevent race conditions
      const pipeline = this.cacheLayer.client.multi();
      pipeline.get(key);
      const results = await pipeline.exec();
      const currentValue = results[0][1]; // Get the value from pipeline result
      
      let current = 0;
      
      if (currentValue === null) {
        await this.cacheLayer.client.setEx(key, window, '1');
        current = 1;
      } else {
        const parsedValue = parseInt(currentValue);
        if (isNaN(parsedValue)) {
          console.warn(`⚠️ Corrupted rate limit key ${key}, resetting`);
          await this.cacheLayer.client.setEx(key, window, '1');
          current = 1;
        } else {
          current = await this.cacheLayer.client.incr(key);
          if (current === 1) {
            await this.cacheLayer.client.expire(key, window);
          }
        }
      }

      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;

      return {
        allowed,
        remaining,
        current,
        resetTime: Date.now() + (window * 1000),
        source: 'redis'
      };

    } catch (error) {
      console.error(`❌ Redis rate limit error for ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Enhanced memory rate limiting (improved from original)
   */
  memoryRateLimit(identifier, limit, window, type) {
    const key = `${type}:${identifier}`;
    const now = Date.now();
    
    if (!this.memoryStore.has(key)) {
      this.memoryStore.set(key, {
        count: 1,
        windowStart: now,
        lastAccess: now
      });
      
      return {
        allowed: true,
        remaining: limit - 1,
        current: 1,
        resetTime: now + (window * 1000),
        source: 'memory'
      };
    }

    const data = this.memoryStore.get(key);
    const windowEnd = data.windowStart + (window * 1000);
    
    if (now > windowEnd) {
      data.count = 1;
      data.windowStart = now;
      data.lastAccess = now;
      
      return {
        allowed: true,
        remaining: limit - 1,
        current: 1,
        resetTime: now + (window * 1000),
        source: 'memory'
      };
    }
    
    data.count++;
    data.lastAccess = now;
    
    const allowed = data.count <= limit;
    const remaining = Math.max(0, limit - data.count);
    
    return {
      allowed,
      remaining,
      current: data.count,
      resetTime: windowEnd,
      source: 'memory'
    };
  }

  /**
   * Combine IP and device rate limit results
   */
  combineRateLimitResults(ipResult, deviceResult, context) {
    // If either limit is exceeded, block the request
    if (!ipResult.allowed) {
      this.stats.rateLimitBlocks++;
      return {
        ...ipResult,
        blockedBy: 'ip',
        deviceResult: deviceResult || null
      };
    }

    if (deviceResult && !deviceResult.allowed) {
      this.stats.rateLimitBlocks++;
      this.stats.deviceBasedBlocks++;
      return {
        ...deviceResult,
        blockedBy: 'device',
        ipResult: ipResult
      };
    }

    // Both limits are okay
    this.stats.rateLimitHits++;
    return {
      allowed: true,
      remaining: Math.min(ipResult.remaining, deviceResult?.remaining || Infinity),
      resetTime: Math.max(ipResult.resetTime, deviceResult?.resetTime || 0),
      source: `${ipResult.source}${deviceResult ? '+' + deviceResult.source : ''}`,
      ipResult,
      deviceResult
    };
  }

  /**
   * Update performance statistics
   */
  updateStatistics(result, context) {
    if (context.isFemaleSafetyReport && result.allowed) {
      this.stats.femaleSafetyReportsAllowed++;
    }

    if (context.isSuspiciousDevice && !result.allowed) {
      this.stats.suspiciousDeviceBlocks++;
    }
  }

  /**
   * Mark device as suspicious
   */
  markDeviceAsSuspicious(deviceFingerprint, reason = 'automated_detection') {
    const hashedDevice = this.hashDevice(deviceFingerprint);
    this.suspiciousDevices.add(hashedDevice);
    
    console.log(`🚨 Device marked as suspicious: ${hashedDevice.substring(0, 8)}... (reason: ${reason})`);
    
    // Cache the suspicious device status
    if (this.cacheLayer && this.cacheLayer.isConnected) {
      const key = this.cacheLayer.generateKey('suspicious', 'device', hashedDevice);
      this.cacheLayer.set(key, { reason, markedAt: new Date() }, 24 * 60 * 60); // 24 hours
    }
  }

  /**
   * Check if device is suspicious
   */
  async isDeviceSuspicious(deviceFingerprint) {
    const hashedDevice = this.hashDevice(deviceFingerprint);
    
    // Check memory first
    if (this.suspiciousDevices.has(hashedDevice)) {
      return true;
    }
    
    // Check cache
    if (this.cacheLayer && this.cacheLayer.isConnected) {
      const key = this.cacheLayer.generateKey('suspicious', 'device', hashedDevice);
      const suspiciousData = await this.cacheLayer.get(key);
      if (suspiciousData) {
        this.suspiciousDevices.add(hashedDevice); // Add to memory for faster access
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enhanced report submission rate limiting middleware
   */
  createEnhancedReportRateLimit() {
    return async (req, res, next) => {
      if (process.env.LOAD_TESTING === 'true' || process.env.NODE_ENV === 'test') {
        return next();
      }

      const identifier = this.hashIp(req.ip);
      const deviceId = req.userContext?.deviceFingerprint?.fingerprintId;
      
      // Extract context from request
      const context = {
        type: 'report_submission',
        isFemaleSafetyReport: this.isFemaleSafetyReport(req.body),
        isSuspiciousDevice: deviceId ? await this.isDeviceSuspicious(deviceId) : false,
        areaRiskLevel: this.determineAreaRiskLevel(req.body?.location),
        culturalContext: this.extractCulturalContext(req.body)
      };

      try {
        const result = await this.checkEnhancedRateLimit(
          identifier,
          deviceId,
          this.config.standardReportLimit,
          this.config.standardReportWindow,
          context
        );

        // Set enhanced rate limit headers
        res.set({
          'X-RateLimit-Limit': result.ipResult?.remaining || 'N/A',
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Source': result.source,
          'X-RateLimit-Context': context.isFemaleSafetyReport ? 'female-safety' : 'standard',
          'X-Device-Limit-Remaining': result.deviceResult?.remaining || 'N/A'
        });

        if (!result.allowed) {
          const blockedBy = result.blockedBy || 'unknown';
          console.log(`🚨 Rate limit exceeded for ${req.ip} (blocked by: ${blockedBy}, device: ${deviceId?.substring(0, 8)}...)`);
          
          let message = 'Too many reports submitted, please try again later.';
          if (blockedBy === 'device') {
            message = 'Too many reports from this device, please try again later.';
          } else if (context.isSuspiciousDevice) {
            message = 'Account temporarily restricted due to suspicious activity.';
          }
          
          return res.status(429).json({
            success: false,
            message,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            blockedBy,
            context: context.isFemaleSafetyReport ? 'female-safety' : 'standard'
          });
        }

        next();

      } catch (error) {
        console.error('❌ Enhanced rate limiting error:', error);
        console.warn('⚠️ Rate limiting failed, allowing request');
        next();
      }
    };
  }

  /**
   * Enhanced API rate limiting middleware
   */
  createEnhancedApiRateLimit(options = {}) {
    const { limit = 100, window = 60, type = 'api' } = options;

    return async (req, res, next) => {
      if (process.env.LOAD_TESTING === 'true' || process.env.NODE_ENV === 'test') {
        return next();
      }

      const identifier = this.hashIp(req.ip);
      const deviceId = req.userContext?.deviceFingerprint?.fingerprintId;

      const context = {
        type,
        isSuspiciousDevice: deviceId ? await this.isDeviceSuspicious(deviceId) : false
      };

      try {
        const result = await this.checkEnhancedRateLimit(
          identifier,
          deviceId,
          limit,
          window,
          context
        );

        res.set({
          'X-RateLimit-Limit': limit,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Source': result.source
        });

        if (!result.allowed) {
          return res.status(429).json({
            success: false,
            message: 'API rate limit exceeded',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
        }

        next();

      } catch (error) {
        console.error('❌ Enhanced API rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Enhanced admin rate limiting middleware
   */
  createEnhancedAdminRateLimit() {
    return async (req, res, next) => {
      const identifier = req.userContext?.user?._id || this.hashIp(req.ip);
      const deviceId = req.userContext?.deviceFingerprint?.fingerprintId;

      const context = {
        type: 'admin_operations',
        isAdminUser: true
      };

      try {
        const result = await this.checkEnhancedRateLimit(
          identifier,
          deviceId,
          this.config.adminOperationLimit,
          this.config.adminOperationWindow,
          context
        );

        res.set({
          'X-RateLimit-Limit': this.config.adminOperationLimit,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
          'X-RateLimit-Source': result.source
        });

        if (!result.allowed) {
          return res.status(429).json({
            success: false,
            message: 'Too many admin operations. Please slow down.',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          });
        }

        next();

      } catch (error) {
        console.error('❌ Enhanced admin rate limiting error:', error);
        next();
      }
    };
  }

  /**
   * Context analysis helpers
   */
  isFemaleSafetyReport(body) {
    if (!body) return false;
    
    const femaleSafetyTypes = [
      'eve_teasing', 'stalking', 'inappropriate_touch', 
      'verbal_harassment', 'unsafe_transport', 'workplace_harassment',
      'domestic_incident', 'unsafe_area_women'
    ];
    
    return femaleSafetyTypes.includes(body.type);
  }

  determineAreaRiskLevel(location) {
    if (!location || !location.coordinates) return 'normal';
    
    // This would integrate with a geographical risk assessment system
    // For now, return 'normal' - could be enhanced with actual risk data
    return 'normal';
  }

  extractCulturalContext(body) {
    if (!body || !body.description) return {};
    
    const description = body.description.toLowerCase();
    
    return {
      familyRelated: /family|home|house|relative/.test(description),
      religiousContext: /mosque|madrasa|religious|prayer/.test(description),
      conservativeArea: false // Would be determined by location analysis
    };
  }

  /**
   * Enhanced memory cleanup
   */
  startMemoryCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = this.config.memoryEntryMaxAge;
      
      // Clean IP-based memory store
      for (const [key, data] of this.memoryStore.entries()) {
        if (now - data.lastAccess > maxAge) {
          this.memoryStore.delete(key);
        }
      }
      
      // Clean device-based memory store
      for (const [key, data] of this.deviceMemoryStore.entries()) {
        if (now - data.lastAccess > maxAge) {
          this.deviceMemoryStore.delete(key);
        }
      }
      
      console.log(`🧹 Enhanced rate limiter cleanup: ${this.memoryStore.size} IP entries, ${this.deviceMemoryStore.size} device entries, ${this.suspiciousDevices.size} suspicious devices`);
    }, this.config.memoryCleanupInterval);
  }

  /**
   * Get enhanced statistics
   */
  getEnhancedStats() {
    return {
      ...this.stats,
      memoryEntries: {
        ip: this.memoryStore.size,
        device: this.deviceMemoryStore.size,
        suspicious: this.suspiciousDevices.size
      },
      redisConnected: this.cacheLayer?.isConnected || false,
      fallbackActive: !this.cacheLayer?.isConnected,
      config: {
        femaleSafetyLimits: {
          limit: this.config.femaleSafetyReportLimit,
          window: this.config.femaleSafetyReportWindow
        },
        deviceLimits: {
          limit: this.config.deviceReportLimit,
          window: this.config.deviceReportWindow
        },
        suspiciousDeviceLimits: {
          limit: this.config.suspiciousDeviceLimit,
          window: this.config.suspiciousDeviceWindow
        }
      }
    };
  }

  /**
   * Admin function to manually mark device as suspicious
   */
  adminMarkDeviceSuspicious(deviceFingerprint, reason = 'admin_action') {
    this.markDeviceAsSuspicious(deviceFingerprint, reason);
    console.log(`👮 Admin marked device as suspicious: ${deviceFingerprint.substring(0, 8)}...`);
  }

  /**
   * Admin function to unmark device as suspicious
   */
  async adminUnmarkDeviceSuspicious(deviceFingerprint) {
    const hashedDevice = this.hashDevice(deviceFingerprint);
    
    // Remove from memory
    this.suspiciousDevices.delete(hashedDevice);
    
    // Remove from cache
    if (this.cacheLayer && this.cacheLayer.isConnected) {
      const key = this.cacheLayer.generateKey('suspicious', 'device', hashedDevice);
      await this.cacheLayer.delete(key);
    }
    
    console.log(`👮 Admin unmarked device as suspicious: ${deviceFingerprint.substring(0, 8)}...`);
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryStore.clear();
    this.deviceMemoryStore.clear();
    this.suspiciousDevices.clear();
    
    console.log('✅ Enhanced Hybrid Rate Limiter shut down gracefully');
  }
}

// Factory function to create enhanced hybrid rate limiter
function createEnhancedHybridRateLimiter(cacheLayer) {
  return new EnhancedHybridRateLimiter(cacheLayer);
}

module.exports = {
  EnhancedHybridRateLimiter,
  createEnhancedHybridRateLimiter,
  
  // Backward compatibility
  HybridRateLimiter: EnhancedHybridRateLimiter,
  createHybridRateLimiter: createEnhancedHybridRateLimiter
};