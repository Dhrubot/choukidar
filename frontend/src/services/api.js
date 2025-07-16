/**
 * @fileoverview Main API Service Orchestrator - Modular SafeStreets API
 * 
 * This is the main entry point for the SafeStreets API services. It provides a unified
 * interface that maintains 100% backward compatibility with the original monolithic API
 * while delegating to feature-based modular services.
 * 
 * @version 2.0.0
 * @author SafeStreets Development Team
 * @since 1.0.0
 * 
 * @example
 * // Basic usage (backward compatible)
 * import api from './services/api.js';
 * const reports = await api.getReports();
 * 
 * @example
 * // Direct service imports (new capability)
 * import reportService from './services/features/reportService.js';
 * const reports = await reportService.getReports();
 * 
 * @example
 * // Destructured imports (backward compatible)
 * import { getReports, getSafeZones } from './services/api.js';
 */

// Import all service modules
import apiClient from './core/apiClient.js';
import authService from './features/authService.js';
import reportService from './features/reportService.js';
import adminService from './features/adminService.js';
import safeZoneService from './features/safeZoneService.js';
import behaviorService from './features/behaviorService.js';
import { calculateDistance, calculateRouteSafetyScore } from './utils/geoUtils.js';

/**
 * Main API Service class that orchestrates all feature services.
 * Maintains complete backward compatibility with the original monolithic API.
 * 
 * @class ApiService
 * @description Provides a unified interface for all SafeStreets API functionality
 * while delegating to specialized feature services for better maintainability.
 */
class ApiService {
  /**
   * Creates a new ApiService instance with backward-compatible configuration.
   * Initializes all service connections and preserves original caching system.
   * 
   * @constructor
   */
  constructor() {
    // Preserve original configuration properties
    this.baseURL = apiClient.baseURL;
    this.deviceFingerprint = null;
    
    // Preserve caching system from original
    this._safeZoneCache = apiClient._safeZoneCache;
    this._cacheExpiry = apiClient._cacheExpiry;
  }

  // ========== DEVICE & AUTHENTICATION SETUP ==========

  /**
   * Sets the device fingerprint for all API requests across all services.
   * This fingerprint is used for security analysis and user tracking.
   * 
   * @param {string} fingerprint - Unique device identifier
   * @example
   * api.setDeviceFingerprint('device-abc123');
   * // Now all API calls will include this fingerprint
   */
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
    
    // Propagate to all services
    apiClient.setDeviceFingerprint(fingerprint);
    authService.setDeviceFingerprint(fingerprint);
    reportService.setDeviceFingerprint(fingerprint);
    adminService.setDeviceFingerprint(fingerprint);
    safeZoneService.setDeviceFingerprint(fingerprint);
    behaviorService.setDeviceFingerprint(fingerprint);
  }

  // Get authentication headers - delegate to API client
  getAuthHeaders() {
    return apiClient.getAuthHeaders();
  }

  // ========== CORE REQUEST METHODS ==========

  // Generic request method - delegate to API client
  async request(endpoint, options = {}) {
    return apiClient.request(endpoint, options);
  }

  // Request with retry - delegate to API client
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    return apiClient.requestWithRetry(endpoint, options, maxRetries);
  }

  // Request with intelligence retry - delegate to API client
  async requestWithIntelligenceRetry(endpoint, options = {}, maxRetries = 2) {
    return apiClient.requestWithIntelligenceRetry(endpoint, options, maxRetries);
  }

  // Batch requests - delegate to API client
  async batchRequests(requests) {
    return apiClient.batchRequests(requests);
  }

  // ========== AUTHENTICATION ENDPOINTS ==========

  // Get user context - delegate to auth service
  async getUserContext(deviceFingerprint) {
    return authService.getUserContext(deviceFingerprint);
  }

  // Admin login - delegate to auth service
  async adminLogin(credentials) {
    return authService.adminLogin(credentials);
  }

  // Admin logout - delegate to auth service
  async adminLogout() {
    return authService.adminLogout();
  }

  // Verify admin session - delegate to auth service
  async verifyAdminSession() {
    return authService.verifyAdminSession();
  }

  // Get admin profile - delegate to auth service
  async getAdminProfile() {
    return authService.getAdminProfile();
  }

  // Update user preferences - delegate to auth service
  async updateUserPreferences(preferences) {
    return authService.updateUserPreferences(preferences);
  }

  // Get security insights - delegate to auth service
  async getSecurityInsights() {
    return authService.getSecurityInsights();
  }

  // Get security analytics - delegate to auth service
  async getSecurityAnalytics() {
    return authService.getSecurityAnalytics();
  }

  // ========== HEALTH CHECK METHODS ==========

  // Health check - delegate to API client
  async healthCheck() {
    return apiClient.healthCheck();
  }

  // Check health - delegate to API client
  async checkHealth() {
    return apiClient.checkHealth();
  }

  // Get API status - delegate to API client
  async getApiStatus() {
    return apiClient.getApiStatus();
  }

  // Get API info - delegate to API client
  async getApiInfo() {
    return apiClient.getApiInfo();
  }

  // ========== REPORT ENDPOINTS ==========

  // Submit report - delegate to report service
  async submitReport(reportData, behaviorData = {}) {
    return reportService.submitReport(reportData, behaviorData);
  }

  // Get reports - delegate to report service
  async getReports(filters = {}) {
    return reportService.getReports(filters);
  }

  // Get single report by ID - delegate to report service
  async getReport(id) {
    return reportService.getReport(id);
  }

  // Get reports for admin - delegate to report service
  async getAdminReports(filters = {}) {
    return reportService.getAdminReports(filters);
  }

  // Get all admin reports - delegate to report service
  async getAllAdminReports() {
    return reportService.getAllAdminReports();
  }

  // Update report status - delegate to report service
  async updateReportStatus(id, status) {
    return reportService.updateReportStatus(id, status);
  }

  // Moderate report - delegate to report service
  async moderateReport(reportId, action, reason = '', priority = 'normal') {
    return reportService.moderateReport(reportId, action, reason, priority);
  }

  // Get flagged reports - delegate to report service
  async getFlaggedReports() {
    return reportService.getFlaggedReports();
  }

  // Bulk update reports - delegate to report service
  async bulkUpdateReports(reportIds, status) {
    return reportService.bulkUpdateReports(reportIds, status);
  }

  // Advanced filtering - delegate to report service
  async getReportsWithFilter(filters = {}) {
    return reportService.getReportsWithFilter(filters);
  }

  // Search reports - delegate to report service
  async searchReports(searchTerm, filters = {}) {
    return reportService.searchReports(searchTerm, filters);
  }

  // Get female safety reports - delegate to report service
  async getFemaleSafetyReports() {
    return reportService.getFemaleSafetyReports();
  }

  // Submit community validation - delegate to report service
  async submitCommunityValidation(reportId, isPositive, validatorInfo = {}) {
    return reportService.submitCommunityValidation(reportId, isPositive, validatorInfo);
  }

  // Get report security insights - delegate to report service
  async getReportSecurityInsights() {
    return reportService.getReportSecurityInsights();
  }

  // Detect coordinated attacks - delegate to report service
  async detectCoordinatedAttacks(timeWindow = 3600000) {
    return reportService.detectCoordinatedAttacks(timeWindow);
  }

  // Get female safety statistics - delegate to report service
  async getFemaleSafetyStats() {
    return reportService.getFemaleSafetyStats();
  }

  // ========== ADMIN USER MANAGEMENT ==========

  // Get all users - delegate to admin service
  async getUsers(filters = {}) {
    return adminService.getUsers(filters);
  }

  // Get user details - delegate to admin service
  async getUserDetails(userId) {
    return adminService.getUserDetails(userId);
  }

  // Quarantine user - delegate to admin service
  async quarantineUser(userId, quarantine, reason, duration = 24) {
    return adminService.quarantineUser(userId, quarantine, reason, duration);
  }

  // Create admin user - delegate to admin service
  async createAdmin(adminData) {
    return adminService.createAdmin(adminData);
  }

  // Update admin permissions - delegate to admin service
  async updateAdminPermissions(adminId, permissions, adminLevel) {
    return adminService.updateAdminPermissions(adminId, permissions, adminLevel);
  }

  // Get user statistics - delegate to admin service
  async getUserStatistics() {
    return adminService.getUserStatistics();
  }

  // Get device fingerprints - delegate to admin service
  async getDeviceFingerprints(filters = {}) {
    return adminService.getDeviceFingerprints(filters);
  }

  // Quarantine device - delegate to admin service
  async quarantineDevice(fingerprintId, quarantine, reason) {
    return adminService.quarantineDevice(fingerprintId, quarantine, reason);
  }

  // Bulk quarantine operations - delegate to admin service
  async bulkQuarantine(userIds, quarantine, reason) {
    return adminService.bulkQuarantine(userIds, quarantine, reason);
  }

  // ========== ADMIN ANALYTICS & DASHBOARD ==========

  // Get moderation stats - delegate to admin service
  async getModerationStats(timeframe = '30d') {
    return adminService.getModerationStats(timeframe);
  }

  // Get geographic stats - delegate to admin service
  async getGeographicStats() {
    return adminService.getGeographicStats();
  }

  // Export reports - delegate to admin service
  async exportReports(format = 'csv', filters = {}) {
    return adminService.exportReports(format, filters);
  }

  // Get admin dashboard - delegate to admin service
  async getAdminDashboard() {
    return adminService.getAdminDashboard();
  }

  // Get admin analytics - delegate to admin service
  async getAdminAnalytics(timeRange = '30d') {
    return adminService.getAdminAnalytics(timeRange);
  }

  // Check admin access - delegate to admin service
  async checkAdminAccess() {
    return adminService.checkAdminAccess();
  }

  // ========== SAFE ZONES ENDPOINTS ==========

  // Get public safe zones for map display - delegate to safe zone service
  async getSafeZones(options = {}) {
    return safeZoneService.getSafeZones(options);
  }

  // Get nearby safe zones - delegate to safe zone service
  async getNearbySafeZones(lat, lng, radius = 2000, minSafety = 6) {
    return safeZoneService.getNearbySafeZones(lat, lng, radius, minSafety);
  }

  // Get specific safe zone by ID - delegate to safe zone service
  async getSafeZone(id) {
    return safeZoneService.getSafeZone(id);
  }

  // Get safe zones by district/location - delegate to safe zone service
  async getSafeZonesByLocation(district, options = {}) {
    return safeZoneService.getSafeZonesByLocation(district, options);
  }

  // Get public safe zone analytics - delegate to safe zone service
  async getSafeZoneAnalytics() {
    return safeZoneService.getSafeZoneAnalytics();
  }

  // ========== ADMIN SAFE ZONE METHODS ==========

  // Get all safe zones (admin only) - delegate to safe zone service
  async getAdminSafeZones(options = {}) {
    return safeZoneService.getAdminSafeZones(options);
  }

  // Create new safe zone (admin only) - delegate to safe zone service
  async createSafeZone(safeZoneData) {
    return safeZoneService.createSafeZone(safeZoneData);
  }

  // Update safe zone (admin only) - delegate to safe zone service
  async updateSafeZone(id, safeZoneData) {
    return safeZoneService.updateSafeZone(id, safeZoneData);
  }

  // Delete safe zone (admin only) - delegate to safe zone service
  async deleteSafeZone(id) {
    return safeZoneService.deleteSafeZone(id);
  }

  // Bulk update safe zone statuses (admin only) - delegate to safe zone service
  async bulkUpdateSafeZoneStatus(safeZoneIds, status) {
    return safeZoneService.bulkUpdateSafeZoneStatus(safeZoneIds, status);
  }

  // Enhanced version method name - delegate to safe zone service
  async bulkUpdateSafeZones(safeZoneIds, status) {
    return safeZoneService.bulkUpdateSafeZones(safeZoneIds, status);
  }

  // Get admin safe zone analytics - delegate to safe zone service
  async getAdminSafeZoneAnalytics() {
    return safeZoneService.getAdminSafeZoneAnalytics();
  }

  // Import safe zones from data (admin only) - delegate to safe zone service
  async importSafeZones(safeZones, source = 'import', overwrite = false) {
    return safeZoneService.importSafeZones(safeZones, source, overwrite);
  }

  // Export safe zones data (admin only) - delegate to safe zone service
  async exportSafeZones(format = 'json', status = 'active') {
    return safeZoneService.exportSafeZones(format, status);
  }

  // ========== INTELLIGENCE & ANALYSIS ==========

  // Check if safe zones service is available - delegate to safe zone service
  async checkSafeZonesAvailability() {
    return safeZoneService.checkSafeZonesAvailability();
  }

  // Get intelligent recommendations based on location - delegate to safe zone service
  async getLocationIntelligence(lat, lng) {
    return safeZoneService.getLocationIntelligence(lat, lng);
  }

  // Get comprehensive area analysis - delegate to safe zone service
  async getAreaAnalysis(lat, lng, radius = 1000) {
    return safeZoneService.getAreaAnalysis(lat, lng, radius);
  }

  // Get route safety analysis - delegate to safe zone service
  async getRouteSafetyData(startLat, startLng, endLat, endLng) {
    return safeZoneService.getRouteSafetyData(startLat, startLng, endLat, endLng);
  }

  // ========== CACHING AND BATCH OPERATIONS ==========

  // Simple in-memory cache for safe zones - delegate to safe zone service
  async getCachedSafeZones(cacheKey, fetchFunction) {
    return safeZoneService.getCachedSafeZones(cacheKey, fetchFunction);
  }

  // Clear safe zone cache - delegate to safe zone service
  clearSafeZoneCache() {
    return safeZoneService.clearSafeZoneCache();
  }

  // Batch get multiple safe zones by IDs - delegate to safe zone service
  async getBatchSafeZones(ids) {
    return safeZoneService.getBatchSafeZones(ids);
  }

  // Batch create multiple safe zones (admin only) - delegate to safe zone service
  async createBatchSafeZones(safeZonesData) {
    return safeZoneService.createBatchSafeZones(safeZonesData);
  }

  // ========== SAFETY RECOMMENDATIONS ==========

  // Generate basic safety recommendations - delegate to safe zone service
  generateSafetyRecommendations(safeZones, reports) {
    return safeZoneService.generateSafetyRecommendations(safeZones, reports);
  }

  // Generate route recommendations - delegate to safe zone service
  generateRouteRecommendations(safeZones) {
    return safeZoneService.generateRouteRecommendations(safeZones);
  }

  // ========== MATHEMATICAL UTILITIES ==========

  // Calculate distance between two points - delegate to geo utils
  calculateDistance(lat1, lng1, lat2, lng2) {
    return calculateDistance(lat1, lng1, lat2, lng2);
  }

  // Calculate route safety score - delegate to geo utils
  calculateRouteSafetyScore(safeZones) {
    return calculateRouteSafetyScore(safeZones);
  }

  // ========== BEHAVIOR TRACKING ==========

  // Detect device type - delegate to behavior service
  detectDeviceType() {
    return behaviorService.detectDeviceType();
  }

  // Track user behavior - delegate to behavior service
  trackBehavior(action, details = {}) {
    return behaviorService.trackBehavior(action, details);
  }

  // Get behavior data - delegate to behavior service
  getBehaviorData() {
    return behaviorService.getBehaviorData();
  }

  // Clear behavior data - delegate to behavior service
  clearBehaviorData() {
    return behaviorService.clearBehaviorData();
  }

  // Generate behavior signature - delegate to behavior service
  generateBehaviorSignature(behaviorData = {}) {
    return behaviorService.generateBehaviorSignature(behaviorData);
  }

  // Analyze behavior pattern - delegate to behavior service
  analyzeBehaviorPattern(recentBehavior = null) {
    return behaviorService.analyzeBehaviorPattern(recentBehavior);
  }

  // Calculate human behavior score - delegate to behavior service
  calculateHumanBehaviorScore(behaviorData = null, interactionMetrics = {}) {
    return behaviorService.calculateHumanBehaviorScore(behaviorData, interactionMetrics);
  }

  // Get comprehensive behavior metrics - delegate to behavior service
  getBehaviorMetrics() {
    return behaviorService.getBehaviorMetrics();
  }

  // ========== UTILITY METHODS ==========

  // Subscribe to real-time updates - delegate to API client
  getWebSocketUrl() {
    return apiClient.getWebSocketUrl();
  }

  // Validate report data before submission - delegate to API client
  validateReportData(reportData) {
    return apiClient.validateReportData(reportData);
  }

  // Format API errors for user display - delegate to API client
  formatApiError(error) {
    return apiClient.formatApiError(error);
  }

  // ========== VALIDATION METHODS ==========

  // Get validation queue for user - delegate to API client
  async getValidationQueue(userLocation = null, filters = {}) {
    return apiClient.request('/community/validation-queue', {
      method: 'POST',
      body: JSON.stringify({ userLocation, filters })
    });
  }

  // Get user's validation history - delegate to API client
  async getValidationHistory() {
    return apiClient.request('/community/validation-history');
  }

  // Get validation statistics - delegate to API client
  async getValidationStats() {
    return apiClient.request('/community/validation-stats');
  }

  // ========== FEMALE SAFETY METHODS ==========

  // Get female safety recommendations - delegate to API client
  async getFemaleSafetyRecommendations(location, timeOfDay) {
    return apiClient.request('/female-safety/recommendations', {
      method: 'POST',
      body: JSON.stringify({ location, timeOfDay })
    });
  }

  // Get female-specific safe zones - delegate to API client
  async getFemaleSafeZones(location, radius = 2000) {
    return apiClient.request('/female-safety/safe-zones', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Report female safety concern - delegate to API client
  async reportFemaleSafetyConcern(concernData) {
    return apiClient.request('/female-safety/report-concern', {
      method: 'POST',
      body: JSON.stringify(concernData)
    });
  }

  // ========== REAL-TIME METHODS ==========

  // Get real-time alerts for location - delegate to API client
  async getRealTimeAlerts(location, radius = 1000) {
    return apiClient.request('/alerts/location', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Subscribe to real-time updates (placeholder)
  subscribeToUpdates(callback) {
    // TODO: Implement WebSocket or SSE for real-time updates
    console.log('Real-time updates not yet implemented');
    return callback;
  }

  // ========== FUTURE FEATURES ==========

  // Police registration (future) - delegate to API client
  async registerPolice(policeData) {
    return apiClient.request('/auth/police/register', {
      method: 'POST',
      body: JSON.stringify(policeData)
    });
  }

  // Researcher registration (future) - delegate to API client
  async registerResearcher(researcherData) {
    return apiClient.request('/auth/researcher/register', {
      method: 'POST',
      body: JSON.stringify(researcherData)
    });
  }
}

// Create and export singleton instance
const apiService = new ApiService();

// ========== EXPORT PATTERNS FOR BACKWARD COMPATIBILITY ==========

// Default export - singleton instance (primary usage pattern)
export default apiService;

// Named export - ApiService class for testing and advanced usage
export { ApiService };

// Individual method exports for destructuring (backward compatibility)
export const {
  // Core request methods
  request,
  requestWithRetry,
  requestWithIntelligenceRetry,
  batchRequests,
  
  // Authentication methods
  getUserContext,
  adminLogin,
  adminLogout,
  verifyAdminSession,
  getAdminProfile,
  updateUserPreferences,
  getSecurityInsights,
  getSecurityAnalytics,
  
  // Health check methods
  healthCheck,
  checkHealth,
  getApiStatus,
  getApiInfo,
  
  // Report methods
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
  
  // Admin methods
  getUsers,
  getUserDetails,
  quarantineUser,
  createAdmin,
  updateAdminPermissions,
  getUserStatistics,
  getDeviceFingerprints,
  quarantineDevice,
  bulkQuarantine,
  getModerationStats,
  getGeographicStats,
  exportReports,
  getAdminDashboard,
  getAdminAnalytics,
  checkAdminAccess,
  
  // Safe zone methods
  getSafeZones,
  getNearbySafeZones,
  getSafeZone,
  getSafeZonesByLocation,
  getSafeZoneAnalytics,
  getAdminSafeZones,
  createSafeZone,
  updateSafeZone,
  deleteSafeZone,
  bulkUpdateSafeZoneStatus,
  bulkUpdateSafeZones,
  getAdminSafeZoneAnalytics,
  importSafeZones,
  exportSafeZones,
  checkSafeZonesAvailability,
  getLocationIntelligence,
  getAreaAnalysis,
  getRouteSafetyData,
  getCachedSafeZones,
  clearSafeZoneCache,
  getBatchSafeZones,
  createBatchSafeZones,
  generateSafetyRecommendations,
  generateRouteRecommendations,
  
  // Utility methods
  detectDeviceType,
  trackBehavior,
  getBehaviorData,
  clearBehaviorData,
  generateBehaviorSignature,
  analyzeBehaviorPattern,
  calculateHumanBehaviorScore,
  getBehaviorMetrics,
  getWebSocketUrl,
  validateReportData,
  formatApiError,
  
  // Configuration methods
  setDeviceFingerprint,
  getAuthHeaders,
  
  // Validation methods
  getValidationQueue,
  getValidationHistory,
  getValidationStats,
  
  // Female safety methods
  getFemaleSafetyRecommendations,
  getFemaleSafeZones,
  reportFemaleSafetyConcern,
  
  // Real-time methods
  getRealTimeAlerts,
  subscribeToUpdates,
  
  // Future features
  registerPolice,
  registerResearcher
} = apiService;

export { calculateDistance, calculateRouteSafetyScore };