// === Safe Zone Service Module ===
// Safe zone functionality extracted from api-old.js
// Handles location intelligence and safe zone management

import apiClient from '../core/apiClient.js';
import { calculateDistance, calculateRouteSafetyScore } from '../utils/geoUtils.js';
import logger, { logDebug, logError, logInfo } from '../utils/logger.js';

class SafeZoneService {
  constructor() {
    this.deviceFingerprint = null;
  }

  // Set device fingerprint for all requests
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
  }

  // ========== PUBLIC SAFE ZONE QUERIES (Lines 801-900) ==========

  // Get public safe zones for map display
  async getSafeZones(options = {}) {
    const params = new URLSearchParams();
    
    // Location-based filtering
    if (options.lat) params.append('lat', options.lat);
    if (options.lng) params.append('lng', options.lng);
    if (options.radius) params.append('radius', options.radius);
    
    // Type and safety filtering
    if (options.minSafety) params.append('minSafety', options.minSafety);
    if (options.zoneType) params.append('zoneType', options.zoneType);
    if (options.category) params.append('category', options.category);
    if (options.district) params.append('district', options.district);
    if (options.limit) params.append('limit', options.limit);

    // Enhanced version additions
    if (options.includeFemaleCategories) params.append('includeFemaleCategories', 'true');

    const queryString = params.toString();
    const endpoint = `/safezones${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.request(endpoint);
  }

  // Get nearby safe zones (shorthand method)
  async getNearbySafeZones(lat, lng, radius = 2000, minSafety = 6) {
    return this.getSafeZones({ lat, lng, radius, minSafety });
  }

  // Get specific safe zone by ID
  async getSafeZone(id) {
    return apiClient.request(`/safezones/${id}`);
  }

  // Get safe zones by district/location
  async getSafeZonesByLocation(district, options = {}) {
    const params = new URLSearchParams();
    
    if (options.thana) params.append('thana', options.thana);
    if (options.zoneType) params.append('zoneType', options.zoneType);
    if (options.minSafety) params.append('minSafety', options.minSafety);
    if (options.limit) params.append('limit', options.limit);

    const queryString = params.toString();
    const endpoint = `/safezones/location/${district}${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.request(endpoint);
  }

  // Get public safe zone analytics
  async getSafeZoneAnalytics() {
    return apiClient.request('/safezones/analytics/public');
  }

  // ========== ADMIN SAFE ZONE MANAGEMENT (Lines 901-1000) ==========

  // Get all safe zones (admin only)
  async getAdminSafeZones(options = {}) {
    const params = new URLSearchParams();
    
    if (options.status) params.append('status', options.status);
    if (options.zoneType) params.append('zoneType', options.zoneType);
    if (options.verificationStatus) params.append('verificationStatus', options.verificationStatus);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);

    const queryString = params.toString();
    const endpoint = `/safezones/admin/all${queryString ? `?${queryString}` : ''}`;
    
    return apiClient.request(endpoint);
  }

  // Create new safe zone (admin only) - Enhanced version endpoint
  async createSafeZone(safeZoneData) {
    return apiClient.request('/safezones/admin', {
      method: 'POST',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Update safe zone (admin only)
  async updateSafeZone(id, safeZoneData) {
    return apiClient.request(`/safezones/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Delete safe zone (admin only)
  async deleteSafeZone(id) {
    return apiClient.request(`/safezones/admin/${id}`, {
      method: 'DELETE'
    });
  }

  // Bulk update safe zone statuses (admin only)
  async bulkUpdateSafeZoneStatus(safeZoneIds, status) {
    return apiClient.request('/safezones/admin/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({ safeZoneIds, status })
    });
  }

  // Enhanced version method name
  async bulkUpdateSafeZones(safeZoneIds, status) {
    return this.bulkUpdateSafeZoneStatus(safeZoneIds, status);
  }

  // Get admin safe zone analytics
  async getAdminSafeZoneAnalytics() {
    return apiClient.request('/safezones/admin/analytics');
  }

  // Import safe zones from data (admin only)
  async importSafeZones(safeZones, source = 'import', overwrite = false) {
    return apiClient.request('/safezones/admin/import', {
      method: 'POST',
      body: JSON.stringify({ safeZones, source, overwrite })
    });
  }

  // Export safe zones data (admin only)
  async exportSafeZones(format = 'json', status = 'active') {
    const params = new URLSearchParams({ format, status });
    return apiClient.request(`/safezones/admin/export?${params}`);
  }

  // ========== INTELLIGENCE & ANALYSIS (Lines 1001-1100) ==========

  // Check if safe zones service is available
  async checkSafeZonesAvailability() {
    try {
      const response = await this.getSafeZoneAnalytics();
      return { available: true, data: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  // Get intelligent recommendations based on location
  async getLocationIntelligence(lat, lng) {
    try {
      const [safeZones, reports] = await Promise.all([
        this.getNearbySafeZones(lat, lng, 1000), // 1km radius
        apiClient.request('/reports') // Get all reports (could be filtered by location)
      ]);

      return {
        success: true,
        data: {
          nearbySafeZones: safeZones.features || [],
          nearbyReports: reports.data || [],
          safetyRecommendations: this.generateSafetyRecommendations(safeZones, reports),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get comprehensive area analysis
  async getAreaAnalysis(lat, lng, radius = 1000) {
    try {
      const [safeZones, reports, analytics] = await Promise.allSettled([
        this.getNearbySafeZones(lat, lng, radius),
        apiClient.request('/reports', {
          params: {
            lat,
            lng,
            radius,
            limit: 100
          }
        }),
        this.getSafeZoneAnalytics()
      ]);

      const result = {
        location: { lat, lng, radius },
        timestamp: new Date().toISOString(),
        analysis: {}
      };

      // Process safe zones data
      if (safeZones.status === 'fulfilled') {
        const zones = safeZones.value.features || [];
        result.analysis.safeZones = {
          total: zones.length,
          averageSafety: zones.length > 0 ? 
            zones.reduce((sum, z) => sum + z.properties.safetyScore, 0) / zones.length : 0,
          highSafety: zones.filter(z => z.properties.safetyScore >= 8).length,
          zones: zones.slice(0, 5) // Top 5 nearest zones
        };
      } else {
        result.analysis.safeZones = { error: safeZones.reason?.message };
      }

      // Process reports data for threat analysis
      if (reports.status === 'fulfilled') {
        const reportsData = reports.value.data || [];
        
        // Analyze for coordinated attacks (reports from same IP/location within short time)
        const coordinatedAttacks = [];
        const recentReports = reportsData.filter(r => 
          new Date(r.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );
        
        // Group by location proximity and time
        const locationGroups = {};
        recentReports.forEach(report => {
          if (report.location?.coordinates) {
            const key = `${Math.round(report.location.coordinates[1] * 100)}_${Math.round(report.location.coordinates[0] * 100)}`;
            if (!locationGroups[key]) locationGroups[key] = [];
            locationGroups[key].push(report);
          }
        });
        
        // Identify coordinated attacks (3+ reports in same area within 2 hours)
        Object.values(locationGroups).forEach(group => {
          if (group.length >= 3) {
            const timeSpread = Math.max(...group.map(r => new Date(r.createdAt))) - 
                             Math.min(...group.map(r => new Date(r.createdAt)));
            if (timeSpread <= 2 * 60 * 60 * 1000) { // 2 hours
              coordinatedAttacks.push({
                type: 'Coordinated Reporting Campaign',
                location: group[0].location,
                count: group.length,
                severity: 'high',
                timestamp: group[0].createdAt,
                description: `${group.length} reports in same area within 2 hours`
              });
            }
          }
        });
        
        result.analysis.incidents = {
          total: reportsData.length,
          recent: recentReports.length,
          coordinatedAttacks,
          crossBorderThreats: [] // Placeholder for cross-border analysis
        };
      } else {
        result.analysis.incidents = { 
          error: reports.reason?.message,
          coordinatedAttacks: [],
          crossBorderThreats: []
        };
      }

      // Process analytics
      if (analytics.status === 'fulfilled') {
        result.analysis.overview = analytics.value.data;
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get route safety analysis (client-side preparation for routing service)
  async getRouteSafetyData(startLat, startLng, endLat, endLng) {
    try {
      // Get safe zones along potential route corridor
      const midLat = (startLat + endLat) / 2;
      const midLng = (startLng + endLng) / 2;
      
      // Calculate rough corridor radius
      const distance = calculateDistance(startLat, startLng, endLat, endLng);
      const corridorRadius = Math.max(500, distance / 2); // At least 500m, or half the route distance
      
      const safeZones = await this.getNearbySafeZones(midLat, midLng, corridorRadius);
      
      return {
        success: true,
        data: {
          route: { start: [startLat, startLng], end: [endLat, endLng] },
          distance,
          corridorSafeZones: safeZones.features || [],
          safetyScore: calculateRouteSafetyScore(safeZones.features || []),
          recommendations: this.generateRouteRecommendations(safeZones.features || [])
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== CACHING AND BATCH OPERATIONS (Lines 1101-1200) ==========

  // Simple in-memory cache for safe zones
  async getCachedSafeZones(cacheKey, fetchFunction) {
    const cached = apiClient._safeZoneCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < apiClient._cacheExpiry) {
      logDebug('Using cached safe zones data', 'SafeZoneService', { cacheKey });
      return cached.data;
    }

    try {
      const freshData = await fetchFunction();
      apiClient._safeZoneCache.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
      });
      
      // Cleanup old cache entries
      if (apiClient._safeZoneCache.size > 50) {
        const oldestKey = apiClient._safeZoneCache.keys().next().value;
        apiClient._safeZoneCache.delete(oldestKey);
      }
      
      return freshData;
    } catch (error) {
      // If fresh fetch fails, return stale cache if available
      if (cached) {
        logError('Using stale cache due to fetch error', 'SafeZoneService', { error: error.message, cacheKey });
        return cached.data;
      }
      throw error;
    }
  }

  // Clear safe zone cache
  clearSafeZoneCache() {
    apiClient.clearSafeZoneCache();
  }

  // Batch get multiple safe zones by IDs
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

  // Batch create multiple safe zones (admin only)
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

  // ========== SAFETY RECOMMENDATIONS (Lines 1201-1273) ==========

  // Generate basic safety recommendations (client-side logic)
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

  // Generate route recommendations
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
}

// Create and export singleton instance
const safeZoneService = new SafeZoneService();

export default safeZoneService;
export { SafeZoneService };