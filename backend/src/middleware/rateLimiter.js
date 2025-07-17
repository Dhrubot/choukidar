// === backend/src/middleware/rateLimiter.js ===
// Rate Limiting Middleware for Authentication Endpoints

const rateLimit = require('express-rate-limit');
const { createHash } = require('crypto');

// Helper to hash IP for privacy
const hashIp = (ip) => {
  return createHash('sha256').update(ip || 'unknown').digest('hex');
};

// Strict rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => hashIp(req.ip),
  handler: (req, res) => {
    console.log(`🚨 Login rate limit exceeded for IP: ${hashIp(req.ip)}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in 1 hour.'
  },
  keyGenerator: (req) => hashIp(req.ip),
  handler: (req, res) => {
    console.log(`🚨 Password reset rate limit exceeded for IP: ${hashIp(req.ip)}`);
    res.status(429).json({
      success: false,
      message: 'Too many password reset requests. Please try again later.'
    });
  }
});

// Rate limiting for 2FA attempts
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 2FA attempts per window
  message: {
    success: false,
    message: 'Too many 2FA attempts. Please try again in 15 minutes.'
  },
  keyGenerator: (req) => {
    // Use both IP and user ID for 2FA rate limiting
    const userKey = req.body.preAuthToken ? jwt.decode(req.body.preAuthToken)?.userId : 'unknown';
    return hashIp(req.ip) + '_' + userKey;
  }
});

// Rate limiting for token refresh
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 refresh attempts per window
  message: {
    success: false,
    message: 'Too many token refresh attempts. Please try again later.'
  },
  keyGenerator: (req) => hashIp(req.ip)
});

// Rate limiting for admin operations
const adminOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 admin operations per minute
  message: {
    success: false,
    message: 'Too many admin operations. Please slow down.'
  },
  keyGenerator: (req) => req.userContext?.user?._id || hashIp(req.ip)
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  twoFactorLimiter,
  refreshLimiter,
  adminOperationLimiter
};