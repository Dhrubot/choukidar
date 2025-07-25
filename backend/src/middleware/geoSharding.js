// === backend/src/middleware/geoSharding.js ===
// Geographic Sharding for SafeStreets Bangladesh
// Distributes data across regions for optimal performance

const { redisCluster } = require('../config/redisCluster');

class GeoShardingManager {
  constructor() {
    // Bangladesh division coordinates and configuration
    this.divisions = {
      dhaka: {
        name: 'Dhaka',
        center: { lat: 23.8103, lng: 90.4125 },
        bounds: {
          north: 24.4769,
          south: 23.2616,
          east: 91.0195,
          west: 89.6936
        },
        priority: 1, // Highest priority due to population
        dbShard: 0,
        cachePrefix: 'dhk'
      },
      chittagong: {
        name: 'Chittagong',
        center: { lat: 22.3569, lng: 91.7832 },
        bounds: {
          north: 23.1791,
          south: 20.7340,
          east: 92.6734,
          west: 91.0421
        },
        priority: 2,
        dbShard: 1,
        cachePrefix: 'ctg'
      },
      sylhet: {
        name: 'Sylhet',
        center: { lat: 24.8949, lng: 91.8687 },
        bounds: {
          north: 25.3285,
          south: 24.0958,
          east: 92.5119,
          west: 90.9911
        },
        priority: 3,
        dbShard: 2,
        cachePrefix: 'syl'
      },
      rajshahi: {
        name: 'Rajshahi',
        center: { lat: 24.3745, lng: 88.6042 },
        bounds: {
          north: 25.1211,
          south: 23.9095,
          east: 89.9414,
          west: 87.9073
        },
        priority: 3,
        dbShard: 0,
        cachePrefix: 'raj'
      },
      khulna: {
        name: 'Khulna',
        center: { lat: 22.8456, lng: 89.5403 },
        bounds: {
          north: 23.9259,
          south: 21.6461,
          east: 90.1823,
          west: 88.5440
        },
        priority: 3,
        dbShard: 1,
        cachePrefix: 'khl'
      },
      barisal: {
        name: 'Barisal',
        center: { lat: 22.7010, lng: 90.3535 },
        bounds: {
          north: 23.0488,
          south: 21.7766,
          east: 91.1315,
          west: 89.7696
        },
        priority: 4,
        dbShard: 2,
        cachePrefix: 'brs'
      },
      rangpur: {
        name: 'Rangpur',
        center: { lat: 25.7439, lng: 89.2752 },
        bounds: {
          north: 26.4461,
          south: 25.0879,
          east: 89.9604,
          west: 88.7584
        },
        priority: 4,
        dbShard: 0,
        cachePrefix: 'rgp'
      },
      mymensingh: {
        name: 'Mymensingh',
        center: { lat: 24.7471, lng: 90.4203 },
        bounds: {
          north: 25.3957,
          south: 24.1585,
          east: 91.0407,
          west: 89.8959
        },
        priority: 4,
        dbShard: 1,
        cachePrefix: 'mym'
      }
    };

    // Shard distribution strategy
    this.shardStrategy = {
      maxShardsPerRegion: 3,
      replicationFactor: 2,
      readPreference: 'nearest'
    };

    // Query routing cache
    this.routingCache = new Map();
    this.routingCacheTTL = 300000; // 5 minutes

    // Statistics
    this.stats = {
      queriesByRegion: {},
      cacheHitsByRegion: {},
      crossRegionQueries: 0
    };

    // Initialize stats
    Object.keys(this.divisions).forEach(region => {
      this.stats.queriesByRegion[region] = 0;
      this.stats.cacheHitsByRegion[region] = 0;
    });
  }

  /**
   * Determine region from coordinates
   */
  getRegionFromCoordinates(lat, lng) {
    // Check routing cache first
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = this.routingCache.get(cacheKey);
    if (cached && cached.timestamp > Date.now() - this.routingCacheTTL) {
      return cached.region;
    }

    // Find region by bounds
    for (const [key, division] of Object.entries(this.divisions)) {
      if (lat >= division.bounds.south && lat <= division.bounds.north &&
          lng >= division.bounds.west && lng <= division.bounds.east) {
        
        // Cache the result
        this.routingCache.set(cacheKey, {
          region: key,
          timestamp: Date.now()
        });
        
        return key;
      }
    }

    // Default to nearest region if outside bounds
    const nearest = this.findNearestRegion(lat, lng);
    
    // Cache the result
    this.routingCache.set(cacheKey, {
      region: nearest,
      timestamp: Date.now()
    });
    
    return nearest;
  }

  /**
   * Find nearest region using Haversine distance
   */
  findNearestRegion(lat, lng) {
    let minDistance = Infinity;
    let nearestRegion = 'dhaka'; // Default

    for (const [key, division] of Object.entries(this.divisions)) {
      const distance = this.calculateDistance(
        lat, lng,
        division.center.lat, division.center.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestRegion = key;
      }
    }

    return nearestRegion;
  }

  /**
   * Calculate distance between two points
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
   * Get database shard for a region
   */
  getDbShardForRegion(region) {
    const division = this.divisions[region];
    return division ? division.dbShard : 0;
  }

  /**
   * Get cache key with regional prefix
   */
  getRegionalCacheKey(baseKey, region) {
    const division = this.divisions[region];
    const prefix = division ? division.cachePrefix : 'def';
    return `${prefix}:${baseKey}`;
  }

  /**
   * Middleware for geographic request routing
   */
  geoRoutingMiddleware() {
    return (req, res, next) => {
      // Extract location from various sources
      let lat, lng, region;

      // 1. Check query parameters
      if (req.query.lat && req.query.lng) {
        lat = parseFloat(req.query.lat);
        lng = parseFloat(req.query.lng);
      }
      // 2. Check body
      else if (req.body && req.body.location) {
        lat = req.body.location.lat;
        lng = req.body.location.lng;
      }
      // 3. Check headers (for mobile apps)
      else if (req.headers['x-user-lat'] && req.headers['x-user-lng']) {
        lat = parseFloat(req.headers['x-user-lat']);
        lng = parseFloat(req.headers['x-user-lng']);
      }
      // 4. Use IP geolocation as fallback
      else {
        // In production, use IP geolocation service
        region = 'dhaka'; // Default fallback
      }

      // Determine region if we have coordinates
      if (lat && lng) {
        region = this.getRegionFromCoordinates(lat, lng);
      }

      // Attach geo context to request
      req.geoContext = {
        region,
        coordinates: lat && lng ? { lat, lng } : null,
        dbShard: this.getDbShardForRegion(region),
        cachePrefix: this.divisions[region]?.cachePrefix || 'def'
      };

      // Update statistics
      this.stats.queriesByRegion[region]++;

      // Add geo headers to response
      res.set({
        'X-Geo-Region': region,
        'X-Geo-Shard': req.geoContext.dbShard
      });

      next();
    };
  }

  /**
   * Get geo-aware cache key
   */
  getGeoCacheKey(req, baseKey) {
    const region = req.geoContext?.region || 'dhaka';
    return this.getRegionalCacheKey(baseKey, region);
  }

  /**
   * Query router for geo-distributed databases
   */
  getQueryOptions(req, baseOptions = {}) {
    const region = req.geoContext?.region || 'dhaka';
    const shard = this.getDbShardForRegion(region);

    return {
      ...baseOptions,
      readPreference: this.shardStrategy.readPreference,
      readPreferenceTags: [{ region }],
      hint: { region: 1 }, // Use region index
      shard
    };
  }

  /**
   * Aggregate data across regions
   */
  async aggregateAcrossRegions(model, pipeline, options = {}) {
    const { includeRegions = Object.keys(this.divisions) } = options;

    // Execute pipeline on each region's shard
    const regionalResults = await Promise.all(
      includeRegions.map(async (region) => {
        const shard = this.getDbShardForRegion(region);
        
        // Add region filter to pipeline
        const regionalPipeline = [
          { $match: { region } },
          ...pipeline
        ];

        // Execute on specific shard
        const results = await model.aggregate(regionalPipeline).read('secondary', { shard });
        
        return {
          region,
          results
        };
      })
    );

    // Merge results
    return this.mergeRegionalResults(regionalResults, options);
  }

  /**
   * Merge results from multiple regions
   */
  mergeRegionalResults(regionalResults, options = {}) {
    const { groupBy, sortBy, limit } = options;

    // Flatten all results
    let merged = regionalResults.flatMap(r => 
      r.results.map(item => ({ ...item, _region: r.region }))
    );

    // Group if specified
    if (groupBy) {
      const grouped = {};
      merged.forEach(item => {
        const key = item[groupBy];
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(item);
      });
      merged = Object.entries(grouped).map(([key, items]) => ({
        [groupBy]: key,
        items,
        count: items.length
      }));
    }

    // Sort if specified
    if (sortBy) {
      const [field, order] = sortBy.split(':');
      merged.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Limit if specified
    if (limit) {
      merged = merged.slice(0, limit);
    }

    return merged;
  }

  /**
   * Cache with geo-distribution
   */
  async geoCache(key, value, ttl, regions = []) {
    // If no regions specified, use all
    const targetRegions = regions.length > 0 ? regions : Object.keys(this.divisions);

    // Cache in multiple regions for redundancy
    const promises = targetRegions.map(region => {
      const regionalKey = this.getRegionalCacheKey(key, region);
      return redisCluster.set(regionalKey, JSON.stringify(value), ttl);
    });

    await Promise.all(promises);
  }

  /**
   * Get from geo-distributed cache
   */
  async geoGet(key, region = null) {
    if (region) {
      // Get from specific region
      const regionalKey = this.getRegionalCacheKey(key, region);
      const value = await redisCluster.get(regionalKey);
      
      if (value) {
        this.stats.cacheHitsByRegion[region]++;
        return JSON.parse(value);
      }
    } else {
      // Try all regions, return first hit
      for (const r of Object.keys(this.divisions)) {
        const regionalKey = this.getRegionalCacheKey(key, r);
        const value = await redisCluster.get(regionalKey);
        
        if (value) {
          this.stats.cacheHitsByRegion[r]++;
          
          // Track cross-region access
          if (region && region !== r) {
            this.stats.crossRegionQueries++;
          }
          
          return JSON.parse(value);
        }
      }
    }

    return null;
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalQueries = Object.values(this.stats.queriesByRegion)
      .reduce((sum, count) => sum + count, 0);
    
    const totalCacheHits = Object.values(this.stats.cacheHitsByRegion)
      .reduce((sum, count) => sum + count, 0);

    return {
      ...this.stats,
      totalQueries,
      totalCacheHits,
      crossRegionRate: totalQueries > 0 
        ? (this.stats.crossRegionQueries / totalQueries * 100).toFixed(2) + '%'
        : '0%',
      regionalDistribution: Object.entries(this.stats.queriesByRegion)
        .map(([region, count]) => ({
          region,
          queries: count,
          percentage: totalQueries > 0 
            ? (count / totalQueries * 100).toFixed(2) + '%'
            : '0%'
        }))
        .sort((a, b) => b.queries - a.queries)
    };
  }
}

// Export singleton instance
const geoSharding = new GeoShardingManager();

module.exports = {
  geoSharding,
  
  // Middleware
  geoRoutingMiddleware: () => geoSharding.geoRoutingMiddleware(),
  
  // Utility functions
  getRegionFromCoordinates: (lat, lng) => geoSharding.getRegionFromCoordinates(lat, lng),
  getGeoCacheKey: (req, key) => geoSharding.getGeoCacheKey(req, key),
  getQueryOptions: (req, options) => geoSharding.getQueryOptions(req, options),
  
  // Cache operations
  geoCache: (key, value, ttl, regions) => geoSharding.geoCache(key, value, ttl, regions),
  geoGet: (key, region) => geoSharding.geoGet(key, region),
  
  // Statistics
  getGeoStats: () => geoSharding.getStats()
};