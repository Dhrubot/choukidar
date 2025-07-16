const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ENHANCED: Import security middleware
const userTypeDetection = require('./src/middleware/userTypeDetection');

// Basic Middleware (PRESERVED)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ENHANCED: Security middleware - Apply device fingerprinting and user context to all requests
// This middleware must come BEFORE route definitions to ensure user context is available
app.use(userTypeDetection);

// ENHANCED: Security headers for additional protection
app.use((req, res, next) => {
  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Add security context to response headers (for debugging in development)
  if (process.env.NODE_ENV === 'development' && req.userContext) {
    res.setHeader('X-User-Type', req.userContext.userType);
    res.setHeader('X-Trust-Score', req.userContext.securityContext?.trustScore || 0);
    res.setHeader('X-Risk-Level', req.userContext.securityContext?.riskLevel || 'unknown');
  }
  
  next();
});

// Database connection (PRESERVED)
mongoose.connect(process.env.MONGODB_URI);

// Database connection events (PRESERVED)
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  console.log('🛡️ Security middleware active - Device fingerprinting enabled');
});

mongoose.connection.on('error', (err) => {
  console.log('❌ MongoDB connection error:', err);
});

// ENHANCED: User context logging middleware (for monitoring)
app.use((req, res, next) => {
  if (req.userContext) {
    // Log user activity for security monitoring (only for non-GET requests)
    if (req.method !== 'GET') {
      console.log(`🔍 ${req.method} ${req.path} - User: ${req.userContext.userType} (Trust: ${req.userContext.securityContext?.trustScore || 0}, Risk: ${req.userContext.securityContext?.riskLevel || 'unknown'})`);
      
      // Log suspicious activity
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

// ENHANCED: Health check with security status
app.get('/api/health', (req, res) => {
  // Get user context for health check
  const userContext = req.userContext || {};
  
  res.json({ 
    message: 'SafeStreets API is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    features: {
      reports: 'active',
      admin: 'active',
      safeZones: 'active',
      // NEW: Security features status
      authentication: 'active',
      userManagement: 'active',
      deviceFingerprinting: 'active',
      securityMonitoring: 'active',
      routing: 'client-side' // (handled by frontend)
    },
    // NEW: Security status
    security: {
      userTypeDetection: 'active',
      deviceFingerprinting: userContext.deviceFingerprint ? 'active' : 'inactive',
      userType: userContext.userType || 'unknown',
      trustScore: userContext.securityContext?.trustScore || 0,
      riskLevel: userContext.securityContext?.riskLevel || 'unknown',
      quarantineStatus: userContext.securityContext?.quarantined || false
    },
    version: '3B-Intelligence-Enhanced'
  });
});

// ENHANCED: API info endpoint with new features
app.get('/api', (req, res) => {
  res.json({
    message: 'SafeStreets Bangladesh API - Phase 3B Enhanced',
    version: '3.2.0', // Incremented version to reflect new features
    features: [
      'Crime Reports', 
      'Admin Management', 
      'Safe Zones', 
      'Route Intelligence',
      // NEW FEATURES
      'Advanced Security Framework',
      'User Type Management',
      'Device Fingerprinting',
      'Female Safety Integration',
      'Multi-Role Authentication'
    ],
    endpoints: {
      // EXISTING ENDPOINTS (PRESERVED)
      reports: {
        public: '/api/reports',
        admin: '/api/admin/reports'
      },
      safeZones: {
        public: '/api/safezones',
        admin: '/api/safezones/admin'
      },
      // NEW ENDPOINTS
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
      health: '/api/health'
    },
    // NEW: Security information
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
    // NEW: Female safety features
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

// 404 handler (ENHANCED with security context)
app.use('/{*catchall}', (req, res) => {
  const userContext = req.userContext || {};
  
  // Log 404 attempts from suspicious users
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
      '/api/auth', // NEW
      '/api/user-types', // NEW
      '/api/health',
      '/api/security/status' // NEW
    ],
    // Include user context for debugging (only in development)
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
  
  // Enhanced error logging with security context
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
  
  // Log critical errors from suspicious users
  if (userContext.securityContext?.riskLevel === 'high' || userContext.securityContext?.riskLevel === 'critical') {
    console.error(`🚨 Critical error from high-risk user: ${userContext.user?.userId}`);
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    // Include security context in development
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
app.listen(PORT, () => {
  console.log('🚀 SafeStreets Bangladesh API server started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log('🛡️ Enhanced Security Features:');
  console.log('   ✅ Device Fingerprinting');
  console.log('   ✅ User Type Detection');
  console.log('   ✅ Role-Based Access Control');
  console.log('   ✅ Security Monitoring');
  console.log('   ✅ Female Safety Integration');
  console.log('   ✅ Multi-Vector Threat Detection');
  console.log('📊 Available Endpoints:');
  console.log('   📍 /api/reports - Crime reporting');
  console.log('   👮 /api/admin - Admin management');
  console.log('   🛡️ /api/safezones - Safe zone management');
  console.log('   🔐 /api/auth - Authentication');
  console.log('   👥 /api/user-types - User management');
  console.log('   💚 /api/health - Health check');
  console.log('   🔍 /api/security/status - Security monitoring');
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;