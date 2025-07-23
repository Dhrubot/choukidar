// === frontend/src/services/websocketService.js ===
// Frontend WebSocket client for real-time features
// Integrates with SafeStreets Bangladesh backend for live updates

import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventListeners = new Map();
    this.connectionPromise = null;
    
    // Auto-detect server URL based on environment
    this.serverUrl = import.meta.env.DEV 
      ? 'http://localhost:5000'
      : window.location.origin;
  }

  /**
   * Connect to WebSocket server
   * @param {string} customUrl - Optional custom server URL
   * @returns {Promise} Connection promise
   */
  connect(customUrl = null) {
    if (this.socket && this.isConnected) {
      console.log('🔌 WebSocket already connected');
      return Promise.resolve();
    }

    // Use custom URL if provided, otherwise use auto-detected URL
    const url = customUrl || this.serverUrl;

    try {
      console.log(`🔌 Connecting to WebSocket server: ${url}`);
      
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000
      });

      this.setupEventHandlers();
      
      // Return a promise that resolves when connected
      this.connectionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return this.connectionPromise;
      
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Setup WebSocket event handlers
   * @private
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('📱 WebSocket disconnected:', reason);
      this.isConnected = false;
      this.isAuthenticated = false;
      this.emit('disconnected', { reason });
      
      // Only attempt manual reconnect for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // Server disconnected us or we disconnected manually - don't auto-reconnect
        console.log('🔌 Manual disconnect - not attempting to reconnect');
      } else {
        // Network issues or other problems - attempt reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.isConnected = false;
      this.emit('connection_error', { error });
    });

    // Authentication events
    this.socket.on('authenticated', (data) => {
      console.log('✅ WebSocket authenticated:', data);
      this.isAuthenticated = true;
      this.emit('authenticated', data);
    });

    this.socket.on('admin_authenticated', (data) => {
      console.log('🔑 Admin WebSocket authenticated:', data);
      this.isAuthenticated = true;
      this.emit('admin_authenticated', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('❌ WebSocket authentication error:', error);
      this.emit('auth_error', error);
    });

    this.socket.on('admin_auth_error', (error) => {
      console.error('❌ Admin WebSocket authentication error:', error);
      this.emit('admin_auth_error', error);
    });

    // Subscription confirmations
    this.socket.on('security_subscription_confirmed', (data) => {
      console.log('🔐 Security subscription confirmed:', data);
      this.emit('security_subscription_confirmed', data);
    });

    this.socket.on('report_subscription_confirmed', (data) => {
      console.log('📊 Report subscription confirmed:', data);
      this.emit('report_subscription_confirmed', data);
    });

    // Real-time data events
    this.socket.on('security_event', (event) => {
      console.log('🚨 Security event received:', event);
      this.emit('security_event', event);
    });

    this.socket.on('report_update', (update) => {
      console.log('📋 Report update received:', update);
      this.emit('report_update', update);
    });

    this.socket.on('female_safety_update', (update) => {
      console.log('🌸 Female safety update received:', update);
      this.emit('female_safety_update', update);
    });

    this.socket.on('system_stats', (stats) => {
      this.emit('system_stats', stats);
    });

    this.socket.on('emergency_alert', (alert) => {
      console.log('🚨 EMERGENCY ALERT:', alert);
      this.emit('emergency_alert', alert);
    });

    // Connection health
    this.socket.on('pong', (data) => {
      this.emit('pong', data);
    });

    // Generic error handling
    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Authenticate regular client
   * @param {string} deviceFingerprint - Device fingerprint ID
   * @param {string} userType - User type (anonymous, user, etc.)
   */
  authenticate(deviceFingerprint, userType = 'anonymous') {
    if (!this.isConnected) {
      console.error('❌ Cannot authenticate: WebSocket not connected');
      return false;
    }

    if (!deviceFingerprint) {
      console.error('❌ Cannot authenticate: Device fingerprint required');
      return false;
    }

    console.log(`🔐 Authenticating WebSocket client: ${userType}`);
    this.socket.emit('authenticate', {
      deviceFingerprint,
      userType
    });
    
    return true;
  }

  /**
   * Authenticate admin client
   * @param {string} token - Admin authentication token
   * @param {string} deviceFingerprint - Device fingerprint ID
   */
  authenticateAdmin(token, deviceFingerprint) {
    if (!this.isConnected) {
      console.error('❌ Cannot authenticate admin: WebSocket not connected');
      return false;
    }

    if (!token || !deviceFingerprint) {
      console.error('❌ Cannot authenticate admin: Token and device fingerprint required');
      return false;
    }

    console.log('🔑 Authenticating admin WebSocket client');
    this.socket.emit('admin_authenticate', {
      token,
      deviceFingerprint
    });
    
    return true;
  }

  /**
   * Subscribe to security events (admin only)
   * @param {Object} options - Subscription options
   */
  subscribeToSecurityEvents(options = {}) {
    if (!this.isAuthenticated) {
      console.error('❌ Cannot subscribe to security events: Not authenticated');
      return false;
    }

    console.log('🔐 Subscribing to security events:', options);
    this.socket.emit('subscribe_security', options);
    return true;
  }

  /**
   * Subscribe to report updates (admin only)
   * @param {Object} options - Subscription options
   */
  subscribeToReportUpdates(options = {}) {
    if (!this.isAuthenticated) {
      console.error('❌ Cannot subscribe to report updates: Not authenticated');
      return false;
    }

    console.log('📊 Subscribing to report updates:', options);
    this.socket.emit('subscribe_reports', options);
    return true;
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to local listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   * @private
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('❌ Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect to WebSocket server
   * @private
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected && this.socket) {
          console.log('🔄 Attempting manual reconnection...');
          this.socket.connect();
        }
      }, delay);
    } else {
      console.log('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached');
    }
  }

  /**
   * Send ping to check connection health
   */
  ping() {
    if (this.isConnected && this.socket) {
      this.socket.emit('ping');
      return true;
    }
    return false;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isAuthenticated = false;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Get current connection status
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      serverUrl: this.serverUrl,
      socketId: this.socket?.id || null
    };
  }

  /**
   * Test connection with timeout
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves if connection is healthy
   */
  async testConnection(timeout = 5000) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection test timeout'));
      }, timeout);

      // Send ping and wait for pong
      const onPong = () => {
        clearTimeout(timer);
        this.off('pong', onPong);
        resolve(true);
      };

      this.on('pong', onPong);
      this.ping();
    });
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      eventListenerCount: Array.from(this.eventListeners.values())
        .reduce((total, listeners) => total + listeners.length, 0),
      activeEvents: Array.from(this.eventListeners.keys()),
      uptime: this.socket?.connected ? 'connected' : 'disconnected'
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;