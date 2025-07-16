// === frontend/src/services/types/apiTypes.js ===
// API Types and Constants for SafeStreets Bangladesh
// EXTRACTED from original api.js to centralize type definitions
// Contains: API constants, enums, type definitions, validation schemas

/**
 * API Types and Constants
 * Centralized location for all API-related type definitions
 * Ensures consistency across all service modules
 */

// ========== API CONFIGURATION ==========

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes
  BATCH_SIZE: 5,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000 // 1 second base delay for exponential backoff
};

// ========== REPORT TYPES ==========

export const REPORT_TYPES = {
  CHADABAJI: 'chadabaji',
  TEEN_GANG: 'teen_gang', 
  CHINTAI: 'chintai',
  OTHER: 'other'
};

export const REPORT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FLAGGED: 'flagged',
  UNDER_REVIEW: 'under_review'
};

export const SEVERITY_LEVELS = {
  VERY_LOW: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
  CRITICAL: 5
};

// ========== USER TYPES ==========

export const USER_TYPES = {
  ANONYMOUS: 'anonymous',
  ADMIN: 'admin',
  POLICE: 'police',
  RESEARCHER: 'researcher'
};

export const ADMIN_LEVELS = {
  BASIC: 'basic',
  STANDARD: 'standard',
  SENIOR: 'senior',
  SUPER: 'super'
};

export const RISK_LEVELS = {
  VERY_LOW: 'very_low',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// ========== SAFE ZONE TYPES ==========

export const SAFE_ZONE_TYPES = {
  PUBLIC: 'public',
  POLICE_STATION: 'police_station',
  HOSPITAL: 'hospital',
  SCHOOL: 'school',
  MOSQUE: 'mosque',
  MARKET: 'market',
  TRANSPORT_HUB: 'transport_hub'
};

export const SAFE_ZONE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review'
};

export const VERIFICATION_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  REJECTED: 'rejected'
};

// ========== DEVICE TYPES ==========

export const DEVICE_TYPES = {
  MOBILE: 'mobile',
  TABLET: 'tablet',
  DESKTOP: 'desktop'
};

// ========== LOCATION SOURCES ==========

export const LOCATION_SOURCES = {
  GPS: 'GPS',
  SEARCH: 'Search',
  MAP_CLICK: 'Map Click',
  MANUAL: 'Manual',
  DEFAULT: 'default'
};

// ========== RECOMMENDATION TYPES ==========

export const RECOMMENDATION_TYPES = {
  SAFE_ZONE: 'safe_zone',
  CAUTION: 'caution',
  WARNING: 'warning',
  POSITIVE: 'positive',
  INFO: 'info'
};

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// ========== ANALYTICS TIMEFRAMES ==========

export const TIMEFRAMES = {
  ONE_DAY: '1d',
  SEVEN_DAYS: '7d',
  THIRTY_DAYS: '30d',
  NINETY_DAYS: '90d',
  ONE_YEAR: '1y',
  ALL: 'all'
};

// ========== EXPORT FORMATS ==========

export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  GEOJSON: 'geojson'
};

// ========== PERMISSIONS ==========

export const PERMISSIONS = {
  // Anonymous user permissions
  VIEW_MAP: 'view_map',
  SUBMIT_REPORT: 'submit_report',
  VALIDATE_REPORTS: 'validate_reports',
  VIEW_SAFE_ZONES: 'view_safe_zones',
  VIEW_PUBLIC_ANALYTICS: 'view_public_analytics',
  
  // Admin permissions
  VIEW_PENDING_REPORTS: 'view_pending_reports',
  APPROVE_REPORTS: 'approve_reports',
  REJECT_REPORTS: 'reject_reports',
  VIEW_ALL_REPORTS: 'view_all_reports',
  MODERATE_CONTENT: 'moderate_content',
  VIEW_FLAGGED_REPORTS: 'view_flagged_reports',
  VIEW_ADMIN_ANALYTICS: 'view_admin_analytics',
  EXPORT_DATA: 'export_data',
  VIEW_USER_STATISTICS: 'view_user_statistics',
  VIEW_SECURITY_ANALYTICS: 'view_security_analytics',
  GENERATE_REPORTS: 'generate_reports',
  VIEW_USERS: 'view_users',
  MANAGE_USER_PERMISSIONS: 'manage_user_permissions',
  QUARANTINE_USERS: 'quarantine_users',
  VIEW_USER_ACTIVITY: 'view_user_activity',
  MANAGE_ADMIN_ACCOUNTS: 'manage_admin_accounts',
  CREATE_SAFE_ZONES: 'create_safe_zones',
  EDIT_SAFE_ZONES: 'edit_safe_zones',
  DELETE_SAFE_ZONES: 'delete_safe_zones',
  VERIFY_SAFE_ZONES: 'verify_safe_zones',
  MANAGE_SAFE_ZONE_CATEGORIES: 'manage_safe_zone_categories',
  VIEW_SECURITY_DASHBOARD: 'view_security_dashboard',
  MANAGE_THREAT_INTEL: 'manage_threat_intel',
  VIEW_DEVICE_FINGERPRINTS: 'view_device_fingerprints',
  MANAGE_QUARANTINE: 'manage_quarantine',
  VIEW_ABUSE_PATTERNS: 'view_abuse_patterns',
  ALL_PERMISSIONS: 'all_permissions',
  MANAGE_ADMINS: 'manage_admins',
  SYSTEM_CONFIGURATION: 'system_configuration',
  BACKUP_MANAGEMENT: 'backup_management',
  AUDIT_LOGS: 'audit_logs'
};

// ========== BANGLADESH GEOGRAPHIC BOUNDS ==========

export const BANGLADESH_BOUNDS = {
  NORTH: 26.7,
  SOUTH: 20.5,
  EAST: 92.7,
  WEST: 88.0
};

// ========== API ENDPOINTS ==========

export const ENDPOINTS = {
  // Health and status
  HEALTH: '/health',
  API_STATUS: '/',
  
  // Authentication
  USER_CONTEXT: '/auth/user/context',
  ADMIN_LOGIN: '/auth/admin/login',
  ADMIN_LOGOUT: '/auth/admin/logout',
  ADMIN_VERIFY: '/admin/verify',
  ADMIN_PROFILE: '/auth/admin/profile',
  UPDATE_PREFERENCES: '/auth/user/update-preferences',
  SECURITY_INSIGHTS: '/auth/security/insights',
  SECURITY_ANALYTICS: '/admin/analytics/security',
  
  // Reports
  REPORTS: '/reports',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_REPORTS_ALL: '/admin/reports/all',
  REPORTS_FLAGGED: '/admin/reports/flagged',
  REPORTS_FEMALE_VALIDATION: '/reports/female-validation-needed',
  REPORTS_SECURITY_INSIGHTS: '/admin/reports/security-insights',
  REPORTS_COORDINATED_ATTACKS: '/admin/reports/coordinated-attacks',
  REPORTS_FEMALE_SAFETY_STATS: '/admin/reports/female-safety-stats',
  
  // Users
  USERS: '/user-types/admin/users',
  USERS_STATISTICS: '/user-types/admin/statistics',
  USERS_DEVICES: '/user-types/admin/devices',
  USERS_BULK_QUARANTINE: '/user-types/admin/bulk/quarantine',
  ADMIN_CREATE: '/user-types/admin/create',
  
  // Analytics
  ANALYTICS_MODERATION: '/admin/analytics/moderation',
  ANALYTICS_GEOGRAPHIC: '/admin/analytics/geographic',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_ANALYTICS: '/admin/analytics',
  ADMIN_EXPORT: '/admin/export',
  
  // Safe Zones
  SAFE_ZONES: '/safezones',
  SAFE_ZONES_ANALYTICS: '/safezones/analytics/public',
  SAFE_ZONES_ADMIN: '/safezones/admin',
  SAFE_ZONES_ADMIN_ALL: '/safezones/admin/all',
  SAFE_ZONES_ADMIN_ANALYTICS: '/safezones/admin/analytics',
  SAFE_ZONES_ADMIN_IMPORT: '/safezones/admin/import',
  SAFE_ZONES_ADMIN_EXPORT: '/safezones/admin/export',
  SAFE_ZONES_ADMIN_BULK: '/safezones/admin/bulk/status',
  
  // Validation
  VALIDATION_QUEUE: '/community/validation-queue',
  VALIDATION_HISTORY: '/community/validation-history',
  VALIDATION_STATS: '/community/validation-stats',
  
  // Female Safety
  FEMALE_SAFETY_RECOMMENDATIONS: '/female-safety/recommendations',
  FEMALE_SAFETY_ZONES: '/female-safety/safe-zones',
  FEMALE_SAFETY_CONCERNS: '/female-safety/report-concern',
  
  // Real-time
  ALERTS_LOCATION: '/alerts/location',
  
  // Future features
  POLICE_REGISTER: '/auth/police/register',
  RESEARCHER_REGISTER: '/auth/researcher/register'
};

// ========== HTTP METHODS ==========

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH'
};

// ========== ERROR CODES ==========

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  CACHE_ERROR: 'CACHE_ERROR'
};

// ========== VALIDATION SCHEMAS ==========

export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\+88)?01[3-9]\d{8}$/,
  COORDINATES: {
    LATITUDE: { min: -90, max: 90 },
    LONGITUDE: { min: -180, max: 180 }
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[a-zA-Z0-9_-]+$/
  },
  DESCRIPTION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 1000
  }
};

// ========== DEFAULT VALUES ==========

export const DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20
  },
  RADIUS: {
    SAFE_ZONES: 2000, // meters
    NEARBY_SEARCH: 1000, // meters
    AREA_ANALYSIS: 1000 // meters
  },
  TIMEFRAME: '30d',
  MIN_SAFETY_SCORE: 6,
  CACHE_EXPIRY: 5 * 60 * 1000, // 5 minutes
  RETRY_ATTEMPTS: 3,
  BATCH_SIZE: 5
};

// ========== FEATURE FLAGS ==========

export const FEATURES = {
  FEMALE_SAFETY: true,
  REAL_TIME_ALERTS: false, // Not yet implemented
  ROUTE_INTELLIGENCE: true,
  COMMUNITY_VALIDATION: true,
  OFFLINE_SUPPORT: true,
  BEHAVIOR_TRACKING: true,
  ADVANCED_ANALYTICS: true
};

// ========== UTILITY FUNCTIONS ==========

// Check if a user type has permission
export const hasPermission = (userType, permission, adminLevel = null) => {
  if (userType === USER_TYPES.ANONYMOUS) {
    return [
      PERMISSIONS.VIEW_MAP,
      PERMISSIONS.SUBMIT_REPORT,
      PERMISSIONS.VALIDATE_REPORTS,
      PERMISSIONS.VIEW_SAFE_ZONES,
      PERMISSIONS.VIEW_PUBLIC_ANALYTICS
    ].includes(permission);
  }
  
  if (userType === USER_TYPES.ADMIN) {
    if (adminLevel === ADMIN_LEVELS.SUPER) {
      return true; // Super admin has all permissions
    }
    // Add more permission logic based on admin level
    return true; // Simplified for now
  }
  
  return false;
};

// Validate coordinates
export const isValidCoordinate = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }
  
  const [lng, lat] = coordinates;
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' &&
    lng >= VALIDATION_PATTERNS.COORDINATES.LONGITUDE.min &&
    lng <= VALIDATION_PATTERNS.COORDINATES.LONGITUDE.max &&
    lat >= VALIDATION_PATTERNS.COORDINATES.LATITUDE.min &&
    lat <= VALIDATION_PATTERNS.COORDINATES.LATITUDE.max
  );
};

// Check if coordinates are within Bangladesh
export const isWithinBangladesh = (coordinates) => {
  if (!isValidCoordinate(coordinates)) return false;
  
  const [lng, lat] = coordinates;
  return (
    lat >= BANGLADESH_BOUNDS.SOUTH &&
    lat <= BANGLADESH_BOUNDS.NORTH &&
    lng >= BANGLADESH_BOUNDS.WEST &&
    lng <= BANGLADESH_BOUNDS.EAST
  );
};

// Format error message
export const formatErrorMessage = (error) => {
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error) return error.error;
  return 'An unknown error occurred';
};

// Build API endpoint URL
export const buildEndpointUrl = (baseUrl, endpoint, params = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const queryString = new URLSearchParams(params).toString();
  return queryString ? `${url}?${queryString}` : url;
};

// Validate report data
export const validateReportData = (data) => {
  const errors = [];
  
  if (!data.type || !Object.values(REPORT_TYPES).includes(data.type)) {
    errors.push('Invalid report type');
  }
  
  if (!data.description || data.description.length < VALIDATION_PATTERNS.DESCRIPTION.MIN_LENGTH) {
    errors.push(`Description must be at least ${VALIDATION_PATTERNS.DESCRIPTION.MIN_LENGTH} characters`);
  }
  
  if (!data.location || !isValidCoordinate(data.location.coordinates)) {
    errors.push('Valid location coordinates are required');
  }
  
  if (!data.severity || !Object.values(SEVERITY_LEVELS).includes(data.severity)) {
    errors.push('Valid severity level is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Export all constants and utilities
export default {
  API_CONFIG,
  REPORT_TYPES,
  REPORT_STATUS,
  SEVERITY_LEVELS,
  USER_TYPES,
  ADMIN_LEVELS,
  RISK_LEVELS,
  SAFE_ZONE_TYPES,
  SAFE_ZONE_STATUS,
  VERIFICATION_STATUS,
  DEVICE_TYPES,
  LOCATION_SOURCES,
  RECOMMENDATION_TYPES,
  PRIORITY_LEVELS,
  TIMEFRAMES,
  EXPORT_FORMATS,
  PERMISSIONS,
  BANGLADESH_BOUNDS,
  ENDPOINTS,
  HTTP_METHODS,
  ERROR_CODES,
  VALIDATION_PATTERNS,
  DEFAULTS,
  FEATURES,
  hasPermission,
  isValidCoordinate,
  isWithinBangladesh,
  formatErrorMessage,
  buildEndpointUrl,
  validateReportData
};