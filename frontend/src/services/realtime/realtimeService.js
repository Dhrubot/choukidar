// === frontend/src/services/realtime/realtimeService.js ===
// Real-time Service for SafeStreets Bangladesh
// EXTRACTED from original api.js real-time methods
// Contains: Real-time alerts, WebSocket connections, live updates

// Import the core API client
import apiClient from '../core/apiClient.js';

/**
 * Real-time Service Class
 * EXTRACTED from original ApiService real-time methods
 * Preserves ALL original functionality including:
 * - Real-time alerts for specific locations
 * - WebSocket connection management
 * - Live update subscriptions
 */
class RealtimeService {
  constructor() {
    // Use the core API client for all requests
    this.apiClient = apiClient;
  }

  // ========== REAL-TIME METHODS (PRESERVED EXACTLY) ==========

  // Get real-time alerts for location (PRESERVED EXACTLY - Original)
  async getRealTimeAlerts(location, radius = 1000) {
    return this.apiClient.request('/alerts/location', {
      method: 'POST',
      body: JSON.stringify({ location, radius })
    });
  }

  // Subscribe to real-time updates (PRESERVED EXACTLY - Original placeholder)
  subscribeToUpdates(callback) {
    // TODO: Implement WebSocket or SSE for real-time updates
    console.log('Real-time updates not yet implemented');
    return () => {}; // Return unsubscribe function
  }

  // Get WebSocket URL (PRESERVED EXACTLY - Original)
  getWebSocketUrl() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = this.apiClient.baseURL.replace(/^https?:/, '').replace('/api', '');
    return `${wsProtocol}${wsHost}/ws?deviceFingerprint=${this.apiClient.deviceFingerprint}`;
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
const realtimeService = new RealtimeService();

export default realtimeService;

// Export class for testing
export { RealtimeService };

// Export individual methods for convenience
export const {
  getRealTimeAlerts,
  subscribeToUpdates,
  getWebSocketUrl,
  setDeviceFingerprint,
  getDeviceFingerprint
} = realtimeService;