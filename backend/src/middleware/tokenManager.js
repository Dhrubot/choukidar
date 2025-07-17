// === backend/src/middleware/tokenManager.js ===
// Token Management System with Refresh Tokens and Blacklisting

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redis = require('redis');
const User = require('../models/User');

// Redis client for token blacklisting and refresh token storage
const redisClient = process.env.NODE_ENV === 'production' ? redis.createClient({
  host: process.env.UPSTASH_REDIS_URL,
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null
}) : 
redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null
})

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.connect();

class TokenManager {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
    this.accessTokenExpiry = '15m'; // Short-lived access tokens
    this.refreshTokenExpiry = '7d'; // Long-lived refresh tokens
  }

  // Generate access token
  generateAccessToken(payload) {
    return jwt.sign(payload, this.accessTokenSecret, { 
      expiresIn: this.accessTokenExpiry,
      issuer: 'safestreets-bd',
      audience: 'safestreets-client'
    });
  }

  // Generate refresh token
  generateRefreshToken(payload) {
    const refreshPayload = {
      ...payload,
      tokenId: crypto.randomBytes(16).toString('hex'), // Unique token ID
      type: 'refresh'
    };
    return jwt.sign(refreshPayload, this.refreshTokenSecret, { 
      expiresIn: this.refreshTokenExpiry,
      issuer: 'safestreets-bd',
      audience: 'safestreets-client'
    });
  }

  // Generate token pair (access + refresh)
  async generateTokenPair(user) {
    const payload = {
      userId: user._id,
      userType: user.userType,
      permissions: user.userType === 'admin' ? user.roleData.admin.permissions : [],
      emailVerified: user.userType === 'admin' ? user.roleData.admin.emailVerified : true
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store refresh token in Redis with user association
    const refreshPayload = jwt.decode(refreshToken);
    await redisClient.setEx(
      `refresh_token:${refreshPayload.tokenId}`, 
      7 * 24 * 60 * 60, // 7 days in seconds
      JSON.stringify({
        userId: user._id,
        tokenId: refreshPayload.tokenId,
        createdAt: new Date().toISOString()
      })
    );

    return { accessToken, refreshToken };
  }

  // Verify access token
  async verifyAccessToken(token) {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      throw error;
    }
  }

  // Verify refresh token
  async verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret);
      
      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${payload.tokenId}`);
      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      return payload;
    } catch (error) {
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const refreshPayload = await this.verifyRefreshToken(refreshToken);
      
      // Get fresh user data
      const user = await User.findById(refreshPayload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        userId: user._id,
        userType: user.userType,
        permissions: user.userType === 'admin' ? user.roleData.admin.permissions : [],
        emailVerified: user.userType === 'admin' ? user.roleData.admin.emailVerified : true
      });

      return { accessToken: newAccessToken };
    } catch (error) {
      throw error;
    }
  }

  // Blacklist access token
  async blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const expiry = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiry > 0) {
          await redisClient.setEx(`blacklist:${token}`, expiry, 'revoked');
        }
      }
    } catch (error) {
      console.error('Error blacklisting token:', error);
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken) {
    try {
      const payload = jwt.decode(refreshToken);
      if (payload && payload.tokenId) {
        await redisClient.del(`refresh_token:${payload.tokenId}`);
      }
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
  }

  // Revoke all user tokens
  async revokeAllUserTokens(userId) {
    try {
      // Get all refresh tokens for user
      const keys = await redisClient.keys(`refresh_token:*`);
      for (const key of keys) {
        const tokenData = await redisClient.get(key);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          if (parsed.userId === userId.toString()) {
            await redisClient.del(key);
          }
        }
      }
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
    }
  }

  // Get user's active refresh tokens
  async getUserRefreshTokens(userId) {
    try {
      const keys = await redisClient.keys(`refresh_token:*`);
      const userTokens = [];
      
      for (const key of keys) {
        const tokenData = await redisClient.get(key);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          if (parsed.userId === userId.toString()) {
            userTokens.push({
              tokenId: parsed.tokenId,
              createdAt: parsed.createdAt
            });
          }
        }
      }
      
      return userTokens;
    } catch (error) {
      console.error('Error getting user refresh tokens:', error);
      return [];
    }
  }
}

module.exports = new TokenManager();