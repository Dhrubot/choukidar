// === Core API Client Infrastructure ===
// HTTP request functionality extracted from api-old.js lines 1-150
// Handles all HTTP communication, authentication headers, device fingerprinting, and caching

// API Base URL configuration
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000/api';

class ApiClient {
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
    const adminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('safestreets_admin_token') : null;
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

  // ========== CACHING INFRASTRUCTURE ==========

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
      console.error('❌ Cache fetch error:', error);
      throw error;
    }
  }

  // Clear safe zone cache
  clearSafeZoneCache() {
    this._safeZoneCache.clear();
    console.log('🗑️ Safe zone cache cleared');
  }

  // ========== UTILITY METHODS ==========

  // Subscribe to real-time updates (Enhanced WebSocket URL)
  getWebSocketUrl() {
    const wsProtocol = (typeof window !== 'undefined' && window.location?.protocol === 'https:') ? 'wss:' : 'ws:';
    const wsHost = this.baseURL.replace(/^https?:/, '').replace('/api', '');
    return `${wsProtocol}${wsHost}/ws?deviceFingerprint=${this.deviceFingerprint}`;
  }

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

  // ========== HEALTH CHECK METHODS ==========

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
}

// Create and export singleton instance
const apiClient = new ApiClient();

export default apiClient;
export { ApiClient };