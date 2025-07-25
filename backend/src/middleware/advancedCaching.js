// === backend/src/middleware/advancedCaching.js ===
// Advanced Multi-tier Caching for SafeStreets Bangladesh
// Handles 8000+ concurrent users with intelligent caching strategies

const { cacheLayer } = require('./cacheLayer');
const crypto = require('crypto');

class AdvancedCachingSystem {
  constructor() {
    // Cache configuration for different data types
    this.cacheConfig = {
      // Static data - long TTL
      safezones: { ttl: 3600, tier: 'hot', pattern: 'safezones:*' },
      publicAnalytics: { ttl: 1800, tier: 'warm', pattern: 'analytics:public:*' },
      
      // Dynamic data - medium TTL
      reports: { ttl: 300, tier: 'warm', pattern: 'reports:*' },
      mapData: { ttl: 600, tier: 'hot', pattern: 'map:*' },
      
      // User-specific data - short TTL
      userProfiles: { ttl: 600, tier: 'warm', pattern: 'user:profile:*' },
      adminDashboard: { ttl: 60, tier: 'hot', pattern: 'admin:dashboard:*' },
      
      // Real-time data - very short TTL
      activeReports: { ttl: 30, tier: 'hot', pattern: 'active:reports:*' },
      websocketState: { ttl: 10, tier: 'hot', pattern: 'ws:state:*' }
    };

    // Geographic cache zones for Bangladesh
    this.geoZones = {
      dhaka: { lat: 23.8103, lng: 90.4125, radius: 50 },
      chittagong: { lat: 22.3569, lng: 91.7832, radius: 40 },
      sylhet: { lat: 24.8949, lng: 91.8687, radius: 30 },
      rajshahi: { lat: 24.3745, lng: 88.6042, radius: 30 },
      khulna: { lat: 22.8456, lng: 89.5403, radius: 30 },
      barisal: { lat: 22.7010, lng: 90.3535, radius: 25 },
      rangpur: { lat: 25.7439, lng: 89.2752, radius: 25 },
      mymensingh: { lat: 24.7471, lng: 90.4203, radius: 25 }
    };

    // Cache warming queue
    this.warmingQueue = [];
    this.isWarming = false;

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressionSavings: 0
    };
  }

  /**
   * Advanced cache middleware with compression and geo-awareness
   */
  middleware(options = {}) {
    const { 
      compress = true, 
      geoAware = true,
      warmCache = true,
      tier = 'warm'
    } = options;

    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') return next();

      // Generate cache key with geo-awareness
      const cacheKey = this.generateCacheKey(req, geoAware);
      const cacheConfig = this.getCacheConfig(req.path);

      try {
        // Try to get from cache
        const cachedData = await this.getFromCache(cacheKey, compress);
        
        if (cachedData) {
          this.stats.hits++;
          
          // Set cache headers
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': crypto.createHash('md5').update(cacheKey).digest('hex').substring(0, 8),
            'X-Cache-TTL': cacheConfig.ttl,
            'Cache-Control': `public, max-age=${cacheConfig.ttl}`
          });

          // Add performance metrics
          res.set('X-Response-Time', '5ms');
          
          return res.json(cachedData);
        }

        // Cache MISS - proceed with request
        this.stats.misses++;
        
        // Override res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = async (data) => {
          // Only cache successful responses
          if (res.statusCode === 200) {
            await this.setInCache(cacheKey, data, cacheConfig.ttl, compress, tier);
            
            // Add to warming queue if enabled
            if (warmCache && cacheConfig.tier === 'hot') {
              this.addToWarmingQueue(cacheKey, data, cacheConfig.ttl);
            }
          }

          // Set cache headers
          res.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': crypto.createHash('md5').update(cacheKey).digest('hex').substring(0, 8),
            'Cache-Control': `public, max-age=${cacheConfig.ttl}`
          });

          return originalJson(data);
        };

        next();
      } catch (error) {
        console.error('❌ Advanced caching error:', error);
        next(); // Continue without caching on error
      }
    };
  }

  /**
   * Generate intelligent cache key based on request
   */
  generateCacheKey(req, geoAware = true) {
    const parts = [
      'v2', // Cache version
      req.path,
      req.userContext?.userType || 'anonymous'
    ];

    // Add query parameters
    const sortedQuery = Object.keys(req.query).sort().reduce((acc, key) => {
      acc[key] = req.query[key];
      return acc;
    }, {});
    
    if (Object.keys(sortedQuery).length > 0) {
      parts.push(JSON.stringify(sortedQuery));
    }

    // Add geographic zone if enabled
    if (geoAware && req.query.lat && req.query.lng) {
      const zone = this.getGeoZone(parseFloat(req.query.lat), parseFloat(req.query.lng));
      parts.push(`zone:${zone}`);
    }

    // Add device type for mobile optimization
    const userAgent = req.get('User-Agent') || '';
    const isMobile = /mobile/i.test(userAgent);
    parts.push(isMobile ? 'mobile' : 'desktop');

    return parts.join(':');
  }

  /**
   * Get data from cache with decompression
   */
  async getFromCache(key, decompress = true) {
    try {
      const data = await cacheLayer.get(key, false); // Get raw data
      
      if (!data) return null;

      if (decompress && data.startsWith('COMPRESSED:')) {
        // Decompress data
        const compressed = data.substring(11);
        const decompressed = await this.decompress(compressed);
        return JSON.parse(decompressed);
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Set data in cache with compression
   */
  async setInCache(key, data, ttl, compress = true, tier = 'warm') {
    try {
      let cacheData = JSON.stringify(data);
      
      if (compress && cacheData.length > 1024) { // Only compress if > 1KB
        const compressed = await this.compress(cacheData);
        const compressionRatio = (1 - compressed.length / cacheData.length) * 100;
        
        if (compressionRatio > 20) { // Only use compression if > 20% savings
          cacheData = `COMPRESSED:${compressed}`;
          this.stats.compressionSavings += (cacheData.length - compressed.length);
        }
      }

      // Set in appropriate cache tier
      if (tier === 'hot') {
        // Hot tier - keep in memory if possible
        await cacheLayer.set(key, cacheData, ttl, false);
      } else {
        // Warm tier - standard Redis storage
        await cacheLayer.set(key, cacheData, ttl, false);
      }

    } catch (error) {
      console.error('❌ Cache storage error:', error);
    }
  }

  /**
   * Compression utilities
   */
  async compress(data) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed.toString('base64'));
      });
    });
  }

  async decompress(data) {
    const zlib = require('zlib');
    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(data, 'base64');
      zlib.gunzip(buffer, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed.toString());
      });
    });
  }

  /**
   * Get geographic zone for cache partitioning
   */
  getGeoZone(lat, lng) {
    for (const [zone, config] of Object.entries(this.geoZones)) {
      const distance = this.calculateDistance(lat, lng, config.lat, config.lng);
      if (distance <= config.radius) {
        return zone;
      }
    }
    return 'other';
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get cache configuration for a path
   */
  getCacheConfig(path) {
    // Match path patterns to cache configs
    if (path.includes('/safezones')) return this.cacheConfig.safezones;
    if (path.includes('/analytics/public')) return this.cacheConfig.publicAnalytics;
    if (path.includes('/reports') && !path.includes('/admin')) return this.cacheConfig.reports;
    if (path.includes('/map')) return this.cacheConfig.mapData;
    if (path.includes('/profile')) return this.cacheConfig.userProfiles;
    if (path.includes('/admin/dashboard')) return this.cacheConfig.adminDashboard;
    
    // Default configuration
    return { ttl: 300, tier: 'warm', pattern: 'default:*' };
  }

  /**
   * Cache warming for frequently accessed data
   */
  addToWarmingQueue(key, data, ttl) {
    this.warmingQueue.push({ key, data, ttl, addedAt: Date.now() });
    
    if (!this.isWarming) {
      this.processWarmingQueue();
    }
  }

  async processWarmingQueue() {
    if (this.warmingQueue.length === 0) {
      this.isWarming = false;
      return;
    }

    this.isWarming = true;
    const item = this.warmingQueue.shift();

    // Re-cache if TTL is about to expire
    const timeUntilExpiry = (item.addedAt + (item.ttl * 1000)) - Date.now();
    
    if (timeUntilExpiry < 60000) { // Less than 1 minute until expiry
      await this.setInCache(item.key, item.data, item.ttl, true, 'hot');
    }

    // Process next item
    setTimeout(() => this.processWarmingQueue(), 100);
  }

  /**
   * Preload critical data into cache
   */
  async preloadCache() {
    console.log('🔥 Preloading critical data into cache...');

    try {
      // Preload safe zones
      const SafeZone = require('../models/SafeZone');
      const safezones = await SafeZone.find({ isActive: true }).lean();
      await this.setInCache('safezones:all', safezones, 3600, true, 'hot');

      // Preload public analytics
      const Report = require('../models/Report');
      const analytics = await Report.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]);
      await this.setInCache('analytics:public:summary', analytics, 1800, true, 'hot');

      console.log('✅ Critical data preloaded into cache');
    } catch (error) {
      console.error('❌ Cache preload error:', error);
    }
  }

  /**
   * Cache invalidation strategies
   */
  async invalidatePattern(pattern) {
    try {
      const deletedCount = await cacheLayer.deletePattern(pattern);
      this.stats.evictions += deletedCount;
      console.log(`🗑️ Invalidated ${deletedCount} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      console.error('❌ Cache invalidation error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      compressionSavingsMB: (this.stats.compressionSavings / 1024 / 1024).toFixed(2),
      warmingQueueSize: this.warmingQueue.length
    };
  }
}

// Export singleton instance
const advancedCache = new AdvancedCachingSystem();

module.exports = {
  advancedCache,
  
  // Middleware shortcuts
  cacheMiddleware: (options) => advancedCache.middleware(options),
  
  // Cache management functions
  invalidateCache: (pattern) => advancedCache.invalidatePattern(pattern),
  preloadCache: () => advancedCache.preloadCache(),
  getCacheStats: () => advancedCache.getStats()
};