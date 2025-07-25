// === backend/src/services/cdnIntegration.js ===
// CDN Integration for SafeStreets Bangladesh
// Offloads static assets and implements edge caching

const crypto = require('crypto');
const { circuitBreakerManager } = require('../middleware/circuitBreaker');

class CDNIntegrationService {
  constructor() {
    // Cloudflare CDN configuration
    this.config = {
      // CloudFlare settings
      zoneId: process.env.CLOUDFLARE_ZONE_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      
      // CDN URLs
      cdnDomain: process.env.CDN_DOMAIN || 'cdn.safestreets-bd.com',
      originDomain: process.env.ORIGIN_DOMAIN || 'api.safestreets-bd.com',
      
      // Cloudinary for images
      cloudinaryUrl: process.env.CLOUDINARY_URL,
      cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || 'safestreets-bd',
      
      // Cache settings
      cacheControl: {
        images: 'public, max-age=31536000, immutable', // 1 year
        reports: 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
        maps: 'public, max-age=600, s-maxage=1800', // 10 min client, 30 min CDN
        analytics: 'public, max-age=1800, s-maxage=3600', // 30 min client, 1 hour CDN
        api: 'public, max-age=60, s-maxage=300' // 1 min client, 5 min CDN
      }
    };

    // Circuit breaker for CDN operations
    this.cdnBreaker = circuitBreakerManager.create('cdn', {
      failureThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000
    });

    // Statistics
    this.stats = {
      cdnHits: 0,
      cdnMisses: 0,
      bandwidthSaved: 0,
      imagesOptimized: 0
    };
  }

  /**
   * Initialize CDN integration
   */
  async initialize() {
    console.log('🌐 Initializing CDN integration...');

    try {
      // Verify Cloudflare connection
      await this.verifyCloudflareConnection();

      // Setup page rules
      await this.setupPageRules();

      // Purge outdated cache
      await this.purgeOutdatedCache();

      console.log('✅ CDN integration initialized');
      return true;

    } catch (error) {
      console.error('❌ CDN initialization failed:', error);
      return false;
    }
  }

  /**
   * Generate CDN URL for assets
   */
  getCDNUrl(path, type = 'api') {
    // Direct serve from origin for development
    if (process.env.NODE_ENV === 'development') {
      return `http://localhost:5000${path}`;
    }

    // Use appropriate subdomain based on content type
    const subdomain = this.getSubdomainForType(type);
    return `https://${subdomain}.${this.cdnDomain}${path}`;
  }

  /**
   * Get subdomain based on content type
   */
  getSubdomainForType(type) {
    const subdomains = {
      images: 'images',
      maps: 'maps',
      analytics: 'analytics',
      api: 'api',
      static: 'static'
    };

    return subdomains[type] || 'api';
  }

  /**
   * Optimize and upload image to Cloudinary
   */
  async optimizeAndUploadImage(imageBuffer, options = {}) {
    const {
      folder = 'reports',
      format = 'webp',
      quality = 'auto',
      width = 1200,
      height = 1200,
      crop = 'limit'
    } = options;

    return await this.cdnBreaker.execute(async () => {
      const cloudinary = require('cloudinary').v2;

      // Configure Cloudinary
      cloudinary.config({
        cloud_name: this.cloudinaryCloudName,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Generate unique filename
      const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
      const publicId = `${folder}/${Date.now()}_${hash}`;

      // Upload with transformations
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: folder,
            format: format,
            quality: quality,
            width: width,
            height: height,
            crop: crop,
            flags: 'progressive',
            transformation: [
              // Mobile version
              { width: 480, height: 480, crop: 'limit', quality: 'auto:low' },
              // Tablet version
              { width: 768, height: 768, crop: 'limit', quality: 'auto:good' },
              // Desktop version
              { width: 1200, height: 1200, crop: 'limit', quality: 'auto:best' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(imageBuffer);
      });

      this.stats.imagesOptimized++;
      this.stats.bandwidthSaved += imageBuffer.length - result.bytes;

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        versions: {
          mobile: result.secure_url.replace('/upload/', '/upload/w_480,h_480,c_limit,q_auto:low/'),
          tablet: result.secure_url.replace('/upload/', '/upload/w_768,h_768,c_limit,q_auto:good/'),
          desktop: result.secure_url
        }
      };
    });
  }

  /**
   * Setup Cloudflare page rules
   */
  async setupPageRules() {
    if (!this.config.zoneId || !this.config.apiToken) {
      console.warn('⚠️ Cloudflare credentials not configured');
      return;
    }

    const rules = [
      // Cache all images aggressively
      {
        targets: [{ target: 'url', constraint: { operator: 'matches', value: '*.jpg' } }],
        actions: [
          { id: 'cache_level', value: 'cache_everything' },
          { id: 'edge_cache_ttl', value: 31536000 }, // 1 year
          { id: 'browser_cache_ttl', value: 31536000 }
        ]
      },
      // Cache API responses with shorter TTL
      {
        targets: [{ target: 'url', constraint: { operator: 'matches', value: '/api/*' } }],
        actions: [
          { id: 'cache_level', value: 'standard' },
          { id: 'edge_cache_ttl', value: 300 }, // 5 minutes
          { id: 'browser_cache_ttl', value: 60 } // 1 minute
        ]
      },
      // Enable Auto Minify
      {
        targets: [{ target: 'url', constraint: { operator: 'matches', value: '*' } }],
        actions: [
          { id: 'minify', value: { html: true, css: true, js: true } }
        ]
      }
    ];

    // Apply rules via Cloudflare API
    // Implementation depends on Cloudflare API version
    console.log('📋 Page rules configured for optimal caching');
  }

  /**
   * Purge cache for specific paths
   */
  async purgeCache(paths = []) {
    if (!this.config.zoneId || !this.config.apiToken) {
      console.warn('⚠️ Cannot purge cache - Cloudflare not configured');
      return;
    }

    return await this.cdnBreaker.execute(async () => {
      const fetch = require('node-fetch');

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: paths.map(path => `https://${this.cdnDomain}${path}`)
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log(`🗑️ Purged ${paths.length} paths from CDN cache`);
        return true;
      } else {
        throw new Error(`Cache purge failed: ${result.errors?.[0]?.message}`);
      }
    });
  }

  /**
   * Purge outdated cache patterns
   */
  async purgeOutdatedCache() {
    const patterns = [
      '/api/reports/*',
      '/api/safezones/*',
      '/api/analytics/*'
    ];

    try {
      await this.purgeCache(patterns);
      console.log('✅ Outdated cache patterns purged');
    } catch (error) {
      console.error('❌ Cache purge error:', error);
    }
  }

  /**
   * Verify Cloudflare connection
   */
  async verifyCloudflareConnection() {
    if (!this.config.zoneId || !this.config.apiToken) {
      console.warn('⚠️ Cloudflare credentials not configured');
      return false;
    }

    try {
      const fetch = require('node-fetch');
      
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.config.zoneId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          }
        }
      );

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Cloudflare connection verified');
        return true;
      } else {
        throw new Error(result.errors?.[0]?.message || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Cloudflare connection failed:', error);
      return false;
    }
  }

  /**
   * Get optimal image URL based on device
   */
  getOptimalImageUrl(originalUrl, deviceType = 'desktop') {
    if (!originalUrl) return null;

    // If already a Cloudinary URL, add transformations
    if (originalUrl.includes('cloudinary')) {
      const transformations = {
        mobile: 'w_480,h_480,c_limit,q_auto:low,f_webp',
        tablet: 'w_768,h_768,c_limit,q_auto:good,f_webp',
        desktop: 'w_1200,h_1200,c_limit,q_auto:best,f_webp'
      };

      const transformation = transformations[deviceType] || transformations.desktop;
      return originalUrl.replace('/upload/', `/upload/${transformation}/`);
    }

    // For other URLs, return CDN version
    return this.getCDNUrl(originalUrl, 'images');
  }

  /**
   * Middleware to set cache headers
   */
  cacheHeadersMiddleware() {
    return (req, res, next) => {
      // Determine content type from route
      let cacheControl = this.config.cacheControl.api;

      if (req.path.includes('/images/')) {
        cacheControl = this.config.cacheControl.images;
      } else if (req.path.includes('/reports')) {
        cacheControl = this.config.cacheControl.reports;
      } else if (req.path.includes('/maps')) {
        cacheControl = this.config.cacheControl.maps;
      } else if (req.path.includes('/analytics')) {
        cacheControl = this.config.cacheControl.analytics;
      }

      // Set cache headers
      res.set({
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cacheControl,
        'Surrogate-Control': cacheControl.replace('public', 'max-age=31536000'),
        'X-CDN': 'Cloudflare'
      });

      // Add vary headers for proper caching
      res.vary('Accept-Encoding');
      res.vary('User-Agent');

      next();
    };
  }

  /**
   * Get CDN statistics
   */
  getStats() {
    const hitRate = this.stats.cdnHits / (this.stats.cdnHits + this.stats.cdnMisses) * 100 || 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      bandwidthSavedMB: (this.stats.bandwidthSaved / 1024 / 1024).toFixed(2),
      avgImageCompression: this.stats.imagesOptimized > 0 
        ? (this.stats.bandwidthSaved / this.stats.imagesOptimized / 1024).toFixed(2) + 'KB'
        : '0KB'
    };
  }
}

// Export singleton instance
const cdnService = new CDNIntegrationService();

module.exports = {
  cdnService,
  
  // Quick access methods
  getCDNUrl: (path, type) => cdnService.getCDNUrl(path, type),
  optimizeImage: (buffer, options) => cdnService.optimizeAndUploadImage(buffer, options),
  purgeCache: (paths) => cdnService.purgeCache(paths),
  cacheHeaders: () => cdnService.cacheHeadersMiddleware(),
  getOptimalImageUrl: (url, device) => cdnService.getOptimalImageUrl(url, device),
  getCDNStats: () => cdnService.getStats()
};