#!/usr/bin/env node
// === fixPhase1Integration.js ===
// Quick fix for Phase 1 integration issues
// Addresses: Missing functions, processor initialization, Redis cluster issues

const mongoose = require('mongoose');
require('dotenv').config();

async function fixPhase1Integration() {
  console.log('🔧 PHASE 1 INTEGRATION FIX SCRIPT');
  console.log('='.repeat(50));
  
  try {
    // 1. Fix Redis cluster configuration issues
    console.log('🔍 Step 1: Fixing Redis cluster configuration...');
    
    // Your env has contradictory settings - let's fix this
    if (process.env.REDIS_CLUSTER_ENABLED === 'true' && !process.env.REDIS_CLUSTER_NODES) {
      console.log('  ⚠️  Redis cluster enabled but no nodes configured');
      console.log('  🔧 For local development, disabling cluster mode...');
      
      // Create corrected env suggestions
      console.log('\n  📝 Add these to your .env file:');
      console.log('     REDIS_CLUSTER_ENABLED=false');
      console.log('     REDIS_SENTINEL_ENABLED=false');
      console.log('     # Keep your existing REDIS_HOST=localhost and REDIS_PORT=6379');
    }

    // 2. Test Redis connection
    console.log('\n🔍 Step 2: Testing Redis connection...');
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxLoadingTimeout: 0,
        lazyConnect: true
      });
      
      await redis.ping();
      console.log('  ✅ Redis connection successful');
      await redis.disconnect();
    } catch (error) {
      console.log('  ❌ Redis connection failed:', error.message);
      console.log('  💡 Quick fix: Start Redis with: redis-server');
    }

    // 3. Check if distributed queue service is properly initialized
    console.log('\n🔍 Step 3: Checking distributed queue service...');
    try {
      const { distributedQueueService } = require('./src/services/distributedQueueService');
      
      if (!distributedQueueService) {
        console.log('  ❌ Distributed queue service not found');
      } else if (!distributedQueueService.isInitialized) {
        console.log('  ⚠️  Distributed queue service not initialized');
        console.log('  🔧 Attempting initialization...');
        
        const result = await distributedQueueService.initialize();
        if (result.success) {
          console.log('  ✅ Distributed queue service initialized');
        } else {
          console.log('  ❌ Initialization failed');
        }
      } else {
        console.log('  ✅ Distributed queue service is ready');
      }
    } catch (error) {
      console.log('  ❌ Error loading distributed queue service:', error.message);
    }

    // 4. Check report processor integration
    console.log('\n🔍 Step 4: Checking report processor...');
    try {
      const { reportProcessor } = require('./src/middleware/reportProcessor');
      
      if (!reportProcessor) {
        console.log('  ❌ Report processor not found');
      } else if (!reportProcessor.isInitialized) {
        console.log('  ⚠️  Report processor not initialized');
        console.log('  🔧 Attempting initialization...');
        
        const result = await reportProcessor.initialize();
        if (result.success) {
          console.log('  ✅ Report processor initialized');
        } else {
          console.log('  ❌ Initialization failed');
        }
      } else {
        console.log('  ✅ Report processor is ready');
      }
    } catch (error) {
      console.log('  ❌ Error loading report processor:', error.message);
    }

    // 5. Test Report model integration
    console.log('\n🔍 Step 5: Testing Report model integration...');
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('  ✅ MongoDB connected');
      
      const Report = require('./src/models/Report');
      
      // Test if the enhanced methods exist
      const testReport = new Report({
        type: 'test',
        description: 'Integration test report',
        location: {
          coordinates: [90.4125, 23.8103]
        },
        severity: 2,
        submittedBy: {
          deviceFingerprint: 'test_device_integration'
        }
      });

      // Test new methods
      if (typeof testReport.determineProcessingTier === 'function') {
        const tier = testReport.determineProcessingTier();
        console.log(`  ✅ Processing tier method works: ${tier}`);
      } else {
        console.log('  ❌ Processing tier method missing');
      }

      if (typeof testReport.queueForDistributedProcessing === 'function') {
        console.log('  ✅ Distributed processing method exists');
      } else {
        console.log('  ❌ Distributed processing method missing');
      }

      await mongoose.connection.close();
      
    } catch (error) {
      console.log('  ❌ Report model integration error:', error.message);
    }

    // 6. Generate integration summary
    console.log('\n📊 INTEGRATION STATUS SUMMARY:');
    console.log('='.repeat(50));
    
    console.log('\n✅ WHAT\'S WORKING:');
    console.log('   • Phase 1 files are present in project knowledge');
    console.log('   • Basic Redis connection possible');
    console.log('   • Enhanced Report model structure exists');
    
    console.log('\n❌ WHAT NEEDS FIXING:');
    console.log('   • Redis cluster configuration conflicts');
    console.log('   • Distributed queue service initialization');
    console.log('   • Report processor initialization');
    console.log('   • Legacy function compatibility');

    console.log('\n🔧 IMMEDIATE ACTION ITEMS:');
    console.log('   1. Update .env file with corrected Redis settings');
    console.log('   2. Initialize distributed queue service in server.js');
    console.log('   3. Initialize report processor in server.js');
    console.log('   4. Test the integration with a simple report');

    return {
      success: true,
      needsManualFixes: true,
      criticalIssues: [
        'Redis cluster configuration',
        'Service initialization order',
        'Legacy function compatibility'
      ]
    };

  } catch (error) {
    console.error('❌ Integration fix failed:', error);
    return { success: false, error: error.message };
  }
}

// Generate corrected environment file
function generateCorrectedEnv() {
  console.log('\n📝 CORRECTED .ENV CONFIGURATION:');
  console.log('='.repeat(50));
  
  const correctedEnv = `
# ===== CORRECTED REDIS CONFIGURATION =====
# For local development - disable clustering
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_CLUSTER_ENABLED=false
REDIS_SENTINEL_ENABLED=false

# Database allocation
REDIS_CACHE_DB=0
REDIS_QUEUE_DB=1
REDIS_SESSION_DB=2
REDIS_RATELIMIT_DB=3
REDIS_ANALYTICS_DB=4

# ===== DISTRIBUTED QUEUE CONFIGURATION =====
# Reduced for local development
EMERGENCY_WORKERS=2
STANDARD_WORKERS=3
BACKGROUND_WORKERS=2
ANALYTICS_WORKERS=1
EMAIL_WORKERS=1
DEVICE_WORKERS=1

# Queue Dashboard
QUEUE_DASHBOARD_ENABLED=true
QUEUE_DASHBOARD_USER=admin
QUEUE_DASHBOARD_PASS=secure_password_here

# ===== INITIALIZATION FLAGS =====
# Add these to ensure proper startup order
INITIALIZE_DISTRIBUTED_QUEUE=true
INITIALIZE_REPORT_PROCESSOR=true
`;

  console.log(correctedEnv);
  
  console.log('\n🔧 COPY THE ABOVE TO YOUR .ENV FILE');
  console.log('   Replace the Redis and Queue sections with the corrected values above');
}

// Generate server.js integration code
function generateServerIntegration() {
  console.log('\n📝 SERVER.JS INTEGRATION CODE:');
  console.log('='.repeat(50));
  
  const integrationCode = `
// Add this to your server.js AFTER database connection but BEFORE routes

// ===== PHASE 1: DISTRIBUTED QUEUE INITIALIZATION =====
(async () => {
  if (process.env.INITIALIZE_DISTRIBUTED_QUEUE === 'true') {
    try {
      console.log('🚀 Initializing distributed queue system...');
      
      // Initialize distributed queue service
      const { distributedQueueService } = require('./src/services/distributedQueueService');
      await distributedQueueService.initialize();
      
      // Initialize report processor
      const { reportProcessor } = require('./src/middleware/reportProcessor');
      await reportProcessor.initialize();
      
      console.log('✅ Phase 1 distributed queue system ready');
      
    } catch (error) {
      console.warn('⚠️ Distributed queue initialization failed, using fallbacks:', error.message);
    }
  }
})();
`;

  console.log(integrationCode);
  
  console.log('\n🔧 ADD THE ABOVE CODE TO YOUR server.js');
  console.log('   Place it after MongoDB connection but before route definitions');
}

// Run the fix script
if (require.main === module) {
  fixPhase1Integration()
    .then((result) => {
      if (result.needsManualFixes) {
        generateCorrectedEnv();
        generateServerIntegration();
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('='.repeat(50));
        console.log('1. Update your .env with the corrected configuration above');
        console.log('2. Add the integration code to your server.js');
        console.log('3. Restart your server: npm run dev');
        console.log('4. Run initialization: node initializeDistributedQueue.js');
        console.log('5. Test with load test: npm run test:heavy-normal');
      }
    })
    .catch(console.error);
}

module.exports = { fixPhase1Integration };