// === Authentication Service ===
// Authentication functionality extracted from api-old.js lines 151-200
// Handles user authentication, admin login/logout, and user context management

import apiClient from '../core/apiClient.js';

class AuthService {
  constructor() {
    this.deviceFingerprint = null;
  }

  // ========== DEVICE FINGERPRINT MANAGEMENT ==========

  // Set device fingerprint for authentication requests
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
    // Propagate to API client
    apiClient.setDeviceFingerprint(fingerprint);
  }

  // ========== AUTHENTICATION ENDPOINTS (Enhanced Version) ==========

  // Get user context
  async getUserContext(deviceFingerprint) {
    this.setDeviceFingerprint(deviceFingerprint);
    return apiClient.request('/auth/user/context');
  }

  // Admin login (Enhanced version)
  async adminLogin(credentials) {
    return apiClient.request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  // Admin logout (Enhanced version)
  async adminLogout() {
    const result = await apiClient.request('/auth/admin/logout', {
      method: 'POST'
    });
    
    // Clear stored token regardless of response
    localStorage.removeItem('safestreets_admin_token');
    return result;
  }

  // ========== ADMIN VERIFICATION AND PROFILE METHODS ==========

  // Original admin verification method
  async verifyAdminSession() {
    return apiClient.request('/admin/verify');
  }

  // Get admin profile (Enhanced version)
  async getAdminProfile() {
    return apiClient.request('/auth/admin/profile');
  }

  // Update user preferences (Enhanced version)
  async updateUserPreferences(preferences) {
    return apiClient.request('/auth/user/update-preferences', {
      method: 'POST',
      body: JSON.stringify({ preferences })
    });
  }

  // Get security insights (Enhanced version)
  async getSecurityInsights() {
    return apiClient.request('/auth/security/insights');
  }

  // Original security analytics
  async getSecurityAnalytics() {
    return apiClient.request('/admin/analytics/security');
  }
}

// Create and export singleton instance
const authService = new AuthService();

export default authService;
export { AuthService };