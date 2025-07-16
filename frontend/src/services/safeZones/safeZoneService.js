// === frontend/src/services/safeZones/safeZoneService.js ===
// Safe Zone Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 433-650 approximately)
// Contains: Safe zone CRUD, admin management, analytics, import/export, batch operations

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Safe Zone Service Class
 * EXTRACTED from original ApiService safe zone methods
 * Preserves ALL original functionality including:
 * - Public safe zone access with location filtering
 * - Admin safe zone management (CRUD operations)
 * - Safe zone analytics and insights
 * - Import/export functionality
 * - Batch operations for efficiency
 * - Caching integration with apiClient
 * - Female safety categories support
 */
class SafeZoneService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== PUBLIC SAFE ZONE METHODS ==========

  // Get public safe zones for map display (PRESERVED EXACTLY - Original Lines 435-455)
  async getSafeZones(options = {}) {
    const params = new URLSearchParams();
    
    // Location-based filtering (PRESERVED EXACTLY - Original Lines 438-442)
    if (options.lat) params.append('lat', options.lat);
    if (options.lng) params.append('lng', options.lng);
    if (options.radius) params.append('radius', options.radius);
    
    // Type and safety filtering (PRESERVED EXACTLY - Original Lines 444-449)
    if (options.minSafety) params.append('minSafety', options.minSafety);
    if (options.zoneType) params.append('zoneType', options.zoneType);
    if (options.category) params.append('category', options.category);
    if (options.district) params.append('district', options.district);
    if (options.limit) params.append('limit', options.limit);

    // Enhanced version additions (PRESERVED EXACTLY - Original Lines 451-452)
    if (options.includeFemaleCategories) params.append('includeFemaleCategories', 'true');

    const queryString = params.toString();
    const endpoint = `/safezones${queryString ? `?${queryString}` : ''}`;
    
    return this.apiClient.request(endpoint);
  }

  // Get nearby safe zones (PRESERVED EXACTLY - Original Lines 457-459)
  async getNearbySafeZones(lat, lng, radius = 2000, minSafety = 6) {
    return this.getSafeZones({ lat, lng, radius, minSafety });
  }

  // Get specific safe zone by ID (PRESERVED EXACTLY - Original Lines 461-463)
  async getSafeZone(id) {
    return this.apiClient.request(`/safezones/${id}`);
  }

  // Get safe zones by district/location (PRESERVED EXACTLY - Original Lines 465-477)
  async getSafeZonesByLocation(district, options = {}) {
    const params = new URLSearchParams();
    
    if (options.thana) params.append('thana', options.thana);
    if (options.zoneType) params.append('zoneType', options.zoneType);
    if (options.minSafety) params.append('minSafety', options.minSafety);
    if (options.limit) params.append('limit', options.limit);

    const queryString = params.toString();
    const endpoint = `/safezones/location/${district}${queryString ? `?${queryString}` : ''}`;
    
    return this.apiClient.request(endpoint);
  }

  // Get public safe zone analytics (PRESERVED EXACTLY - Original Lines 479-481)
  async getSafeZoneAnalytics() {
    return this.apiClient.request('/safezones/analytics/public');
  }

  // ========== ADMIN SAFE ZONE METHODS ==========

  // Get all safe zones (PRESERVED EXACTLY - Original Lines 485-502)
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
    
    return this.apiClient.request(endpoint);
  }

  // Create new safe zone (PRESERVED EXACTLY - Original Lines 504-509)
  async createSafeZone(safeZoneData) {
    return this.apiClient.request('/safezones/admin', {
      method: 'POST',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Update safe zone (PRESERVED EXACTLY - Original Lines 511-516)
  async updateSafeZone(id, safeZoneData) {
    return this.apiClient.request(`/safezones/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Delete safe zone (PRESERVED EXACTLY - Original Lines 518-522)
  async deleteSafeZone(id) {
    return this.apiClient.request(`/safezones/admin/${id}`, {
      method: 'DELETE'
    });
  }

  // Bulk update safe zone statuses (PRESERVED EXACTLY - Original Lines 524-530)
  async bulkUpdateSafeZoneStatus(safeZoneIds, status) {
    return this.apiClient.request('/safezones/admin/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({ safeZoneIds, status })
    });
  }

  // Enhanced version method name (PRESERVED EXACTLY - Original Lines 532-534)
  async bulkUpdateSafeZones(safeZoneIds, status) {
    return this.bulkUpdateSafeZoneStatus(safeZoneIds, status);
  }

  // Get admin safe zone analytics (PRESERVED EXACTLY - Original Lines 536-538)
  async getAdminSafeZoneAnalytics() {
    return this.apiClient.request('/safezones/admin/analytics');
  }

  // Import safe zones from data (PRESERVED EXACTLY - Original Lines 540-545)
  async importSafeZones(safeZones, source = 'import', overwrite = false) {
    return this.apiClient.request('/safezones/admin/import', {
      method: 'POST',
      body: JSON.stringify({ safeZones, source, overwrite })
    });
  }

  // Export safe zones data (PRESERVED EXACTLY - Original Lines 547-550)
  async exportSafeZones(format = 'json', status = 'active') {
    const params = new URLSearchParams({ format, status });
    return this.apiClient.request(`/safezones/admin/export?${params}`);
  }

  // ========== CACHE MANAGEMENT (PRESERVED EXACTLY) ==========

  // Get cached safe zones (delegation to apiClient - PRESERVED EXACTLY)
  getCachedSafeZones(key) {
    return this.apiClient.getCachedSafeZones(key);
  }

  // Set cached safe zones (delegation to apiClient - PRESERVED EXACTLY)
  setCachedSafeZones(key, data) {
    return this.apiClient.setCachedSafeZones(key, data);
  }

  // Clear safe zone cache (PRESERVED EXACTLY - delegation to apiClient)
  clearSafeZoneCache() {
    return this.apiClient.clearSafeZoneCache();
  }

  // ========== BATCH OPERATIONS ==========

  // Batch get multiple safe zones by IDs (PRESERVED EXACTLY - Original Lines 600-625)
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

  // Batch create multiple safe zones (PRESERVED EXACTLY - Original Lines 627-650)
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

  // ========== UTILITY METHODS ==========

  // Validate safe zone data for creation/update
  validateSafeZoneData(safeZoneData) {
    const errors = [];
    
    // Required fields validation
    if (!safeZoneData.name || safeZoneData.name.trim().length < 3) {
      errors.push('Safe zone name must be at least 3 characters');
    }
    
    if (!safeZoneData.location || !safeZoneData.location.coordinates) {
      errors.push('Location coordinates are required');
    } else {
      const [lng, lat] = safeZoneData.location.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        errors.push('Invalid location coordinates');
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        errors.push('Location coordinates out of valid range');
      }
    }
    
    if (!safeZoneData.category || safeZoneData.category.trim().length === 0) {
      errors.push('Safe zone category is required');
    }
    
    if (safeZoneData.safetyScore !== undefined) {
      if (typeof safeZoneData.safetyScore !== 'number' || 
          safeZoneData.safetyScore < 0 || safeZoneData.safetyScore > 10) {
        errors.push('Safety score must be a number between 0 and 10');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format safe zone data for display
  formatSafeZoneForDisplay(safeZone) {
    return {
      id: safeZone._id || safeZone.id,
      name: safeZone.name,
      category: safeZone.category,
      zoneType: safeZone.zoneType || 'public',
      coordinates: safeZone.location?.coordinates || [0, 0],
      address: safeZone.location?.address || 'Address not provided',
      district: safeZone.location?.district || 'Unknown',
      safetyScore: safeZone.safetyScore || 0,
      status: safeZone.status || 'pending',
      verificationStatus: safeZone.verificationStatus || 'pending',
      createdAt: safeZone.createdAt,
      updatedAt: safeZone.updatedAt,
      features: safeZone.features || [],
      accessibility: safeZone.accessibility || {},
      operatingHours: safeZone.operatingHours || {},
      contactInfo: safeZone.contactInfo || {}
    };
  }

  // Calculate distance between two coordinates (utility method)
  calculateDistance(coord1, coord2) {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Check if coordinates are within Bangladesh bounds
  isWithinBangladesh(coordinates) {
    const [lng, lat] = coordinates;
    
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

  // Generate safe zone recommendations based on area analysis
  generateSafeZoneRecommendations(coordinates, radius = 1000) {
    // This would integrate with area analysis and incident data
    // For now, return basic recommendations
    return {
      coordinates,
      radius,
      recommendations: [
        'Add more lighting in the area',
        'Increase police patrol frequency',
        'Install emergency call boxes',
        'Improve visibility and remove blind spots'
      ],
      priorityLevel: 'medium',
      estimatedImpact: 'moderate',
      implementationCost: 'medium'
    };
  }

  // ========== DELEGATION METHODS (Access to apiClient functionality) ==========

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
const safeZoneService = new SafeZoneService();

export default safeZoneService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { SafeZoneService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  getSafeZones,
  getNearbySafeZones,
  getSafeZone,
  getSafeZonesByLocation,
  getSafeZoneAnalytics,
  getAdminSafeZones,
  createSafeZone,
  updateSafeZone,
  deleteSafeZone,
  bulkUpdateSafeZoneStatus,
  bulkUpdateSafeZones,
  getAdminSafeZoneAnalytics,
  importSafeZones,
  exportSafeZones,
  getCachedSafeZones,
  setCachedSafeZones,
  clearSafeZoneCache,
  getBatchSafeZones,
  createBatchSafeZones,
  validateSafeZoneData,
  formatSafeZoneForDisplay,
  calculateDistance,
  isWithinBangladesh,
  generateSafeZoneRecommendations,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = safeZoneService;