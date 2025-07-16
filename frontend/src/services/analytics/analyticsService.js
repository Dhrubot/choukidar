// === frontend/src/services/analytics/analyticsService.js ===
// Analytics Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 358-410 approximately)
// Contains: Dashboard analytics, moderation stats, geographic data, export functionality

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Analytics Service Class
 * EXTRACTED from original ApiService analytics methods
 * Preserves ALL original functionality including:
 * - Admin dashboard data
 * - Moderation statistics with timeframes
 * - Geographic analytics
 * - Report export functionality (CSV/JSON)
 * - Admin access verification
 * - Security analytics integration
 */
class AnalyticsService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== CORE ANALYTICS METHODS ==========

  // Get moderation stats (PRESERVED EXACTLY - Original Lines 358-360)
  async getModerationStats(timeframe = '30d') {
    return this.apiClient.request(`/admin/analytics/moderation?timeframe=${timeframe}`);
  }

  // Get geographic stats (PRESERVED EXACTLY - Original Lines 362-364)
  async getGeographicStats() {
    return this.apiClient.request('/admin/analytics/geographic');
  }

  // Export reports (PRESERVED EXACTLY - Original Lines 366-383)
  async exportReports(format = 'csv', filters = {}) {
    const params = new URLSearchParams(filters);
    params.append('format', format);
    
    const response = await fetch(`${this.apiClient.baseURL}/admin/export?${params.toString()}`, {
      headers: {
        ...this.apiClient.getAuthHeaders(),
        'Accept': format === 'csv' ? 'text/csv' : 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    return format === 'csv' ? response.text() : response.json();
  }

  // ========== ADMIN DASHBOARD METHODS ==========

  // Get admin dashboard (PRESERVED EXACTLY - Original Lines 387-389)
  async getAdminDashboard() {
    return this.apiClient.request('/admin/dashboard');
  }

  // Get admin analytics (PRESERVED EXACTLY - Original Lines 391-393)
  async getAdminAnalytics(timeRange = '30d') {
    return this.apiClient.request(`/admin/analytics?timeRange=${timeRange}`);
  }

  // Check admin access (PRESERVED EXACTLY - Original Lines 395-401)
  async checkAdminAccess() {
    try {
      await this.apiClient.request('/admin/dashboard');
      return true;
    } catch (error) {
      return false;
    }
  }

  // ========== UTILITY METHODS ==========

  // Format timeframe for API requests
  formatTimeframe(timeframe) {
    const validTimeframes = ['1d', '7d', '30d', '90d', '1y', 'all'];
    return validTimeframes.includes(timeframe) ? timeframe : '30d';
  }

  // Parse analytics response for frontend consumption
  parseAnalyticsData(data) {
    return {
      summary: data.summary || {},
      breakdown: data.breakdown || [],
      trends: data.trends || [],
      insights: data.insights || [],
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  }

  // Format export parameters
  formatExportParams(filters) {
    const validParams = {};
    
    // Date range filters
    if (filters.startDate) validParams.startDate = filters.startDate;
    if (filters.endDate) validParams.endDate = filters.endDate;
    
    // Status filters
    if (filters.status) validParams.status = filters.status;
    if (filters.type) validParams.type = filters.type;
    if (filters.severity) validParams.severity = filters.severity;
    
    // Geographic filters
    if (filters.district) validParams.district = filters.district;
    if (filters.thana) validParams.thana = filters.thana;
    if (filters.withinBangladesh !== undefined) validParams.withinBangladesh = filters.withinBangladesh;
    
    // Security filters
    if (filters.includeSecurityFlags) validParams.includeSecurityFlags = filters.includeSecurityFlags;
    if (filters.onlyFlagged) validParams.onlyFlagged = filters.onlyFlagged;
    
    return validParams;
  }

  // ========== ENHANCED ANALYTICS METHODS ==========

  // Get security analytics dashboard
  async getSecurityAnalytics() {
    return this.apiClient.request('/admin/analytics/security');
  }

  // Get moderation queue analytics
  async getModerationQueueAnalytics() {
    return this.apiClient.request('/admin/analytics/moderation-queue');
  }

  // Get user activity analytics
  async getUserActivityAnalytics(timeframe = '30d') {
    const formattedTimeframe = this.formatTimeframe(timeframe);
    return this.apiClient.request(`/admin/analytics/user-activity?timeframe=${formattedTimeframe}`);
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    return this.apiClient.request('/admin/analytics/performance');
  }

  // Get trend analysis
  async getTrendAnalysis(metric, timeframe = '30d') {
    const formattedTimeframe = this.formatTimeframe(timeframe);
    return this.apiClient.request(`/admin/analytics/trends/${metric}?timeframe=${formattedTimeframe}`);
  }

  // ========== SPECIALIZED EXPORT METHODS ==========

  // Export moderation report
  async exportModerationReport(timeframe = '30d', format = 'csv') {
    const formattedTimeframe = this.formatTimeframe(timeframe);
    return this.exportReports(format, {
      type: 'moderation',
      timeframe: formattedTimeframe
    });
  }

  // Export geographic report
  async exportGeographicReport(format = 'csv') {
    return this.exportReports(format, {
      type: 'geographic',
      includeCoordinates: true
    });
  }

  // Export security report
  async exportSecurityReport(format = 'csv') {
    return this.exportReports(format, {
      type: 'security',
      includeSecurityFlags: true,
      includeDeviceFingerprints: true
    });
  }

  // Export user analytics report
  async exportUserReport(format = 'csv') {
    return this.exportReports(format, {
      type: 'users',
      includeActivityMetrics: true,
      includeTrustScores: true
    });
  }

  // ========== DATA PROCESSING METHODS ==========

  // Process dashboard data for charts
  processDashboardData(dashboardData) {
    const processed = {
      overview: {
        total: dashboardData.total || 0,
        pending: dashboardData.pending || 0,
        approved: dashboardData.approved || 0,
        rejected: dashboardData.rejected || 0
      },
      security: {
        crossBorderReports: dashboardData.security?.crossBorderReports || 0,
        potentialSpam: dashboardData.security?.potentialSpam || 0,
        bangladeshReports: dashboardData.security?.bangladeshReports || 0,
        flaggedReports: dashboardData.security?.flaggedReports || 0
      },
      sources: dashboardData.sourceBreakdown || [],
      trends: this.calculateTrends(dashboardData)
    };

    return processed;
  }

  // Calculate trends from data
  calculateTrends(data) {
    // Basic trend calculation
    const total = data.total || 0;
    const approved = data.approved || 0;
    const rejected = data.rejected || 0;
    const pending = data.pending || 0;

    return {
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : '0.0',
      rejectionRate: total > 0 ? ((rejected / total) * 100).toFixed(1) : '0.0',
      pendingRate: total > 0 ? ((pending / total) * 100).toFixed(1) : '0.0',
      securityRisk: data.security ? this.calculateSecurityRisk(data.security) : 'low'
    };
  }

  // Calculate security risk level
  calculateSecurityRisk(securityData) {
    const total = securityData.bangladeshReports || 1;
    const flagged = (securityData.crossBorderReports || 0) + (securityData.potentialSpam || 0);
    const riskRatio = flagged / total;

    if (riskRatio > 0.3) return 'high';
    if (riskRatio > 0.15) return 'medium';
    return 'low';
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
const analyticsService = new AnalyticsService();

export default analyticsService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { AnalyticsService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  getModerationStats,
  getGeographicStats,
  exportReports,
  getAdminDashboard,
  getAdminAnalytics,
  checkAdminAccess,
  formatTimeframe,
  parseAnalyticsData,
  formatExportParams,
  getSecurityAnalytics,
  getModerationQueueAnalytics,
  getUserActivityAnalytics,
  getPerformanceMetrics,
  getTrendAnalysis,
  exportModerationReport,
  exportGeographicReport,
  exportSecurityReport,
  exportUserReport,
  processDashboardData,
  calculateTrends,
  calculateSecurityRisk,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = analyticsService;