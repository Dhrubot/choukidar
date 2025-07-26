#!/usr/bin/env node
// === backend/fixRedisConflicts.js ===
// Redis Cache Cleanup Script - Fixes the rate limiting conflicts
// Run this BEFORE restarting your server

require('dotenv').config();
const redis = require('redis');

class RedisConflictFixer {
  constructor() {
    this.client = null;
    this.cleanupStats = {
      keysFound: 0,
      keysDeleted: 0,
      errors: 0,
      patterns: []
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    console.log('🚀 Redis Conflict Fixer for SafeStreets Bangladesh');
    console.log('=' * 60);
    console.log('🎯 Target: Fix "ERR value is not an integer" errors');
    console.log('🔧 Strategy: Clean conflicting rate limit keys\n');

    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 10000,
          lazyConnect: true
        }
      });

      await this.client.connect();
      
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        console.log('✅ Connected to Redis successfully');
        return true;
      }
      
      throw new Error('Redis ping failed');
      
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      
      if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 Redis Connection Tips:');
        console.log('   • Make sure Redis server is running: redis-server');
        console.log('   • Check REDIS_URL in .env file');
        console.log('   • Default: redis://localhost:6379');
      }
      
      throw error;
    }
  }

  /**
   * Scan and identify problematic keys
   */
  async scanProblematicKeys() {
    console.log('🔍 Scanning for problematic Redis keys...');
    
    // Patterns that cause conflicts between express-rate-limit and our cache layer
    const problematicPatterns = [
      'rl:*',                    // express-rate-limit keys
      'rate-limit:*',            // Alternative rate limit keys
      '*:ratelimit:*',           // Mixed rate limit keys
      'safestreets:ratelimit:*', // Our rate limit keys that might be corrupted
      'limiter:*',               // Other rate limiter keys
      'limit:*'                  // Generic limit keys
    ];

    for (const pattern of problematicPatterns) {
      try {
        console.log(`  🔎 Scanning pattern: ${pattern}`);
        
        const keys = await this.scanKeys(pattern);
        
        if (keys.length > 0) {
          console.log(`    📋 Found ${keys.length} keys matching pattern`);
          this.cleanupStats.keysFound += keys.length;
          this.cleanupStats.patterns.push({
            pattern,
            count: keys.length,
            keys: keys.slice(0, 5) // Show first 5 keys as sample
          });
        } else {
          console.log(`    ✅ No keys found for pattern`);
        }
        
      } catch (error) {
        console.error(`    ❌ Error scanning pattern ${pattern}:`, error.message);
        this.cleanupStats.errors++;
      }
    }

    return this.cleanupStats.keysFound > 0;
  }

  /**
   * Scan keys using SCAN command for memory efficiency
   */
  async scanKeys(pattern) {
    const keys = [];
    let cursor = '0'; // Use string cursor for Redis v4/v5 compatibility
    
    do {
      try {
        const result = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = result.cursor.toString(); // Ensure cursor is always string
        keys.push(...result.keys);
        
      } catch (error) {
        console.error(`    ❌ SCAN error for pattern ${pattern}:`, error.message);
        break; // Exit loop on error to prevent infinite loop
      }
      
    } while (cursor !== '0');
    
    return keys;
  }

  /**
   * Analyze key data types and identify conflicts
   */
  async analyzeKeyConflicts() {
    console.log('\n🔬 Analyzing key conflicts and data types...');
    
    for (const patternInfo of this.cleanupStats.patterns) {
      console.log(`\n  📊 Analyzing pattern: ${patternInfo.pattern}`);
      
      for (const key of patternInfo.keys) {
        try {
          const type = await this.client.type(key);
          const ttl = await this.client.ttl(key);
          
          console.log(`    🔑 ${key}`);
          console.log(`       Type: ${type}, TTL: ${ttl}s`);
          
          // Check if this key has problematic data
          if (type === 'string') {
            const value = await this.client.get(key);
            const isNumeric = /^\d+$/.test(value);
            
            if (!isNumeric && value !== null) {
              console.log(`       ⚠️  NON-NUMERIC VALUE: "${value}" (this causes INCR errors)`);
            }
          } else if (type !== 'string') {
            console.log(`       ⚠️  WRONG TYPE: Expected string for rate limiting, got ${type}`);
          }
          
        } catch (error) {
          console.error(`       ❌ Error analyzing key ${key}:`, error.message);
        }
      }
    }
  }

  /**
   * Clean up conflicting keys
   */
  async cleanupConflictingKeys() {
    console.log('\n🧹 Cleaning up conflicting Redis keys...');
    
    const confirmCleanup = process.argv.includes('--force') || process.argv.includes('-f');
    
    if (!confirmCleanup) {
      console.log('⚠️  DRY RUN MODE - No keys will be deleted');
      console.log('   Run with --force or -f to actually delete keys');
      console.log('   Example: node fixRedisConflicts.js --force\n');
    }

    let totalDeleted = 0;

    for (const patternInfo of this.cleanupStats.patterns) {
      console.log(`\n  🗑️  Processing pattern: ${patternInfo.pattern}`);
      
      // Get all keys for this pattern
      const allKeys = await this.scanKeys(patternInfo.pattern);
      
      if (confirmCleanup && allKeys.length > 0) {
        try {
          // Delete keys in batches for performance
          const batchSize = 50;
          for (let i = 0; i < allKeys.length; i += batchSize) {
            const batch = allKeys.slice(i, i + batchSize);
            const deleted = await this.client.del(batch);
            totalDeleted += deleted;
            
            console.log(`    ✅ Deleted ${deleted}/${batch.length} keys (batch ${Math.floor(i/batchSize) + 1})`);
          }
          
        } catch (error) {
          console.error(`    ❌ Error deleting keys for pattern ${patternInfo.pattern}:`, error.message);
          this.cleanupStats.errors++;
        }
      } else {
        console.log(`    📝 Would delete ${allKeys.length} keys (dry run)`);
      }
    }

    this.cleanupStats.keysDeleted = totalDeleted;

    if (confirmCleanup) {
      console.log(`\n✅ Cleanup completed! Deleted ${totalDeleted} conflicting keys`);
    } else {
      console.log(`\n📋 Dry run completed! Found ${this.cleanupStats.keysFound} keys that would be deleted`);
    }
  }

  /**
   * Verify Redis is clean and ready
   */
  async verifyCleanup() {
    console.log('\n🔍 Verifying Redis cleanup...');
    
    // Test basic operations
    const testKey = 'safestreets:test:cleanup:verification';
    
    try {
      // Test SET
      await this.client.set(testKey, 'test_value', 'EX', 60);
      console.log('  ✅ SET operation successful');
      
      // Test GET
      const value = await this.client.get(testKey);
      if (value === 'test_value') {
        console.log('  ✅ GET operation successful');
      } else {
        throw new Error('GET returned unexpected value');
      }
      
      // Test INCR (the problematic operation)
      const incrKey = 'safestreets:test:incr:verification';
      await this.client.set(incrKey, '0');
      const incrResult = await this.client.incr(incrKey);
      
      if (incrResult === 1) {
        console.log('  ✅ INCR operation successful');
      } else {
        throw new Error('INCR returned unexpected result');
      }
      
      // Test rate limiting simulation
      const rateLimitKey = 'safestreets:ratelimit:test:127.0.0.1';
      const current = await this.client.incr(rateLimitKey);
      await this.client.expire(rateLimitKey, 60);
      
      console.log(`  ✅ Rate limiting test successful (count: ${current})`);
      
      // Cleanup test keys
      await this.client.del([testKey, incrKey, rateLimitKey]);
      console.log('  ✅ Test keys cleaned up');
      
    } catch (error) {
      console.error('  ❌ Verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Display final report
   */
  displayReport() {
    console.log('\n🎯 REDIS CLEANUP REPORT');
    console.log('=' * 40);
    console.log(`📊 Keys Found: ${this.cleanupStats.keysFound}`);
    console.log(`🗑️  Keys Deleted: ${this.cleanupStats.keysDeleted}`);
    console.log(`❌ Errors: ${this.cleanupStats.errors}`);
    console.log(`🔍 Patterns Scanned: ${this.cleanupStats.patterns.length}`);

    if (this.cleanupStats.patterns.length > 0) {
      console.log('\n📋 Pattern Details:');
      this.cleanupStats.patterns.forEach(p => {
        console.log(`   ${p.pattern}: ${p.count} keys`);
      });
    }

    if (this.cleanupStats.keysDeleted > 0) {
      console.log('\n🚀 NEXT STEPS:');
      console.log('   1. Restart your backend server: npm run dev');
      console.log('   2. Run load tests to verify: npm run test:heavy-normal');
      console.log('   3. Expected: Error rate drops from 46% to <20%');
    } else if (this.cleanupStats.keysFound === 0) {
      console.log('\n✅ No conflicting keys found - Redis is clean!');
      console.log('   The error might be caused by active express-rate-limit middleware');
      console.log('   Check the reports route for conflicting rate limiters');
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup() {
    if (this.client) {
      try {
        await this.client.disconnect();
        console.log('\n✅ Disconnected from Redis');
      } catch (error) {
        console.error('❌ Error disconnecting from Redis:', error);
      }
    }
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      await this.initialize();
      
      const hasProblematicKeys = await this.scanProblematicKeys();
      
      if (hasProblematicKeys) {
        await this.analyzeKeyConflicts();
        await this.cleanupConflictingKeys();
      } else {
        console.log('✅ No problematic keys found in Redis');
      }
      
      await this.verifyCleanup();
      this.displayReport();
      
      console.log('\n🎉 Redis cleanup completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Redis cleanup failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
if (require.main === module) {
  const fixer = new RedisConflictFixer();
  fixer.run().catch(console.error);
}

module.exports = RedisConflictFixer;