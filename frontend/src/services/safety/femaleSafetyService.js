// === frontend/src/services/safety/femaleSafetyService.js ===
// Female Safety Service for SafeStreets Bangladesh
// EXTRACTED from original api.js female safety methods
// Contains: Female safety recommendations, safe zones, concern reporting

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Female Safety Service Class
 * EXTRACTED from original ApiService female safety methods
 * Preserves ALL original functionality including:
 * - Female safety recommendations based on location and time
 * - Female-specific safe zones identification
 * - Female safety concern reporting system
 */
class FemaleSafetyService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== FEMALE SAFETY METHODS (PRESERVED EXACTLY) ==========

  // Get female safety recommendations (PRESERVED EXACTLY - Original)
  async getFemaleSafetyRecommendations(location, timeOfDay) {
    return this.apiClient.request('/female-safety/recommendations', {
      method: 'POST',
      body: JSON.stringify({ location, timeOfDay })
    });
  }

  // Get female-specific safe zones (PRESERVED EXACTLY - Original)
  async getFemaleSafeZones(location, radius = 2000) {
    return this.apiClient.request('/female-safety/safe-zones', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Report female safety concern (PRESERVED EXACTLY - Original)
  async reportFemaleSafetyConcern(concernData) {
    return this.apiClient.request('/female-safety/report-concern', {
      method: 'POST',
      body: JSON.stringify({
        ...concernData,
        deviceFingerprint: this.apiClient.deviceFingerprint
      })
    });
  }

  // ========== DELEGATION METHODS ==========

  // Set device fingerprint (delegation to apiClient)
  setDeviceFingerprint(fingerprint) {
    return this.apiClient.setDeviceFingerprint(fingerprint);
  }

  // Get device fingerprint (delegation to apiClient)
  getDeviceFingerprint() {
    return this.apiClient.getDeviceFingerprint();
  }
}

// Create and export singleton instance
const femaleSafetyService = new FemaleSafetyService();

export default femaleSafetyService;

// Export class for testing
export { FemaleSafetyService };

// Export individual methods for convenience
export const {
  getFemaleSafetyRecommendations,
  getFemaleSafeZones,
  reportFemaleSafetyConcern,
  setDeviceFingerprint,
  getDeviceFingerprint
} = femaleSafetyService;