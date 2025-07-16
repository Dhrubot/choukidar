// === frontend/src/services/utils/apiUtils.js ===
// API Utilities Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js utility methods
// Contains: Mathematical calculations, caching utilities, batch operations, formatting helpers

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * API Utilities Service Class
 * EXTRACTED from original ApiService utility methods
 * Preserves ALL original functionality including:
 * - Distance calculations (Haversine formula)
 * - Route safety scoring algorithms
 * - Safety and route recommendations generation
 * - Caching utilities for safe zones
 * - Batch operations for efficiency
 * - Data formatting and validation helpers
 */
class ApiUtilsService {
  constructor() {
    // Use the core API client for caching and basic operations
    this.apiClient = apiClient;
  }

  // ========== MATHEMATICAL UTILITIES (PRESERVED EXACTLY) ==========

  // Calculate distance between two points (PRESERVED EXACTLY - Original Lines 680-692)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Calculate route safety score (PRESERVED EXACTLY - Original Lines 694-703)
  calculateRouteSafetyScore(safeZones) {
    if (safeZones.length === 0) return 3; // Low safety if no safe zones

    const avgSafety = safeZones.reduce((sum, zone) => 
      sum + zone.properties.safetyScore, 0) / safeZones.length;
    
    const coverage = Math.min(safeZones.length / 3, 1); // Normalize coverage (max 3 zones = full coverage)
    
    return Math.round((avgSafety * 0.7 + coverage * 10 * 0.3) * 10) / 10;
  }

  // ========== RECOMMENDATION GENERATORS (PRESERVED EXACTLY) ==========

  // Generate safety recommendations (PRESERVED EXACTLY - Original Lines 705-730)
  generateSafetyRecommendations(safeZones, reports) {
    const recommendations = [];
    
    if (safeZones.features && safeZones.features.length > 0) {
      const highSafetyZones = safeZones.features.filter(zone => 
        zone.properties.safetyScore >= 8
      );
      
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'safe_zone',
          priority: 'high',
          message: `${highSafetyZones.length} high-safety zones nearby`,
          zones: highSafetyZones.slice(0, 3) // Top 3 zones
        });
      }
    }

    if (reports.data && reports.data.length > 0) {
      const recentReports = reports.data.filter(report => {
        const reportDate = new Date(report.createdAt || report.timestamp);
        const daysDiff = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Reports from last 7 days
      });

      if (recentReports.length > 0) {
        recommendations.push({
          type: 'caution',
          priority: 'medium',
          message: `${recentReports.length} recent incidents in the area`,
          suggestion: 'Exercise extra caution and consider safer routes'
        });
      }
    }

    return recommendations;
  }

  // Generate route recommendations (PRESERVED EXACTLY - Original Lines 732-760)
  generateRouteRecommendations(safeZones) {
    const recommendations = [];
    
    if (safeZones.length === 0) {
      recommendations.push({
        type: 'warning',
        message: 'No safe zones identified along this route',
        suggestion: 'Consider alternative routes with better safety coverage'
      });
    } else {
      const highSafetyZones = safeZones.filter(z => z.properties.safetyScore >= 8);
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'positive',
          message: `Route passes near ${highSafetyZones.length} high-safety zones`,
          suggestion: 'This appears to be a relatively safe route'
        });
      }
      
      const policeStations = safeZones.filter(z => z.properties.zoneType === 'police_station');
      if (policeStations.length > 0) {
        recommendations.push({
          type: 'info',
          message: `${policeStations.length} police stations along route`,
          suggestion: 'Good emergency support availability'
        });
      }
    }
    
    return recommendations;
  }

  // ========== CACHING UTILITIES (PRESERVED EXACTLY) ==========

  // Get cached safe zones (PRESERVED EXACTLY - delegation to apiClient)
  getCachedSafeZones(key) {
    return this.apiClient.getCachedSafeZones(key);
  }

  // Set cached safe zones (PRESERVED EXACTLY - delegation to apiClient)
  setCachedSafeZones(key, data) {
    return this.apiClient.setCachedSafeZones(key, data);
  }

  // Clear safe zone cache (PRESERVED EXACTLY - delegation to apiClient)
  clearSafeZoneCache() {
    return this.apiClient.clearSafeZoneCache();
  }

  // Advanced cache management with fetch function (PRESERVED EXACTLY - Original Lines 762-785)
  async getCachedSafeZones(cacheKey, fetchFunction) {
    const cached = this.apiClient.getCachedSafeZones(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.apiClient._cacheExpiry) {
      console.log('🔄 Using cached safe zones data');
      return cached.data;
    }

    try {
      const freshData = await fetchFunction();
      this.apiClient.setCachedSafeZones(cacheKey, {
        data: freshData,
        timestamp: Date.now()
      });
      
      // Cleanup old cache entries
      if (this.apiClient._safeZoneCache.size > 50) {
        const oldestKey = this.apiClient._safeZoneCache.keys().next().value;
        this.apiClient._safeZoneCache.delete(oldestKey);
      }
      
      return freshData;
    } catch (error) {
      // If fresh fetch fails, return stale cache if available
      if (cached) {
        console.warn('⚠️ Using stale cache due to fetch error:', error.message);
        return cached.data;
      }
      throw error;
    }
  }

  // ========== BATCH OPERATIONS (PRESERVED EXACTLY) ==========

  // Batch get multiple safe zones by IDs (PRESERVED EXACTLY - Original Lines 789-812)
  async getBatchSafeZones(ids) {
    const results = [];
    const batchSize = 5; // Process in batches to avoid overwhelming the server
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchPromises = batch.map(id => 
        this.getSafeZone(id).catch(error => ({ error: error.message, id }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return {
      success: true,
      results,
      total: ids.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    };
  }

  // Batch create multiple safe zones (PRESERVED EXACTLY - Original Lines 814-840)
  async createBatchSafeZones(safeZonesData) {
    const results = [];
    
    for (const safeZoneData of safeZonesData) {
      try {
        const result = await this.createSafeZone(safeZoneData);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          safeZone: safeZoneData.name || 'Unknown' 
        });
      }
    }
    
    return {
      success: true,
      results,
      total: safeZonesData.length,
      created: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }

  // ========== DATA FORMATTING UTILITIES ==========

  // Format coordinates for API requests
  formatCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new Error('Coordinates must be an array of [longitude, latitude]');
    }
    
    const [lng, lat] = coordinates;
    
    // Validate coordinate ranges
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      throw new Error('Coordinates must be numbers');
    }
    
    if (lng < -180 || lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    
    if (lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    
    return [
      Math.round(lng * 1000000) / 1000000, // 6 decimal places
      Math.round(lat * 1000000) / 1000000
    ];
  }

  // Format API error responses
  formatApiError(error) {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.error) {
      return error.error;
    }
    
    return 'An unknown error occurred';
  }

  // Validate report data structure
  validateReportData(reportData) {
    const errors = [];
    
    // Required fields validation
    if (!reportData.type) errors.push('Report type is required');
    if (!reportData.description || reportData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    if (!reportData.location) errors.push('Location is required');
    if (!reportData.severity || reportData.severity < 1 || reportData.severity > 5) {
      errors.push('Severity must be between 1 and 5');
    }
    
    // Location validation
    if (reportData.location && reportData.location.coordinates) {
      try {
        this.formatCoordinates(reportData.location.coordinates);
      } catch (coordError) {
        errors.push(coordError.message);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ========== GEOGRAPHIC UTILITIES ==========

  // Check if coordinates are within Bangladesh bounds
  isWithinBangladesh(coordinates) {
    const [lng, lat] = this.formatCoordinates(coordinates);
    
    // Approximate bounds for Bangladesh
    const bounds = {
      north: 26.7,
      south: 20.5,
      east: 92.7,
      west: 88.0
    };
    
    return lat >= bounds.south && lat <= bounds.north && 
           lng >= bounds.west && lng <= bounds.east;
  }

  // Calculate bounding box for a given center and radius
  calculateBoundingBox(centerLat, centerLng, radiusMeters) {
    const earth = 6378137; // Earth's radius in meters
    const pi = Math.PI;
    
    const latDelta = (radiusMeters / earth) * (180 / pi);
    const lngDelta = (radiusMeters / earth) * (180 / pi) / Math.cos(centerLat * pi / 180);
    
    return {
      north: centerLat + latDelta,
      south: centerLat - latDelta,
      east: centerLng + lngDelta,
      west: centerLng - lngDelta
    };
  }

  // Check if point is within bounding box
  isPointInBounds(coordinates, bounds) {
    const [lng, lat] = this.formatCoordinates(coordinates);
    
    return lat >= bounds.south && lat <= bounds.north &&
           lng >= bounds.west && lng <= bounds.east;
  }

  // ========== URL AND QUERY UTILITIES ==========

  // Build query string from object
  buildQueryString(params) {
    const urlParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(item => urlParams.append(key, item));
        } else {
          urlParams.append(key, value.toString());
        }
      }
    });
    
    return urlParams.toString();
  }

  // Parse query string to object
  parseQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    
    for (const [key, value] of params.entries()) {
      if (result[key]) {
        // Convert to array if multiple values
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  // ========== DELEGATION METHODS (Access to apiClient functionality) ==========

  // Get safe zone (delegation for batch operations)
  async getSafeZone(id) {
    return this.apiClient.request(`/safezones/${id}`);
  }

  // Create safe zone (delegation for batch operations)
  async createSafeZone(safeZoneData) {
    return this.apiClient.request('/safezones/admin', {
      method: 'POST',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Set device fingerprint (delegation to apiClient)
  setDeviceFingerprint(fingerprint) {
    return this.apiClient.setDeviceFingerprint(fingerprint);
  }

  // Get device fingerprint (delegation to apiClient)
  getDeviceFingerprint() {
    return this.apiClient.getDeviceFingerprint();
  }

  // Request with retry (delegation to apiClient)
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    return this.apiClient.requestWithRetry(endpoint, options, maxRetries);
  }

  // Batch requests (delegation to apiClient)
  async batchRequests(requests) {
    return this.apiClient.batchRequests(requests);
  }
}

// Create and export singleton instance (PRESERVED EXACTLY - Original pattern)
const apiUtilsService = new ApiUtilsService();

export default apiUtilsService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { ApiUtilsService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  calculateDistance,
  calculateRouteSafetyScore,
  generateSafetyRecommendations,
  generateRouteRecommendations,
  getCachedSafeZones,
  setCachedSafeZones,
  clearSafeZoneCache,
  getBatchSafeZones,
  createBatchSafeZones,
  formatCoordinates,
  formatApiError,
  validateReportData,
  isWithinBangladesh,
  calculateBoundingBox,
  isPointInBounds,
  buildQueryString,
  parseQueryString,
  getSafeZone,
  createSafeZone,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = apiUtilsService;