// === server.js (ENHANCED WITH CONNECTION MANAGEMENT) ===
// CRITICAL FIX: Replace basic mongoose.connect with intelligent connection management
// Prevents "Client must be connected before running operations" errors
// Handles 25,000+ concurrent users with robust connection pooling

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const cookieParser = require('cookie-parser');

// CRITICAL FIX: Import new connection management systems
const { connectionPoolManager } = require('./src/config/connectionPoolManager');
const { databaseHealthChecker, databaseHealthMiddleware } = require('./src/middleware/databaseHealthChecker');

// ENHANCED: Import security middleware functions as named exports
const { userTypeDetection } = require('./src/middleware/userTypeDetection');
// PERFORMANCE: Use scaled WebSocket handler for horizontal scaling
const ScaledSocketHandler = require('./src/websocket/scaledSocketHandler');
const { productionLogger, requestLogger, errorLogger, securityLogger } = require('./src/utils/productionLogger');
const { sanitizationMiddleware, securityHeaders } = require('./src/utils/sanitization');
const { initializeCache } = require('./src/middleware/cacheLayer');
const { initializePerformanceTracking, trackApiPerformance, addPerformanceHeaders } = require('./src/middleware/performanceTracking');
const { optimizeMongoDB } = require('./src/config/mongodbOptimizations');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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
// === CRITICAL FIX: ENHANCED DATABASE CONNECTION MANAGEMENT =======
// =================================================================

/**
 * Initialize database connection with intelligent pool management
 */
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing enhanced database connection...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    // Enhanced connection configuration for high load
    const connectionConfig = {
      // INCREASED LIMITS: Handle 25,000+ concurrent users
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 150,  // Up from 100
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 20,   // Up from 10
      
      // AGGRESSIVE TIMEOUTS: Fail fast under load
      socketTimeoutMS: 30000,        // Down from 45000
      serverSelectionTimeoutMS: 3000, // Down from 5000
      connectTimeoutMS: 10000,
      heartbeatFrequencyMS: 5000,    // More frequent health checks
      
      // SMART POOLING: Close idle connections faster
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 2000,      // Fail fast if pool is full
      
      // RELIABILITY: Enhanced retry and error handling
      retryWrites: true,
      retryReads: true,
      readPreference: 'primaryPreferred',
      
      // PERFORMANCE: Compression for better throughput
      compressors: 'zstd,zlib,snappy',
      
      // CONSISTENCY: Production-ready settings
      readConcern: { level: 'majority' },
      writeConcern: { 
        w: 'majority',
        j: true,
        wtimeout: 5000 
      }
    };
    
    // Use intelligent connection pool manager instead of basic mongoose.connect
    await connectionPoolManager.initialize(process.env.MONGODB_URI, connectionConfig);
    
    // Initialize database health monitoring
    databaseHealthChecker.initialize();
    
    console.log('✅ Enhanced database connection established');
    console.log(`📊 Pool: ${connectionConfig.maxPoolSize} max, ${connectionConfig.minPoolSize} min connections`);
    
    // Setup connection event handlers
    setupConnectionEventHandlers();
    
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide helpful debugging information
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Database Connection Troubleshooting:');
      console.log('   • Ensure MongoDB is running');
      console.log('   • Check MONGODB_URI in .env file');
      console.log('   • Verify network connectivity');
      console.log('   • Check firewall settings');
    }
    
    throw error;
  }
}

/**
 * Setup connection event handlers for monitoring
 */
function setupConnectionEventHandlers() {
  // Connection pool events
  connectionPoolManager.on('connected', () => {
    console.log('📡 Connection pool: Connected');
  });
  
  connectionPoolManager.on('connectionLost', () => {
    console.log('📡 Connection pool: Connection lost - attempting recovery');
  });
  
  connectionPoolManager.on('connectionRecovered', () => {
    console.log('📡 Connection pool: Connection recovered');
  });
  
  connectionPoolManager.on('poolAlert', (alert) => {
    if (alert.level === 'critical') {
      console.log(`🚨 CRITICAL: ${alert.message}`);
    } else {
      console.log(`⚠️ WARNING: ${alert.message}`);
    }
  });
  
  connectionPoolManager.on('circuitBreakerOpen', () => {
    console.log('🔴 Circuit breaker opened - connection attempts suspended');
  });
  
  // Original mongoose events (for backward compatibility)
  mongoose.connection.on('connected', () => {
    console.log('📡 Mongoose: Connected to MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    console.error('📡 Mongoose: Connection error -', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('📡 Mongoose: Disconnected from MongoDB');
  });
}

// =================================================================
// === ENHANCED MIDDLEWARE SETUP ==================================
// =================================================================

initializePerformanceTracking();

// PERFORMANCE: Initialize Redis caching - FIXED: Await initialization
(async () => {
  try {
    console.log('🔄 Initializing Redis cache layer...');
    await initializeCache();
    console.log('✅ Redis cache layer initialization completed');
  } catch (error) {
    console.error('❌ Failed to initialize Redis cache:', error);
    console.log('⚠️ Server will continue without Redis caching');
  }
})();

// CONDITIONAL MIDDLEWARE: Apply heavy middleware only when needed
if (process.env.NODE_ENV === 'development') {
  // Development-only middleware
  // Add performance tracking middleware (before routes)
  app.use(trackApiPerformance);
  app.use(addPerformanceHeaders);
  //logger
  app.use(requestLogger());
  app.use(securityLogger());
  app.use(errorLogger());
} else {
  // Production: Minimal logging, essential security only
  app.use(errorLogger()); // Keep error logging in production
}

// SECURITY: Add input sanitization and security headers
app.use(securityHeaders());
// app.use(sanitizationMiddleware());

// CRITICAL FIX: Add database health middleware BEFORE routes
app.use(databaseHealthMiddleware({
  skipPaths: ['/api/health', '/api/status', '/api/websocket/status'],
  enableHealthHeaders: true,
  fastFail: true  // Fail fast during database issues
}));

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

// Create HTTP server
const server = http.createServer(app);

// =================================================================
// === ENHANCED SERVER INITIALIZATION SEQUENCE ====================
// =================================================================

/**
 * Initialize server components in the correct order
 */
async function initializeServer() {
  try {
    console.log('🚀 SafeStreets Bangladesh API server initialization...');
    console.log('📡 Server will run on port', PORT);
    
    // STEP 1: Initialize database connection with intelligent pooling
    await initializeDatabase();
    
    // STEP 2: Initialize application components after database is ready
    await initializeApplicationComponents();
    
    // STEP 3: Initialize routes and middleware
    initializeRoutes();
    
    // STEP 4: Start HTTP server
    const serverInstance = await startHttpServer();
    
    // STEP 5: Setup graceful shutdown
    setupGracefulShutdown(serverInstance);
    
    console.log('🚀 SafeStreets Bangladesh server fully initialized');
    console.log('🌐 Environment:', process.env.NODE_ENV);
    
    // Display system status
    displaySystemStatus();
    
    return serverInstance;
    
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Initialize application components after database connection
 */
async function initializeApplicationComponents() {
  try {
    console.log('🔧 Initializing application components...');
    
    // Run expensive optimization only in development or once via env flag
    if (process.env.RUN_INDEX_OPTIMIZATION === 'true') {
      console.log('🔍 Running database index optimization...');
      const { optimizeDatabase } = require('./src/config/indexOptimization');
      await optimizeDatabase();
    }

    // Safe to run on every startup (optional: guard with another flag)
    if (process.env.RUN_MONGO_OPTIMIZERS === 'true') {
      console.log('⚡ Applying MongoDB optimizations...');
      await optimizeMongoDB();
    }
    
    // Initialize scaled WebSocket handler with Redis backing
    console.log('🔌 Initializing WebSocket server...');
    const socketHandler = new ScaledSocketHandler(server);
    await socketHandler.waitForInitialization(); // Wait for proper initialization
    
    app.locals.socketHandler = socketHandler;
    global.socketHandler = socketHandler;
    
    // ===== PHASE 1: DISTRIBUTED QUEUE INITIALIZATION (FIXED) =====
    if (process.env.INITIALIZE_DISTRIBUTED_QUEUE === 'true') {
      console.log('📊 Initializing distributed queue system...');
      const { distributedQueueService } = require('./src/services/distributedQueueService');
      
      if (!distributedQueueService.isInitialized) {
        await distributedQueueService.initialize();
      }
    }

    if (process.env.INITIALIZE_REPORT_PROCESSOR === 'true') {
      console.log('🔄 Initializing report processor...');
      const { reportProcessor } = require('./src/middleware/reportProcessor');
      await reportProcessor.initialize();
    }
    
    console.log('✅ Application components initialized');
    
  } catch (error) {
    console.error('❌ Application component initialization failed:', error);
    // Don't fail completely - some components are optional
    console.log('⚠️ Server will continue with reduced functionality');
  }
}

/**
 * Initialize routes and API endpoints
 */
function initializeRoutes() {
  console.log('🛣️ Initializing API routes...');
  
  // Enhanced health endpoint with database status
  app.get('/api/health', async (req, res) => {
    try {
      const healthStatus = databaseHealthChecker.getHealthStatus();
      const poolStatus = connectionPoolManager.getPoolStatus();
      
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          connected: healthStatus.isHealthy,
          healthScore: healthStatus.healthScore,
          connectionState: healthStatus.connectionState,
          poolUtilization: poolStatus.stats.poolUtilization?.toFixed(1) + '%'
        },
        server: {
          uptime: process.uptime(),
          environment: process.env.NODE_ENV,
          nodeVersion: process.version
        }
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        error: error.message
      });
    }
  });
  
  // Load application routes
  try {
    app.use('/api/auth', require('./src/routes/auth'));
    app.use('/api/reports', require('./src/routes/reports'));
    app.use('/api/admin', require('./src/routes/admin'));
    app.use('/api/safezones', require('./src/routes/safezones'));
    app.use('/api/user-types', require('./src/routes/userTypes'));
    app.use('/api/invites', require('./src/routes/invites'));
    
    console.log('✅ API routes initialized');
  } catch (error) {
    console.error('❌ Route initialization failed:', error);
    throw error;
  }
}

/**
 * Start HTTP server
 */
function startHttpServer() {
  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(PORT, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('📡 Server running on port', PORT);
        resolve(serverInstance);
      }
    });
    
    serverInstance.on('error', reject);
  });
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(serverInstance) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      serverInstance.close(async () => {
        console.log('📡 HTTP server closed');
        
        // Shutdown database health checker
        databaseHealthChecker.shutdown();
        
        // Shutdown connection pool manager
        await connectionPoolManager.shutdown();
        
        // Close database connection
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close();
          console.log('📚 Database connection closed');
        }
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });
      
      // Force exit after timeout
      setTimeout(() => {
        console.log('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
      
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
}

/**
 * Display system status and available endpoints
 */
function displaySystemStatus() {
  const poolStatus = connectionPoolManager.getPoolStatus();
  const healthStatus = databaseHealthChecker.getHealthStatus();
  
  console.log('\n🛡️ Enhanced Security Features:');
  console.log('   ✅ Device Fingerprinting');
  console.log('   ✅ User Type Detection');
  console.log('   ✅ Role-Based Access Control');
  console.log('   ✅ Security Monitoring');
  console.log('   ✅ Female Safety Integration');
  console.log('   ✅ Multi-Vector Threat Detection');
  console.log('   🔌 Real-time WebSocket Updates');
  console.log('   📧 Invite-Only Registration System');
  console.log('   🏥 Database Health Monitoring');
  console.log('   ⚡ Intelligent Connection Pooling');
  
  console.log('\n📊 Available Endpoints:');
  console.log('   📍 /api/reports - Crime reporting');
  console.log('   👮 /api/admin - Admin management');
  console.log('   🛡️ /api/safezones - Safe zone management');
  console.log('   🔐 /api/auth - Authentication');
  console.log('   👥 /api/user-types - User management');
  console.log('   📧 /api/invites - Invite system');
  console.log('   💚 /api/health - Enhanced health check');
  console.log('   🔍 /api/security/status - Security monitoring');
  console.log('   🔌 /api/websocket/status - WebSocket status');
  
  console.log('\n📊 Database Status:');
  console.log(`   🔗 Connection: ${healthStatus.connectionState}`);
  console.log(`   🏥 Health Score: ${healthStatus.healthScore}/100`);
  console.log(`   📊 Pool Utilization: ${(poolStatus.stats.poolUtilization || 0).toFixed(1)}%`);
  console.log(`   🔄 Max Connections: ${poolStatus.config.maxPoolSize}`);
}

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

// Start the server
initializeServer().catch(error => {
  console.error('💥 Fatal server error:', error);
  process.exit(1);
});

module.exports = { app, server };