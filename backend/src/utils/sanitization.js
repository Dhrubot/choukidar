// === backend/src/utils/sanitization.js ===
// Input Sanitization Utility for SafeStreets Bangladesh
// Fixes critical security vulnerabilities identified in the audit

const { body, param, query, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

/**
 * Comprehensive Input Sanitization System
 * Handles: XSS prevention, SQL injection, NoSQL injection, file upload security
 */
class InputSanitizer {
  constructor() {
    this.xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>/gi,
      /<link[^>]*>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /onclick=/gi,
      /onmouseover=/gi
    ];

    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|#|\/\*|\*\/)/g,
      /('|('')|;|%|_)/g
    ];

    this.noSqlInjectionPatterns = [
      /\$where/gi,
      /\$ne/gi,
      /\$in/gi,
      /\$nin/gi,
      /\$or/gi,
      /\$and/gi,
      /\$not/gi,
      /\$nor/gi,
      /\$exists/gi,
      /\$type/gi,
      /\$mod/gi,
      /\$regex/gi,
      /\$text/gi,
      /\$search/gi
    ];

    this.allowedFileTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mp3',
      'audio/wav'
    ];

    this.maxFileSizes = {
      image: 5 * 1024 * 1024,    // 5MB for images
      video: 50 * 1024 * 1024,   // 50MB for videos
      audio: 10 * 1024 * 1024    // 10MB for audio
    };
  }

  /**
   * Sanitize text input to prevent XSS
   */
  sanitizeText(input, options = {}) {
    if (!input || typeof input !== 'string') return input;

    const {
      allowHTML = false,
      maxLength = 10000,
      stripTags = true,
      normalizeWhitespace = true
    } = options;

    let sanitized = input;

    try {
      // Basic XSS prevention
      if (!allowHTML) {
        // Remove potential XSS patterns
        this.xssPatterns.forEach(pattern => {
          sanitized = sanitized.replace(pattern, '');
        });

        // Escape HTML entities
        sanitized = validator.escape(sanitized);
      } else {
        // Use DOMPurify for safe HTML
        sanitized = DOMPurify.sanitize(sanitized, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
          ALLOWED_ATTR: ['href'],
          ALLOW_DATA_ATTR: false
        });
      }

      // Strip HTML tags if requested
      if (stripTags && !allowHTML) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      }

      // Normalize whitespace
      if (normalizeWhitespace) {
        sanitized = sanitized.replace(/\s+/g, ' ').trim();
      }

      // Truncate to max length
      if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
      }

      return sanitized;

    } catch (error) {
      console.error('❌ Text sanitization error:', error);
      return ''; // Return empty string on error for safety
    }
  }

  /**
   * Sanitize MongoDB queries to prevent NoSQL injection
   */
  sanitizeMongoQuery(query) {
    if (!query || typeof query !== 'object') return query;

    try {
      const sanitized = JSON.parse(JSON.stringify(query));

      // Recursively sanitize object
      const sanitizeObject = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(item => sanitizeObject(item));
        }

        if (obj && typeof obj === 'object') {
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            // Check for dangerous operators
            if (typeof key === 'string' && this.noSqlInjectionPatterns.some(pattern => pattern.test(key))) {
              console.warn(`⚠️ Potentially dangerous MongoDB operator blocked: ${key}`);
              continue;
            }

            // Sanitize key
            const cleanKey = this.sanitizeText(key, { allowHTML: false, stripTags: true });

            // Recursively sanitize value
            if (typeof value === 'string') {
              cleaned[cleanKey] = this.sanitizeText(value, { allowHTML: false });
            } else if (typeof value === 'object') {
              cleaned[cleanKey] = sanitizeObject(value);
            } else {
              cleaned[cleanKey] = value;
            }
          }
          return cleaned;
        }

        return obj;
      };

      return sanitizeObject(sanitized);

    } catch (error) {
      console.error('❌ MongoDB query sanitization error:', error);
      return {}; // Return empty object on error for safety
    }
  }

  /**
   * Sanitize coordinates for location data
   */
  sanitizeCoordinates(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new Error('Invalid coordinates format');
    }

    const [lng, lat] = coordinates;

    // Validate longitude
    if (!validator.isFloat(lng.toString(), { min: -180, max: 180 })) {
      throw new Error('Invalid longitude');
    }

    // Validate latitude  
    if (!validator.isFloat(lat.toString(), { min: -90, max: 90 })) {
      throw new Error('Invalid latitude');
    }

    // Check if coordinates are within Bangladesh bounds (approximately)
    const bangladeshBounds = {
      minLng: 88.0,
      maxLng: 92.8,
      minLat: 20.3,
      maxLat: 26.8
    };

    const isInBangladesh = 
      lng >= bangladeshBounds.minLng && lng <= bangladeshBounds.maxLng &&
      lat >= bangladeshBounds.minLat && lat <= bangladeshBounds.maxLat;

    return {
      coordinates: [parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))],
      isInBangladesh,
      validated: true
    };
  }

  /**
   * Sanitize file uploads
   */
  sanitizeFile(file, type = 'image') {
    if (!file) {
      throw new Error('No file provided');
    }

    const errors = [];

    // Check file type
    if (!this.allowedFileTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed`);
    }

    // Check file size
    const maxSize = this.maxFileSizes[type] || this.maxFileSizes.image;
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${maxSize} bytes`);
    }

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(file.originalname);

    // Check for suspicious file content (basic)
    if (this.containsSuspiciousContent(file.buffer)) {
      errors.push('File contains suspicious content');
    }

    if (errors.length > 0) {
      throw new Error(`File validation failed: ${errors.join(', ')}`);
    }

    return {
      originalname: sanitizedFilename,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      validated: true
    };
  }

  /**
   * Sanitize filename
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    // Remove dangerous characters
    let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Remove multiple consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_');
    
    // Ensure file has an extension
    if (!sanitized.includes('.')) {
      sanitized += '.unknown';
    }

    // Limit length
    if (sanitized.length > 100) {
      const extension = sanitized.split('.').pop();
      sanitized = sanitized.substring(0, 95) + '.' + extension;
    }

    return sanitized;
  }

  /**
   * Check for suspicious file content
   */
  containsSuspiciousContent(buffer) {
    if (!buffer) return false;

    try {
      const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
      
      // Check for script tags
      if (/<script|javascript:|vbscript:/i.test(content)) {
        return true;
      }

      // Check for PHP tags
      if (/<\?php|<\?=/i.test(content)) {
        return true;
      }

      // Check for executable signatures
      const executableSignatures = [
        'MZ',      // Windows PE
        '\x7fELF', // Linux ELF
        '#!/bin/', // Shell scripts
      ];

      for (const signature of executableSignatures) {
        if (content.startsWith(signature)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Error checking file content:', error);
      return true; // Err on the side of caution
    }
  }

  /**
   * Sanitize email addresses
   */
  sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid email format');
    }

    const sanitized = email.toLowerCase().trim();

    if (!validator.isEmail(sanitized)) {
      throw new Error('Invalid email address');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\+.*@/,     // Plus addressing (can be used for bypassing)
      /\.{2,}/,    // Multiple consecutive dots
      /@.*@/,      // Multiple @ symbols
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        console.warn(`⚠️ Suspicious email pattern detected: ${sanitized}`);
      }
    }

    return sanitized;
  }

  /**
   * Sanitize phone numbers
   */
  sanitizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Invalid phone number format');
    }

    // Remove all non-digit characters except +
    let sanitized = phone.replace(/[^\d+]/g, '');

    // Bangladesh phone number validation
    const bangladeshPatterns = [
      /^\+8801[3-9]\d{8}$/,    // +880 followed by valid mobile
      /^01[3-9]\d{8}$/,        // Local format
      /^8801[3-9]\d{8}$/       // Without + prefix
    ];

    const isValidBangladeshi = bangladeshPatterns.some(pattern => pattern.test(sanitized));

    if (!isValidBangladeshi) {
      throw new Error('Invalid Bangladesh phone number');
    }

    // Normalize to international format
    if (sanitized.startsWith('01')) {
      sanitized = '+880' + sanitized;
    } else if (sanitized.startsWith('8801')) {
      sanitized = '+' + sanitized;
    }

    return sanitized;
  }

  /**
   * Sanitize URL inputs
   */
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL format');
    }

    const sanitized = url.trim();

    if (!validator.isURL(sanitized, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_host: true,
      require_valid_protocol: true
    })) {
      throw new Error('Invalid URL');
    }

    // Check for suspicious domains
    const suspiciousDomains = [
      'bit.ly',
      'tinyurl.com',
      't.co',
      'short.link'
    ];

    const domain = new URL(sanitized).hostname;
    if (suspiciousDomains.some(suspicious => domain.includes(suspicious))) {
      console.warn(`⚠️ Suspicious URL domain detected: ${domain}`);
    }

    return sanitized;
  }

  /**
   * Express validation rules generator
   */
  generateValidationRules() {
    return {
      // Report submission validation
      reportSubmission: [
        body('type')
          .isIn(['chadabaji', 'teen_gang', 'chintai', 'other', 'eve_teasing', 'stalking', 'inappropriate_touch', 'verbal_harassment', 'unsafe_transport', 'workplace_harassment', 'domestic_incident', 'unsafe_area_women'])
          .withMessage('Invalid incident type'),
        
        body('description')
          .isLength({ min: 10, max: 1000 })
          .withMessage('Description must be between 10-1000 characters')
          .custom((value) => {
            return this.sanitizeText(value, { maxLength: 1000 });
          }),
        
        body('location.coordinates')
          .isArray({ min: 2, max: 2 })
          .withMessage('Coordinates must be [longitude, latitude]')
          .custom((value) => {
            const result = this.sanitizeCoordinates(value);
            return result.validated;
          }),
        
        body('severity')
          .isInt({ min: 1, max: 5 })
          .withMessage('Severity must be between 1-5'),
        
        body('anonymous')
          .optional()
          .isBoolean()
          .withMessage('Anonymous must be boolean')
      ],

      // Admin login validation
      adminLogin: [
        body('username')
          .isLength({ min: 3, max: 50 })
          .withMessage('Username must be between 3-50 characters')
          .custom((value) => {
            return this.sanitizeText(value, { allowHTML: false, stripTags: true });
          }),
        
        body('password')
          .isLength({ min: 8, max: 128 })
          .withMessage('Password must be between 8-128 characters'),
        
        body('deviceFingerprint')
          .optional()
          .isLength({ max: 1000 })
          .withMessage('Device fingerprint too long')
      ],

      // Safe zone creation validation
      safeZoneCreation: [
        body('name')
          .isLength({ min: 3, max: 100 })
          .withMessage('Name must be between 3-100 characters')
          .custom((value) => {
            return this.sanitizeText(value, { maxLength: 100 });
          }),
        
        body('description')
          .isLength({ min: 10, max: 500 })
          .withMessage('Description must be between 10-500 characters')
          .custom((value) => {
            return this.sanitizeText(value, { maxLength: 500 });
          }),
        
        body('location.coordinates')
          .isArray({ min: 2, max: 2 })
          .withMessage('Coordinates must be [longitude, latitude]')
          .custom((value) => {
            const result = this.sanitizeCoordinates(value);
            return result.validated;
          }),
        
        body('safetyScore')
          .isInt({ min: 1, max: 10 })
          .withMessage('Safety score must be between 1-10'),
        
        body('zoneType')
          .isIn(['police_station', 'hospital', 'school', 'shopping_center', 'residential_safe', 'transport_hub', 'community_center', 'government_office'])
          .withMessage('Invalid zone type')
      ],

      // User management validation
      userManagement: [
        body('email')
          .optional()
          .isEmail()
          .withMessage('Invalid email address')
          .custom((value) => {
            return this.sanitizeEmail(value);
          }),
        
        body('phoneNumber')
          .optional()
          .custom((value) => {
            if (value) {
              return this.sanitizePhoneNumber(value);
            }
            return true;
          }),
        
        param('userId')
          .isMongoId()
          .withMessage('Invalid user ID format'),
        
        query('limit')
          .optional()
          .isInt({ min: 1, max: 100 })
          .withMessage('Limit must be between 1-100'),
        
        query('offset')
          .optional()
          .isInt({ min: 0 })
          .withMessage('Offset must be non-negative')
      ]
    };
  }

  /**
   * Express middleware for input sanitization
   */
  sanitizationMiddleware() {
    return (req, res, next) => {
      try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
          req.body = this.sanitizeMongoQuery(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
          for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
              req.query[key] = this.sanitizeText(value, { allowHTML: false });
            }
          }
        }

        // Sanitize URL parameters
        if (req.params && typeof req.params === 'object') {
          for (const [key, value] of Object.entries(req.params)) {
            if (typeof value === 'string') {
              req.params[key] = this.sanitizeText(value, { allowHTML: false });
            }
          }
        }

        next();
      } catch (error) {
        console.error('❌ Input sanitization error:', error);
        return res.status(400).json({
          success: false,
          message: 'Invalid input data',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    };
  }

  /**
   * Validation error handler middleware
   */
  validationErrorHandler() {
    return (req, res, next) => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          value: error.value
        }));

        console.warn('⚠️ Validation errors:', errorMessages);

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errorMessages
        });
      }

      next();
    };
  }

  /**
   * File upload validation middleware
   */
  fileUploadValidation(fileType = 'image') {
    return (req, res, next) => {
      try {
        if (!req.file && !req.files) {
          return next(); // No file uploaded, continue
        }

        const files = req.files || [req.file];
        const validatedFiles = [];

        for (const file of files) {
          const validated = this.sanitizeFile(file, fileType);
          validatedFiles.push(validated);
        }

        // Replace original files with validated ones
        if (req.files) {
          req.files = validatedFiles;
        } else {
          req.file = validatedFiles[0];
        }

        next();
      } catch (error) {
        console.error('❌ File validation error:', error);
        return res.status(400).json({
          success: false,
          message: 'File validation failed',
          error: error.message
        });
      }
    };
  }

  /**
   * Rate limiting by IP and user
   */
  createRateLimitKey(req, type = 'general') {
    const ip = req.ip || 'unknown';
    const userId = req.userContext?.user?._id || 'anonymous';
    const deviceFingerprint = req.userContext?.deviceFingerprint?.fingerprintId || 'unknown';
    
    return `ratelimit:${type}:${ip}:${userId}:${deviceFingerprint}`;
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req, res, next) => {
      // Prevent XSS
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Content Security Policy
      res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' wss: ws:; " +
        "font-src 'self' https:; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "frame-src 'none'"
      );
      
      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      
      next();
    };
  }

  /**
   * Audit logging for security events
   */
  async logSecurityEvent(req, eventType, details = {}) {
    try {
      const AuditLog = require('../models/AuditLog');
      
      await AuditLog.create({
        actor: {
          userId: req.userContext?.user?._id,
          userType: req.userContext?.userType || 'anonymous',
          deviceFingerprint: req.userContext?.deviceFingerprint?.fingerprintId,
          ipAddress: req.ip
        },
        actionType: eventType,
        details: {
          url: req.originalUrl,
          method: req.method,
          userAgent: req.get('User-Agent'),
          ...details
        },
        outcome: 'success',
        severity: 'medium'
      });
    } catch (error) {
      console.error('❌ Failed to log security event:', error);
    }
  }
}

// Export singleton instance
const inputSanitizer = new InputSanitizer();

module.exports = {
  InputSanitizer,
  inputSanitizer,
  
  // Direct access to common methods
  sanitizeText: (input, options) => inputSanitizer.sanitizeText(input, options),
  sanitizeMongoQuery: (query) => inputSanitizer.sanitizeMongoQuery(query),
  sanitizeCoordinates: (coords) => inputSanitizer.sanitizeCoordinates(coords),
  sanitizeFile: (file, type) => inputSanitizer.sanitizeFile(file, type),
  sanitizeEmail: (email) => inputSanitizer.sanitizeEmail(email),
  
  // Middleware exports
  sanitizationMiddleware: () => inputSanitizer.sanitizationMiddleware(),
  validationErrorHandler: () => inputSanitizer.validationErrorHandler(),
  fileUploadValidation: (type) => inputSanitizer.fileUploadValidation(type),
  securityHeaders: () => inputSanitizer.securityHeaders(),
  
  // Validation rules
  validationRules: inputSanitizer.generateValidationRules()
};