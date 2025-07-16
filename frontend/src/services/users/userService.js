// === frontend/src/services/users/userService.js ===
// User Management Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 232-285 approximately)
// Contains: User management, admin operations, device fingerprints, quarantine operations

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * User Service Class
 * EXTRACTED from original ApiService user management methods
 * Preserves ALL original functionality including:
 * - User listing and details
 * - Admin user creation and permission management
 * - User and device quarantine operations
 * - Device fingerprint management
 * - Bulk operations
 * - User statistics and insights
 */
class UserService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== USER MANAGEMENT ENDPOINTS (PRESERVED EXACTLY) ==========

  // Get all users (PRESERVED EXACTLY - Original Lines 234-237)
  async getUsers(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.apiClient.request(`/user-types/admin/users?${queryParams}`);
  }

  // Get user details (PRESERVED EXACTLY - Original Lines 239-241)
  async getUserDetails(userId) {
    return this.apiClient.request(`/user-types/admin/user/${userId}`);
  }

  // Quarantine user (PRESERVED EXACTLY - Original Lines 243-249)
  async quarantineUser(userId, quarantine, reason, duration = 24) {
    return this.apiClient.request(`/user-types/admin/user/${userId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason, duration })
    });
  }

  // Create admin user (PRESERVED EXACTLY - Original Lines 251-256)
  async createAdmin(adminData) {
    return this.apiClient.request('/user-types/admin/create', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  }

  // Update admin permissions (PRESERVED EXACTLY - Original Lines 258-263)
  async updateAdminPermissions(adminId, permissions, adminLevel) {
    return this.apiClient.request(`/user-types/admin/${adminId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, adminLevel })
    });
  }

  // Get user statistics (PRESERVED EXACTLY - Original Lines 265-267)
  async getUserStatistics() {
    return this.apiClient.request('/user-types/admin/statistics');
  }

  // ========== DEVICE FINGERPRINT MANAGEMENT ==========

  // Get device fingerprints (PRESERVED EXACTLY - Original Lines 269-272)
  async getDeviceFingerprints(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.apiClient.request(`/user-types/admin/devices?${queryParams}`);
  }

  // Quarantine device (PRESERVED EXACTLY - Original Lines 274-279)
  async quarantineDevice(fingerprintId, quarantine, reason) {
    return this.apiClient.request(`/user-types/admin/device/${fingerprintId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason })
    });
  }

  // ========== BULK OPERATIONS ==========

  // Bulk quarantine operations (PRESERVED EXACTLY - Original Lines 281-286)
  async bulkQuarantine(userIds, quarantine, reason) {
    return this.apiClient.request('/user-types/admin/bulk/quarantine', {
      method: 'POST',
      body: JSON.stringify({ userIds, quarantine, reason })
    });
  }

  // ========== UTILITY METHODS ==========

  // Validate admin data (utility method for form validation)
  validateAdminData(adminData) {
    const errors = [];
    
    // Required fields validation
    if (!adminData.username || adminData.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    if (!adminData.email || !this.isValidEmail(adminData.email)) {
      errors.push('Valid email is required');
    }
    if (!adminData.password || adminData.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!adminData.permissions || !Array.isArray(adminData.permissions)) {
      errors.push('Permissions array is required');
    }
    if (!adminData.adminLevel || !['basic', 'standard', 'senior', 'super'].includes(adminData.adminLevel)) {
      errors.push('Valid admin level is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate user filters
  validateUserFilters(filters) {
    const validFilters = {};
    
    // Valid filter keys
    const allowedFilters = [
      'userType', 'riskLevel', 'quarantined', 'trustScore', 
      'page', 'limit', 'sortBy', 'sortOrder'
    ];
    
    Object.keys(filters).forEach(key => {
      if (allowedFilters.includes(key)) {
        validFilters[key] = filters[key];
      }
    });
    
    // Validate specific filters
    if (validFilters.userType && !['anonymous', 'admin', 'police', 'researcher'].includes(validFilters.userType)) {
      delete validFilters.userType;
    }
    
    if (validFilters.riskLevel && !['low', 'medium', 'high', 'critical'].includes(validFilters.riskLevel)) {
      delete validFilters.riskLevel;
    }
    
    if (validFilters.quarantined && !['true', 'false'].includes(validFilters.quarantined)) {
      delete validFilters.quarantined;
    }
    
    if (validFilters.page && (isNaN(validFilters.page) || parseInt(validFilters.page) < 1)) {
      validFilters.page = 1;
    }
    
    if (validFilters.limit && (isNaN(validFilters.limit) || parseInt(validFilters.limit) < 1 || parseInt(validFilters.limit) > 100)) {
      validFilters.limit = 20;
    }
    
    return validFilters;
  }

  // Format user data for display
  formatUserForDisplay(user) {
    return {
      id: user._id || user.id,
      userId: user.userId,
      userType: user.userType,
      displayName: this.getUserDisplayName(user),
      email: user.roleData?.admin?.email || 'N/A',
      trustScore: user.securityProfile?.overallTrustScore || 0,
      riskLevel: user.securityProfile?.securityRiskLevel || 'unknown',
      quarantined: user.securityProfile?.quarantineStatus || false,
      quarantineReason: user.securityProfile?.quarantineReason || null,
      lastSeen: user.activityProfile?.lastSeen || user.createdAt,
      totalSessions: user.activityProfile?.totalSessions || 0,
      deviceFingerprint: user.securityProfile?.primaryDeviceFingerprint || user.anonymousProfile?.deviceFingerprint
    };
  }

  // Get user display name
  getUserDisplayName(user) {
    if (user.userType === 'admin' && user.roleData?.admin?.username) {
      return user.roleData.admin.username;
    }
    if (user.userType === 'police' && user.roleData?.police?.badgeNumber) {
      return `Officer ${user.roleData.police.badgeNumber}`;
    }
    if (user.userType === 'researcher' && user.roleData?.researcher?.institution) {
      return `Researcher (${user.roleData.researcher.institution})`;
    }
    return `Anonymous User (${user.userId?.slice(-8) || 'Unknown'})`;
  }

  // Check if user can be quarantined
  canQuarantineUser(user, currentAdminLevel) {
    // Super admins can quarantine anyone except other super admins
    if (currentAdminLevel === 'super') {
      return user.userType !== 'admin' || user.roleData?.admin?.adminLevel !== 'super';
    }
    
    // Senior admins can quarantine basic/standard admins and non-admins
    if (currentAdminLevel === 'senior') {
      if (user.userType !== 'admin') return true;
      return ['basic', 'standard'].includes(user.roleData?.admin?.adminLevel);
    }
    
    // Standard admins can only quarantine non-admin users
    if (currentAdminLevel === 'standard') {
      return user.userType !== 'admin';
    }
    
    // Basic admins cannot quarantine anyone
    return false;
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
const userService = new UserService();

export default userService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { UserService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  getUsers,
  getUserDetails,
  quarantineUser,
  createAdmin,
  updateAdminPermissions,
  getUserStatistics,
  getDeviceFingerprints,
  quarantineDevice,
  bulkQuarantine,
  validateAdminData,
  isValidEmail,
  validateUserFilters,
  formatUserForDisplay,
  getUserDisplayName,
  canQuarantineUser,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = userService;