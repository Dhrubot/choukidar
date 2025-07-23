// === src/services/utils/errorHandler.js ===
/**
 * Unified Error Handling Strategy for SafeStreets Bangladesh
 * Replaces inconsistent alert() calls and provides centralized error management
 */

import logger, { logError, logWarning } from './logger.js';

// Error types for categorization
export const ERROR_TYPES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  SERVER: 'server',
  CLIENT: 'client',
  GEOLOCATION: 'geolocation',
  FILE_UPLOAD: 'file_upload',
  WEBSOCKET: 'websocket'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.maxQueueSize = 50;
    this.isDevelopment = import.meta.env.MODE === 'development';
  }

  // Main error handling method
  handle(error, context = null, options = {}) {
    const errorInfo = this.categorizeError(error, context, options);
    
    // Log the error
    logError(errorInfo.message, errorInfo.context, errorInfo.originalError);
    
    // Add to error queue for analytics
    this.addToQueue(errorInfo);
    
    // Handle based on severity and type
    switch (errorInfo.severity) {
      case ERROR_SEVERITY.CRITICAL:
        return this.handleCriticalError(errorInfo);
      case ERROR_SEVERITY.HIGH:
        return this.handleHighError(errorInfo);
      case ERROR_SEVERITY.MEDIUM:
        return this.handleMediumError(errorInfo);
      default:
        return this.handleLowError(errorInfo);
    }
  }

  // Categorize and enhance error information
  categorizeError(error, context, options) {
    const errorInfo = {
      originalError: error,
      context: context || 'Unknown',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...options
    };

    // Determine error type and severity
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      errorInfo.type = ERROR_TYPES.NETWORK;
      errorInfo.severity = ERROR_SEVERITY.HIGH;
      errorInfo.message = 'Network connection issue. Please check your internet connection.';
      errorInfo.userMessage = 'Connection problem. Please try again.';
    } else if (error.status === 401) {
      errorInfo.type = ERROR_TYPES.AUTHENTICATION;
      errorInfo.severity = ERROR_SEVERITY.HIGH;
      errorInfo.message = 'Authentication failed';
      errorInfo.userMessage = 'Please log in again to continue.';
    } else if (error.status === 403) {
      errorInfo.type = ERROR_TYPES.AUTHORIZATION;
      errorInfo.severity = ERROR_SEVERITY.MEDIUM;
      errorInfo.message = 'Access denied';
      errorInfo.userMessage = 'You do not have permission to perform this action.';
    } else if (error.status >= 500) {
      errorInfo.type = ERROR_TYPES.SERVER;
      errorInfo.severity = ERROR_SEVERITY.HIGH;
      errorInfo.message = 'Server error occurred';
      errorInfo.userMessage = 'Server is experiencing issues. Please try again later.';
    } else if (error.name === 'ValidationError' || error.message.includes('validation')) {
      errorInfo.type = ERROR_TYPES.VALIDATION;
      errorInfo.severity = ERROR_SEVERITY.LOW;
      errorInfo.message = error.message || 'Validation failed';
      errorInfo.userMessage = 'Please check your input and try again.';
    } else if (error.code === 1 || error.message.includes('location')) {
      errorInfo.type = ERROR_TYPES.GEOLOCATION;
      errorInfo.severity = ERROR_SEVERITY.MEDIUM;
      errorInfo.message = 'Location access denied or unavailable';
      errorInfo.userMessage = 'Location access is needed for this feature. Please enable location services.';
    } else {
      errorInfo.type = ERROR_TYPES.CLIENT;
      errorInfo.severity = ERROR_SEVERITY.MEDIUM;
      errorInfo.message = error.message || 'An unexpected error occurred';
      errorInfo.userMessage = 'Something went wrong. Please try again.';
    }

    return errorInfo;
  }

  // Handle critical errors (system-breaking)
  handleCriticalError(errorInfo) {
    // Show modal or redirect to error page
    return {
      type: 'modal',
      title: 'Critical Error',
      message: errorInfo.userMessage,
      actions: [
        { label: 'Reload Page', action: () => window.location.reload() },
        { label: 'Go Home', action: () => window.location.href = '/' }
      ]
    };
  }

  // Handle high severity errors
  handleHighError(errorInfo) {
    return {
      type: 'toast',
      variant: 'error',
      title: 'Error',
      message: errorInfo.userMessage,
      duration: 5000,
      persistent: true
    };
  }

  // Handle medium severity errors
  handleMediumError(errorInfo) {
    return {
      type: 'toast',
      variant: 'warning',
      title: 'Warning',
      message: errorInfo.userMessage,
      duration: 4000
    };
  }

  // Handle low severity errors
  handleLowError(errorInfo) {
    return {
      type: 'toast',
      variant: 'info',
      message: errorInfo.userMessage,
      duration: 3000
    };
  }

  // Add error to queue for analytics
  addToQueue(errorInfo) {
    this.errorQueue.push(errorInfo);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  // Get error statistics for admin dashboard
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      byType: {},
      bySeverity: {},
      recent: this.errorQueue.slice(-10)
    };

    this.errorQueue.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  // Clear error queue
  clearQueue() {
    this.errorQueue = [];
  }

  // Report error to external service (production)
  async reportError(errorInfo) {
    if (import.meta.env.MODE === 'production') {
      try {
        // Send to error tracking service
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorInfo)
        });
      } catch (reportingError) {
        logWarning('Failed to report error to service', 'ErrorHandler', reportingError);
      }
    }
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Convenience functions for common error scenarios
export const handleApiError = (error, context = 'API') => {
  return errorHandler.handle(error, context);
};

export const handleValidationError = (errors, context = 'Validation') => {
  const validationError = new Error('Validation failed');
  validationError.name = 'ValidationError';
  validationError.details = errors;
  return errorHandler.handle(validationError, context);
};

export const handleNetworkError = (error, context = 'Network') => {
  const networkError = new Error('Network request failed');
  networkError.name = 'NetworkError';
  networkError.originalError = error;
  return errorHandler.handle(networkError, context);
};

export const handleAuthError = (error, context = 'Authentication') => {
  return errorHandler.handle(error, context, { 
    type: ERROR_TYPES.AUTHENTICATION,
    severity: ERROR_SEVERITY.HIGH 
  });
};

export const handleLocationError = (error, context = 'Geolocation') => {
  return errorHandler.handle(error, context, {
    type: ERROR_TYPES.GEOLOCATION,
    severity: ERROR_SEVERITY.MEDIUM
  });
};

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  errorHandler.handle(event.error, 'Global', {
    type: ERROR_TYPES.CLIENT,
    severity: ERROR_SEVERITY.HIGH
  });
});

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handle(event.reason, 'Promise', {
    type: ERROR_TYPES.CLIENT,
    severity: ERROR_SEVERITY.MEDIUM
  });
});

export default errorHandler;
