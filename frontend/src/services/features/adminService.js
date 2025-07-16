// === Admin Service Module ===
// Administrative operations and analytics extracted from api-old.js
// Handles user management, device management, analytics, and dashboard functionality

import apiClient from '../core/apiClient.js';

class AdminService {
  constructor() {
    this.deviceFingerprint = null;
  }

  // Set device fingerprint for all requests
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
  }

  // ========== USER MANAGEMENT OPERATIONS ==========
  // Extracted from api-old.js lines 251-299

  // Get all users (admin only)
  async getUsers(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return apiClient.request(`/user-types/admin/users?${queryParams}`);
  }

  // Get user details (admin only)
  async getUserDetails(userId) {
    return apiClient.request(`/user-types/admin/user/${userId}`);
  }

  // Quarantine user (admin only)
  async quarantineUser(userId, quarantine, reason, duration = 24) {
    return apiClient.request(`/user-types/admin/user/${userId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason, duration })
    });
  }

  // Create admin user (admin only)
  async createAdmin(adminData) {
    return apiClient.request('/user-types/admin/create', {
      method: 'POST',
      body: JSON.stringify(adminData)
    });
  }

  // Update admin permissions (admin only)
  async updateAdminPermissions(adminId, permissions, adminLevel) {
    return apiClient.request(`/user-types/admin/${adminId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions, adminLevel })
    });
  }

  // ========== DEVICE MANAGEMENT OPERATIONS ==========
  // Extracted from api-old.js lines 251-299

  // Get user statistics (admin only)
  async getUserStatistics() {
    return apiClient.request('/user-types/admin/statistics');
  }

  // Get device fingerprints (admin only)
  async getDeviceFingerprints(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return apiClient.request(`/user-types/admin/devices?${queryParams}`);
  }

  // Quarantine device (admin only)
  async quarantineDevice(fingerprintId, quarantine, reason) {
    return apiClient.request(`/user-types/admin/device/${fingerprintId}/quarantine`, {
      method: 'PUT',
      body: JSON.stringify({ quarantine, reason })
    });
  }

  // Bulk quarantine operations (admin only)
  async bulkQuarantine(userIds, quarantine, reason) {
    return apiClient.request('/user-types/admin/bulk/quarantine', {
      method: 'POST',
      body: JSON.stringify({ userIds, quarantine, reason })
    });
  }

  // ========== ANALYTICS & DASHBOARD OPERATIONS ==========
  // Extracted from api-old.js lines 701-800

  // Get moderation stats
  async getModerationStats(timeframe = '30d') {
    return apiClient.request(`/admin/analytics/moderation?timeframe=${timeframe}`);
  }

  // Get geographic stats
  async getGeographicStats() {
    return apiClient.request('/admin/analytics/geographic');
  }

  // Export reports
  async exportReports(format = 'csv', filters = {}) {
    const params = new URLSearchParams(filters);
    params.append('format', format);
    
    const response = await fetch(`${apiClient.baseURL}/admin/export?${params.toString()}`, {
      headers: {
        ...apiClient.getAuthHeaders(),
        'Accept': format === 'csv' ? 'text/csv' : 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return format === 'csv' ? response.text() : response.json();
  }

  // Get admin dashboard (Both versions)
  async getAdminDashboard() {
    return apiClient.request('/admin/dashboard');
  }

  // Get admin analytics (Enhanced)
  async getAdminAnalytics(timeRange = '30d') {
    return apiClient.request(`/admin/analytics?timeRange=${timeRange}`);
  }

  // Check admin access (Original)
  async checkAdminAccess() {
    try {
      await apiClient.request('/admin/dashboard');
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Create and export singleton instance
const adminService = new AdminService();

export default adminService;
export { AdminService };