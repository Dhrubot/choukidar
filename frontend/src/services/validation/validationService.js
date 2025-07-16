// === frontend/src/services/validation/validationService.js ===
// Validation Service for SafeStreets Bangladesh
// EXTRACTED from original api.js validation methods
// Contains: Community validation queue, history, statistics

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Validation Service Class
 * EXTRACTED from original ApiService validation methods
 * Preserves ALL original functionality including:
 * - Community validation queue management
 * - User validation history tracking
 * - Validation statistics and insights
 */
class ValidationService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== VALIDATION METHODS (PRESERVED EXACTLY) ==========

  // Get validation queue for user (PRESERVED EXACTLY - Original)
  async getValidationQueue(userLocation = null, filters = {}) {
    return this.apiClient.request('/community/validation-queue', {
      method: 'POST',
      body: JSON.stringify({ 
        userLocation, 
        filters,
        deviceFingerprint: this.apiClient.deviceFingerprint
      })
    });
  }

  // Get user's validation history (PRESERVED EXACTLY - Original)
  async getValidationHistory() {
    return this.apiClient.request('/community/validation-history');
  }

  // Get validation statistics (PRESERVED EXACTLY - Original)
  async getValidationStats() {
    return this.apiClient.request('/community/validation-stats');
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
const validationService = new ValidationService();

export default validationService;

// Export class for testing
export { ValidationService };

// Export individual methods for convenience
export const {
  getValidationQueue,
  getValidationHistory,
  getValidationStats,
  setDeviceFingerprint,
  getDeviceFingerprint
} = validationService;