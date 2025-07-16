// === frontend/src/services/api.js (COMPLETE MERGED VERSION) ===
// Enhanced API Service for SafeStreets Bangladesh
// Combines authentication, user management, safe zones intelligence, and female safety features

// API Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    // Base configuration
    this.baseURL = API_BASE_URL;
    this.deviceFingerprint = null;
    
    // Caching system from original
    this._safeZoneCache = new Map();
    this._cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // ========== DEVICE & AUTHENTICATION SETUP ==========

  // Set device fingerprint for all requests (Enhanced version)
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
  }

  // Get authentication headers (Enhanced version)
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add device fingerprint
    if (this.deviceFingerprint) {
      headers['x-device-fingerprint'] = this.deviceFingerprint;
    }

    // Add admin token if available
    const adminToken = localStorage.getItem('safestreets_admin_token');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }

    return headers;
  }

  // ========== CORE REQUEST METHODS ==========

  // Generic request method (Merged: Enhanced error handling + Original structure)
  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const config = {
        headers: this.getAuthHeaders(), // Enhanced version headers
        ...options,
      };

      console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;

    } catch (error) {
      console.error(`❌ API Error (${endpoint}):`, error);
      
      // Enhanced version error format
      return {
        success: false,
        message: error.message || 'Network error occurred',
        error: error.message
      };
    }
  }

  // Original retry logic with enhanced error handling
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.request(endpoint, options);
        if (result && !result.error) {
          return result;
        }
        lastError = new Error(result.message || 'Request failed');
      } catch (error) {
        lastError = error;
        
        // Don't retry on 4xx errors (client errors)
        if (error.message.includes('4')) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  // Enhanced retry with intelligence features (Original)
  async requestWithIntelligenceRetry(endpoint, options = {}, maxRetries = 2) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Intelligence retry attempt ${attempt} for ${endpoint}`);
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
        
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry for client errors (4xx)
        if (error.message.includes('40')) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        console.warn(`⚠️ Request failed (attempt ${attempt + 1}):`, error.message);
      }
    }
    
    throw lastError;
  }

  // Enhanced batch requests (Enhanced version)
  async batchRequests(requests) {
    try {
      const promises = requests.map(({ endpoint, options }) => 
        this.request(endpoint, options)
      );
      
      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => ({
        index,
        success: result.status === 'fulfilled' && result.value.success,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : 
               (result.value && !result.value.success ? result.value.message : null)
      }));
      
    } catch (error) {
      console.error('❌ Batch request error:', error);
      throw error;
    }
  }

  // ========== AUTHENTICATION ENDPOINTS (Enhanced Version) ==========

  // Get user context
  async getUserContext(deviceFingerprint) {
    this.setDeviceFingerprint(deviceFingerprint);
    return this.request('/auth/user/context');
  }

  // Admin login (Enhanced version)
  async adminLogin(credentials) {
    return this.request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  // Admin logout (Enhanced version)
  async adminLogout() {
    const result = await this.request('/auth/admin/logout', {
      method: 'POST'
    });
    
    // Clear stored token regardless of response
    localStorage.removeItem('safestreets_admin_token');
    return result;
  }

  // Original admin verification method
  async verifyAdminSession() {
    return this.request('/admin/verify');
  }

  // Get admin profile (Enhanced version)
  async getAdminProfile() {
    return this.request('/auth/admin/profile');
  }

  // Update user preferences (Enhanced version)
  async updateUserPreferences(preferences) {
    return this.request('/auth/user/update-preferences', {
      method: 'POST',
      body: JSON.stringify({ preferences })
    });
  }

  // Get security insights (Enhanced version)
  async getSecurityInsights() {
    return this.request('/auth/security/insights');
  }

  // Original security analytics
  async getSecurityAnalytics() {
    return this.request('/admin/analytics/security');
  }

  // ========== USER TYPE MANAGEMENT (Enhanced Version) ==========

  // Get all users (admin only)
  async getUsers(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.request(`/user-types/admin/users?${queryParams}`);
  }

  // Get user details (admin only)
  async getUserDetails(userId) {
    return this.request(`/user-types/admin/user/${userId}`);
  }

  // Quarantine user (admin only)
  async quarantineUser(userId, quarantine, reason, duration = 24) {
    return this.request(`/user-types/admin/user/${userId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason, duration })
    });
  }

  // Create admin user (admin only)
  async createAdmin(adminData) {
    return this.request('/user-types/admin/create', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  }

  // Update admin permissions (admin only)
  async updateAdminPermissions(adminId, permissions, adminLevel) {
    return this.request(`/user-types/admin/${adminId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, adminLevel })
    });
  }

  // Get user statistics (admin only)
  async getUserStatistics() {
    return this.request('/user-types/admin/statistics');
  }

  // Get device fingerprints (admin only)
  async getDeviceFingerprints(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.request(`/user-types/admin/devices?${queryParams}`);
  }

  // Quarantine device (admin only)
  async quarantineDevice(fingerprintId, quarantine, reason) {
    return this.request(`/user-types/admin/device/${fingerprintId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason })
    });
  }

  // Bulk quarantine operations (admin only)
  async bulkQuarantine(userIds, quarantine, reason) {
    return this.request('/user-types/admin/bulk/quarantine', {
      method: 'POST',
      body: JSON.stringify({ userIds, quarantine, reason })
    });
  }

  // ========== HEALTH CHECK (Both Versions) ==========

  // Health check (Original version method name)
  async healthCheck() {
    return this.request('/health');
  }

  // Check health (Enhanced version method name)
  async checkHealth() {
    return this.request('/health');
  }

  // Get API status and features (Enhanced version)
  async getApiStatus() {
    return this.request('/');
  }

  // Get API info (Original version)
  async getApiInfo() {
    return this.request('/health');
  }

  // ========== REPORT ENDPOINTS (Merged) ==========

  // Submit report (Enhanced version with behavior data)
  async submitReport(reportData, behaviorData = {}) {
    const enhancedReportData = {
      ...reportData,
      submittedBy: {
        deviceFingerprint: this.deviceFingerprint,
        userType: 'anonymous'
      },
      behaviorSignature: {
        submissionSpeed: behaviorData.submissionTime || 0,
        deviceType: this.detectDeviceType(),
        interactionPattern: behaviorData.interactionPattern || 'normal',
        humanBehaviorScore: behaviorData.humanBehaviorScore || 75
      }
    };

    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(enhancedReportData)
    });
  }

  // Get reports (Enhanced with gender sensitive support)
  async getReports(filters = {}) {
    const queryParams = new URLSearchParams({
      includeGenderSensitive: true,
      ...filters
    }).toString();
    
    return this.request(`/reports?${queryParams}`);
  }

  // Get single report by ID (Original)
  async getReport(id) {
    return this.request(`/reports/${id}`);
  }

  // Get reports for admin (Enhanced)
  async getAdminReports(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.request(`/admin/reports?${queryParams}`);
  }

  // Get all admin reports (Enhanced)
  async getAllAdminReports() {
    return this.request('/admin/reports/all');
  }

  // Update report status (Original)
  async updateReportStatus(id, status) {
    return this.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Moderate report (Enhanced version)
  async moderateReport(reportId, action, reason = '', priority = 'normal') {
    return this.request(`/admin/reports/${reportId}/moderate`, {
      method: 'PUT',
      body: JSON.stringify({ 
        action, 
        reason,
        priority,
        deviceFingerprint: this.deviceFingerprint
      })
    });
  }

  // Get flagged reports (Both versions)
  async getFlaggedReports() {
    return this.request('/admin/reports/flagged');
  }

  // Bulk update reports (Original)
  async bulkUpdateReports(reportIds, status) {
    const results = [];
    for (const id of reportIds) {
      try {
        const result = await this.updateReportStatus(id, status);
        results.push({ id, success: true, result });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return { success: true, results };
  }

  // Advanced filtering (Original)
  async getReportsWithFilter(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.flagged) params.append('flagged', filters.flagged);
    if (filters.withinBangladesh !== undefined) params.append('withinBangladesh', filters.withinBangladesh);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const queryString = params.toString();
    const endpoint = `/admin/reports${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  // Search reports (Original)
  async searchReports(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    };
    return this.getReportsWithFilter(searchFilters);
  }

  // Get female safety reports (Enhanced)
  async getFemaleSafetyReports() {
    return this.request('/reports/female-validation-needed');
  }

  // Submit community validation (Enhanced)
  async submitCommunityValidation(reportId, isPositive, validatorInfo = {}) {
    return this.request(`/reports/${reportId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ 
        isPositive,
        validatorInfo: {
          ...validatorInfo,
          deviceFingerprint: this.deviceFingerprint
        }
      })
    });
  }

  // Get report security insights (Enhanced)
  async getReportSecurityInsights() {
    return this.request('/admin/reports/security-insights');
  }

  // Detect coordinated attacks (Enhanced)
  async detectCoordinatedAttacks(timeWindow = 3600000) {
    return this.request('/admin/reports/coordinated-attacks', {
      method: 'POST',
      body: JSON.stringify({ timeWindow })
    });
  }

  // Get female safety statistics (Enhanced)
  async getFemaleSafetyStats() {
    return this.request('/admin/reports/female-safety-stats');
  }

  // ========== ANALYTICS & REPORTING (Original) ==========

  // Get moderation stats
  async getModerationStats(timeframe = '30d') {
    return this.request(`/admin/analytics/moderation?timeframe=${timeframe}`);
  }

  // Get geographic stats
  async getGeographicStats() {
    return this.request('/admin/analytics/geographic');
  }

  // Export reports
  async exportReports(format = 'csv', filters = {}) {
    const params = new URLSearchParams(filters);
    params.append('format', format);
    
    const response = await fetch(`${this.baseURL}/admin/export?${params.toString()}`, {
      headers: {
        'Accept': format === 'csv' ? 'text/csv' : 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return format === 'csv' ? response.text() : response.json();
  }

  // ========== ADMIN DASHBOARD (Merged) ==========

  // Get admin dashboard (Both versions)
  async getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  // Get admin analytics (Enhanced)
  async getAdminAnalytics(timeRange = '30d') {
    return this.request(`/admin/analytics?timeRange=${timeRange}`);
  }

  // Check admin access (Original)
  async checkAdminAccess() {
    try {
      await this.request('/admin/dashboard');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ========== SAFE ZONES ENDPOINTS (Complete Original Implementation) ==========

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
    
    return this.request(endpoint);
  }

  // Get nearby safe zones (shorthand method)
  async getNearbySafeZones(lat, lng, radius = 2000, minSafety = 6) {
    return this.getSafeZones({ lat, lng, radius, minSafety });
  }

  // Get specific safe zone by ID
  async getSafeZone(id) {
    return this.request(`/safezones/${id}`);
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
    
    return this.request(endpoint);
  }

  // Get public safe zone analytics
  async getSafeZoneAnalytics() {
    return this.request('/safezones/analytics/public');
  }

  // ========== ADMIN SAFE ZONE METHODS ==========

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
    
    return this.request(endpoint);
  }

  // Create new safe zone (admin only) - Enhanced version endpoint
  async createSafeZone(safeZoneData) {
    return this.request('/safezones/admin', {
      method: 'POST',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Update safe zone (admin only)
  async updateSafeZone(id, safeZoneData) {
    return this.request(`/safezones/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(safeZoneData)
    });
  }

  // Delete safe zone (admin only)
  async deleteSafeZone(id) {
    return this.request(`/safezones/admin/${id}`, {
      method: 'DELETE'
    });
  }

  // Bulk update safe zone statuses (admin only)
  async bulkUpdateSafeZoneStatus(safeZoneIds, status) {
    return this.request('/safezones/admin/bulk/status', {
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
    return this.request('/safezones/admin/analytics');
  }

  // Import safe zones from data (admin only)
  async importSafeZones(safeZones, source = 'import', overwrite = false) {
    return this.request('/safezones/admin/import', {
      method: 'POST',
      body: JSON.stringify({ safeZones, source, overwrite })
    });
  }

  // Export safe zones data (admin only)
  async exportSafeZones(format = 'json', status = 'active') {
    const params = new URLSearchParams({ format, status });
    return this.request(`/safezones/admin/export?${params}`);
  }

  // ========== INTELLIGENCE & ANALYSIS (Original) ==========

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
        this.getReports() // Get all reports (could be filtered by location)
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
        this.getReports(), // TODO: Add location filtering when backend supports it
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

      // Process reports data (simplified)
      if (reports.status === 'fulfilled') {
        const reportsData = reports.value.data || [];
        result.analysis.incidents = {
          total: reportsData.length,
          recent: reportsData.filter(r => {
            const days = (Date.now() - new Date(r.createdAt || r.timestamp)) / (1000 * 60 * 60 * 24);
            return days <= 30;
          }).length
        };
      } else {
        result.analysis.incidents = { error: reports.reason?.message };
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
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      const corridorRadius = Math.max(500, distance / 2); // At least 500m, or half the route distance
      
      const safeZones = await this.getNearbySafeZones(midLat, midLng, corridorRadius);
      
      return {
        success: true,
        data: {
          route: { start: [startLat, startLng], end: [endLat, endLng] },
          distance,
          corridorSafeZones: safeZones.features || [],
          safetyScore: this.calculateRouteSafetyScore(safeZones.features || []),
          recommendations: this.generateRouteRecommendations(safeZones.features || [])
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== MATHEMATICAL UTILITIES (Original) ==========

  // Calculate distance between two points (Haversine formula)
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

  // Calculate route safety score based on nearby safe zones
  calculateRouteSafetyScore(safeZones) {
    if (safeZones.length === 0) return 3; // Low safety if no safe zones

    const avgSafety = safeZones.reduce((sum, zone) => 
      sum + zone.properties.safetyScore, 0) / safeZones.length;
    
    const coverage = Math.min(safeZones.length / 3, 1); // Normalize coverage (max 3 zones = full coverage)
    
    return Math.round((avgSafety * 0.7 + coverage * 10 * 0.3) * 10) / 10;
  }

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

  // ========== CACHING UTILITIES (Original) ==========

  // Simple in-memory cache for safe zones
  async getCachedSafeZones(cacheKey, fetchFunction) {
    const cached = this._safeZoneCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this._cacheExpiry) {
      console.log('🔄 Using cached safe zones data');
      return cached.data;
    }

    try {
      const freshData = await fetchFunction();
      this._safeZoneCache.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
      });
      
      // Cleanup old cache entries
      if (this._safeZoneCache.size > 50) {
        const oldestKey = this._safeZoneCache.keys().next().value;
        this._safeZoneCache.delete(oldestKey);
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

  // Clear safe zone cache
  clearSafeZoneCache() {
    this._safeZoneCache.clear();
    console.log('🗑️ Safe zone cache cleared');
  }

  // ========== BATCH OPERATIONS (Original) ==========

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

  // ========== COMMUNITY VALIDATION (Enhanced Version) ==========

  // Get validation queue for user
  async getValidationQueue(userLocation = null, filters = {}) {
    return this.request('/community/validation-queue', {
      method: 'POST',
      body: JSON.stringify({ 
        userLocation, 
        filters,
        deviceFingerprint: this.deviceFingerprint
      })
    });
  }

  // Get user's validation history
  async getValidationHistory() {
    return this.request('/community/validation-history');
  }

  // Get validation statistics
  async getValidationStats() {
    return this.request('/community/validation-stats');
  }

  // ========== FEMALE SAFETY FEATURES (Enhanced Version) ==========

  // Get female safety recommendations
  async getFemaleSafetyRecommendations(location, timeOfDay) {
    return this.request('/female-safety/recommendations', {
      method: 'POST',
      body: JSON.stringify({ location, timeOfDay })
    });
  }

  // Get female-specific safe zones
  async getFemaleSafeZones(location, radius = 2000) {
    return this.request('/female-safety/safe-zones', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Report female safety concern
  async reportFemaleSafetyConcern(concernData) {
    return this.request('/female-safety/report-concern', {
      method: 'POST',
      body: JSON.stringify({
        ...concernData,
        deviceFingerprint: this.deviceFingerprint
      })
    });
  }

  // ========== REAL-TIME FEATURES (Enhanced Version) ==========

  // Get real-time alerts for location
  async getRealTimeAlerts(location, radius = 1000) {
    return this.request('/alerts/location', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Subscribe to real-time updates (Original placeholder)
  subscribeToUpdates(callback) {
    // TODO: Implement WebSocket or SSE for real-time updates
    console.log('Real-time updates not yet implemented');
    return () => {}; // Return unsubscribe function
  }

  // Subscribe to real-time updates (Enhanced WebSocket URL)
  getWebSocketUrl() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = this.baseURL.replace(/^https?:/, '').replace('/api', '');
    return `${wsProtocol}${wsHost}/ws?deviceFingerprint=${this.deviceFingerprint}`;
  }

  // ========== VALIDATION & ERROR HANDLING (Original) ==========

  // Validate report data before submission
  validateReportData(reportData) {
    const errors = [];
    
    if (!reportData.type) errors.push('Report type is required');
    if (!reportData.description || reportData.description.length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    if (!reportData.location || !reportData.location.coordinates) {
      errors.push('Location coordinates are required');
    }
    if (!reportData.severity || reportData.severity < 1 || reportData.severity > 5) {
      errors.push('Severity must be between 1 and 5');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format API errors for user display
  formatApiError(error) {
    if (typeof error === 'string') return error;
    
    if (error.message) {
      // Clean up common API error messages
      if (error.message.includes('Failed to fetch')) {
        return 'Unable to connect to server. Please check your internet connection.';
      }
      if (error.message.includes('404')) {
        return 'The requested resource was not found.';
      }
      if (error.message.includes('500')) {
        return 'Server error. Please try again later.';
      }
      return error.message;
    }
    
    return 'An unexpected error occurred. Please try again.';
  }

  // ========== UTILITY METHODS (Enhanced Version) ==========

  // Detect device type for behavior analysis
  detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile';
    } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // Track user behavior for security analysis
  trackBehavior(action, details = {}) {
    // This could be enhanced to send behavior data to backend
    console.log('📊 Behavior tracked:', action, details);
    
    // Store locally for submission with next report
    const behaviorData = JSON.parse(localStorage.getItem('safestreets_behavior') || '[]');
    behaviorData.push({
      action,
      details,
      timestamp: Date.now(),
      deviceFingerprint: this.deviceFingerprint
    });
    
    // Keep only last 10 behavior events
    if (behaviorData.length > 10) {
      behaviorData.splice(0, behaviorData.length - 10);
    }
    
    localStorage.setItem('safestreets_behavior', JSON.stringify(behaviorData));
  }

  // Get stored behavior data
  getBehaviorData() {
    return JSON.parse(localStorage.getItem('safestreets_behavior') || '[]');
  }

  // Clear behavior data
  clearBehaviorData() {
    localStorage.removeItem('safestreets_behavior');
  }

  // ========== FUTURE ENDPOINTS (Enhanced Version) ==========

  // Police registration (future)
  async registerPolice(policeData) {
    return this.request('/auth/police/register', {
      method: 'POST',
      body: JSON.stringify(policeData)
    });
  }

  // Researcher registration (future)
  async registerResearcher(researcherData) {
    return this.request('/auth/researcher/register', {
      method: 'POST',
      body: JSON.stringify(researcherData)
    });
  }
}

// Create and export singleton instance
const apiService = new ApiService();

export default apiService;

// Export class for testing (Original)
export { ApiService };

// Export individual methods for convenience (Complete list from both versions)
export const {
  // ========== CORE METHODS ==========
  healthCheck,
  checkHealth,
  getApiStatus,
  getApiInfo,
  
  // ========== AUTHENTICATION ==========
  getUserContext,
  adminLogin,
  adminLogout,
  verifyAdminSession,
  getAdminProfile,
  updateUserPreferences,
  getSecurityInsights,
  getSecurityAnalytics,
  
  // ========== USER MANAGEMENT ==========
  getUsers,
  getUserDetails,
  quarantineUser,
  createAdmin,
  updateAdminPermissions,
  getUserStatistics,
  getDeviceFingerprints,
  quarantineDevice,
  bulkQuarantine,
  
  // ========== REPORTS ==========
  submitReport,
  getReports,
  getReport,
  getAdminReports,
  getAllAdminReports,
  updateReportStatus,
  moderateReport,
  getFlaggedReports,
  bulkUpdateReports,
  getReportsWithFilter,
  searchReports,
  getFemaleSafetyReports,
  submitCommunityValidation,
  getReportSecurityInsights,
  detectCoordinatedAttacks,
  getFemaleSafetyStats,
  
  // ========== ANALYTICS ==========
  getModerationStats,
  getGeographicStats,
  exportReports,
  getAdminDashboard,
  getAdminAnalytics,
  checkAdminAccess,
  
  // ========== SAFE ZONES ==========
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
  
  // ========== INTELLIGENCE ==========
  checkSafeZonesAvailability,
  getLocationIntelligence,
  getAreaAnalysis,
  getRouteSafetyData,
  
  // ========== UTILITIES ==========
  calculateDistance,
  calculateRouteSafetyScore,
  generateSafetyRecommendations,
  generateRouteRecommendations,
  getCachedSafeZones,
  clearSafeZoneCache,
  getBatchSafeZones,
  createBatchSafeZones,
  
  // ========== VALIDATION ==========
  getValidationQueue,
  getValidationHistory,
  getValidationStats,
  
  // ========== FEMALE SAFETY ==========
  getFemaleSafetyRecommendations,
  getFemaleSafeZones,
  reportFemaleSafetyConcern,
  
  // ========== REAL-TIME ==========
  getRealTimeAlerts,
  subscribeToUpdates,
  getWebSocketUrl,
  
  // ========== ERROR HANDLING ==========
  validateReportData,
  formatApiError,
  requestWithRetry,
  requestWithIntelligenceRetry,
  batchRequests,
  
  // ========== BEHAVIOR TRACKING ==========
  detectDeviceType,
  trackBehavior,
  getBehaviorData,
  clearBehaviorData,
  
  // ========== FUTURE FEATURES ==========
  registerPolice,
  registerResearcher
} = apiService;