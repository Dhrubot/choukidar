// === backend/src/websocket/scaledSocketHandler.js ===
// Horizontally Scalable WebSocket Handler for SafeStreets Bangladesh
// Solves the single-server WebSocket scaling limitations

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const { cacheLayer } = require('../middleware/cacheLayer');

/**
 * Horizontally Scalable WebSocket Handler
 * Features: Redis adapter, distributed sessions, load balancing, fault tolerance
 */
class ScaledSocketHandler {
  constructor(server) {
    this.server = server;
    this.io = null;
    this.redisAdapter = null;
    this.isInitialized = false;
    
    // Connection tracking with Redis backing
    this.localConnections = new Map(); // Local server connections
    this.adminChannels = new Set(['security_monitoring', 'report_updates', 'system_stats']);
    
    // Performance metrics
    this.metrics = {
      totalConnections: 0,
      adminConnections: 0,
      messagesProcessed: 0,
      broadcastsSent: 0,
      reconnections: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    // Event queues for reliability
    this.eventQueues = new Map();
    this.failedEvents = [];
    
    this.initialize();
  }

  /**
   * Initialize scaled WebSocket server
   */
  async initialize() {
    try {
      console.log('🚀 Initializing scaled WebSocket server...');

      // Initialize Socket.IO with Redis adapter for scaling
      await this.setupSocketIO();
      
      // Setup Redis adapter for horizontal scaling
      await this.setupRedisAdapter();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      this.isInitialized = true;
      console.log('✅ Scaled WebSocket server initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize scaled WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Setup Socket.IO with enhanced configuration
   */
  async setupSocketIO() {
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://safestreets-bangladesh.com'] 
          : ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      
      // Connection settings
      transports: ['websocket', 'polling'],
      pingTimeout: 30000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6, // 1MB
      
      // Scaling settings
      allowEIO3: true,
      serveClient: false,
      
      // Performance optimizations
      perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: {
          level: 3,
          chunkSize: 1024
        }
      }
    });

    console.log('🔌 Socket.IO server configured');
  }

  /**
   * Setup Redis adapter for horizontal scaling
   */
  async setupRedisAdapter() {
    try {
      // Import Redis adapter
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');

      // Create Redis clients for pub/sub
      const pubClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.attempt > 5) return new Error('Max Redis retry attempts reached');
          return Math.min(options.attempt * 100, 3000);
        }
      });

      const subClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.attempt > 5) return new Error('Max Redis retry attempts reached');
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Connect Redis clients
      await Promise.all([pubClient.connect(), subClient.connect()]);

      // Handle Redis client events (not adapter events)
      pubClient.on('error', (error) => {
        console.error('❌ Redis pub client error:', error);
        this.metrics.errors++;
      });

      subClient.on('error', (error) => {
        console.error('❌ Redis sub client error:', error);
        this.metrics.errors++;
      });

      // Create and attach Redis adapter
      this.redisAdapter = createAdapter(pubClient, subClient, {
        key: 'safestreets:socketio',
        requestsTimeout: 5000
      });

      this.io.adapter(this.redisAdapter);

      console.log('✅ Redis adapter configured for horizontal scaling');

    } catch (error) {
      console.warn('⚠️ Redis adapter setup failed, falling back to memory adapter:', error);
      // Continue without Redis adapter - single server mode
    }
  }

  /**
   * Setup comprehensive event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => this.handleConnection(socket));
    
    // Global error handling
    this.io.engine.on('connection_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      this.metrics.errors++;
    });

    console.log('🎯 Event handlers configured');
  }

  /**
   * Handle new socket connection
   */
  async handleConnection(socket) {
    const connectionId = socket.id;
    const clientInfo = {
      id: connectionId,
      connectedAt: new Date(),
      userType: 'anonymous',
      authenticated: false,
      lastActivity: new Date(),
      deviceFingerprint: null,
      userId: null,
      rooms: []
    };

    try {
      // Store connection locally and in Redis
      this.localConnections.set(connectionId, clientInfo);
      await this.storeConnectionInRedis(connectionId, clientInfo);
      
      this.metrics.totalConnections++;
      
      console.log(`📱 Client connected: ${connectionId} (Total: ${this.localConnections.size})`);

      // Setup socket event handlers
      this.setupSocketHandlers(socket, clientInfo);

      // Send welcome message
      socket.emit('connection_established', {
        success: true,
        serverId: process.env.SERVER_ID || 'default',
        connectionId,
        timestamp: new Date(),
        features: ['real_time_updates', 'security_monitoring', 'admin_notifications']
      });

    } catch (error) {
      console.error(`❌ Error handling connection ${connectionId}:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Setup individual socket event handlers
   */
  setupSocketHandlers(socket, clientInfo) {
    const connectionId = socket.id;

    // Authentication
    socket.on('authenticate', async (data) => {
      try {
        await this.handleAuthentication(socket, clientInfo, data);
      } catch (error) {
        console.error(`❌ Authentication error for ${connectionId}:`, error);
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    // Admin authentication
    socket.on('admin_authenticate', async (data) => {
      try {
        await this.handleAdminAuthentication(socket, clientInfo, data);
      } catch (error) {
        console.error(`❌ Admin authentication error for ${connectionId}:`, error);
        socket.emit('admin_auth_error', { message: 'Admin authentication failed' });
      }
    });

    // Channel subscriptions
    socket.on('subscribe', async (data) => {
      await this.handleSubscription(socket, clientInfo, data);
    });

    socket.on('unsubscribe', async (data) => {
      await this.handleUnsubscription(socket, clientInfo, data);
    });

    // Heartbeat for connection health
    socket.on('ping', () => {
      clientInfo.lastActivity = new Date();
      socket.emit('pong', { timestamp: new Date() });
    });

    // Activity tracking
    socket.on('activity', async (data) => {
      await this.updateActivity(connectionId, data);
    });

    // Disconnection
    socket.on('disconnect', async (reason) => {
      await this.handleDisconnection(connectionId, reason);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${connectionId}:`, error);
      this.metrics.errors++;
    });
  }

  /**
   * Handle user authentication
   */
  async handleAuthentication(socket, clientInfo, data) {
    const { token, deviceFingerprint } = data;

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Update client info
      clientInfo.authenticated = true;
      clientInfo.userId = user._id;
      clientInfo.userType = user.userType;
      clientInfo.deviceFingerprint = deviceFingerprint;

      // Store in Redis for cross-server access
      await this.updateConnectionInRedis(socket.id, clientInfo);

      socket.emit('authenticated', {
        success: true,
        userType: user.userType,
        permissions: user.roleData?.admin?.permissions || []
      });

      console.log(`🔑 User authenticated: ${socket.id} (${user.userType})`);

    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Handle admin authentication
   */
  async handleAdminAuthentication(socket, clientInfo, data) {
    const { sessionToken, deviceFingerprint } = data;

    try {
      // Verify admin session
      const session = await cacheLayer.get(`admin_session:${sessionToken}`);
      if (!session) {
        throw new Error('Invalid admin session');
      }

      const adminUser = await User.findById(session.userId);
      if (!adminUser || adminUser.userType !== 'admin') {
        throw new Error('Invalid admin user');
      }

      // Update client info
      clientInfo.authenticated = true;
      clientInfo.userId = adminUser._id;
      clientInfo.userType = 'admin';
      clientInfo.deviceFingerprint = deviceFingerprint;
      clientInfo.adminLevel = adminUser.roleData.admin.adminLevel;
      clientInfo.permissions = adminUser.roleData.admin.permissions;

      // Join admin rooms
      socket.join('admin_global');
      this.adminChannels.forEach(channel => {
        socket.join(channel);
        clientInfo.rooms.push(channel);
      });

      // Store in Redis
      await this.updateConnectionInRedis(socket.id, clientInfo);

      this.metrics.adminConnections++;

      socket.emit('admin_authenticated', {
        success: true,
        user: {
          username: adminUser.roleData.admin.username,
          permissions: adminUser.roleData.admin.permissions,
          adminLevel: adminUser.roleData.admin.adminLevel
        },
        availableChannels: this.adminChannels
      });

      console.log(`🔑 Admin authenticated: ${socket.id} (${adminUser.roleData.admin.username})`);

    } catch (error) {
      throw new Error(`Admin authentication failed: ${error.message}`);
    }
  }

  /**
   * Handle channel subscriptions
   */
  async handleSubscription(socket, clientInfo, data) {
    const { channels, options = {} } = data;

    if (!clientInfo.authenticated) {
      socket.emit('subscription_error', { message: 'Authentication required' });
      return;
    }

    try {
      const allowedChannels = this.getAllowedChannels(clientInfo);
      const validChannels = channels.filter(channel => allowedChannels.includes(channel));

      for (const channel of validChannels) {
        socket.join(channel);
        clientInfo.rooms.push(channel);

        // Store subscription preferences in Redis
        await this.storeSubscription(socket.id, channel, options);
      }

      await this.updateConnectionInRedis(socket.id, clientInfo);

      socket.emit('subscription_confirmed', {
        success: true,
        subscribedChannels: validChannels,
        rejectedChannels: channels.filter(c => !validChannels.includes(c))
      });

      console.log(`📺 Subscriptions updated for ${socket.id}: ${validChannels.join(', ')}`);

    } catch (error) {
      console.error(`❌ Subscription error for ${socket.id}:`, error);
      socket.emit('subscription_error', { message: error.message });
    }
  }

  /**
   * Handle channel unsubscriptions
   */
  async handleUnsubscription(socket, clientInfo, data) {
    const { channels } = data;

    try {
      for (const channel of channels) {
        socket.leave(channel);
        clientInfo.rooms = clientInfo.rooms.filter(room => room !== channel);
        
        // Remove from Redis
        await this.removeSubscription(socket.id, channel);
      }

      await this.updateConnectionInRedis(socket.id, clientInfo);

      socket.emit('unsubscription_confirmed', {
        success: true,
        unsubscribedChannels: channels
      });

    } catch (error) {
      console.error(`❌ Unsubscription error for ${socket.id}:`, error);
    }
  }

  /**
   * Handle disconnection
   */
  async handleDisconnection(connectionId, reason) {
    try {
      const clientInfo = this.localConnections.get(connectionId);
      
      if (clientInfo) {
        // Update metrics
        this.metrics.totalConnections--;
        if (clientInfo.userType === 'admin') {
          this.metrics.adminConnections--;
        }

        // Clean up local storage
        this.localConnections.delete(connectionId);

        // Clean up Redis storage
        await this.removeConnectionFromRedis(connectionId);

        console.log(`📱 Client disconnected: ${connectionId} (Reason: ${reason})`);
      }

    } catch (error) {
      console.error(`❌ Error handling disconnection for ${connectionId}:`, error);
    }
  }

  /**
   * Broadcasting methods with reliability
   */
  async broadcastSecurityEvent(eventData) {
    try {
      const event = {
        id: `security_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'security_event',
        ...eventData,
        timestamp: new Date(),
        serverId: process.env.SERVER_ID || 'default'
      };

      // Cache event for reliability
      await cacheLayer.cacheRealtimeEvent('security', event, 3600);

      // Broadcast to all security monitoring subscribers
      this.io.to('security_monitoring').emit('security_event', event);

      // Also broadcast to admin global if critical
      if (event.severity === 'critical') {
        this.io.to('admin_global').emit('critical_security_alert', event);
      }

      this.metrics.broadcastsSent++;
      console.log(`🚨 Security event broadcasted: ${event.type} (${event.severity})`);

      return event.id;

    } catch (error) {
      console.error('❌ Error broadcasting security event:', error);
      this.failedEvents.push({ type: 'security', data: eventData, error: error.message });
      return null;
    }
  }

  async broadcastReportUpdate(reportData) {
    try {
      const event = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'report_update',
        ...reportData,
        timestamp: new Date(),
        serverId: process.env.SERVER_ID || 'default'
      };

      // Cache event
      await cacheLayer.cacheRealtimeEvent('reports', event, 1800);

      // Broadcast to report update subscribers
      this.io.to('report_updates').emit('report_update', event);

      // Special handling for female safety reports
      if (event.isFemaleSafety) {
        this.io.to('female_safety_reports').emit('female_safety_update', event);
      }

      this.metrics.broadcastsSent++;
      console.log(`📋 Report update broadcasted: ${event.reportId} -> ${event.status}`);

      return event.id;

    } catch (error) {
      console.error('❌ Error broadcasting report update:', error);
      this.failedEvents.push({ type: 'report', data: reportData, error: error.message });
      return null;
    }
  }

  async broadcastSystemStats(statsData) {
    try {
      const stats = {
        timestamp: new Date(),
        serverId: process.env.SERVER_ID || 'default',
        localConnections: this.localConnections.size,
        totalConnections: await this.getTotalConnections(),
        adminConnections: this.metrics.adminConnections,
        metrics: this.metrics,
        uptime: Date.now() - this.metrics.startTime,
        ...statsData
      };

      // Broadcast to admin users only
      this.io.to('admin_global').emit('system_stats', stats);

      this.metrics.broadcastsSent++;

    } catch (error) {
      console.error('❌ Error broadcasting system stats:', error);
    }
  }

  /**
   * Emergency broadcast for critical alerts
   */
  async emergencyBroadcast(data) {
    try {
      const emergencyEvent = {
        id: `emergency_${Date.now()}`,
        type: 'emergency',
        severity: 'critical',
        ...data,
        timestamp: new Date(),
        serverId: process.env.SERVER_ID || 'default'
      };

      // Cache for reliability
      await cacheLayer.cacheRealtimeEvent('emergency', emergencyEvent, 7200);

      // Broadcast to ALL connected clients
      this.io.emit('emergency_alert', emergencyEvent);

      // Also send to all admin channels
      this.adminChannels.forEach(channel => {
        this.io.to(channel).emit('emergency_admin_alert', emergencyEvent);
      });

      this.metrics.broadcastsSent++;
      console.log('🚨 EMERGENCY BROADCAST:', data.message);

      return emergencyEvent.id;

    } catch (error) {
      console.error('❌ Emergency broadcast failed:', error);
      return null;
    }
  }

  /**
   * Emit event specifically to admin users
   * This method is expected by the reports route for admin notifications
   */
  async emitToAdmins(eventType, eventData) {
    try {
      if (!this.isInitialized) {
        console.warn('⚠️ WebSocket not initialized, queuing admin event');
        this.queueEvent('admin_notification', { eventType, eventData });
        return;
      }

      // Emit to admin room
      this.io.to('admin_global').emit(eventType, {
        ...eventData,
        timestamp: new Date().toISOString(),
        serverInstance: process.env.SERVER_INSTANCE || 'primary'
      });

      // Also use the existing broadcastReportUpdate for report-related events
      if (eventType === 'new_pending_report') {
        await this.broadcastReportUpdate({
          reportId: eventData.reportId,
          type: eventData.type,
          severity: eventData.severity,
          location: eventData.location,
          status: 'pending',
          timestamp: eventData.timestamp
        });
      }

      this.metrics.broadcastsSent++;
      console.log(`👨‍💼 Admin notification sent: ${eventType}`);

    } catch (error) {
      console.error('❌ Error emitting to admins:', error);
      this.metrics.errors++;
      
      // Queue for retry
      this.queueEvent('admin_notification', { eventType, eventData });
    }
  }

  /**
   * Redis connection management
   */
  async storeConnectionInRedis(connectionId, clientInfo) {
    if (!cacheLayer.isConnected) return;

    const key = `websocket:connection:${connectionId}`;
    await cacheLayer.set(key, {
      ...clientInfo,
      serverId: process.env.SERVER_ID || 'default'
    }, 86400); // 24 hours
  }

  async updateConnectionInRedis(connectionId, clientInfo) {
    await this.storeConnectionInRedis(connectionId, clientInfo);
  }

  async removeConnectionFromRedis(connectionId) {
    if (!cacheLayer.isConnected) return;

    const key = `websocket:connection:${connectionId}`;
    await cacheLayer.delete(key);

    // Also clean up subscriptions
    const subKey = `websocket:subscriptions:${connectionId}`;
    await cacheLayer.delete(subKey);
  }

  async storeSubscription(connectionId, channel, options) {
    if (!cacheLayer.isConnected) return;

    const key = `websocket:subscriptions:${connectionId}`;
    const existing = await cacheLayer.get(key) || {};
    existing[channel] = { options, subscribedAt: new Date() };
    await cacheLayer.set(key, existing, 86400);
  }

  async removeSubscription(connectionId, channel) {
    if (!cacheLayer.isConnected) return;

    const key = `websocket:subscriptions:${connectionId}`;
    const existing = await cacheLayer.get(key) || {};
    delete existing[channel];
    await cacheLayer.set(key, existing, 86400);
  }

  /**
   * Utility methods
   */
  getAllowedChannels(clientInfo) {
    const baseChannels = ['general_updates', 'system_notifications'];
    
    if (clientInfo.userType === 'admin') {
      return [...baseChannels, ...this.adminChannels, 'admin_global'];
    }
    
    if (clientInfo.userType === 'police') {
      return [...baseChannels, 'police_updates', 'security_monitoring'];
    }
    
    return baseChannels;
  }

  async getTotalConnections() {
    if (!cacheLayer.isConnected) return this.localConnections.size;

    try {
      // Get all connection keys from Redis
      const keys = await cacheLayer.client.keys('websocket:connection:*');
      return keys.length;
    } catch (error) {
      console.error('❌ Error getting total connections:', error);
      return this.localConnections.size;
    }
  }

  async updateActivity(connectionId, activityData) {
    const clientInfo = this.localConnections.get(connectionId);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
      await this.updateConnectionInRedis(connectionId, clientInfo);
    }

    // Track activity in cache
    const key = `websocket:activity:${connectionId}`;
    await cacheLayer.set(key, { ...activityData, timestamp: new Date() }, 3600);
  }

  /**
   * Background tasks
   */
  startBackgroundTasks() {
    // Connection cleanup task
    setInterval(async () => {
      await this.cleanupStaleConnections();
    }, 300000); // 5 minutes

    // Metrics reporting
    setInterval(async () => {
      await this.reportMetrics();
    }, 60000); // 1 minute

    // Failed event retry
    setInterval(async () => {
      await this.retryFailedEvents();
    }, 30000); // 30 seconds

    console.log('🔄 Background tasks started');
  }

  async cleanupStaleConnections() {
    try {
      const staleThreshold = Date.now() - (10 * 60 * 1000); // 10 minutes

      for (const [connectionId, clientInfo] of this.localConnections.entries()) {
        if (clientInfo.lastActivity.getTime() < staleThreshold) {
          console.log(`🧹 Cleaning up stale connection: ${connectionId}`);
          await this.handleDisconnection(connectionId, 'stale_connection');
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up stale connections:', error);
    }
  }

  async reportMetrics() {
    try {
      const metrics = {
        ...this.metrics,
        localConnections: this.localConnections.size,
        totalConnections: await this.getTotalConnections(),
        uptime: Date.now() - this.metrics.startTime,
        avgMessagesPerSecond: this.metrics.messagesProcessed / ((Date.now() - this.metrics.startTime) / 1000),
        errorRate: (this.metrics.errors / this.metrics.messagesProcessed * 100).toFixed(2) + '%'
      };

      // Store metrics in cache
      await cacheLayer.set('websocket:metrics', metrics, 300);

      // Report to admins if there are any connected
      if (this.metrics.adminConnections > 0) {
        this.io.to('admin_global').emit('websocket_metrics', metrics);
      }

    } catch (error) {
      console.error('❌ Error reporting metrics:', error);
    }
  }

  async retryFailedEvents() {
    if (this.failedEvents.length === 0) return;

    try {
      const retryEvents = this.failedEvents.splice(0, 10); // Retry up to 10 events

      for (const failedEvent of retryEvents) {
        try {
          if (failedEvent.type === 'security') {
            await this.broadcastSecurityEvent(failedEvent.data);
          } else if (failedEvent.type === 'report') {
            await this.broadcastReportUpdate(failedEvent.data);
          }
        } catch (error) {
          // If retry fails, put it back in the queue (with limit)
          if (failedEvent.retryCount < 3) {
            failedEvent.retryCount = (failedEvent.retryCount || 0) + 1;
            this.failedEvents.push(failedEvent);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error retrying failed events:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const totalConnections = await this.getTotalConnections();
      
      return {
        status: 'healthy',
        initialized: this.isInitialized,
        localConnections: this.localConnections.size,
        totalConnections,
        adminConnections: this.metrics.adminConnections,
        redisAdapter: !!this.redisAdapter,
        metrics: this.metrics,
        uptime: Date.now() - this.metrics.startTime,
        failedEventsCount: this.failedEvents.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        localConnections: this.localConnections.size,
        metrics: this.metrics
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down scaled WebSocket server...');

      // Close all connections gracefully
      this.io.emit('server_shutdown', {
        message: 'Server is shutting down for maintenance',
        timestamp: new Date()
      });

      // Wait for connections to close
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Close the server
      this.io.close();

      // Clean up Redis connections
      if (this.redisAdapter) {
        await this.redisAdapter.close();
      }

      console.log('✅ Scaled WebSocket server shutdown complete');

    } catch (error) {
      console.error('❌ Error during WebSocket shutdown:', error);
    }
  }

  /**
   * Public API methods
   */
  getConnectionStats() {
    return {
      localConnections: this.localConnections.size,
      adminConnections: this.metrics.adminConnections,
      uptime: Date.now() - this.metrics.startTime,
      metrics: this.metrics
    };
  }

  notifySecurityEvent(eventData) {
    return this.broadcastSecurityEvent(eventData);
  }

  notifyReportUpdate(reportData) {
    return this.broadcastReportUpdate(reportData);
  }

  emergencyAlert(data) {
    return this.emergencyBroadcast(data);
  }
}

module.exports = ScaledSocketHandler;


// socketHandler.notifySecurityEvent({
//   type: 'suspicious_activity',
//   severity: 'high',
//   details: { userId: 'user123', action: 'multiple_failed_logins' }
// });

// // Broadcasting report updates
// socketHandler.notifyReportUpdate({
//   reportId: 'report123',
//   status: 'approved',
//   moderatedBy: 'admin456'
// });

// // Emergency alerts
// socketHandler.emergencyAlert({
//   message: 'System maintenance in 5 minutes',
//   type: 'maintenance'
// });