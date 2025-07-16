// === frontend/src/services/auth/authService.js ===
// Authentication Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 164-230 approximately)
// Contains: User context, admin authentication, preferences, security insights

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Authentication Service Class
 * EXTRACTED from original ApiService authentication methods
 * Preserves ALL original functionality including:
 * - Device fingerprint integration
 * - Admin login/logout with localStorage token handling
 * - User context management
 * - Preferences handling
 * - Security insights and analytics
 */
class AuthService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== AUTHENTICATION ENDPOINTS (PRESERVED EXACTLY) ==========

  // Get user context (PRESERVED EXACTLY - Original Lines 166-169)
  async getUserContext(deviceFingerprint) {
    this.apiClient.setDeviceFingerprint(deviceFingerprint);
    return this.apiClient.request('/auth/user/context');
  }

  // Admin login (PRESERVED EXACTLY - Original Lines 171-177)
  async adminLogin(credentials) {
    return this.apiClient.request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  // Admin logout (PRESERVED EXACTLY - Original Lines 179-187)
  async adminLogout() {
    const result = await this.apiClient.request('/auth/admin/logout', {
      method: 'POST'
    });
    
    // Clear stored token regardless of response (PRESERVED EXACTLY - Original Line 185)
    localStorage.removeItem('safestreets_admin_token');
    return result;
  }

  // Original admin verification method (PRESERVED EXACTLY - Original Lines 189-191)
  async verifyAdminSession() {
    return this.apiClient.request('/admin/verify');
  }

  // Get admin profile (PRESERVED EXACTLY - Original Lines 193-195)
  async getAdminProfile() {
    return this.apiClient.request('/auth/admin/profile');
  }

  // Update user preferences (PRESERVED EXACTLY - Original Lines 197-202)
  async updateUserPreferences(preferences) {
    return this.apiClient.request('/auth/user/update-preferences', {
      method: 'POST',
      body: JSON.stringify({ preferences })
    });
  }

  // Get security insights (PRESERVED EXACTLY - Original Lines 204-206)
  async getSecurityInsights() {
    return this.apiClient.request('/auth/security/insights');
  }

  // Original security analytics (PRESERVED EXACTLY - Original Lines 208-210)
  async getSecurityAnalytics() {
    return this.apiClient.request('/admin/analytics/security');
  }

  // ========== FUTURE AUTHENTICATION FEATURES (PRESERVED EXACTLY) ==========

  // Police registration (PRESERVED EXACTLY - From end of original file)
  async registerPolice(policeData) {
    return this.apiClient.request('/auth/police/register', {
      method: 'POST',
      body: JSON.stringify(policeData)
    });
  }

  // Researcher registration (PRESERVED EXACTLY - From end of original file)
  async registerResearcher(researcherData) {
    return this.apiClient.request('/auth/researcher/register', {
      method: 'POST',
      body: JSON.stringify(researcherData)
    });
  }

  // ========== UTILITY METHODS ==========

  // Check if user is authenticated (utility method)
  isAuthenticated() {
    return !!localStorage.getItem('safestreets_admin_token');
  }

  // Get stored admin token (utility method)
  getStoredToken() {
    return localStorage.getItem('safestreets_admin_token');
  }

  // Clear authentication (utility method)
  clearAuthentication() {
    localStorage.removeItem('safestreets_admin_token');
  }

  // Set device fingerprint (delegation to apiClient)
  setDeviceFingerprint(fingerprint) {
    return this.apiClient.setDeviceFingerprint(fingerprint);
  }

  // Get device fingerprint (delegation to apiClient)
  getDeviceFingerprint() {
    return this.apiClient.getDeviceFingerprint();
  }
}

// Create and export singleton instance (PRESERVED EXACTLY - Original pattern)
const authService = new AuthService();

export default authService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { AuthService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  getUserContext,
  adminLogin,
  adminLogout,
  verifyAdminSession,
  getAdminProfile,
  updateUserPreferences,
  getSecurityInsights,
  getSecurityAnalytics,
  registerPolice,
  registerResearcher,
  isAuthenticated,
  getStoredToken,
  clearAuthentication,
  setDeviceFingerprint,
  getDeviceFingerprint
} = authService;