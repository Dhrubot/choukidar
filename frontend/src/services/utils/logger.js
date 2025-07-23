// === src/services/utils/logger.js ===
/**
 * Production-ready logging service for SafeStreets Bangladesh
 * Replaces console.log statements with proper logging levels and environment awareness
 */

class Logger {
  constructor() {
    this.isDevelopment = import.meta.env.MODE === 'development'
    this.isProduction = import.meta.env.MODE === 'production'
    this.logLevel = import.meta.env.VITE_LOG_LEVEL || (this.isDevelopment ? 'debug' : 'warn')
    
    // Log levels in order of severity
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    
    this.currentLevel = this.levels[this.logLevel] || this.levels.warn
  }

  // Format log message with timestamp and context
  formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    
    if (context) {
      return `${prefix} [${context}] ${message}`
    }
    return `${prefix} ${message}`
  }

  // Check if log level should be output
  shouldLog(level) {
    return this.levels[level] >= this.currentLevel
  }

  // Debug level logging (development only)
  debug(message, context = null, data = null) {
    if (!this.shouldLog('debug')) return
    
    const formattedMessage = this.formatMessage('debug', message, context)
    console.log(formattedMessage, data || '')
  }

  // Info level logging
  info(message, context = null, data = null) {
    if (!this.shouldLog('info')) return
    
    const formattedMessage = this.formatMessage('info', message, context)
    console.info(formattedMessage, data || '')
  }

  // Warning level logging
  warn(message, context = null, data = null) {
    if (!this.shouldLog('warn')) return
    
    const formattedMessage = this.formatMessage('warn', message, context)
    console.warn(formattedMessage, data || '')
  }

  // Error level logging (always shown)
  error(message, context = null, error = null) {
    const formattedMessage = this.formatMessage('error', message, context)
    console.error(formattedMessage, error || '')
    
    // In production, could send to error tracking service
    if (this.isProduction && error) {
      this.reportError(message, context, error)
    }
  }

  // Success logging with emoji (development only)
  success(message, context = null, data = null) {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage('info', `✅ ${message}`, context)
      console.log(formattedMessage, data || '')
    }
  }

  // Connection/WebSocket logging
  connection(message, context = null, data = null) {
    if (this.isDevelopment) {
      const formattedMessage = this.formatMessage('info', `🔌 ${message}`, context)
      console.log(formattedMessage, data || '')
    }
  }

  // Performance logging
  performance(message, context = null, timing = null) {
    if (this.isDevelopment) {
      const timingStr = timing ? ` (${timing}ms)` : ''
      const formattedMessage = this.formatMessage('info', `⚡ ${message}${timingStr}`, context)
      console.log(formattedMessage)
    }
  }

  // Security logging (always logged)
  security(message, context = null, data = null) {
    const formattedMessage = this.formatMessage('warn', `🔐 ${message}`, context)
    console.warn(formattedMessage, data || '')
  }

  // Report error to external service (production)
  reportError(message, context, error) {
    // Placeholder for error reporting service integration
    // Could integrate with Sentry, LogRocket, or custom error tracking
    try {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(error, { context, message })
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  // Group logging for related operations
  group(label) {
    if (this.isDevelopment) {
      console.group(label)
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd()
    }
  }

  // Table logging for data structures
  table(data, context = null) {
    if (this.isDevelopment) {
      if (context) {
        console.log(`📊 ${context}:`)
      }
      console.table(data)
    }
  }

  // Time logging for performance measurement
  time(label) {
    if (this.isDevelopment) {
      console.time(label)
    }
  }

  timeEnd(label) {
    if (this.isDevelopment) {
      console.timeEnd(label)
    }
  }

  // Silent mode for testing
  setSilent(silent = true) {
    this.silent = silent
  }

  // Override log level temporarily
  setLogLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level]
    }
  }
}

// Create singleton instance
const logger = new Logger()

// Export both the instance and class for testing
export default logger
export { Logger }

// Convenience exports for common logging patterns
export const logSuccess = (message, context, data) => logger.success(message, context, data)
export const logError = (message, context, error) => logger.error(message, context, error)
export const logWarning = (message, context, data) => logger.warn(message, context, data)
export const logInfo = (message, context, data) => logger.info(message, context, data)
export const logDebug = (message, context, data) => logger.debug(message, context, data)
export const logConnection = (message, context, data) => logger.connection(message, context, data)
export const logPerformance = (message, context, timing) => logger.performance(message, context, timing)
export const logSecurity = (message, context, data) => logger.security(message, context, data)
