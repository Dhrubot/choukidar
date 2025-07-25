#!/usr/bin/env node
// === backend/runPerformanceBaseline.js ===
// Standalone Performance Baseline Runner
// Initializes database connection and runs complete analysis

require('dotenv').config();
const mongoose = require('mongoose');
const { PerformanceBaseline } = require('./src/utils/performanceBaseline');

async function runStandaloneBaseline() {
  console.log('🎯 Choukidar Performance Baseline Runner');
  console.log('=' * 50);
  
  try {
    // 1. Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI environment variable not set');
      console.log('💡 Make sure your .env file contains MONGODB_URI');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 100,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000 // Increase timeout for connection
    });
    
    console.log('✅ Connected to MongoDB');
    
    // 2. Wait a moment for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Run baseline analysis
    console.log('🚀 Starting performance analysis...\n');
    
    const baseline = new PerformanceBaseline();
    const results = await baseline.runCompleteBaseline();
    
    console.log('\n🎉 Baseline analysis completed successfully!');
    
    // 4. Show critical findings
    showCriticalFindings(results);
    
    return results;
    
  } catch (error) {
    console.error('❌ Baseline analysis failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 MongoDB Connection Tips:');
      console.log('   • Make sure MongoDB is running');
      console.log('   • Check your MONGODB_URI in .env file');
      console.log('   • Verify network connectivity');
    }
    
    process.exit(1);
  } finally {
    // 5. Close database connection
    try {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database:', error.message);
    }
  }
}

function showCriticalFindings(results) {
  console.log('\n' + '🔥 CRITICAL PERFORMANCE ISSUES FOUND:');
  console.log('=' * 50);
  
  const critical = results.recommendations.filter(r => r.priority === 'critical');
  const high = results.recommendations.filter(r => r.priority === 'high');
  
  if (critical.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES (Fix Immediately):');
    critical.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.issue}`);
      console.log(`      → ${issue.expectedImprovement}`);
    });
  }
  
  if (high.length > 0) {
    console.log('\n⚠️  HIGH PRIORITY ISSUES:');
    high.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.issue}`);
      console.log(`      → ${issue.expectedImprovement}`);
    });
  }
  
  // Database insights
  const totalDocs = Object.values(results.database.collections)
    .reduce((sum, col) => sum + (col.documentCount || 0), 0);
  
  const totalIndexes = Object.values(results.database.indexes)
    .reduce((sum, col) => sum + (col.total || 0), 0);
  
  console.log('\n📊 QUICK STATS:');
  console.log(`   • Total Documents: ${totalDocs.toLocaleString()}`);
  console.log(`   • Total Indexes: ${totalIndexes}`);
  console.log(`   • Avg Query Time: ${results.database.avgQueryTime.toFixed(2)}ms`);
  console.log(`   • Memory Usage: ${results.memory.heapUsed}MB heap`);
  console.log(`   • Cache Status: ${results.cache.status}`);
  
  // Performance verdict
  const performanceScore = calculatePerformanceScore(results);
  console.log('\n🎯 OVERALL PERFORMANCE SCORE:');
  console.log(`   ${performanceScore.score}/100 - ${performanceScore.verdict}`);
  
  if (performanceScore.score < 50) {
    console.log('\n🚨 URGENT: Your backend needs immediate optimization!');
    console.log('   Based on load test showing 42.75% error rate, start with:');
    console.log('   1. Database index optimization (biggest impact)');
    console.log('   2. Redis cache setup (60-80% improvement)');
    console.log('   3. Connection pool optimization (40-60% improvement)');
  }
}

function calculatePerformanceScore(results) {
  let score = 100;
  
  // Database penalties
  if (results.database.avgQueryTime > 100) score -= 30;
  else if (results.database.avgQueryTime > 50) score -= 15;
  
  const totalIndexes = Object.values(results.database.indexes)
    .reduce((sum, col) => sum + (col.total || 0), 0);
  if (totalIndexes > 50) score -= 25;
  else if (totalIndexes > 30) score -= 15;
  
  // Cache penalties
  if (results.cache.status === 'disconnected' || results.cache.status === 'unavailable') {
    score -= 35; // Major penalty for no caching
  } else if (results.cache.hitRate && parseFloat(results.cache.hitRate) < 60) {
    score -= 20;
  }
  
  // Memory penalties
  if (results.memory.heapUsed > 512) score -= 10;
  
  // Connection pool penalties
  if (results.database.connectionPool.connectionState !== 'connected') {
    score -= 20;
  }
  
  score = Math.max(0, score);
  
  let verdict;
  if (score >= 80) verdict = 'EXCELLENT';
  else if (score >= 65) verdict = 'GOOD';
  else if (score >= 50) verdict = 'FAIR';
  else if (score >= 30) verdict = 'POOR';
  else verdict = 'CRITICAL';
  
  return { score, verdict };
}

// Run if called directly
if (require.main === module) {
  runStandaloneBaseline().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runStandaloneBaseline };