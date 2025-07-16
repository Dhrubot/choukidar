// === Report Service Module ===
// Report management and community features extracted from api-old.js
// Handles report CRUD operations, moderation, filtering, and community validation

import apiClient from '../core/apiClient.js';

class ReportService {
  constructor() {
    this.deviceFingerprint = null;
  }

  // Set device fingerprint for all requests
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
    apiClient.setDeviceFingerprint(fingerprint);
  }

  // ========== CORE REPORT CRUD OPERATIONS ==========
  // Extracted from api-old.js lines 300-400

  // Submit report (Enhanced version with behavior data)
  async submitReport(reportData, behaviorData = {}) {
    const enhancedReportData = {
      ...reportData,
      submittedBy: {
        deviceFingerprint: this.deviceFingerprint || apiClient.deviceFingerprint,
        userType: 'anonymous'
      },
      behaviorSignature: {
        submissionSpeed: behaviorData.submissionTime || 0,
        deviceType: this.detectDeviceType(),
        interactionPattern: behaviorData.interactionPattern || 'normal',
        humanBehaviorScore: behaviorData.humanBehaviorScore || 75
      }
    };

    return apiClient.request('/reports', {
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
    
    return apiClient.request(`/reports?${queryParams}`);
  }

  // Get single report by ID (Original)
  async getReport(id) {
    return apiClient.request(`/reports/${id}`);
  }

  // Get reports for admin (Enhanced)
  async getAdminReports(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return apiClient.request(`/admin/reports?${queryParams}`);
  }

  // Get all admin reports (Enhanced)
  async getAllAdminReports() {
    return apiClient.request('/admin/reports/all');
  }

  // ========== REPORT MODERATION FUNCTIONALITY ==========
  // Extracted from api-old.js lines 401-500

  // Update report status (Original)
  async updateReportStatus(id, status) {
    return apiClient.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Moderate report (Enhanced version)
  async moderateReport(reportId, action, reason = '', priority = 'normal') {
    return apiClient.request(`/admin/reports/${reportId}/moderate`, {
      method: 'PUT',
      body: JSON.stringify({ 
        action, 
        reason,
        priority,
        deviceFingerprint: this.deviceFingerprint || apiClient.deviceFingerprint
      })
    });
  }

  // Get flagged reports (Both versions)
  async getFlaggedReports() {
    return apiClient.request('/admin/reports/flagged');
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

  // ========== ADVANCED REPORT FILTERING ==========
  // Extracted from api-old.js lines 501-600

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
    
    return apiClient.request(endpoint);
  }

  // Search reports (Original)
  async searchReports(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    };
    return this.getReportsWithFilter(searchFilters);
  }

  // ========== COMMUNITY VALIDATION AND FEMALE SAFETY ==========
  // Extracted from api-old.js lines 601-700

  // Get female safety reports (Enhanced)
  async getFemaleSafetyReports() {
    return apiClient.request('/reports/female-validation-needed');
  }

  // Submit community validation (Enhanced)
  async submitCommunityValidation(reportId, isPositive, validatorInfo = {}) {
    return apiClient.request(`/reports/${reportId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ 
        isPositive,
        validatorInfo: {
          ...validatorInfo,
          deviceFingerprint: this.deviceFingerprint || apiClient.deviceFingerprint
        }
      })
    });
  }

  // Get report security insights (Enhanced)
  async getReportSecurityInsights() {
    return apiClient.request('/admin/reports/security-insights');
  }

  // Detect coordinated attacks (Enhanced)
  async detectCoordinatedAttacks(timeWindow = 3600000) {
    return apiClient.request('/admin/reports/coordinated-attacks', {
      method: 'POST',
      body: JSON.stringify({ timeWindow })
    });
  }

  // Get female safety statistics (Enhanced)
  async getFemaleSafetyStats() {
    return apiClient.request('/admin/reports/female-safety-stats');
  }

  // Export reports (Original - from lines 401-500)
  async exportReports(format = 'csv', filters = {}) {
    const params = new URLSearchParams(filters);
    params.append('format', format);
    
    const response = await fetch(`${apiClient.baseURL}/admin/export?${params.toString()}`, {
      headers: {
        'Accept': format === 'csv' ? 'text/csv' : 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return format === 'csv' ? response.text() : response.json();
  }

  // ========== DEVICE DETECTION UTILITY ==========
  // Helper method used by submitReport

  // Detect device type (from original implementation)
  detectDeviceType() {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/i.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }
}

// Create and export singleton instance
const reportService = new ReportService();

export default reportService;
export { ReportService };