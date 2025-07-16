// === frontend/src/services/behavior/behaviorService.js ===
// Behavior Service for SafeStreets Bangladesh
// EXTRACTED from original api.js behavior tracking methods
// Contains: Device detection, behavior tracking, user analytics

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Behavior Service Class
 * EXTRACTED from original ApiService behavior methods
 * Preserves ALL original functionality including:
 * - Device type detection for enhanced reporting
 * - Behavior pattern tracking and analysis
 * - User interaction data collection
 */
class BehaviorService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
    
    // In-memory behavior data storage
    this.behaviorData = {
      interactions: [],
      sessionStart: Date.now(),
      deviceType: this.detectDeviceType()
    };
  }

  // ========== BEHAVIOR TRACKING METHODS (PRESERVED EXACTLY) ==========

  // Detect device type (PRESERVED EXACTLY - Referenced in original submitReport)
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

  // Track user behavior patterns
  trackBehavior(eventType, eventData = {}) {
    const behaviorEvent = {
      type: eventType,
      timestamp: Date.now(),
      data: eventData,
      sessionTime: Date.now() - this.behaviorData.sessionStart
    };
    
    this.behaviorData.interactions.push(behaviorEvent);
    
    // Keep only last 100 interactions to prevent memory bloat
    if (this.behaviorData.interactions.length > 100) {
      this.behaviorData.interactions = this.behaviorData.interactions.slice(-100);
    }
    
    console.log('📊 Behavior tracked:', eventType, eventData);
  }

  // Get collected behavior data
  getBehaviorData() {
    return {
      ...this.behaviorData,
      sessionDuration: Date.now() - this.behaviorData.sessionStart,
      interactionCount: this.behaviorData.interactions.length,
      humanBehaviorScore: this.calculateHumanBehaviorScore()
    };
  }

  // Clear behavior data
  clearBehaviorData() {
    this.behaviorData = {
      interactions: [],
      sessionStart: Date.now(),
      deviceType: this.detectDeviceType()
    };
    console.log('🗑️ Behavior data cleared');
  }

  // ========== BEHAVIOR ANALYSIS METHODS ==========

  // Calculate human behavior score (anti-bot detection)
  calculateHumanBehaviorScore() {
    const interactions = this.behaviorData.interactions;
    if (interactions.length === 0) return 50; // Neutral score
    
    let score = 50;
    
    // Check for natural interaction patterns
    const timings = interactions.map((interaction, index) => {
      if (index === 0) return 0;
      return interaction.timestamp - interactions[index - 1].timestamp;
    }).filter(timing => timing > 0);
    
    if (timings.length > 0) {
      // Natural human timing (not too fast, not too slow)
      const avgTiming = timings.reduce((sum, timing) => sum + timing, 0) / timings.length;
      
      if (avgTiming > 100 && avgTiming < 5000) { // 100ms to 5s is human-like
        score += 20;
      } else if (avgTiming < 50) { // Too fast (bot-like)
        score -= 30;
      }
      
      // Check for timing variance (humans are inconsistent)
      const variance = this.calculateVariance(timings);
      if (variance > 100000) { // Good variance indicates human behavior
        score += 15;
      }
    }
    
    // Mouse/touch movement patterns
    const mouseEvents = interactions.filter(i => i.type === 'mouse_move' || i.type === 'touch');
    if (mouseEvents.length > 5) {
      score += 10; // Human-like if there are mouse movements
    }
    
    // Form interaction patterns
    const formEvents = interactions.filter(i => i.type.includes('form_'));
    if (formEvents.length > 0) {
      score += 5; // Bonus for form interactions
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate variance for timing analysis
  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    
    return variance;
  }

  // Get behavior insights for admin dashboard
  getBehaviorInsights() {
    const data = this.getBehaviorData();
    
    return {
      deviceType: data.deviceType,
      sessionDuration: data.sessionDuration,
      interactionCount: data.interactionCount,
      humanBehaviorScore: data.humanBehaviorScore,
      riskAssessment: this.assessRisk(data),
      recommendations: this.generateRecommendations(data)
    };
  }

  // Assess risk level based on behavior
  assessRisk(behaviorData) {
    const score = behaviorData.humanBehaviorScore;
    
    if (score >= 80) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'critical';
  }

  // Generate security recommendations
  generateRecommendations(behaviorData) {
    const recommendations = [];
    
    if (behaviorData.humanBehaviorScore < 40) {
      recommendations.push('Potential automated behavior detected');
    }
    
    if (behaviorData.sessionDuration < 30000) { // Less than 30 seconds
      recommendations.push('Very short session - may indicate rushed/automated submission');
    }
    
    if (behaviorData.interactionCount < 3) {
      recommendations.push('Limited user interaction - consider additional verification');
    }
    
    return recommendations;
  }

  // ========== EVENT TRACKING HELPERS ==========

  // Track form interactions
  trackFormEvent(eventType, fieldName, value = null) {
    this.trackBehavior(`form_${eventType}`, {
      field: fieldName,
      value: value ? '***' : null, // Don't store actual values for privacy
      timestamp: Date.now()
    });
  }

  // Track mouse/touch events
  trackUserInteraction(eventType, coordinates = null) {
    this.trackBehavior(eventType, {
      coordinates: coordinates ? {
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y)
      } : null,
      timestamp: Date.now()
    });
  }

  // Track page navigation
  trackNavigation(from, to) {
    this.trackBehavior('navigation', {
      from,
      to,
      timestamp: Date.now()
    });
  }

  // ========== DELEGATION METHODS ==========

  // Set device fingerprint (delegation to apiClient)
  setDeviceFingerprint(fingerprint) {
    return this.apiClient.setDeviceFingerprint(fingerprint);
  }

  // Get device fingerprint (delegation to apiClient)
  getDeviceFingerprint() {
    return this.apiClient.getDeviceFingerprint();
  }
}

// Create and export singleton instance
const behaviorService = new BehaviorService();

export default behaviorService;

// Export class for testing
export { BehaviorService };

// Export individual methods for convenience
export const {
  detectDeviceType,
  trackBehavior,
  getBehaviorData,
  clearBehaviorData,
  calculateHumanBehaviorScore,
  getBehaviorInsights,
  assessRisk,
  generateRecommendations,
  trackFormEvent,
  trackUserInteraction,
  trackNavigation,
  setDeviceFingerprint,
  getDeviceFingerprint
} = behaviorService;