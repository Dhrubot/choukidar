// === backend/src/websocket/socketHandler.js ===
// WebSocket Integration Foundation for SafeStreets Bangladesh
// Provides real-time security monitoring and threat notifications

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');

class SocketHandler {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://safestreets-bangladesh.com'] 
          : ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.connectedClients = new Map(); // Track connected clients
    this.adminClients = new Set();     // Track admin clients
    this.securityChannels = new Map(); // Security monitoring channels
    
    this.setupSocketEvents();
    this.startSecurityMonitoring();
    
    console.log('🔌 WebSocket server initialized');
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`📱 Client connected: ${socket.id}`);
      
      // Handle client authentication
      socket.on('authenticate', async (data) => {
        try {
          await this.authenticateClient(socket, data);
        } catch (error) {
          console.error('❌ Authentication error:', error);
          socket.emit('auth_error', { message: 'Authentication failed' });
        }
      });

      // Handle admin authentication
      socket.on('admin_authenticate', async (data) => {
        try {
          await this.authenticateAdmin(socket, data);
        } catch (error) {
          console.error('❌ Admin authentication error:', error);
          socket.emit('admin_auth_error', { message: 'Admin authentication failed' });
        }
      });

      // Handle security monitoring subscription
      socket.on('subscribe_security', (data) => {
        if (socket.isAdmin) {
          this.subscribeToSecurityEvents(socket, data);
        } else {
          socket.emit('error', { message: 'Unauthorized' });
        }
      });

      // Handle real-time report updates
      socket.on('subscribe_reports', (data) => {
        if (socket.isAdmin) {
          this.subscribeToReportUpdates(socket, data);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  async authenticateClient(socket, data) {
    const { deviceFingerprint, userType } = data;
    
    if (!deviceFingerprint) {
      throw new Error('Device fingerprint required');
    }

    // Find or create device fingerprint
    let device = await DeviceFingerprint.findOne({ 
      fingerprintId: deviceFingerprint 
    });

    if (!device) {
      // Create new device entry
      device = new DeviceFingerprint({
        fingerprintId: deviceFingerprint,
        deviceSignature: {
          userAgentHash: 'websocket_client',
          deviceType: 'unknown'
        }
      });
      await device.save();
    }

    // Update last seen
    device.lastSeen = new Date();
    device.activityProfile.totalWebSocketConnections = 
      (device.activityProfile.totalWebSocketConnections || 0) + 1;
    await device.save();

    // Store client info
    socket.deviceFingerprint = deviceFingerprint;
    socket.userType = userType || 'anonymous';
    socket.isAuthenticated = true;
    socket.isAdmin = false;

    this.connectedClients.set(socket.id, {
      deviceFingerprint,
      userType,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    socket.emit('authenticated', {
      success: true,
      userType: socket.userType,
      deviceFingerprint: socket.deviceFingerprint
    });

    console.log(`✅ Client authenticated: ${socket.id} (${userType})`);
  }

  async authenticateAdmin(socket, data) {
    const { token, deviceFingerprint } = data;
    
    if (!token) {
      throw new Error('Admin token required');
    }

    // In a production environment, verify JWT token here
    // For now, simple validation
    const adminUser = await User.findOne({
      userType: 'admin',
      'roleData.admin.accountLocked': { $ne: true }
    });

    if (!adminUser) {
      throw new Error('Invalid admin credentials');
    }

    // Store admin client info
    socket.deviceFingerprint = deviceFingerprint;
    socket.userType = 'admin';
    socket.adminUser = adminUser;
    socket.isAuthenticated = true;
    socket.isAdmin = true;

    this.adminClients.add(socket.id);
    this.connectedClients.set(socket.id, {
      deviceFingerprint,
      userType: 'admin',
      adminUser: adminUser._id,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    socket.emit('admin_authenticated', {
      success: true,
      user: {
        username: adminUser.roleData.admin.username,
        permissions: adminUser.roleData.admin.permissions
      }
    });

    console.log(`🔑 Admin authenticated: ${socket.id} (${adminUser.roleData.admin.username})`);
  }

  subscribeToSecurityEvents(socket, options = {}) {
    const { 
      threatLevel = 'all',
      deviceEvents = true,
      reportEvents = true,
      systemEvents = true 
    } = options;

    const channelKey = `security_${socket.id}`;
    this.securityChannels.set(channelKey, {
      socket,
      options,
      subscribedAt: new Date()
    });

    socket.join('security_monitoring');
    
    socket.emit('security_subscription_confirmed', {
      success: true,
      channelKey,
      options
    });

    console.log(`🔐 Admin subscribed to security events: ${socket.id}`);
  }

  subscribeToReportUpdates(socket, options = {}) {
    const { 
      status = 'all',
      priority = 'all',
      femaleSafety = false 
    } = options;

    socket.join('report_updates');
    
    if (femaleSafety) {
      socket.join('female_safety_reports');
    }

    socket.emit('report_subscription_confirmed', {
      success: true,
      options
    });

    console.log(`📊 Admin subscribed to report updates: ${socket.id}`);
  }

  handleDisconnection(socket) {
    console.log(`📱 Client disconnected: ${socket.id}`);
    
    // Clean up client tracking
    this.connectedClients.delete(socket.id);
    this.adminClients.delete(socket.id);
    
    // Clean up security channels
    const channelKey = `security_${socket.id}`;
    this.securityChannels.delete(channelKey);
  }

  // Real-time security event broadcasting
  broadcastSecurityEvent(eventData) {
    const {
      type,
      severity,
      deviceFingerprint,
      details,
      timestamp = new Date()
    } = eventData;

    const securityEvent = {
      id: `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      deviceFingerprint,
      details,
      timestamp,
      source: 'security_monitoring'
    };

    // Broadcast to all admin clients
    this.io.to('security_monitoring').emit('security_event', securityEvent);

    console.log(`🚨 Security event broadcasted: ${type} (${severity})`);
  }

  // Real-time report update broadcasting
  broadcastReportUpdate(reportData) {
    const {
      reportId,
      status,
      type,
      moderatedBy,
      timestamp = new Date(),
      isFemaleSafety = false
    } = reportData;

    const updateEvent = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reportId,
      status,
      type,
      moderatedBy,
      timestamp,
      isFemaleSafety,
      source: 'moderation_system'
    };

    // Broadcast to all admin clients
    this.io.to('report_updates').emit('report_update', updateEvent);

    // Special broadcast for female safety reports
    if (isFemaleSafety) {
      this.io.to('female_safety_reports').emit('female_safety_update', updateEvent);
    }

    console.log(`📋 Report update broadcasted: ${reportId} -> ${status}`);
  }

  // System health and stats broadcasting
  broadcastSystemStats(statsData) {
    const systemStats = {
      timestamp: new Date(),
      connectedClients: this.connectedClients.size,
      adminClients: this.adminClients.size,
      securityChannels: this.securityChannels.size,
      ...statsData
    };

    // Broadcast to all admin clients
    this.adminClients.forEach(adminSocketId => {
      const socket = this.io.sockets.sockets.get(adminSocketId);
      if (socket) {
        socket.emit('system_stats', systemStats);
      }
    });
  }

  // Threat detection and broadcasting
  async detectAndBroadcastThreats() {
    try {
      // Check for coordinated attacks
      const coordinatedAttacks = await this.detectCoordinatedAttacks();
      if (coordinatedAttacks.length > 0) {
        coordinatedAttacks.forEach(attack => {
          this.broadcastSecurityEvent({
            type: 'coordinated_attack',
            severity: attack.severity,
            details: attack,
            deviceFingerprint: null
          });
        });
      }

      // Check for suspicious device patterns
      const suspiciousDevices = await this.detectSuspiciousDevices();
      if (suspiciousDevices.length > 0) {
        suspiciousDevices.forEach(device => {
          this.broadcastSecurityEvent({
            type: 'suspicious_device',
            severity: device.riskLevel,
            deviceFingerprint: device.fingerprintId,
            details: {
              trustScore: device.securityProfile.trustScore,
              violations: device.securityProfile.securityViolations
            }
          });
        });
      }

      // Check for cross-border threats
      const crossBorderThreats = await this.detectCrossBorderThreats();
      if (crossBorderThreats.length > 0) {
        crossBorderThreats.forEach(threat => {
          this.broadcastSecurityEvent({
            type: 'cross_border_threat',
            severity: 'high',
            details: threat,
            deviceFingerprint: threat.deviceFingerprint
          });
        });
      }

    } catch (error) {
      console.error('❌ Error in threat detection:', error);
    }
  }

  async detectCoordinatedAttacks() {
    // Detect coordinated attacks based on timing and patterns
    const Report = require('../models/Report');
    
    const recentReports = await Report.find({
      timestamp: { $gte: new Date(Date.now() - 3600000) }, // Last hour
      status: { $in: ['pending', 'approved'] }
    });

    const attacks = [];
    
    // Group by similar timestamps (within 10 minutes)
    const timeGroups = {};
    recentReports.forEach(report => {
      const timeKey = Math.floor(report.timestamp.getTime() / (10 * 60 * 1000));
      if (!timeGroups[timeKey]) timeGroups[timeKey] = [];
      timeGroups[timeKey].push(report);
    });

    // Check for suspicious patterns
    Object.values(timeGroups).forEach(group => {
      if (group.length >= 5) { // 5+ reports in 10 minutes
        attacks.push({
          type: 'rapid_reporting',
          severity: 'high',
          reportCount: group.length,
          timeWindow: '10_minutes',
          pattern: 'high_frequency'
        });
      }
    });

    return attacks;
  }

  async detectSuspiciousDevices() {
    // Detect devices with suspicious behavior
    const DeviceFingerprint = require('../models/DeviceFingerprint');
    
    return await DeviceFingerprint.find({
      'securityProfile.riskLevel': { $in: ['high', 'critical'] },
      'securityProfile.quarantineStatus': false,
      lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Active in last 24h
    }).limit(10);
  }

  async detectCrossBorderThreats() {
    // Detect cross-border threats
    const Report = require('../models/Report');
    
    const crossBorderReports = await Report.find({
      'securityFlags.crossBorderReport': true,
      timestamp: { $gte: new Date(Date.now() - 3600000) }, // Last hour
      status: 'pending'
    });

    return crossBorderReports.map(report => ({
      reportId: report._id,
      location: report.location,
      deviceFingerprint: report.submittedBy?.deviceFingerprint,
      timestamp: report.timestamp
    }));
  }

  // Start periodic security monitoring
  startSecurityMonitoring() {
    // Check for threats every 2 minutes
    setInterval(() => {
      this.detectAndBroadcastThreats();
    }, 2 * 60 * 1000);

    // Broadcast system stats every 30 seconds to admins
    setInterval(() => {
      if (this.adminClients.size > 0) {
        this.broadcastSystemStats({
          serverUptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date()
        });
      }
    }, 30 * 1000);

    console.log('🔄 Security monitoring started');
  }

  // Public methods for external use
  notifySecurityEvent(eventData) {
    this.broadcastSecurityEvent(eventData);
  }

  notifyReportUpdate(reportData) {
    this.broadcastReportUpdate(reportData);
  }

  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      adminConnections: this.adminClients.size,
      securitySubscriptions: this.securityChannels.size,
      uptime: process.uptime()
    };
  }

  // Emergency broadcast for critical security events
  emergencyBroadcast(data) {
    const emergencyEvent = {
      id: `emergency_${Date.now()}`,
      type: 'emergency',
      severity: 'critical',
      ...data,
      timestamp: new Date()
    };

    // Broadcast to all connected clients
    this.io.emit('emergency_alert', emergencyEvent);
    
    console.log('🚨 EMERGENCY BROADCAST:', data.message);
  }
}

module.exports = SocketHandler;

// === frontend/src/services/websocketService.js ===
// Frontend WebSocket client for real-time features

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventListeners = new Map();
  }

  connect(serverUrl = 'ws://localhost:5000') {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // Note: In production, import socket.io-client properly
      // For now, assuming it's available globally or imported
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true
      });

      this.setupEventHandlers();
      console.log('🔌 Connecting to WebSocket server...');
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('📱 WebSocket disconnected');
      this.isConnected = false;
      this.isAuthenticated = false;
      this.emit('disconnected');
      this.attemptReconnect();
    });

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

    // Security events
    this.socket.on('security_event', (event) => {
      console.log('🚨 Security event received:', event);
      this.emit('security_event', event);
    });

    // Report updates
    this.socket.on('report_update', (update) => {
      console.log('📋 Report update received:', update);
      this.emit('report_update', update);
    });

    // Female safety updates
    this.socket.on('female_safety_update', (update) => {
      console.log('🌸 Female safety update received:', update);
      this.emit('female_safety_update', update);
    });

    // System stats
    this.socket.on('system_stats', (stats) => {
      this.emit('system_stats', stats);
    });

    // Emergency alerts
    this.socket.on('emergency_alert', (alert) => {
      console.log('🚨 EMERGENCY ALERT:', alert);
      this.emit('emergency_alert', alert);
    });

    // Connection health
    this.socket.on('pong', (data) => {
      this.emit('pong', data);
    });
  }

  authenticate(deviceFingerprint, userType = 'anonymous') {
    if (!this.isConnected) {
      console.error('Cannot authenticate: WebSocket not connected');
      return;
    }

    this.socket.emit('authenticate', {
      deviceFingerprint,
      userType
    });
  }

  authenticateAdmin(token, deviceFingerprint) {
    if (!this.isConnected) {
      console.error('Cannot authenticate admin: WebSocket not connected');
      return;
    }

    this.socket.emit('admin_authenticate', {
      token,
      deviceFingerprint
    });
  }

  subscribeToSecurityEvents(options = {}) {
    if (!this.isAuthenticated) {
      console.error('Cannot subscribe: Not authenticated');
      return;
    }

    this.socket.emit('subscribe_security', options);
  }

  subscribeToReportUpdates(options = {}) {
    if (!this.isAuthenticated) {
      console.error('Cannot subscribe: Not authenticated');
      return;
    }

    this.socket.emit('subscribe_reports', options);
  }

  // Event listener management
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.log('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached');
    }
  }

  ping() {
    if (this.isConnected) {
      this.socket.emit('ping');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isAuthenticated = false;
    }
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;