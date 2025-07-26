// === backend/src/middleware/reportDeduplication.js ===
// Comprehensive report deduplication system for SafeStreets Bangladesh
// Prevents duplicate submissions from network retries, double-clicks, and spam

const crypto = require('crypto');
const Report = require('../models/Report');
const { cacheLayer } = require('./cacheLayer');

class ReportDeduplicationManager {
  constructor() {
    this.tempSubmissions = new Map(); // In-memory store for recent submissions
    this.cleanupInterval = null;
    
    // Start cleanup process
    this.startCleanup();
  }

  /**
   * Generate content hash for deduplication
   * Creates a unique fingerprint based on report content
   */
  generateContentHash(reportData) {
    const { type, description, location, severity, submittedBy } = reportData;
    
    // Normalize description (remove extra spaces, lowercase)
    const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Round coordinates to prevent minor GPS differences
    const roundedCoords = location.coordinates.map(coord => 
      Math.round(coord * 10000) / 10000 // ~11m precision
    );
    
    // Create content fingerprint
    const contentString = JSON.stringify({
      type,
      description: normalizedDesc,
      coordinates: roundedCoords,
      severity,
      userId: submittedBy.userId,
      deviceFingerprint: submittedBy.deviceFingerprint
    });
    
    return crypto.createHash('sha256').update(contentString).digest('hex');
  }

  /**
   * Generate temporal hash for same user submissions
   * Prevents rapid successive submissions from same user
   */
  generateTemporalHash(submittedBy, timeWindow = 300) { // 5 minutes default
    const windowStart = Math.floor(Date.now() / (timeWindow * 1000)) * timeWindow;
    
    return crypto.createHash('sha256').update(JSON.stringify({
      userId: submittedBy.userId,
      deviceFingerprint: submittedBy.deviceFingerprint,
      ipHash: submittedBy.ipHash,
      timeWindow: windowStart
    })).digest('hex');
  }

  /**
   * Check for exact content duplicates in database
   */
  async checkContentDuplicates(contentHash, timeRange = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const since = new Date(Date.now() - timeRange);
      
      const duplicate = await Report.findOne({
        'deduplication.contentHash': contentHash,
        createdAt: { $gte: since },
        status: { $ne: 'rejected' } // Don't count rejected reports as duplicates
      }).select('_id type description location severity createdAt submittedBy');
      
      return duplicate;
      
    } catch (error) {
      console.error('❌ Error checking content duplicates:', error);
      return null;
    }
  }

  /**
   * Check for temporal duplicates (rapid submissions from same user)
   */
  async checkTemporalDuplicates(submittedBy, timeWindow = 300) { // 5 minutes
    try {
      const since = new Date(Date.now() - (timeWindow * 1000));
      
      const count = await Report.countDocuments({
        $or: [
          { 'submittedBy.userId': submittedBy.userId },
          { 'submittedBy.deviceFingerprint': submittedBy.deviceFingerprint },
          { 'submittedBy.ipHash': submittedBy.ipHash }
        ],
        createdAt: { $gte: since },
        status: { $ne: 'rejected' }
      });
      
      return count;
      
    } catch (error) {
      console.error('❌ Error checking temporal duplicates:', error);
      return 0;
    }
  }

  /**
   * Check Redis for recent submission attempts (prevents double-click)
   */
  async checkRecentSubmissions(contentHash, submittedBy) {
    if (!cacheLayer.isConnected) return null;
    
    try {
      // Check content-based recent submissions (last 5 minutes)
      const contentKey = cacheLayer.generateKey('dedup', 'content', contentHash);
      const contentRecent = await cacheLayer.get(contentKey);
      
      if (contentRecent) {
        return {
          type: 'content',
          originalReportId: contentRecent.reportId,
          timestamp: contentRecent.timestamp,
          timeAgo: Date.now() - contentRecent.timestamp
        };
      }
      
      // Check user-based rapid submissions (last 30 seconds)
      const userKey = cacheLayer.generateKey('dedup', 'user', submittedBy.userId || submittedBy.deviceFingerprint);
      const userRecent = await cacheLayer.get(userKey);
      
      if (userRecent && (Date.now() - userRecent.timestamp) < 30000) { // 30 seconds
        return {
          type: 'rapid',
          originalReportId: userRecent.reportId,
          timestamp: userRecent.timestamp,
          timeAgo: Date.now() - userRecent.timestamp
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error checking recent submissions:', error);
      return null;
    }
  }

  /**
   * Record successful submission to prevent future duplicates
   */
  async recordSubmission(reportId, contentHash, submittedBy) {
    if (!cacheLayer.isConnected) return;
    
    try {
      const timestamp = Date.now();
      const submissionData = { reportId, timestamp };
      
      // Record content-based submission (5 minutes)
      const contentKey = cacheLayer.generateKey('dedup', 'content', contentHash);
      await cacheLayer.set(contentKey, submissionData, 300);
      
      // Record user-based submission (30 seconds for rapid submission detection)
      const userKey = cacheLayer.generateKey('dedup', 'user', submittedBy.userId || submittedBy.deviceFingerprint);
      await cacheLayer.set(userKey, submissionData, 30);
      
      console.log(`✅ Recorded submission for deduplication: ${reportId}`);
      
    } catch (error) {
      console.error('❌ Error recording submission:', error);
    }
  }

  /**
   * Main deduplication check - comprehensive analysis
   */
  async checkDuplicates(reportData) {
    const results = {
      isDuplicate: false,
      duplicateType: null,
      originalReport: null,
      confidence: 0,
      recommendation: 'allow',
      details: {}
    };

    try {
      // Generate hashes
      const contentHash = this.generateContentHash(reportData);
      const temporalHash = this.generateTemporalHash(reportData.submittedBy);
      
      // 1. Check recent cache submissions (immediate duplicates)
      const recentSubmission = await this.checkRecentSubmissions(contentHash, reportData.submittedBy);
      if (recentSubmission) {
        results.isDuplicate = true;
        results.duplicateType = recentSubmission.type;
        results.originalReport = recentSubmission.originalReportId;
        results.confidence = recentSubmission.type === 'content' ? 95 : 80;
        results.recommendation = 'reject';
        results.details.timeAgo = recentSubmission.timeAgo;
        results.details.source = 'cache';
        
        return results;
      }

      // 2. Check database for content duplicates
      const contentDuplicate = await this.checkContentDuplicates(contentHash);
      if (contentDuplicate) {
        // Calculate similarity confidence
        const timeAgo = Date.now() - contentDuplicate.createdAt.getTime();
        const hoursSince = timeAgo / (1000 * 60 * 60);
        
        // Recent duplicates are more likely to be actual duplicates
        const confidence = Math.max(70 - (hoursSince * 2), 30);
        
        results.isDuplicate = true;
        results.duplicateType = 'content';
        results.originalReport = contentDuplicate._id;
        results.confidence = confidence;
        results.recommendation = confidence > 80 ? 'reject' : 'flag';
        results.details.timeAgo = timeAgo;
        results.details.source = 'database';
        results.details.originalReport = contentDuplicate;
        
        return results;
      }

      // 3. Check temporal duplicates (rapid submissions)
      const temporalCount = await this.checkTemporalDuplicates(reportData.submittedBy);
      if (temporalCount >= 3) { // More than 3 reports in 5 minutes
        results.isDuplicate = true;
        results.duplicateType = 'temporal';
        results.confidence = 85;
        results.recommendation = 'flag';
        results.details.recentCount = temporalCount;
        results.details.source = 'temporal';
        
        return results;
      }

      // 4. Add deduplication metadata to report
      results.details.contentHash = contentHash;
      results.details.temporalHash = temporalHash;
      
      return results;

    } catch (error) {
      console.error('❌ Error in duplicate check:', error);
      
      // On error, allow submission but flag for review
      results.recommendation = 'allow';
      results.details.error = error.message;
      
      return results;
    }
  }

  /**
   * Express middleware for deduplication checking
   */
  createMiddleware() {
    return async (req, res, next) => {
      try {
        const { type, description, location, severity } = req.body;
        
        // Skip deduplication for load testing
        if (process.env.LOAD_TESTING === 'true' || process.env.NODE_ENV === 'test') {
          return next();
        }

        // Build report data for deduplication check
        const reportData = {
          type,
          description,
          location,
          severity,
          submittedBy: {
            userId: req.userContext.user._id,
            deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
            ipHash: req.submittedByIpHash || 'unknown' // Should be set by route
          }
        };

        // Run deduplication check
        const duplicateCheck = await this.checkDuplicates(reportData);
        
        // Attach results to request for use in route
        req.deduplicationCheck = duplicateCheck;
        
        // Handle based on recommendation
        if (duplicateCheck.recommendation === 'reject') {
          console.log(`🚫 Duplicate report rejected: ${duplicateCheck.duplicateType} (confidence: ${duplicateCheck.confidence}%)`);
          
          return res.status(409).json({
            success: false,
            message: 'This report appears to be a duplicate of a recent submission.',
            code: 'DUPLICATE_REPORT',
            details: {
              type: duplicateCheck.duplicateType,
              confidence: duplicateCheck.confidence,
              originalReportId: duplicateCheck.originalReport,
              timeAgo: duplicateCheck.details.timeAgo
            }
          });
        }

        // Continue with submission (allow or flag)
        next();

      } catch (error) {
        console.error('❌ Deduplication middleware error:', error);
        // On error, allow submission to continue
        next();
      }
    };
  }

  /**
   * Clean up old in-memory entries
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      for (const [key, data] of this.tempSubmissions.entries()) {
        if (now - data.timestamp > maxAge) {
          this.tempSubmissions.delete(key);
        }
      }
      
      if (this.tempSubmissions.size > 0) {
        console.log(`🧹 Deduplication cleanup: ${this.tempSubmissions.size} entries remaining`);
      }
    }, 60000); // Every minute
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tempSubmissions.clear();
  }

  /**
   * Get deduplication statistics
   */
  getStats() {
    return {
      tempSubmissions: this.tempSubmissions.size,
      redisConnected: cacheLayer?.isConnected || false
    };
  }
}

// Export singleton instance
const reportDeduplicationManager = new ReportDeduplicationManager();

module.exports = {
  ReportDeduplicationManager,
  reportDeduplicationManager,
  
  // Middleware factory
  deduplicationMiddleware: () => reportDeduplicationManager.createMiddleware(),
  
  // Helper functions
  recordSubmission: (reportId, contentHash, submittedBy) => 
    reportDeduplicationManager.recordSubmission(reportId, contentHash, submittedBy),
    
  checkDuplicates: (reportData) => 
    reportDeduplicationManager.checkDuplicates(reportData),
    
  getStats: () => reportDeduplicationManager.getStats()
};