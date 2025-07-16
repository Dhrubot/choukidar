// === frontend/src/services/reports/reportService.js ===
// Report Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 212-380 approximately)
// Contains: Report CRUD, moderation, filtering, female safety, security insights

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Report Service Class
 * EXTRACTED from original ApiService report methods
 * Preserves ALL original functionality including:
 * - Enhanced report submission with behavior data
 * - Report filtering and search
 * - Admin moderation capabilities
 * - Female safety features
 * - Security insights and coordinated attack detection
 * - Community validation system
 * - Bulk operations
 */
class ReportService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== CORE REPORT METHODS ==========

  // Submit report (PRESERVED EXACTLY - Original Lines 214-235)
  async submitReport(reportData, behaviorData = {}) {
    const enhancedReportData = {
      ...reportData,
      submittedBy: {
        deviceFingerprint: this.apiClient.deviceFingerprint,
        userType: 'anonymous'
      },
      behaviorSignature: {
        submissionSpeed: behaviorData.submissionTime || 0,
        deviceType: this.detectDeviceType(),
        interactionPattern: behaviorData.interactionPattern || 'normal',
        humanBehaviorScore: behaviorData.humanBehaviorScore || 75
      }
    };

    return this.apiClient.request('/reports', {
      method: 'POST',
      body: JSON.stringify(enhancedReportData)
    });
  }

  // Get reports (PRESERVED EXACTLY - Original Lines 237-244)
  async getReports(filters = {}) {
    const queryParams = new URLSearchParams({
      includeGenderSensitive: true,
      ...filters
    }).toString();
    
    return this.apiClient.request(`/reports?${queryParams}`);
  }

  // Get single report by ID (PRESERVED EXACTLY - Original Lines 246-248)
  async getReport(id) {
    return this.apiClient.request(`/reports/${id}`);
  }

  // ========== ADMIN REPORT METHODS ==========

  // Get reports for admin (PRESERVED EXACTLY - Original Lines 250-253)
  async getAdminReports(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return this.apiClient.request(`/admin/reports?${queryParams}`);
  }

  // Get all admin reports (PRESERVED EXACTLY - Original Lines 255-257)
  async getAllAdminReports() {
    return this.apiClient.request('/admin/reports/all');
  }

  // Update report status (PRESERVED EXACTLY - Original Lines 259-264)
  async updateReportStatus(id, status) {
    return this.apiClient.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Moderate report (PRESERVED EXACTLY - Original Lines 266-275)
  async moderateReport(reportId, action, reason = '', priority = 'normal') {
    return this.apiClient.request(`/admin/reports/${reportId}/moderate`, {
      method: 'PUT',
      body: JSON.stringify({ 
        action, 
        reason,
        priority,
        deviceFingerprint: this.apiClient.deviceFingerprint
      })
    });
  }

  // Get flagged reports (PRESERVED EXACTLY - Original Lines 277-279)
  async getFlaggedReports() {
    return this.apiClient.request('/admin/reports/flagged');
  }

  // Bulk update reports (PRESERVED EXACTLY - Original Lines 281-291)
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

  // ========== ADVANCED FILTERING AND SEARCH ==========

  // Advanced filtering (PRESERVED EXACTLY - Original Lines 293-314)
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
    
    return this.apiClient.request(endpoint);
  }

  // Search reports (PRESERVED EXACTLY - Original Lines 316-322)
  async searchReports(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    };
    return this.getReportsWithFilter(searchFilters);
  }

  // ========== FEMALE SAFETY FEATURES ==========

  // Get female safety reports (PRESERVED EXACTLY - Original Lines 324-326)
  async getFemaleSafetyReports() {
    return this.apiClient.request('/reports/female-validation-needed');
  }

  // Submit community validation (PRESERVED EXACTLY - Original Lines 328-339)
  async submitCommunityValidation(reportId, isPositive, validatorInfo = {}) {
    return this.apiClient.request(`/reports/${reportId}/validate`, {
      method: 'POST',
      body: JSON.stringify({ 
        isPositive,
        validatorInfo: {
          ...validatorInfo,
          deviceFingerprint: this.apiClient.deviceFingerprint
        }
      })
    });
  }

  // Get female safety statistics (PRESERVED EXACTLY - Original Lines 354-356)
  async getFemaleSafetyStats() {
    return this.apiClient.request('/admin/reports/female-safety-stats');
  }

  // ========== SECURITY AND INTELLIGENCE ==========

  // Get report security insights (PRESERVED EXACTLY - Original Lines 341-343)
  async getReportSecurityInsights() {
    return this.apiClient.request('/admin/reports/security-insights');
  }

  // Detect coordinated attacks (PRESERVED EXACTLY - Original Lines 345-350)
  async detectCoordinatedAttacks(timeWindow = 3600000) {
    return this.apiClient.request('/admin/reports/coordinated-attacks', {
      method: 'POST',
      body: JSON.stringify({ timeWindow })
    });
  }

  // ========== UTILITY METHODS ==========

  // Detect device type (PRESERVED EXACTLY - Method referenced in submitReport)
  detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|tablet/.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // Validate report data (utility method for form validation)
  validateReportData(reportData) {
    const errors = [];
    
    // Required fields validation
    if (!reportData.type) errors.push('Report type is required');
    if (!reportData.description || reportData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }
    if (!reportData.location) errors.push('Location is required');
    if (!reportData.severity || reportData.severity < 1 || reportData.severity > 5) {
      errors.push('Severity must be between 1 and 5');
    }
    
    // Location validation
    if (reportData.location && reportData.location.coordinates) {
      const [lng, lat] = reportData.location.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        errors.push('Invalid location coordinates');
      }
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        errors.push('Location coordinates out of valid range');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Format API error (utility method for error handling)
  formatApiError(error) {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.message) {
      return error.message;
    }
    
    if (error.error) {
      return error.error;
    }
    
    return 'An unknown error occurred';
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
const reportService = new ReportService();

export default reportService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { ReportService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
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
  validateReportData,
  formatApiError,
  detectDeviceType,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = reportService;