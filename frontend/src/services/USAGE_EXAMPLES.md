# API Services Usage Examples

This document provides practical examples of how to use the modular API services in different scenarios.

## Table of Contents

1. [Basic Usage Examples](#basic-usage-examples)
2. [Advanced Usage Patterns](#advanced-usage-patterns)
3. [Component Integration Examples](#component-integration-examples)
4. [Testing Examples](#testing-examples)
5. [Migration Examples](#migration-examples)

## Basic Usage Examples

### 1. Report Management Component

```javascript
// ReportManager.js - Using direct service imports
import reportService from '../services/features/reportService.js';
import behaviorService from '../services/features/behaviorService.js';

class ReportManager {
  async submitIncidentReport(reportData) {
    try {
      // Track user behavior for security analysis
      behaviorService.trackBehavior('report_start', { 
        timestamp: Date.now() 
      });

      // Generate behavior signature
      const behaviorData = behaviorService.generateBehaviorSignature({
        submissionTime: Date.now() - this.startTime,
        interactionPattern: 'normal'
      });

      // Submit report with behavior data
      const result = await reportService.submitReport(reportData, behaviorData);
      
      if (result.success) {
        behaviorService.trackBehavior('report_success');
        return { success: true, reportId: result.data.id };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      behaviorService.trackBehavior('report_error', { error: error.message });
      throw error;
    }
  }

  async getReportsForModeration(filters = {}) {
    return await reportService.getAdminReports({
      status: 'pending',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...filters
    });
  }

  async moderateReport(reportId, action, reason) {
    return await reportService.moderateReport(reportId, action, reason, 'high');
  }
}

export default ReportManager;
```

### 2. Safe Zone Explorer Component

```javascript
// SafeZoneExplorer.js - Location-based safe zone discovery
import safeZoneService from '../services/features/safeZoneService.js';
import { calculateDistance } from '../services/utils/geoUtils.js';

class SafeZoneExplorer {
  constructor() {
    this.userLocation = null;
    this.cachedZones = new Map();
  }

  async findNearbySafeZones(lat, lng, radius = 2000) {
    this.userLocation = { lat, lng };
    
    try {
      // Use caching for better performance
      const cacheKey = `zones_${lat}_${lng}_${radius}`;
      
      const safeZones = await safeZoneService.getCachedSafeZones(
        cacheKey,
        () => safeZoneService.getNearbySafeZones(lat, lng, radius, 6)
      );

      // Calculate distances and sort by proximity
      const zonesWithDistance = safeZones.features?.map(zone => ({
        ...zone,
        distance: calculateDistance(
          lat, lng,
          zone.geometry.coordinates[1],
          zone.geometry.coordinates[0]
        )
      })).sort((a, b) => a.distance - b.distance);

      return {
        success: true,
        zones: zonesWithDistance,
        userLocation: this.userLocation
      };
    } catch (error) {
      console.error('Failed to find safe zones:', error);
      return { success: false, error: error.message };
    }
  }

  async getLocationIntelligence(lat, lng) {
    const intelligence = await safeZoneService.getLocationIntelligence(lat, lng);
    
    if (intelligence.success) {
      // Generate user-friendly recommendations
      const recommendations = this.formatRecommendations(
        intelligence.data.safetyRecommendations
      );
      
      return {
        ...intelligence,
        formattedRecommendations: recommendations
      };
    }
    
    return intelligence;
  }

  async planSafeRoute(startLat, startLng, endLat, endLng) {
    const routeData = await safeZoneService.getRouteSafetyData(
      startLat, startLng, endLat, endLng
    );

    if (routeData.success) {
      const { data } = routeData;
      
      return {
        route: data.route,
        distance: data.distance,
        safetyScore: data.safetyScore,
        safeZones: data.corridorSafeZones,
        recommendations: data.recommendations,
        riskLevel: this.calculateRiskLevel(data.safetyScore)
      };
    }

    return routeData;
  }

  formatRecommendations(recommendations) {
    return recommendations.map(rec => ({
      ...rec,
      icon: this.getRecommendationIcon(rec.type),
      color: this.getRecommendationColor(rec.priority)
    }));
  }

  calculateRiskLevel(safetyScore) {
    if (safetyScore >= 8) return 'low';
    if (safetyScore >= 6) return 'medium';
    return 'high';
  }

  getRecommendationIcon(type) {
    const icons = {
      'safe_zone': '🛡️',
      'caution': '⚠️',
      'warning': '🚨',
      'positive': '✅',
      'info': 'ℹ️'
    };
    return icons[type] || '📍';
  }

  getRecommendationColor(priority) {
    const colors = {
      'high': '#ff4444',
      'medium': '#ffaa00',
      'low': '#44ff44'
    };
    return colors[priority] || '#888888';
  }
}

export default SafeZoneExplorer;
```

### 3. Admin Dashboard Component

```javascript
// AdminDashboard.js - Comprehensive admin interface
import adminService from '../services/features/adminService.js';
import reportService from '../services/features/reportService.js';
import safeZoneService from '../services/features/safeZoneService.js';

class AdminDashboard {
  constructor() {
    this.refreshInterval = null;
    this.dashboardData = {};
  }

  async initializeDashboard() {
    try {
      // Check admin access first
      const hasAccess = await adminService.checkAdminAccess();
      if (!hasAccess) {
        throw new Error('Insufficient admin privileges');
      }

      // Load dashboard data in parallel
      const [dashboard, modStats, geoStats, flaggedReports] = await Promise.all([
        adminService.getAdminDashboard(),
        adminService.getModerationStats('30d'),
        adminService.getGeographicStats(),
        reportService.getFlaggedReports()
      ]);

      this.dashboardData = {
        overview: dashboard.data,
        moderation: modStats.data,
        geographic: geoStats.data,
        flaggedReports: flaggedReports.data,
        lastUpdated: new Date().toISOString()
      };

      return this.dashboardData;
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      throw error;
    }
  }

  async handleBulkModeration(reportIds, action, reason) {
    try {
      const results = [];
      
      // Process in batches to avoid overwhelming the server
      const batchSize = 10;
      for (let i = 0; i < reportIds.length; i += batchSize) {
        const batch = reportIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(id => 
          reportService.moderateReport(id, action, reason)
        );
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      }

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: true,
        processed: reportIds.length,
        successful,
        failed,
        results
      };
    } catch (error) {
      console.error('Bulk moderation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async exportReportsData(format = 'csv', filters = {}) {
    try {
      const exportData = await adminService.exportReports(format, {
        dateFrom: filters.startDate,
        dateTo: filters.endDate,
        status: filters.status,
        ...filters
      });

      // Create download link
      const blob = new Blob([exportData], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reports_export_${Date.now()}.${format}`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      return { success: true, message: 'Export completed' };
    } catch (error) {
      console.error('Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  async manageUsers(action, userIds, options = {}) {
    switch (action) {
      case 'quarantine':
        return await adminService.bulkQuarantine(
          userIds, 
          true, 
          options.reason || 'Bulk quarantine action'
        );
      
      case 'unquarantine':
        return await adminService.bulkQuarantine(
          userIds, 
          false, 
          options.reason || 'Bulk unquarantine action'
        );
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  startAutoRefresh(intervalMs = 30000) {
    this.stopAutoRefresh();
    
    this.refreshInterval = setInterval(async () => {
      try {
        await this.initializeDashboard();
        console.log('Dashboard refreshed automatically');
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, intervalMs);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export default AdminDashboard;
```

## Advanced Usage Patterns

### 1. Service Composition Pattern

```javascript
// LocationIntelligenceService.js - Combining multiple services
import safeZoneService from '../services/features/safeZoneService.js';
import reportService from '../services/features/reportService.js';
import { calculateDistance } from '../services/utils/geoUtils.js';

class LocationIntelligenceService {
  async getComprehensiveLocationAnalysis(lat, lng, radius = 1000) {
    try {
      // Gather data from multiple services
      const [safeZones, reports, areaAnalysis] = await Promise.allSettled([
        safeZoneService.getNearbySafeZones(lat, lng, radius),
        reportService.getReports({ 
          // Note: Backend filtering by location would be ideal
          limit: 100 
        }),
        safeZoneService.getAreaAnalysis(lat, lng, radius)
      ]);

      // Process and combine results
      const analysis = {
        location: { lat, lng, radius },
        timestamp: new Date().toISOString(),
        safetyMetrics: {},
        recommendations: [],
        riskFactors: []
      };

      // Process safe zones
      if (safeZones.status === 'fulfilled') {
        const zones = safeZones.value.features || [];
        analysis.safetyMetrics.safeZones = {
          total: zones.length,
          highSafety: zones.filter(z => z.properties.safetyScore >= 8).length,
          averageSafety: zones.length > 0 ? 
            zones.reduce((sum, z) => sum + z.properties.safetyScore, 0) / zones.length : 0
        };
      }

      // Process reports (client-side filtering by location)
      if (reports.status === 'fulfilled') {
        const allReports = reports.value.data || [];
        const nearbyReports = allReports.filter(report => {
          if (!report.location?.coordinates) return false;
          
          const distance = calculateDistance(
            lat, lng,
            report.location.coordinates[1],
            report.location.coordinates[0]
          );
          
          return distance <= radius;
        });

        analysis.safetyMetrics.incidents = {
          total: nearbyReports.length,
          recent: nearbyReports.filter(r => {
            const days = (Date.now() - new Date(r.createdAt)) / (1000 * 60 * 60 * 24);
            return days <= 7;
          }).length,
          byType: this.groupReportsByType(nearbyReports)
        };
      }

      // Add area analysis
      if (areaAnalysis.status === 'fulfilled') {
        analysis.areaInsights = areaAnalysis.value.data;
      }

      // Generate recommendations
      analysis.recommendations = this.generateIntelligentRecommendations(analysis);
      
      return { success: true, data: analysis };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  groupReportsByType(reports) {
    return reports.reduce((acc, report) => {
      const type = report.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  generateIntelligentRecommendations(analysis) {
    const recommendations = [];
    const { safetyMetrics } = analysis;

    // Safe zone recommendations
    if (safetyMetrics.safeZones?.total > 0) {
      if (safetyMetrics.safeZones.averageSafety >= 8) {
        recommendations.push({
          type: 'positive',
          priority: 'high',
          title: 'High Safety Area',
          message: `This area has ${safetyMetrics.safeZones.highSafety} high-safety zones nearby`,
          action: 'This is a relatively safe location'
        });
      }
    } else {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: 'Limited Safe Zone Coverage',
        message: 'No safe zones identified in this area',
        action: 'Exercise extra caution and consider alternative locations'
      });
    }

    // Incident-based recommendations
    if (safetyMetrics.incidents?.recent > 0) {
      recommendations.push({
        type: 'caution',
        priority: 'medium',
        title: 'Recent Incidents',
        message: `${safetyMetrics.incidents.recent} incidents reported in the last 7 days`,
        action: 'Stay alert and avoid isolated areas'
      });
    }

    return recommendations;
  }
}

export default LocationIntelligenceService;
```

### 2. Real-time Data Integration

```javascript
// RealTimeMonitor.js - Real-time updates with service integration
import reportService from '../services/features/reportService.js';
import safeZoneService from '../services/features/safeZoneService.js';
import apiClient from '../services/core/apiClient.js';

class RealTimeMonitor {
  constructor() {
    this.websocket = null;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      // Get WebSocket URL from API client
      const wsUrl = apiClient.getWebSocketUrl();
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Real-time monitor connected');
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        this.handleRealtimeUpdate(JSON.parse(event.data));
      };

      this.websocket.onclose = () => {
        console.log('Real-time monitor disconnected');
        this.attemptReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to initialize real-time monitor:', error);
    }
  }

  async handleRealtimeUpdate(update) {
    const { type, data } = update;

    switch (type) {
      case 'new_report':
        await this.handleNewReport(data);
        break;
      
      case 'report_status_change':
        await this.handleReportStatusChange(data);
        break;
      
      case 'safe_zone_update':
        await this.handleSafeZoneUpdate(data);
        break;
      
      case 'security_alert':
        await this.handleSecurityAlert(data);
        break;
      
      default:
        console.log('Unknown update type:', type);
    }

    // Notify subscribers
    this.notifySubscribers(type, data);
  }

  async handleNewReport(reportData) {
    // Clear relevant caches
    safeZoneService.clearSafeZoneCache();
    
    // Fetch updated data if needed
    if (this.subscribers.has('reports')) {
      const updatedReports = await reportService.getReports();
      this.notifySubscribers('reports_updated', updatedReports);
    }
  }

  async handleSafeZoneUpdate(safeZoneData) {
    // Clear safe zone cache
    safeZoneService.clearSafeZoneCache();
    
    // Notify subscribers of safe zone changes
    this.notifySubscribers('safe_zones_updated', safeZoneData);
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    
    this.subscribers.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Subscriber callback error:', error);
        }
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.initialize();
      }, delay);
    }
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.subscribers.clear();
  }
}

export default RealTimeMonitor;
```

## Component Integration Examples

### 1. React Hook Integration

```javascript
// useApiServices.js - Custom React hook
import { useState, useEffect, useCallback } from 'react';
import reportService from '../services/features/reportService.js';
import safeZoneService from '../services/features/safeZoneService.js';
import behaviorService from '../services/features/behaviorService.js';

export function useReports(filters = {}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await reportService.getReports(filters);
      if (result.success) {
        setReports(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const submitReport = useCallback(async (reportData) => {
    const behaviorData = behaviorService.generateBehaviorSignature();
    return await reportService.submitReport(reportData, behaviorData);
  }, []);

  return {
    reports,
    loading,
    error,
    refetch: fetchReports,
    submitReport
  };
}

export function useSafeZones(location, radius = 2000) {
  const [safeZones, setSafeZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSafeZones = useCallback(async () => {
    if (!location?.lat || !location?.lng) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeZoneService.getNearbySafeZones(
        location.lat, 
        location.lng, 
        radius
      );
      
      if (result.success) {
        setSafeZones(result.features || []);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [location, radius]);

  useEffect(() => {
    fetchSafeZones();
  }, [fetchSafeZones]);

  return {
    safeZones,
    loading,
    error,
    refetch: fetchSafeZones
  };
}
```

### 2. Vue Composition API Integration

```javascript
// composables/useApiServices.js - Vue 3 composables
import { ref, computed, watch } from 'vue';
import reportService from '../services/features/reportService.js';
import safeZoneService from '../services/features/safeZoneService.js';

export function useReportManagement() {
  const reports = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchReports = async (filters = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const result = await reportService.getReports(filters);
      if (result.success) {
        reports.value = result.data;
      } else {
        error.value = result.message;
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const submitReport = async (reportData) => {
    try {
      const result = await reportService.submitReport(reportData);
      if (result.success) {
        // Refresh reports list
        await fetchReports();
      }
      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  return {
    reports: computed(() => reports.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    fetchReports,
    submitReport
  };
}

export function useLocationIntelligence(location) {
  const intelligence = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchIntelligence = async () => {
    if (!location.value?.lat || !location.value?.lng) return;
    
    loading.value = true;
    error.value = null;
    
    try {
      const result = await safeZoneService.getLocationIntelligence(
        location.value.lat,
        location.value.lng
      );
      
      if (result.success) {
        intelligence.value = result.data;
      } else {
        error.value = result.message;
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // Watch for location changes
  watch(location, fetchIntelligence, { deep: true });

  return {
    intelligence: computed(() => intelligence.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refetch: fetchIntelligence
  };
}
```

## Testing Examples

### 1. Service Unit Tests

```javascript
// reportService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import reportService from '../features/reportService.js';

// Mock the API client
vi.mock('../core/apiClient.js', () => ({
  default: {
    request: vi.fn(),
    setDeviceFingerprint: vi.fn(),
    deviceFingerprint: 'test-device'
  }
}));

import apiClient from '../core/apiClient.js';

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitReport', () => {
    it('should submit report with behavior data', async () => {
      const mockResponse = { success: true, data: { id: '123' } };
      apiClient.request.mockResolvedValue(mockResponse);

      const reportData = {
        type: 'harassment',
        description: 'Test incident',
        location: { coordinates: [90.4125, 23.8103] },
        severity: 4
      };

      const behaviorData = {
        submissionTime: 5000,
        interactionPattern: 'normal'
      };

      const result = await reportService.submitReport(reportData, behaviorData);

      expect(apiClient.request).toHaveBeenCalledWith('/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...reportData,
          submittedBy: {
            deviceFingerprint: 'test-device',
            userType: 'anonymous'
          },
          behaviorSignature: expect.objectContaining({
            submissionSpeed: 5000,
            deviceType: expect.any(String),
            interactionPattern: 'normal',
            humanBehaviorScore: 75
          })
        })
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle submission errors', async () => {
      const mockError = new Error('Network error');
      apiClient.request.mockRejectedValue(mockError);

      const reportData = { type: 'test' };

      await expect(reportService.submitReport(reportData)).rejects.toThrow('Network error');
    });
  });

  describe('getReportsWithFilter', () => {
    it('should build query parameters correctly', async () => {
      const mockResponse = { success: true, data: [] };
      apiClient.request.mockResolvedValue(mockResponse);

      const filters = {
        status: 'pending',
        type: 'harassment',
        severity: 'high',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31'
      };

      await reportService.getReportsWithFilter(filters);

      expect(apiClient.request).toHaveBeenCalledWith(
        '/admin/reports?status=pending&type=harassment&severity=high&dateFrom=2024-01-01&dateTo=2024-01-31'
      );
    });
  });
});
```

### 2. Integration Tests

```javascript
// apiIntegration.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import api from '../api.js';

describe('API Integration', () => {
  beforeEach(() => {
    // Set up test environment
    api.setDeviceFingerprint('test-device-123');
  });

  it('should maintain backward compatibility', async () => {
    // Test that all methods exist and are callable
    expect(typeof api.getReports).toBe('function');
    expect(typeof api.submitReport).toBe('function');
    expect(typeof api.getSafeZones).toBe('function');
    expect(typeof api.adminLogin).toBe('function');
  });

  it('should propagate device fingerprint to all services', () => {
    const testFingerprint = 'new-test-device';
    api.setDeviceFingerprint(testFingerprint);
    
    expect(api.deviceFingerprint).toBe(testFingerprint);
    // Additional checks would verify propagation to individual services
  });

  it('should handle method delegation correctly', async () => {
    // Mock a successful response
    const mockResponse = { success: true, data: [] };
    
    // This would require proper mocking setup
    // The test verifies that calling api.getReports() 
    // properly delegates to reportService.getReports()
  });
});
```

## Migration Examples

### 1. Gradual Migration Strategy

```javascript
// Before: Using monolithic API
import api from './services/api-old.js';

class ReportComponent {
  async loadReports() {
    const reports = await api.getReports();
    const safeZones = await api.getSafeZones();
    return { reports, safeZones };
  }
}

// After: Step 1 - Switch to new API (no other changes)
import api from './services/api.js';

class ReportComponent {
  async loadReports() {
    const reports = await api.getReports();
    const safeZones = await api.getSafeZones();
    return { reports, safeZones };
  }
}

// After: Step 2 - Use direct service imports (optional)
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';

class ReportComponent {
  async loadReports() {
    const reports = await reportService.getReports();
    const safeZones = await safeZoneService.getSafeZones();
    return { reports, safeZones };
  }
}
```

### 2. Component-by-Component Migration

```javascript
// MapComponent.js - Migrated to use direct imports
import safeZoneService from '../services/features/safeZoneService.js';
import { calculateDistance } from '../services/utils/geoUtils.js';

class MapComponent {
  async loadMapData(bounds) {
    // Use specific service for better performance
    const safeZones = await safeZoneService.getSafeZones({
      lat: bounds.center.lat,
      lng: bounds.center.lng,
      radius: bounds.radius
    });

    // Use utility function directly
    const distances = safeZones.features?.map(zone => ({
      ...zone,
      distance: calculateDistance(
        bounds.center.lat,
        bounds.center.lng,
        zone.geometry.coordinates[1],
        zone.geometry.coordinates[0]
      )
    }));

    return distances;
  }
}

// ReportForm.js - Still using main API (both approaches work)
import api from '../services/api.js';

class ReportForm {
  async submitReport(data) {
    return await api.submitReport(data);
  }
}
```

### 3. Testing Migration

```javascript
// Before: Testing with monolithic API
import api from '../services/api-old.js';

// Mock entire API
vi.mock('../services/api-old.js', () => ({
  default: {
    getReports: vi.fn(),
    submitReport: vi.fn(),
    getSafeZones: vi.fn()
  }
}));

// After: Testing with modular services
import reportService from '../services/features/reportService.js';
import safeZoneService from '../services/features/safeZoneService.js';

// Mock individual services
vi.mock('../services/features/reportService.js', () => ({
  default: {
    getReports: vi.fn(),
    submitReport: vi.fn()
  }
}));

vi.mock('../services/features/safeZoneService.js', () => ({
  default: {
    getSafeZones: vi.fn()
  }
}));

// More focused and maintainable tests
test('should load reports', async () => {
  reportService.getReports.mockResolvedValue({ success: true, data: [] });
  
  const result = await component.loadReports();
  expect(reportService.getReports).toHaveBeenCalled();
});
```

---

These examples demonstrate the flexibility and power of the modular API architecture while maintaining full backward compatibility. Choose the approach that best fits your specific use case and migration timeline.