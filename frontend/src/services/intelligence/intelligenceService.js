// === frontend/src/services/intelligence/intelligenceService.js ===
// Intelligence Service for SafeStreets Bangladesh
// EXTRACTED LINE-BY-LINE from original api.js (Lines 556-700 approximately)
// Contains: Location intelligence, area analysis, route safety, safety recommendations

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Intelligence Service Class
 * EXTRACTED from original ApiService intelligence methods
 * Preserves ALL original functionality including:
 * - Safe zones availability checking
 * - Location-based intelligence gathering
 * - Comprehensive area analysis
 * - Route safety data preparation
 * - Safety recommendations generation
 * - Route recommendations for safer travel
 */
class IntelligenceService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== CORE INTELLIGENCE METHODS ==========

  // Check if safe zones service is available (PRESERVED EXACTLY - Original Lines 558-564)
  async checkSafeZonesAvailability() {
    try {
      const response = await this.getSafeZoneAnalytics();
      return { available: true, data: response.data };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  // Get intelligent recommendations based on location (PRESERVED EXACTLY - Original Lines 566-584)
  async getLocationIntelligence(lat, lng) {
    try {
      const [safeZones, reports] = await Promise.all([
        this.getNearbySafeZones(lat, lng, 1000), // 1km radius
        this.getReports() // Get all reports (could be filtered by location)
      ]);

      return {
        success: true,
        data: {
          nearbySafeZones: safeZones.features || [],
          nearbyReports: reports.data || [],
          safetyRecommendations: this.generateSafetyRecommendations(safeZones, reports),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get comprehensive area analysis (PRESERVED EXACTLY - Original Lines 586-628)
  async getAreaAnalysis(lat, lng, radius = 1000) {
    try {
      const [safeZones, reports, analytics] = await Promise.allSettled([
        this.getNearbySafeZones(lat, lng, radius),
        this.getReports(), // TODO: Add location filtering when backend supports it
        this.getSafeZoneAnalytics()
      ]);

      const result = {
        location: { lat, lng, radius },
        timestamp: new Date().toISOString(),
        analysis: {}
      };

      // Process safe zones data (PRESERVED EXACTLY - Original Lines 598-610)
      if (safeZones.status === 'fulfilled') {
        const zones = safeZones.value.features || [];
        result.analysis.safeZones = {
          total: zones.length,
          averageSafety: zones.length > 0 ? 
            zones.reduce((sum, z) => sum + z.properties.safetyScore, 0) / zones.length : 0,
          highSafety: zones.filter(z => z.properties.safetyScore >= 8).length,
          zones: zones.slice(0, 5) // Top 5 nearest zones
        };
      } else {
        result.analysis.safeZones = { error: safeZones.reason?.message };
      }

      // Process reports data (PRESERVED EXACTLY - Original Lines 612-621)
      if (reports.status === 'fulfilled') {
        const reportsData = reports.value.data || [];
        result.analysis.incidents = {
          total: reportsData.length,
          recent: reportsData.filter(r => {
            const days = (Date.now() - new Date(r.createdAt || r.timestamp)) / (1000 * 60 * 60 * 24);
            return days <= 30;
          }).length
        };
      } else {
        result.analysis.incidents = { error: reports.reason?.message };
      }

      // Process analytics (PRESERVED EXACTLY - Original Lines 623-625)
      if (analytics.status === 'fulfilled') {
        result.analysis.overview = analytics.value.data;
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get route safety analysis (PRESERVED EXACTLY - Original Lines 630-655)
  async getRouteSafetyData(startLat, startLng, endLat, endLng) {
    try {
      // Get safe zones along potential route corridor (PRESERVED EXACTLY - Original Lines 632-638)
      const midLat = (startLat + endLat) / 2;
      const midLng = (startLng + endLng) / 2;
      
      // Calculate rough corridor radius (PRESERVED EXACTLY - Original Lines 640-641)
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
      const corridorRadius = Math.max(500, distance / 2); // At least 500m, or half the route distance
      
      const safeZones = await this.getNearbySafeZones(midLat, midLng, corridorRadius);
      
      return {
        success: true,
        data: {
          route: { start: [startLat, startLng], end: [endLat, endLng] },
          distance,
          corridorSafeZones: safeZones.features || [],
          safetyScore: this.calculateRouteSafetyScore(safeZones.features || []),
          recommendations: this.generateRouteRecommendations(safeZones.features || [])
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== UTILITY METHODS (PRESERVED EXACTLY) ==========

  // Calculate distance between two coordinates (PRESERVED EXACTLY - Referenced in original)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  // Calculate route safety score (PRESERVED EXACTLY - Referenced in original)
  calculateRouteSafetyScore(safeZones) {
    if (safeZones.length === 0) return 3; // Low safety if no safe zones
    
    const averageSafety = safeZones.reduce((sum, zone) => 
      sum + (zone.properties?.safetyScore || 5), 0) / safeZones.length;
    
    // Adjust score based on safe zone density
    const densityBonus = Math.min(2, safeZones.length * 0.2);
    
    return Math.min(10, averageSafety + densityBonus);
  }

  // Generate safety recommendations (PRESERVED EXACTLY - Original Lines 675-698)
  generateSafetyRecommendations(safeZones, reports) {
    const recommendations = [];
    
    // Check safe zone availability
    const zones = safeZones.features || [];
    if (zones.length === 0) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        message: 'No verified safe zones in immediate area',
        suggestion: 'Consider moving to a more populated area with established safe zones'
      });
    } else {
      const highSafetyZones = zones.filter(z => z.properties.safetyScore >= 8);
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'positive',
          priority: 'low',
          message: `${highSafetyZones.length} high-safety zones nearby`,
          suggestion: 'Good safety coverage in this area'
        });
      }
    }

    // Check recent incident activity
    const reportsData = reports.data || [];
    if (reportsData.length > 0) {
      const recentReports = reportsData.filter(report => {
        const daysDiff = (Date.now() - new Date(report.createdAt || report.timestamp)) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Reports from last 7 days
      });

      if (recentReports.length > 0) {
        recommendations.push({
          type: 'caution',
          priority: 'medium',
          message: `${recentReports.length} recent incidents in the area`,
          suggestion: 'Exercise extra caution and consider safer routes'
        });
      }
    }

    return recommendations;
  }

  // Generate route recommendations (PRESERVED EXACTLY - Original Lines 700-730)
  generateRouteRecommendations(safeZones) {
    const recommendations = [];
    
    if (safeZones.length === 0) {
      recommendations.push({
        type: 'warning',
        message: 'No safe zones identified along this route',
        suggestion: 'Consider alternative routes with better safety coverage'
      });
    } else {
      const highSafetyZones = safeZones.filter(z => z.properties.safetyScore >= 8);
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'positive',
          message: `Route passes near ${highSafetyZones.length} high-safety zones`,
          suggestion: 'This appears to be a relatively safe route'
        });
      }
      
      const policeStations = safeZones.filter(z => z.properties.zoneType === 'police_station');
      if (policeStations.length > 0) {
        recommendations.push({
          type: 'info',
          message: `${policeStations.length} police stations along route`,
          suggestion: 'Good emergency support availability'
        });
      }
    }
    
    return recommendations;
  }

  // ========== DELEGATION METHODS (Access to related services) ==========

  // Get safe zone analytics (delegation - part of intelligence gathering)
  async getSafeZoneAnalytics() {
    return this.apiClient.request('/safezones/analytics/public');
  }

  // Get nearby safe zones (delegation - part of intelligence gathering)
  async getNearbySafeZones(lat, lng, radius, minSafety = 6) {
    const params = new URLSearchParams({ lat, lng, radius, minSafety });
    return this.apiClient.request(`/safezones?${params}`);
  }

  // Get reports (delegation - part of intelligence gathering)
  async getReports(filters = {}) {
    const queryParams = new URLSearchParams({
      includeGenderSensitive: true,
      ...filters
    }).toString();
    
    return this.apiClient.request(`/reports?${queryParams}`);
  }

  // ========== ADVANCED INTELLIGENCE METHODS ==========

  // Analyze area threat level based on multiple factors
  async getAreaThreatLevel(lat, lng, radius = 1000) {
    try {
      const analysis = await this.getAreaAnalysis(lat, lng, radius);
      
      if (!analysis.success) {
        return { threatLevel: 'unknown', confidence: 0 };
      }
      
      const { safeZones, incidents } = analysis.data.analysis;
      
      // Calculate threat level based on safe zones and incidents
      let threatScore = 5; // Neutral starting point
      
      // Safe zones reduce threat
      if (safeZones && !safeZones.error) {
        const safetyBonus = Math.min(3, safeZones.total * 0.5);
        threatScore -= safetyBonus;
      }
      
      // Recent incidents increase threat
      if (incidents && !incidents.error) {
        const threatPenalty = Math.min(4, incidents.recent * 0.3);
        threatScore += threatPenalty;
      }
      
      // Convert to threat level
      let threatLevel;
      if (threatScore <= 2) threatLevel = 'low';
      else if (threatScore <= 4) threatLevel = 'moderate';
      else if (threatScore <= 7) threatLevel = 'high';
      else threatLevel = 'critical';
      
      return {
        threatLevel,
        threatScore: Math.max(0, Math.min(10, threatScore)),
        confidence: 0.8, // High confidence in our analysis
        factors: {
          safeZoneCount: safeZones?.total || 0,
          recentIncidents: incidents?.recent || 0,
          analysisRadius: radius
        }
      };
      
    } catch (error) {
      return { 
        threatLevel: 'unknown', 
        confidence: 0, 
        error: error.message 
      };
    }
  }

  // Get personalized safety recommendations based on user profile
  generatePersonalizedRecommendations(userProfile, locationData) {
    const recommendations = [];
    const baseRecommendations = this.generateSafetyRecommendations(
      locationData.safeZones, 
      locationData.reports
    );
    
    // Add base recommendations
    recommendations.push(...baseRecommendations);
    
    // Add personalized recommendations based on user profile
    if (userProfile.genderSensitive) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        message: 'Female safety considerations active',
        suggestion: 'Prioritizing well-lit areas and verified safe spaces'
      });
    }
    
    if (userProfile.timeOfDay === 'night') {
      recommendations.push({
        type: 'caution',
        priority: 'high',
        message: 'Night time safety protocols',
        suggestion: 'Stay in well-lit areas and consider group travel'
      });
    }
    
    if (userProfile.transportMode === 'walking') {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        message: 'Pedestrian safety active',
        suggestion: 'Use sidewalks and crosswalks, stay visible to traffic'
      });
    }
    
    return recommendations;
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
const intelligenceService = new IntelligenceService();

export default intelligenceService;

// Export class for testing (PRESERVED EXACTLY - Original pattern)
export { IntelligenceService };

// Export individual methods for convenience (PRESERVED EXACTLY - Original pattern)
export const {
  checkSafeZonesAvailability,
  getLocationIntelligence,
  getAreaAnalysis,
  getRouteSafetyData,
  calculateDistance,
  calculateRouteSafetyScore,
  generateSafetyRecommendations,
  generateRouteRecommendations,
  getSafeZoneAnalytics,
  getNearbySafeZones,
  getReports,
  getAreaThreatLevel,
  generatePersonalizedRecommendations,
  setDeviceFingerprint,
  getDeviceFingerprint,
  requestWithRetry,
  batchRequests
} = intelligenceService;