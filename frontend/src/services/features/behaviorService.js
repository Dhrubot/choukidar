// Behavior Service - Device detection and behavior tracking functionality
// Extracted from api-old.js for modular architecture

import apiClient from '../core/apiClient.js';

class BehaviorService {
  constructor() {
    this.deviceFingerprint = null;
  }

  // Set device fingerprint for behavior tracking
  setDeviceFingerprint(fingerprint) {
    this.deviceFingerprint = fingerprint;
  }

  // Detect device type for behavior analysis
  detectDeviceType() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
      return 'mobile';
    } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  // Track user behavior for security analysis
  trackBehavior(action, details = {}) {
    // This could be enhanced to send behavior data to backend
    console.log('📊 Behavior tracked:', action, details);
    
    // Store locally for submission with next report
    const behaviorData = JSON.parse(localStorage.getItem('safestreets_behavior') || '[]');
    behaviorData.push({
      action,
      details,
      timestamp: Date.now(),
      deviceFingerprint: this.deviceFingerprint
    });
    
    // Keep only last 10 behavior events
    if (behaviorData.length > 10) {
      behaviorData.splice(0, behaviorData.length - 10);
    }
    
    localStorage.setItem('safestreets_behavior', JSON.stringify(behaviorData));
  }

  // Get stored behavior data
  getBehaviorData() {
    return JSON.parse(localStorage.getItem('safestreets_behavior') || '[]');
  }

  // Clear behavior data
  clearBehaviorData() {
    localStorage.removeItem('safestreets_behavior');
  }

  // Generate behavior signature for report submission
  generateBehaviorSignature(behaviorData = {}) {
    return {
      submissionSpeed: behaviorData.submissionTime || 0,
      deviceType: this.detectDeviceType(),
      interactionPattern: behaviorData.interactionPattern || 'normal',
      humanBehaviorScore: behaviorData.humanBehaviorScore || 75
    };
  }

  // Enhanced behavior analysis for security purposes
  analyzeBehaviorPattern(recentBehavior = null) {
    const behaviorData = recentBehavior || this.getBehaviorData();
    
    if (behaviorData.length === 0) {
      return {
        riskLevel: 'unknown',
        confidence: 0,
        patterns: []
      };
    }

    // Analyze patterns in behavior data
    const patterns = [];
    const timeSpans = [];
    
    for (let i = 1; i < behaviorData.length; i++) {
      const timeDiff = behaviorData[i].timestamp - behaviorData[i-1].timestamp;
      timeSpans.push(timeDiff);
    }

    // Check for rapid-fire submissions (potential bot behavior)
    const rapidSubmissions = timeSpans.filter(span => span < 1000).length; // Less than 1 second
    if (rapidSubmissions > 2) {
      patterns.push('rapid_submissions');
    }

    // Check for consistent timing (potential automation)
    if (timeSpans.length > 3) {
      const avgTime = timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length;
      const variance = timeSpans.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / timeSpans.length;
      
      if (variance < 100) { // Very consistent timing
        patterns.push('consistent_timing');
      }
    }

    // Determine risk level
    let riskLevel = 'low';
    let confidence = 50;

    if (patterns.includes('rapid_submissions') && patterns.includes('consistent_timing')) {
      riskLevel = 'high';
      confidence = 85;
    } else if (patterns.length > 0) {
      riskLevel = 'medium';
      confidence = 65;
    }

    return {
      riskLevel,
      confidence,
      patterns,
      behaviorCount: behaviorData.length,
      analysis: {
        averageTimeBetweenActions: timeSpans.length > 0 ? 
          timeSpans.reduce((a, b) => a + b, 0) / timeSpans.length : 0,
        rapidActions: rapidSubmissions,
        deviceType: this.detectDeviceType()
      }
    };
  }

  // Calculate human behavior score based on interaction patterns
  calculateHumanBehaviorScore(behaviorData = null, interactionMetrics = {}) {
    const behavior = behaviorData || this.getBehaviorData();
    let score = 75; // Base human score

    // Analyze device consistency
    const deviceType = this.detectDeviceType();
    if (deviceType === 'mobile') {
      score += 5; // Mobile users tend to be more human-like
    }

    // Analyze interaction patterns
    if (interactionMetrics.mouseMovements > 0) {
      score += 10; // Mouse movements indicate human interaction
    }

    if (interactionMetrics.keyboardEvents > 0) {
      score += 5; // Keyboard events indicate human interaction
    }

    // Analyze behavior timing
    const analysis = this.analyzeBehaviorPattern(behavior);
    if (analysis.riskLevel === 'high') {
      score -= 30;
    } else if (analysis.riskLevel === 'medium') {
      score -= 15;
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  // Get comprehensive behavior metrics for reporting
  getBehaviorMetrics() {
    const behaviorData = this.getBehaviorData();
    const analysis = this.analyzeBehaviorPattern(behaviorData);
    const humanScore = this.calculateHumanBehaviorScore(behaviorData);

    return {
      deviceType: this.detectDeviceType(),
      behaviorHistory: behaviorData,
      riskAnalysis: analysis,
      humanBehaviorScore: humanScore,
      deviceFingerprint: this.deviceFingerprint,
      timestamp: Date.now()
    };
  }
}

// Create singleton instance
const behaviorService = new BehaviorService();

export default behaviorService;

// Named exports for individual methods
export const {
  detectDeviceType,
  trackBehavior,
  getBehaviorData,
  clearBehaviorData
} = behaviorService;