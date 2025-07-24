// === backend/src/utils/productionLogger.js ===
// Safe Production Logger for SafeStreets Bangladesh
// Fixes the sensitive information logging vulnerability identified in audit

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Production-Safe Logging System
 * Features: Sensitive data masking, structured logging, security event tracking
 */
class ProductionLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
    this.environment = process.env.NODE_ENV || 'development';
    this.logDirectory = process.env.LOG_DIRECTORY || './logs';
    this.maxLogFileSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    
    // Sensitive fields that should never be logged
    this.sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'sessionToken',
      'refreshToken',
      'apiKey',
      'secret',
      'twoFactorSecret',
      'passwordResetToken',
      'emailVerificationToken',
      'authorization',
      'cookie',
      'x-auth-token',
      'x-api-key'
    ];

    // PII fields that should be masked
    this.piiFields = [
      'email',
      'phoneNumber',
      'ipAddress',
      'deviceFingerprint',
      'userAgent',
      'location',
      'coordinates'
    ];

    // Initialize log directory
    this.initializeLogDirectory();
  }

  /**
   * Initialize logging directory
   */
  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      console.error('❌ Failed to create log directory:', error);
    }
  }

  /**
   * Determine if message should be logged based on level
   */
  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.logLevel];
  }

  /**
   * Mask sensitive information in objects
   */
  maskSensitiveData(obj, depth = 0) {
    if (depth > 5) return '[Deep Object]'; // Prevent infinite recursion

    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return this.maskSensitiveString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const masked = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Completely remove sensitive fields
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          masked[key] = '[REDACTED]';
          continue;
        }
        
        // Mask PII fields
        if (this.piiFields.some(field => lowerKey.includes(field))) {
          masked[key] = this.maskPII(value, key);
          continue;
        }
        
        // Recursively process nested objects
        masked[key] = this.maskSensitiveData(value, depth + 1);
      }
      
      return masked;
    }

    return obj;
  }

  /**
   * Mask sensitive strings
   */
  maskSensitiveString(str) {
    if (!str || typeof str !== 'string') return str;

    // Mask email addresses
    str = str.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
    
    // Mask phone numbers
    str = str.replace(/\+?[\d\s\-\(\)]{10,}/g, '[PHONE]');
    
    // Mask JWT tokens
    str = str.replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, '[JWT_TOKEN]');
    
    // Mask API keys (common patterns)
    str = str.replace(/[A-Za-z0-9]{32,}/g, (match) => {
      if (match.length >= 32) return '[API_KEY]';
      return match;
    });

    return str;
  }

  /**
   * Mask PII data based on field type
   */
  maskPII(value, fieldName) {
    if (!value) return value;

    const lowerField = fieldName.toLowerCase();

    if (lowerField.includes('email')) {
      return this.hashValue(value, 'email');
    }

    if (lowerField.includes('phone')) {
      return this.hashValue(value, 'phone');
    }

    if (lowerField.includes('ip')) {
      return this.maskIPAddress(value);
    }

    if (lowerField.includes('coordinate') || lowerField.includes('location')) {
      return this.maskLocation(value);
    }

    if (lowerField.includes('fingerprint')) {
      return this.hashValue(value, 'fingerprint');
    }

    if (lowerField.includes('useragent')) {
      return '[USER_AGENT]';
    }

    return '[PII]';
  }

  /**
   * Hash sensitive values for tracking while preserving privacy
   */
  hashValue(value, type) {
    if (!value) return value;
    
    const hash = crypto.createHash('sha256')
      .update(value.toString())
      .digest('hex')
      .substring(0, 8);
    
    return `[${type.toUpperCase()}_${hash}]`;
  }

  /**
   * Mask IP addresses
   */
  maskIPAddress(ip) {
    if (!ip) return ip;
    
    // IPv4: Show first two octets, mask last two
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    
    // IPv6: Show first 4 groups, mask the rest
    if (ip.includes(':')) {
      const parts = ip.split(':');
      return `${parts.slice(0, 4).join(':')}::xxxx`;
    }
    
    return '[IP_ADDRESS]';
  }

  /**
   * Mask location coordinates
   */
  maskLocation(location) {
    if (Array.isArray(location) && location.length === 2) {
      // Round coordinates to ~1km precision
      const [lng, lat] = location;
      return [
        Math.round(lng * 100) / 100,
        Math.round(lat * 100) / 100
      ];
    }
    
    if (typeof location === 'object' && location.coordinates) {
      return {
        ...location,
        coordinates: this.maskLocation(location.coordinates)
      };
    }
    
    return '[LOCATION]';
  }

  /**
   * Format log entry
   */
  formatLogEntry(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const maskedMetadata = this.maskSensitiveData(metadata);
    
    return {
      timestamp,
      level: level.toUpperCase(),
      environment: this.environment,
      pid: process.pid,
      message: this.maskSensitiveString(message),
      metadata: maskedMetadata,
      ...(this.environment === 'development' && { 
        stack: new Error().stack 
      })
    };
  }

  /**
   * Write log to file
   */
  async writeToFile(level, logEntry) {
    if (this.environment === 'development') return; // Only write files in production

    try {
      const filename = path.join(this.logDirectory, `${level}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      await fs.appendFile(filename, logLine);
      
      // Rotate logs if needed
      await this.rotateLogsIfNeeded(filename);
    } catch (error) {
      console.error('❌ Failed to write log file:', error);
    }
  }

  /**
   * Rotate log files when they get too large
   */
  async rotateLogsIfNeeded(filename) {
    try {
      const stats = await fs.stat(filename);
      
      if (stats.size > this.maxLogFileSize) {
        // Create rotated filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFilename = filename.replace('.log', `-${timestamp}.log`);
        
        // Move current log to rotated name
        await fs.rename(filename, rotatedFilename);
        
        // Clean up old log files
        await this.cleanupOldLogs(path.dirname(filename));
      }
    } catch (error) {
      console.error('❌ Log rotation failed:', error);
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(logDir) {
    try {
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stat: null
        }));

      // Get file stats
      for (const file of logFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          console.error('❌ Error getting file stats:', error);
        }
      }

      // Sort by modification time (newest first)
      logFiles.sort((a, b) => 
        (b.stat?.mtime || 0) - (a.stat?.mtime || 0)
      );

      // Remove excess files
      const filesToDelete = logFiles.slice(this.maxLogFiles);
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`🗑️ Deleted old log file: ${file.name}`);
        } catch (error) {
          console.error('❌ Error deleting old log file:', error);
        }
      }
    } catch (error) {
      console.error('❌ Log cleanup failed:', error);
    }
  }

  /**
   * Core logging methods
   */
  async error(message, metadata = {}) {
    if (!this.shouldLog('error')) return;

    const logEntry = this.formatLogEntry('error', message, metadata);
    
    // Always output errors to console
    console.error(`❌ [${logEntry.timestamp}] ERROR: ${message}`, 
      this.environment === 'development' ? metadata : '');
    
    await this.writeToFile('error', logEntry);
  }

  async warn(message, metadata = {}) {
    if (!this.shouldLog('warn')) return;

    const logEntry = this.formatLogEntry('warn', message, metadata);
    
    console.warn(`⚠️ [${logEntry.timestamp}] WARN: ${message}`,
      this.environment === 'development' ? metadata : '');
    
    await this.writeToFile('warn', logEntry);
  }

  async info(message, metadata = {}) {
    if (!this.shouldLog('info')) return;

    const logEntry = this.formatLogEntry('info', message, metadata);
    
    if (this.environment === 'development') {
      console.log(`ℹ️ [${logEntry.timestamp}] INFO: ${message}`, metadata);
    }
    
    await this.writeToFile('info', logEntry);
  }

  async debug(message, metadata = {}) {
    if (!this.shouldLog('debug')) return;

    const logEntry = this.formatLogEntry('debug', message, metadata);
    
    if (this.environment === 'development') {
      console.log(`🔍 [${logEntry.timestamp}] DEBUG: ${message}`, metadata);
    }
    
    await this.writeToFile('debug', logEntry);
  }

  /**
   * Security-specific logging
   */
  async security(message, metadata = {}) {
    const logEntry = this.formatLogEntry('security', message, {
      ...metadata,
      security_event: true
    });
    
    // Security events always go to console and file
    console.warn(`🔒 [${logEntry.timestamp}] SECURITY: ${message}`);
    
    await this.writeToFile('security', logEntry);
    
    // Also send to error log for alerting
    await this.writeToFile('error', logEntry);
  }

  /**
   * Audit logging for compliance
   */
  async audit(action, actor, target, outcome, metadata = {}) {
    const auditEntry = this.formatLogEntry('audit', `${action} by ${actor}`, {
      action,
      actor: this.maskSensitiveData(actor),
      target: this.maskSensitiveData(target),
      outcome,
      audit_event: true,
      ...metadata
    });
    
    console.log(`📋 [${auditEntry.timestamp}] AUDIT: ${action} - ${outcome}`);
    
    await this.writeToFile('audit', auditEntry);
  }

  /**
   * Performance logging
   */
  async performance(operation, duration, metadata = {}) {
    const perfEntry = this.formatLogEntry('performance', `${operation} took ${duration}ms`, {
      operation,
      duration,
      performance_event: true,
      ...metadata
    });
    
    if (duration > 1000) { // Log slow operations
      console.warn(`⏱️ [${perfEntry.timestamp}] SLOW: ${operation} took ${duration}ms`);
    }
    
    await this.writeToFile('performance', perfEntry);
  }

  /**
   * Express middleware for request logging
   */
  requestLogger() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Log request start (only in development)
      if (this.environment === 'development') {
        this.debug(`Incoming request: ${req.method} ${req.path}`, {
          method: req.method,
          path: req.path,
          userAgent: req.get('User-Agent'),
          userType: req.userContext?.userType || 'anonymous'
        });
      }
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;
        const level = res.statusCode >= 400 ? 'error' : 'info';
        
        // Log response
        productionLogger[level](`${req.method} ${req.path} - ${res.statusCode}`, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userType: req.userContext?.userType || 'anonymous',
          responseSize: res.get('Content-Length') || 0
        });
        
        // Log performance if slow
        if (duration > 1000) {
          productionLogger.performance(`${req.method} ${req.path}`, duration, {
            statusCode: res.statusCode,
            userType: req.userContext?.userType || 'anonymous'
          });
        }
        
        originalEnd.apply(this, args);
      };
      
      next();
    };
  }

  /**
   * Error logging middleware
   */
  errorLogger() {
    return (error, req, res, next) => {
      this.error(`Unhandled error in ${req.method} ${req.path}`, {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        request: {
          method: req.method,
          path: req.path,
          userType: req.userContext?.userType || 'anonymous',
          userAgent: req.get('User-Agent')
        }
      });
      
      next(error);
    };
  }

  /**
   * Security event middleware
   */
  securityLogger() {
    return (req, res, next) => {
      // Log security-relevant events
      const userContext = req.userContext || {};
      
      // Log high-risk users
      if (userContext.securityContext?.riskLevel === 'high' || userContext.securityContext?.riskLevel === 'critical') {
        this.security(`High-risk user activity: ${req.method} ${req.path}`, {
          riskLevel: userContext.securityContext.riskLevel,
          trustScore: userContext.securityContext.trustScore,
          userType: userContext.userType || 'anonymous',
          quarantined: userContext.securityContext.quarantined || false
        });
      }
      
      // Log quarantined user attempts
      if (userContext.securityContext?.quarantined) {
        this.security(`Quarantined user attempt: ${req.method} ${req.path}`, {
          userType: userContext.userType || 'anonymous',
          quarantineReason: userContext.securityContext.quarantineReason
        });
      }
      
      // Log admin actions
      if (userContext.userType === 'admin') {
        this.audit(
          `${req.method} ${req.path}`,
          {
            userType: 'admin',
            username: userContext.user?.roleData?.admin?.username,
            adminLevel: userContext.user?.roleData?.admin?.adminLevel
          },
          { path: req.path, method: req.method },
          'initiated'
        );
      }
      
      next();
    };
  }

  /**
   * Log system startup
   */
  logStartup(config = {}) {
    this.info('SafeStreets Bangladesh API starting up', {
      environment: this.environment,
      nodeVersion: process.version,
      pid: process.pid,
      config: this.maskSensitiveData(config),
      startTime: new Date().toISOString()
    });
  }

  /**
   * Log system shutdown
   */
  logShutdown(reason = 'unknown') {
    this.info('SafeStreets Bangladesh API shutting down', {
      reason,
      uptime: process.uptime(),
      shutdownTime: new Date().toISOString()
    });
  }

  /**
   * Database operation logging
   */
  logDatabaseOperation(operation, collection, query = {}, result = {}) {
    if (this.environment === 'production' && this.shouldLog('debug')) return;
    
    this.debug(`Database operation: ${operation} on ${collection}`, {
      operation,
      collection,
      query: this.maskSensitiveData(query),
      resultCount: result.length || result.modifiedCount || result.deletedCount || 1,
      database_event: true
    });
  }

  /**
   * WebSocket event logging
   */
  logWebSocketEvent(event, socketId, data = {}) {
    this.debug(`WebSocket event: ${event}`, {
      event,
      socketId: this.hashValue(socketId, 'socket'),
      data: this.maskSensitiveData(data),
      websocket_event: true
    });
  }

  /**
   * Cache operation logging
   */
  logCacheOperation(operation, key, hit = null) {
    if (this.environment === 'production') return;
    
    this.debug(`Cache ${operation}: ${key}`, {
      operation,
      key: this.maskSensitiveString(key),
      hit,
      cache_event: true
    });
  }

  /**
   * Authentication event logging
   */
  logAuthEvent(event, user, success, metadata = {}) {
    const level = success ? 'info' : 'warn';
    
    this[level](`Authentication ${event}: ${success ? 'success' : 'failed'}`, {
      event,
      user: this.maskSensitiveData(user),
      success,
      auth_event: true,
      ...metadata
    });
  }

  /**
   * Rate limiting event logging
   */
  logRateLimit(identifier, limit, current, blocked) {
    if (blocked) {
      this.warn(`Rate limit exceeded`, {
        identifier: this.hashValue(identifier, 'user'),
        limit,
        current,
        blocked,
        rate_limit_event: true
      });
    }
  }

  /**
   * Health check logging
   */
  logHealthCheck(component, status, details = {}) {
    const level = status === 'healthy' ? 'info' : 'warn';
    
    this[level](`Health check - ${component}: ${status}`, {
      component,
      status,
      details: this.maskSensitiveData(details),
      health_check: true
    });
  }

  /**
   * Get log statistics
   */
  getLogStats() {
    return {
      logLevel: this.logLevel,
      environment: this.environment,
      logDirectory: this.logDirectory,
      sensitiveFieldCount: this.sensitiveFields.length,
      piiFieldCount: this.piiFields.length,
      maxLogFileSize: this.maxLogFileSize,
      maxLogFiles: this.maxLogFiles
    };
  }

  /**
   * Update log level dynamically
   */
  setLogLevel(level) {
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (validLevels.includes(level)) {
      this.logLevel = level;
      this.info(`Log level changed to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}. Valid levels: ${validLevels.join(', ')}`);
    }
  }

  /**
   * Add custom sensitive field
   */
  addSensitiveField(field) {
    if (!this.sensitiveFields.includes(field.toLowerCase())) {
      this.sensitiveFields.push(field.toLowerCase());
      this.debug(`Added sensitive field: ${field}`);
    }
  }

  /**
   * Emergency logging for critical system events
   */
  async emergency(message, metadata = {}) {
    const emergencyEntry = this.formatLogEntry('emergency', message, {
      ...metadata,
      emergency: true,
      alert: true
    });
    
    // Emergency logs always go to console regardless of log level
    console.error(`🚨 [${emergencyEntry.timestamp}] EMERGENCY: ${message}`);
    
    await this.writeToFile('emergency', emergencyEntry);
    await this.writeToFile('error', emergencyEntry);
  }
}

// Export singleton instance
const productionLogger = new ProductionLogger();

module.exports = {
  ProductionLogger,
  productionLogger,
  
  // Direct access methods
  error: (message, metadata) => productionLogger.error(message, metadata),
  warn: (message, metadata) => productionLogger.warn(message, metadata),
  info: (message, metadata) => productionLogger.info(message, metadata),
  debug: (message, metadata) => productionLogger.debug(message, metadata),
  security: (message, metadata) => productionLogger.security(message, metadata),
  audit: (action, actor, target, outcome, metadata) => productionLogger.audit(action, actor, target, outcome, metadata),
  performance: (operation, duration, metadata) => productionLogger.performance(operation, duration, metadata),
  emergency: (message, metadata) => productionLogger.emergency(message, metadata),
  
  // Middleware exports
  requestLogger: () => productionLogger.requestLogger(),
  errorLogger: () => productionLogger.errorLogger(),
  securityLogger: () => productionLogger.securityLogger(),
  
  // Utility methods
  logStartup: (config) => productionLogger.logStartup(config),
  logShutdown: (reason) => productionLogger.logShutdown(reason),
  logDatabaseOperation: (op, col, query, result) => productionLogger.logDatabaseOperation(op, col, query, result),
  logWebSocketEvent: (event, socketId, data) => productionLogger.logWebSocketEvent(event, socketId, data),
  logAuthEvent: (event, user, success, metadata) => productionLogger.logAuthEvent(event, user, success, metadata),
  
  // Configuration
  setLogLevel: (level) => productionLogger.setLogLevel(level),
  getLogStats: () => productionLogger.getLogStats()
};