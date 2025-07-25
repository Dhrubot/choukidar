// === backend/src/config/securityOptimizations.js ===
// Security Layer Optimizations for SafeStreets Bangladesh
// Balances security with performance for 8000+ users

const crypto = require('crypto');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { redisCluster } = require('./redisCluster');

class SecurityOptimizer {
  constructor() {
    // Security configuration optimized for performance
    this.config = {
      // Rate limiting tiers
      rateLimiting: {
        global: { points: 1000, duration: 60 }, // 1000 requests per minute globally
        api: { points: 100, duration: 60 }, // 100 API calls per minute
        auth: { points: 5, duration: 300 }, // 5 auth attempts per 5 minutes
        reports: { points: 10, duration: 3600 }, // 10 reports per hour
        uploads: { points: 20, duration: 3600 }, // 20 uploads per hour
        
        // Burst allowance
        burst: {
          enabled: true,
          multiplier: 2,
          duration: 10 // 10 second burst window
        }
      },

      // DDoS protection
      ddosProtection: {
        enabled: true,
        maxConcurrentConnections: 10000,
        connectionTimeout: 30000, // 30 seconds
        blacklistDuration: 3600000, // 1 hour
        
        // Thresholds
        thresholds: {
          requestsPerSecond: 100,
          connectionsPerIP: 50,
          payloadSize: 10485760 // 10MB
        }
      },

      // Request validation
      validation: {
        maxUrlLength: 2048,
        maxHeaderSize: 8192,
        maxBodySize: 10485760, // 10MB
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        
        // Content Security Policy
        csp: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },

      // Authentication optimization
      auth: {
        tokenCache: true,
        tokenCacheTTL: 300, // 5 minutes
        sessionTimeout: 86400, // 24 hours
        refreshTokenRotation: true,
        
        // JWT optimization
        jwt: {
          algorithm: 'RS256', // Asymmetric for better security
          expiresIn: '15m',
          refreshExpiresIn: '7d',
          issuer: 'safestreets-bd',
          audience: 'safestreets-api'
        }
      },

      // Geo-blocking
      geoBlocking: {
        enabled: false, // Disabled by default
        allowedCountries: ['BD'], // Bangladesh only
        blockedIPs: new Set(),
        trustedProxies: ['127.0.0.1', '::1']
      }
    };

    // Rate limiters
    this.rateLimiters = new Map();
    
    // Security statistics
    this.stats = {
      blockedRequests: 0,
      rateLimitHits: 0,
      authFailures: 0,
      suspiciousActivities: 0,
      ddosAttempts: 0
    };

    // IP tracking for DDoS protection
    this.ipTracking = new Map();
    this.blacklist = new Set();
  }

  /**
   * Initialize security optimizations
   */
  async initialize() {
    console.log('🚀 Initializing security optimizations...');

    try {
      // Setup rate limiters
      await this.setupRateLimiters();

      // Initialize JWT keys
      this.initializeJWTKeys();

      // Start security monitoring
      this.startSecurityMonitoring();

      console.log('✅ Security optimizations initialized');
      return true;

    } catch (error) {
      console.error('❌ Security initialization failed:', error);
      return false;
    }
  }

  /**
   * Setup distributed rate limiters
   */
  async setupRateLimiters() {
    const redis = await redisCluster.getClient('ratelimit');

    // Create rate limiters for each tier
    for (const [tier, config] of Object.entries(this.config.rateLimiting)) {
      if (tier === 'burst') continue;

      try {
        const limiter = new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: `rl:${tier}`,
          points: config.points,
          duration: config.duration,
          blockDuration: config.duration,
          execEvenly: true // Spread requests evenly
        });

        this.rateLimiters.set(tier, limiter);
        console.log(`✅ Rate limiter created: ${tier} (${config.points}/${config.duration}s)`);

      } catch (error) {
        // Fallback to memory limiter
        console.warn(`⚠️ Redis limiter failed for ${tier}, using memory fallback`);
        
        const limiter = new RateLimiterMemory({
          points: config.points,
          duration: config.duration,
          blockDuration: config.duration
        });

        this.rateLimiters.set(tier, limiter);
      }
    }
  }

  /**
   * Initialize JWT keys for performance
   */
  initializeJWTKeys() {
    if (!this.jwtKeys) {
      // Generate or load RSA keys
      this.jwtKeys = {
        private: process.env.JWT_PRIVATE_KEY || this.generateRSAKey(),
        public: process.env.JWT_PUBLIC_KEY || this.generateRSAKey(true)
      };
    }
  }

  /**
   * Generate RSA key pair
   */
  generateRSAKey(publicOnly = false) {
    const { generateKeyPairSync } = require('crypto');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return publicOnly ? publicKey : privateKey;
  }

  /**
   * Optimized rate limiting middleware
   */
  rateLimitMiddleware(tier = 'api') {
    const limiter = this.rateLimiters.get(tier);
    
    if (!limiter) {
      console.warn(`⚠️ No rate limiter found for tier: ${tier}`);
      return (req, res, next) => next();
    }

    return async (req, res, next) => {
      try {
        // Get identifier
        const key = this.getRateLimitKey(req, tier);

        // Check burst allowance
        if (this.config.rateLimiting.burst.enabled) {
          const burstKey = `${key}:burst`;
          const burstLimiter = this.getBurstLimiter(tier);
          
          try {
            await burstLimiter.consume(burstKey);
          } catch (burstError) {
            // Burst limit exceeded, check normal limit
          }
        }

        // Consume rate limit point
        const rateLimitRes = await limiter.consume(key);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': limiter.points,
          'X-RateLimit-Remaining': rateLimitRes.remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString()
        });

        next();

      } catch (rateLimitError) {
        this.stats.rateLimitHits++;

        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.round(rateLimitError.msBeforeNext / 1000) || 60
        });
      }
    };
  }

  /**
   * Get rate limit key based on request
   */
  getRateLimitKey(req, tier) {
    // Use different identifiers based on tier
    let identifier = req.ip;

    if (tier === 'auth' && req.body?.username) {
      identifier = `${req.ip}:${req.body.username}`;
    } else if (req.userContext?.user?._id) {
      identifier = `user:${req.userContext.user._id}`;
    } else if (req.userContext?.deviceFingerprint) {
      identifier = `device:${req.userContext.deviceFingerprint}`;
    }

    return identifier;
  }

  /**
   * Get burst limiter
   */
  getBurstLimiter(tier) {
    const config = this.config.rateLimiting[tier];
    const burstPoints = config.points * this.config.rateLimiting.burst.multiplier;

    return new RateLimiterMemory({
      points: burstPoints,
      duration: this.config.rateLimiting.burst.duration
    });
  }

  /**
   * DDoS protection middleware
   */
  ddosProtectionMiddleware() {
    return (req, res, next) => {
      if (!this.config.ddosProtection.enabled) {
        return next();
      }

      const ip = req.ip;
      const now = Date.now();

      // Check blacklist
      if (this.blacklist.has(ip)) {
        this.stats.blockedRequests++;
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Track IP connections
      if (!this.ipTracking.has(ip)) {
        this.ipTracking.set(ip, {
          connections: 0,
          requests: 0,
          firstSeen: now,
          lastSeen: now
        });
      }

      const ipData = this.ipTracking.get(ip);
      ipData.requests++;
      ipData.lastSeen = now;

      // Check thresholds
      const timeDiff = (now - ipData.firstSeen) / 1000; // seconds
      const requestRate = ipData.requests / Math.max(timeDiff, 1);

      if (requestRate > this.config.ddosProtection.thresholds.requestsPerSecond) {
        this.blacklistIP(ip);
        this.stats.ddosAttempts++;
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded'
        });
      }

      // Check concurrent connections
      if (ipData.connections > this.config.ddosProtection.thresholds.connectionsPerIP) {
        return res.status(503).json({
          success: false,
          error: 'Too many connections'
        });
      }

      // Track connection
      ipData.connections++;
      
      // Clean up connection on response
      res.on('finish', () => {
        ipData.connections--;
      });

      next();
    };
  }

  /**
   * Blacklist an IP
   */
  blacklistIP(ip) {
    this.blacklist.add(ip);
    
    // Auto-remove from blacklist after duration
    setTimeout(() => {
      this.blacklist.delete(ip);
      this.ipTracking.delete(ip);
    }, this.config.ddosProtection.blacklistDuration);

    console.warn(`🚫 IP blacklisted: ${ip}`);
  }

  /**
   * Security headers middleware
   */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      // Basic security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(self), microphone=(), camera=()'
      });

      // Content Security Policy
      const csp = this.buildCSP();
      res.set('Content-Security-Policy', csp);

      next();
    };
  }

  /**
   * Build Content Security Policy
   */
  buildCSP() {
    const policy = [];
    
    for (const [directive, sources] of Object.entries(this.config.validation.csp)) {
      const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
      policy.push(`${kebabDirective} ${sources.join(' ')}`);
    }

    return policy.join('; ');
  }

  /**
   * Request validation middleware
   */
  requestValidationMiddleware() {
    return (req, res, next) => {
      // Validate URL length
      if (req.url.length > this.config.validation.maxUrlLength) {
        return res.status(414).json({
          success: false,
          error: 'URI too long'
        });
      }

      // Validate method
      if (!this.config.validation.allowedMethods.includes(req.method)) {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
      }

      // Validate headers size
      const headerSize = JSON.stringify(req.headers).length;
      if (headerSize > this.config.validation.maxHeaderSize) {
        return res.status(431).json({
          success: false,
          error: 'Request header fields too large'
        });
      }

      next();
    };
  }

  /**
   * Optimized authentication check
   */
  async checkAuthentication(token) {
    if (!token) return null;

    // Check token cache first
    const cacheKey = `auth:token:${crypto.createHash('md5').update(token).digest('hex')}`;
    
    if (this.config.auth.tokenCache) {
      const cached = await redisCluster.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      // Verify JWT
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, this.jwtKeys.public, {
        algorithms: [this.config.auth.jwt.algorithm],
        issuer: this.config.auth.jwt.issuer,
        audience: this.config.auth.jwt.audience
      });

      // Cache the result
      if (this.config.auth.tokenCache) {
        await redisCluster.set(
          cacheKey,
          JSON.stringify(decoded),
          this.config.auth.tokenCacheTTL
        );
      }

      return decoded;

    } catch (error) {
      this.stats.authFailures++;
      return null;
    }
  }

  /**
   * Geo-blocking middleware
   */
  geoBlockingMiddleware() {
    return async (req, res, next) => {
      if (!this.config.geoBlocking.enabled) {
        return next();
      }

      // Skip for trusted proxies
      if (this.config.geoBlocking.trustedProxies.includes(req.ip)) {
        return next();
      }

      // Check blocked IPs
      if (this.config.geoBlocking.blockedIPs.has(req.ip)) {
        this.stats.blockedRequests++;
        return res.status(403).json({
          success: false,
          error: 'Access denied from your location'
        });
      }

      // In production, use IP geolocation service
      // For now, we'll allow all Bangladesh IPs
      next();
    };
  }

  /**
   * Start security monitoring
   */
  startSecurityMonitoring() {
    // Clean up old IP tracking data
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.ddosProtection.connectionTimeout;

      for (const [ip, data] of this.ipTracking.entries()) {
        if (now - data.lastSeen > timeout && data.connections === 0) {
          this.ipTracking.delete(ip);
        }
      }
    }, 60000); // Every minute

    // Log security statistics
    setInterval(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔒 Security Stats:', this.getStats());
      }
    }, 300000); // Every 5 minutes
  }

  /**
   * Get security statistics
   */
  getStats() {
    const totalRequests = Object.values(this.stats).reduce((sum, val) => sum + val, 0);
    const blockRate = totalRequests > 0 
      ? ((this.stats.blockedRequests / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      totalRequests,
      blockRate: `${blockRate}%`,
      activeIPs: this.ipTracking.size,
      blacklistedIPs: this.blacklist.size,
      rateLimiters: this.rateLimiters.size
    };
  }

  /**
   * Security middleware stack
   */
  getSecurityMiddlewareStack() {
    return [
      this.requestValidationMiddleware(),
      this.securityHeadersMiddleware(),
      this.geoBlockingMiddleware(),
      this.ddosProtectionMiddleware(),
      this.rateLimitMiddleware('global')
    ];
  }
}

// Export singleton instance
const securityOptimizer = new SecurityOptimizer();

module.exports = {
  securityOptimizer,
  
  // Initialize
  initializeSecurity: () => securityOptimizer.initialize(),
  
  // Middleware factories
  rateLimiter: (tier) => securityOptimizer.rateLimitMiddleware(tier),
  ddosProtection: () => securityOptimizer.ddosProtectionMiddleware(),
  securityHeaders: () => securityOptimizer.securityHeadersMiddleware(),
  requestValidation: () => securityOptimizer.requestValidationMiddleware(),
  geoBlocking: () => securityOptimizer.geoBlockingMiddleware(),
  
  // Full security stack
  securityStack: () => securityOptimizer.getSecurityMiddlewareStack(),
  
  // Utilities
  checkAuth: (token) => securityOptimizer.checkAuthentication(token),
  blacklistIP: (ip) => securityOptimizer.blacklistIP(ip),
  getSecurityStats: () => securityOptimizer.getStats()
};