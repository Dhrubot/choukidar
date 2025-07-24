const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ENHANCED: Import security middleware functions as named exports
const { userTypeDetection } = require('./src/middleware/userTypeDetection');
// PERFORMANCE: Use scaled WebSocket handler for horizontal scaling
const ScaledSocketHandler = require('./src/websocket/scaledSocketHandler');

// Basic Middleware (PRESERVED with cookieParser)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://choukidar.com'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // IMPORTANT: Don't miss this

// =================================================================
// === TEMPORARY REQUEST LOGGER MIDDLEWARE =========================
// =================================================================
// app.use((req, res, next) => {
//   if (req.path.startsWith('/api')) {
//     console.log('--- Incoming Request ---');
//     console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
//     console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
//     if (req.body && Object.keys(req.body).length > 0) {
//       console.log('Body:', JSON.stringify(req.body, null, 2));
//     } else {
//       console.log('Body: [Empty]');
//     }
    
//     console.log('------------------------');
//   }
//   next();
// });
const { productionLogger, requestLogger, errorLogger, securityLogger } = require('./src/utils/productionLogger');
const { sanitizationMiddleware, securityHeaders } = require('./src/utils/sanitization');
const { initializeCache } = require('./src/middleware/cacheLayer');

app.use(requestLogger());
app.use(securityLogger());
app.use(errorLogger());

// SECURITY: Add input sanitization and security headers
app.use(securityHeaders());
app.use(sanitizationMiddleware());

// PERFORMANCE: Initialize Redis caching
initializeCache();

// ENHANCED: Security middleware - Apply device fingerprinting and user context to all requests
app.use(userTypeDetection);

// ENHANCED: Security headers for additional protection
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (process.env.NODE_ENV === 'development' && req.userContext) {
    res.setHeader('X-User-Type', req.userContext.userType);
    res.setHeader('X-Trust-Score', req.userContext.securityContext?.trustScore || 0);
    res.setHeader('X-Risk-Level', req.userContext.securityContext?.riskLevel || 'unknown');
  }
  
  next();
});

// input sanitizers

// Database connection
mongoose.connect(process.env.MONGODB_URI);

// Create HTTP server
const server = http.createServer(app);

// Database connection events with enhanced WebSocket initialization
// mongoose.connection.on('connected', () => {
//   console.log('✅ Connected to MongoDB');
//   console.log('🛡️ Security middleware active - Device fingerprinting enabled');
  
//   // Initialize WebSocket server after database connection
//   try {
//     const socketHandler = new SocketHandler(server);
//     app.locals.socketHandler = socketHandler; // Make accessible in routes
//     global.socketHandler = socketHandler;     // Also make globally available
//     console.log('🔌 WebSocket server initialized and ready');
//   } catch (error) {
//     console.error('❌ Failed to initialize WebSocket server:', error);
//   }
// });

// // Check database optimization results
// const optimizer = require('./src/models/optimizedIndexes');
// optimizer.monitorPerformance(60000); // 1 minute monitoring

// // Check cache performance
// const cache = require('./src/middleware/cacheLayer');
// cache.cacheHealthCheck();

// // Check WebSocket stats
// const socketHandler = global.socketHandler;
// socketHandler.healthCheck();

const { optimizeDatabase } = require('./src/models/optimizedIndexes');

mongoose.connection.on('connected', async () => {
  console.log('✅ Connected to MongoDB');
  
  // Optimize database indexes
  await optimizeDatabase();
  
  // Initialize scaled WebSocket handler with Redis backing
  const socketHandler = new ScaledSocketHandler(server);
  app.locals.socketHandler = socketHandler;
  global.socketHandler = socketHandler;
  
  console.log('🚀 SafeStreets Bangladesh server fully initialized');
});

mongoose.connection.on('error', (err) => {
  console.log('❌ MongoDB connection error:', err);
});

// ENHANCED: User context logging middleware (for monitoring)
app.use((req, res, next) => {
  if (req.userContext) {
    if (req.method !== 'GET') {
      console.log(`🔍 ${req.method} ${req.path} - User: ${req.userContext.userType} (Trust: ${req.userContext.securityContext?.trustScore || 0}, Risk: ${req.userContext.securityContext?.riskLevel || 'unknown'})`);
      
      if (req.userContext.securityContext?.quarantined) {
        console.log(`🚨 Quarantined user attempting ${req.method} ${req.path}`);
      }
      
      if (req.userContext.securityContext?.riskLevel === 'high' || req.userContext.securityContext?.riskLevel === 'critical') {
        console.log(`⚠️ High-risk user (${req.userContext.securityContext.riskLevel}) accessing ${req.method} ${req.path}`);
      }
    }
  }
  next();
});

// EXISTING ROUTES (PRESERVED)
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/safezones', require('./src/routes/safeZones'));

// NEW ENHANCED ROUTES: Authentication and User Management
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/user-types', require('./src/routes/userTypes'));

// IMPORTANT: Invites route (don't miss this!)
app.use('/api/invites', require('./src/routes/invites'));

// ENHANCED: Health check with security status and WebSocket status
app.get('/api/health', (req, res) => {
  const userContext = req.userContext || {};
  const socketHandler = app.locals.socketHandler || global.socketHandler;
  
  res.json({ 
    message: 'SafeStreets API is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    websocket: socketHandler ? 'connected' : 'disconnected',
    features: {
      reports: 'active',
      admin: 'active',
      safeZones: 'active',
      authentication: 'active',
      userManagement: 'active',
      deviceFingerprinting: 'active',
      securityMonitoring: 'active',
      realtimeUpdates: socketHandler ? 'active' : 'inactive',
      inviteSystem: 'active', // Don't forget this feature
      routing: 'client-side'
    },
    security: {
      userTypeDetection: 'active',
      deviceFingerprinting: userContext.deviceFingerprint ? 'active' : 'inactive',
      userType: userContext.userType || 'unknown',
      trustScore: userContext.securityContext?.trustScore || 0,
      riskLevel: userContext.securityContext?.riskLevel || 'unknown',
      quarantineStatus: userContext.securityContext?.quarantined || false
    },
    websocketStats: socketHandler ? socketHandler.getConnectionStats() : {
      totalConnections: 0,
      adminConnections: 0,
      securitySubscriptions: 0,
      uptime: 0
    },
    version: '3B-Intelligence-Enhanced'
  });
});

// ENHANCED: API info endpoint with comprehensive features
app.get('/api', (req, res) => {
  const socketHandler = app.locals.socketHandler || global.socketHandler;
  
  res.json({
    message: 'SafeStreets Bangladesh API - Phase 3B Enhanced',
    version: '3.2.0',
    features: [
      'Crime Reports', 
      'Admin Management', 
      'Safe Zones', 
      'Route Intelligence',
      'Advanced Security Framework',
      'User Type Management',
      'Device Fingerprinting',
      'Female Safety Integration',
      'Multi-Role Authentication',
      'Real-time WebSocket Updates',
      'Invite-Only Registration System' // Important feature
    ],
    endpoints: {
      reports: {
        public: '/api/reports',
        admin: '/api/admin/reports'
      },
      safeZones: {
        public: '/api/safezones',
        admin: '/api/safezones/admin'
      },
      authentication: {
        userContext: '/api/auth/user/context',
        adminLogin: '/api/auth/admin/login',
        adminLogout: '/api/auth/admin/logout',
        adminProfile: '/api/auth/admin/profile',
        userPreferences: '/api/auth/user/update-preferences',
        securityInsights: '/api/auth/security/insights'
      },
      userManagement: {
        adminUsers: '/api/user-types/admin/users',
        userDetails: '/api/user-types/admin/user/:id',
        deviceManagement: '/api/user-types/admin/devices',
        securityActions: '/api/user-types/admin/security/:action'
      },
      inviteSystem: {
        sendInvite: '/api/invites/send',
        validateInvite: '/api/invites/validate/:token',
        manageInvites: '/api/invites/admin'
      },
      system: {
        health: '/api/health',
        info: '/api',
        securityStatus: '/api/security/status',
        websocketStatus: '/api/websocket/status'
      }
    },
    websocket: {
      enabled: socketHandler ? true : false,
      url: process.env.NODE_ENV === 'production' 
        ? 'wss://choukidar.com' 
        : 'ws://localhost:5000',
      features: [
        'Real-time security monitoring',
        'Live report updates',
        'Admin notifications',
        'Female safety alerts',
        'System health monitoring'
      ]
    },
    security: {
      features: [
        'Device Fingerprinting',
        'Cross-Border Threat Detection',
        'Coordinated Attack Prevention',
        'Behavioral Analysis',
        'Trust Score System',
        'Quarantine Management'
      ],
      userTypes: ['anonymous', 'admin', 'police', 'researcher'],
      authentication: 'Role-based with device tracking'
    },
    femaleSafety: {
      incidentTypes: [
        'eve_teasing',
        'stalking', 
        'inappropriate_touch',
        'verbal_harassment',
        'unsafe_transport',
        'workplace_harassment',
        'domestic_incident',
        'unsafe_area_women'
      ],
      features: [
        'Enhanced Privacy Protection',
        'Female-Only Validation',
        'Cultural Sensitivity Flags',
        'Time-Based Risk Assessment'
      ]
    },
    documentation: 'See README.md for complete API documentation',
    timestamp: new Date().toISOString()
  });
});

// ENHANCED: Security endpoint for monitoring and debugging
app.get('/api/security/status', (req, res) => {
  const userContext = req.userContext || {};
  
  res.json({
    success: true,
    securityStatus: {
      middleware: {
        userTypeDetection: 'active',
        roleBasedAccess: 'available',
        securityHeaders: 'active'
      },
      currentUser: {
        userType: userContext.userType || 'unknown',
        userId: userContext.user?.userId || null,
        deviceFingerprint: userContext.deviceFingerprint?.fingerprintId || null,
        permissions: userContext.permissions || [],
        securityContext: userContext.securityContext || {}
      },
      system: {
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        securityVersion: '3.2.0'
      }
    }
  });
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
  const socketHandler = app.locals.socketHandler || global.socketHandler;
  
  if (!socketHandler) {
    return res.status(503).json({
      success: false,
      message: 'WebSocket server not initialized',
      status: 'disconnected'
    });
  }

  const stats = socketHandler.getConnectionStats();
  res.json({
    success: true,
    status: 'connected',
    connectionStats: stats,
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler (ENHANCED with security context)
app.use('*catchall', (req, res) => {
  const userContext = req.userContext || {};
  
  if (userContext.securityContext?.riskLevel === 'high' || userContext.securityContext?.riskLevel === 'critical') {
    console.log(`⚠️ High-risk user attempted to access non-existent endpoint: ${req.method} ${req.path}`);
  }
  
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    availableEndpoints: [
      '/api/reports',
      '/api/admin',
      '/api/safezones',
      '/api/auth',
      '/api/user-types',
      '/api/invites', // Don't forget this!
      '/api/health',
      '/api/security/status',
      '/api/websocket/status'
    ],
    ...(process.env.NODE_ENV === 'development' && {
      userContext: {
        userType: userContext.userType,
        permissions: userContext.permissions
      }
    })
  });
});

// Global error handler (ENHANCED with security logging)
app.use((error, req, res, next) => {
  const userContext = req.userContext || {};
  
  console.error('❌ Unhandled error:', {
    error: error.message,
    stack: error.stack,
    userType: userContext.userType,
    userId: userContext.user?.userId,
    deviceFingerprint: userContext.deviceFingerprint?.fingerprintId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  if (userContext.securityContext?.riskLevel === 'high' || userContext.securityContext?.riskLevel === 'critical') {
    console.error(`🚨 Critical error from high-risk user: ${userContext.user?.userId}`);
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && {
      userContext: {
        userType: userContext.userType,
        trustScore: userContext.securityContext?.trustScore,
        riskLevel: userContext.securityContext?.riskLevel
      }
    })
  });
});

// Server startup with enhanced logging
server.listen(PORT, () => {
  console.log('🚀 SafeStreets Bangladesh API server started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log('🛡️ Enhanced Security Features:');
  console.log('   ✅ Device Fingerprinting');
  console.log('   ✅ User Type Detection');
  console.log('   ✅ Role-Based Access Control');
  console.log('   ✅ Security Monitoring');
  console.log('   ✅ Female Safety Integration');
  console.log('   ✅ Multi-Vector Threat Detection');
  console.log('   🔌 Real-time WebSocket Updates');
  console.log('   📧 Invite-Only Registration System');
  console.log('📊 Available Endpoints:');
  console.log('   📍 /api/reports - Crime reporting');
  console.log('   👮 /api/admin - Admin management');
  console.log('   🛡️ /api/safezones - Safe zone management');
  console.log('   🔐 /api/auth - Authentication');
  console.log('   👥 /api/user-types - User management');
  console.log('   📧 /api/invites - Invite system');
  console.log('   💚 /api/health - Health check');
  console.log('   🔍 /api/security/status - Security monitoring');
  console.log('   🔌 /api/websocket/status - WebSocket status');
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔌 WebSocket server will initialize after database connection');
});

module.exports = { app, server };