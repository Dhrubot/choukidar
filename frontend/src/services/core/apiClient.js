// === frontend/src/services/core/apiClient.js ===
// Core API Client for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 1-150 approximately)
// Contains: Base request handling, authentication, retry logic, error handling

// API Base URL configuration (PRESERVED EXACTLY)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Core API Client Class
 * EXTRACTED from original ApiService class constructor and core methods
 * Preserves ALL original functionality including:
 * - Device fingerprinting
 * - Authentication headers
 * - localStorage token handling
 * - Retry logic with exponential backoff
 * - Batch request processing
 * - Error handling and logging
 */
class ApiClient {
  constructor() {
    // Base configuration (PRESERVED EXACTLY - Original Lines 11-17)
    this.baseURL = API_BASE_URL;
    this.deviceFingerprint = null;
    
    // Caching system from original (PRESERVED EXACTLY - Original Lines 15-16)
    this._safeZoneCache = new Map();
    this._cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // ========== DEVICE & AUTHENTICATION SETUP ==========

  // Set device fingerprint for all requests (PRESERVED EXACTLY - Original Lines 22-24)
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
  }

  // Get authentication headers (PRESERVED EXACTLY - Original Lines 26-42)
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Add device fingerprint (PRESERVED EXACTLY - Original Lines 32-34)
    if (this.deviceFingerprint) {
      headers['x-device-fingerprint'] = this.deviceFingerprint;
    }

    // Add admin token if available (PRESERVED EXACTLY - Original Lines 36-39)
    const adminToken = localStorage.getItem('safestreets_admin_token');
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }

    return headers;
  }

  // ========== CORE REQUEST METHODS ==========

  // Generic request method (PRESERVED EXACTLY - Original Lines 46-80)
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
      
      // Enhanced version error format (PRESERVED EXACTLY - Original Lines 73-77)
      return {
        success: false,
        message: error.message || 'Network error occurred',
        error: error.message
      };
    }
  }

  // Original retry logic with enhanced error handling (PRESERVED EXACTLY - Original Lines 82-106)
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
        
        // Don't retry on 4xx errors (client errors) (PRESERVED EXACTLY - Original Lines 95-97)
        if (error.message.includes('4')) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff) (PRESERVED EXACTLY - Original Lines 99-102)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  // Enhanced retry with intelligence features (PRESERVED EXACTLY - Original Lines 108-137)
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
        
        // Don't retry for client errors (4xx) (PRESERVED EXACTLY - Original Lines 123-125)
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

  // Enhanced batch requests (PRESERVED EXACTLY - Original Lines 139-162)
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

  // ========== CACHE MANAGEMENT (Safe Zone Cache) ==========
  // PRESERVED EXACTLY from original api.js - Required by safe zone service

  // Get cached safe zones
  getCachedSafeZones(key) {
    const cached = this._safeZoneCache.get(key);
    if (cached && Date.now() - cached.timestamp < this._cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  // Set safe zone cache
  setCachedSafeZones(key, data) {
    this._safeZoneCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear safe zone cache
  clearSafeZoneCache() {
    this._safeZoneCache.clear();
    console.log('🗑️ Safe zone cache cleared');
  }

  // ========== UTILITY METHODS ==========

  // Get base URL
  getBaseURL() {
    return this.baseURL;
  }

  // Get device fingerprint
  getDeviceFingerprint() {
    return this.deviceFingerprint;
  }

  // Check if device fingerprint is set
  hasDeviceFingerprint() {
    return !!this.deviceFingerprint;
  }

  // Get cache stats
  getCacheStats() {
    return {
      safeZoneCacheSize: this._safeZoneCache.size,
      cacheExpiry: this._cacheExpiry
    };
  }
}

// Create and export singleton instance (PRESERVED EXACTLY - Original pattern)
const apiClient = new ApiClient();

export default apiClient;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { ApiClient };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  setDeviceFingerprint,
  getAuthHeaders,
  request,
  requestWithRetry,
  requestWithIntelligenceRetry,
  batchRequests,
  getCachedSafeZones,
  setCachedSafeZones,
  clearSafeZoneCache,
  getBaseURL,
  getDeviceFingerprint,
  hasDeviceFingerprint,
  getCacheStats
} = apiClient;