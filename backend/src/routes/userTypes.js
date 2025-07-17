// === backend/src/routes/userTypes.js ===
// User Types Management Routes for SafeStreets Bangladesh
// Handles user type operations, role management, and user administration

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const AuditLog = require('../models/AuditLog'); // For logging admin actions
const { userTypeDetection } = require('../middleware/userTypeDetection'); 
const { requireAdmin, requirePermission, requireMinimumTrust, getUserPermissions } = require('../middleware/roleBasedAccess');

// Apply user type detection to all routes
router.use(userTypeDetection);

/**
 * Helper function to create an audit log entry for admin actions on users.
 */
const logAdminAction = async (req, actionType, details = {}, severity = 'medium', target = {}) => {
  try {
    await AuditLog.create({
      actor: {
        userId: req.userContext.user._id,
        userType: 'admin',
        username: req.userContext.user.roleData.admin.username,
        deviceFingerprint: req.userContext.deviceFingerprint?.fingerprintId,
        ipAddress: req.ip
      },
      actionType,
      details,
      outcome: 'success',
      severity,
      target
    });
  } catch (error) {
    console.error(`❌ Audit log failed for action ${actionType}:`, error);
  }
};

// === ADMIN USER MANAGEMENT ===

// GET /api/user-types/admin/users - Get all users with filters
router.get('/admin/users', 
  requireAdmin, 
  requirePermission('view_users'), 
  async (req, res) => {
    try {
      const {
        userType = 'all',
        riskLevel = 'all',
        quarantined = 'all',
        page = 1,
        limit = 50,
        sortBy = 'activityProfile.lastSeen',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = {};
      
      if (userType !== 'all') {
        query.userType = userType;
      }
      
      if (riskLevel !== 'all') {
        query['securityProfile.securityRiskLevel'] = riskLevel;
      }
      
      if (quarantined !== 'all') {
        query['securityProfile.quarantineStatus'] = quarantined === 'true';
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const users = await User.find(query)
        .select('-roleData.admin.passwordHash -roleData.admin.twoFactorSecret') // Exclude sensitive fields
        .sort(sort)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const totalUsers = await User.countDocuments(query);

      res.json({
        success: true,
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasMore: page * limit < totalUsers
        },
        filters: {
          userType,
          riskLevel,
          quarantined,
          sortBy,
          sortOrder
        }
      });

    } catch (error) {
      console.error('❌ Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get users',
        error: error.message
      });
    }
  }
);

// GET /api/user-types/admin/user/:id - Get specific user details
router.get('/admin/user/:id',
  requireAdmin,
  requirePermission('view_users'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-roleData.admin.passwordHash -roleData.admin.twoFactorSecret')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's device fingerprint details
      let deviceDetails = null;
      if (user.securityProfile.primaryDeviceFingerprint) {
        deviceDetails = await DeviceFingerprint.findOne({
          fingerprintId: user.securityProfile.primaryDeviceFingerprint
        }).lean();
      }

      // Get user permissions
      const permissions = await getUserPermissions({ user, userType: user.userType });

      res.json({
        success: true,
        user: {
          ...user,
          deviceDetails,
          permissions
        }
      });

    } catch (error) {
      console.error('❌ Get user details error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user details',
        error: error.message
      });
    }
  }
);

// PUT /api/user-types/admin/user/:id/quarantine - Quarantine/unquarantine user
router.put('/admin/user/:id/quarantine',
  requireAdmin,
  requirePermission('quarantine_users'),
  async (req, res) => {
    try {
      const { quarantine, reason, duration = 24 } = req.body; // duration in hours
      
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (quarantine) {
        user.securityProfile.quarantineStatus = true;
        user.securityProfile.quarantineReason = reason || 'Admin quarantine';
        user.securityProfile.quarantineUntil = new Date(Date.now() + duration * 60 * 60 * 1000);
        
        user.addSecurityEvent(
          'admin_quarantine',
          `Quarantined by admin: ${reason}`,
          'high'
        );
      } else {
        user.securityProfile.quarantineStatus = false;
        user.securityProfile.quarantineReason = null;
        user.securityProfile.quarantineUntil = null;
        
        user.addSecurityEvent(
          'admin_unquarantine',
          'Released from quarantine by admin',
          'low'
        );
      }

      await user.save();

      // --- Audit Log ---
      await logAdminAction(
        req,
        'user_quarantine_status_change',
        { status: quarantine ? 'quarantined' : 'unquarantined', reason, duration },
        'high',
        { id: user._id, type: 'User', name: user.userId }
      );

      console.log(`✅ User ${user.userId} ${quarantine ? 'quarantined' : 'unquarantined'} by admin`);

      res.json({
        success: true,
        message: `User ${quarantine ? 'quarantined' : 'unquarantined'} successfully`,
        user: {
          id: user._id,
          userId: user.userId,
          quarantineStatus: user.securityProfile.quarantineStatus,
          quarantineReason: user.securityProfile.quarantineReason,
          quarantineUntil: user.securityProfile.quarantineUntil
        }
      });

    } catch (error) {
      console.error('❌ User quarantine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quarantine status',
        error: error.message
      });
    }
  }
);

// === ADMIN CREATION & MANAGEMENT ===

// POST /api/user-types/admin/create - Create new admin user
router.post('/admin/create',
  requireAdmin,
  requirePermission('manage_admins'),
  async (req, res) => {
    try {
      const { username, email, password, permissions = ['moderation'], adminLevel = 5 } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username, email, and password are required'
        });
      }

      // Check if admin already exists
      const existingAdmin = await User.findOne({
        $or: [
          { 'roleData.admin.username': username },
          { 'roleData.admin.email': email }
        ]
      });

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Admin with this username or email already exists'
        });
      }

      // Create new admin user
      const adminId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newAdmin = new User({
        userId: adminId,
        userType: 'admin',
        roleData: {
          admin: {
            username,
            email,
            permissions,
            adminLevel,
            loginAttempts: 0,
            accountLocked: false,
            twoFactorEnabled: false
          }
        }
      });

      // Set password
      await newAdmin.setPassword(password);

      // Log security event
      newAdmin.addSecurityEvent(
        'admin_account_created',
        `Admin account created by ${req.userContext.user.roleData.admin.username}`,
        'medium'
      );

      await newAdmin.save();

      // --- Audit Log ---
      await logAdminAction(
        req,
        'user_role_change',
        { action: 'create_admin', username, email, permissions, adminLevel },
        'high',
        { id: newAdmin._id, type: 'User', name: newAdmin.roleData.admin.username }
      );

      console.log(`✅ New admin created: ${username} by ${req.userContext.user.roleData.admin.username}`);

      res.status(201).json({
        success: true,
        message: 'Admin user created successfully',
        admin: {
          id: newAdmin._id,
          userId: newAdmin.userId,
          username: newAdmin.roleData.admin.username,
          email: newAdmin.roleData.admin.email,
          permissions: newAdmin.roleData.admin.permissions,
          adminLevel: newAdmin.roleData.admin.adminLevel,
          createdAt: newAdmin.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Create admin error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create admin user',
        error: error.message
      });
    }
  }
);

// PUT /api/user-types/admin/:id/permissions - Update admin permissions
router.put('/admin/:id/permissions',
  requireAdmin,
  requirePermission('manage_admin_accounts'),
  async (req, res) => {
    try {
      const { permissions, adminLevel } = req.body;

      const adminUser = await User.findOne({
        _id: req.params.id,
        userType: 'admin'
      });

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }

      // Track changes for audit log
      const changes = {};
      
      // Update permissions
      if (permissions) {
        changes.oldPermissions = adminUser.roleData.admin.permissions;
        changes.newPermissions = permissions;
        adminUser.roleData.admin.permissions = permissions;
      }

      if (adminLevel !== undefined) {
        changes.oldAdminLevel = adminUser.roleData.admin.adminLevel;
        changes.newAdminLevel = adminLevel;
        adminUser.roleData.admin.adminLevel = adminLevel;
      }

      // Log security event
      adminUser.addSecurityEvent(
        'admin_permissions_updated',
        `Permissions updated by ${req.userContext.user.roleData.admin.username}`,
        'medium'
      );

      await adminUser.save();

      // --- Audit Log ---
      await logAdminAction(
        req,
        'user_permission_change',
        changes,
        'high',
        { id: adminUser._id, type: 'User', name: adminUser.roleData.admin.username }
      );

      console.log(`✅ Admin permissions updated: ${adminUser.roleData.admin.username}`);

      res.json({
        success: true,
        message: 'Admin permissions updated successfully',
        admin: {
          id: adminUser._id,
          username: adminUser.roleData.admin.username,
          permissions: adminUser.roleData.admin.permissions,
          adminLevel: adminUser.roleData.admin.adminLevel
        }
      });

    } catch (error) {
      console.error('❌ Update admin permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update admin permissions',
        error: error.message
      });
    }
  }
);

// === USER STATISTICS & ANALYTICS ===

// GET /api/user-types/admin/statistics - Get user statistics
router.get('/admin/statistics',
  requireAdmin,
  requirePermission('view_user_statistics'),
  async (req, res) => {
    try {
      // User type distribution
      const userTypeStats = await User.aggregate([
        {
          $group: {
            _id: '$userType',
            count: { $sum: 1 },
            avgTrustScore: { $avg: '$securityProfile.overallTrustScore' },
            avgActiveTime: { $avg: '$activityProfile.totalActiveTime' }
          }
        }
      ]);

      // Risk level distribution
      const riskLevelStats = await User.aggregate([
        {
          $group: {
            _id: '$securityProfile.securityRiskLevel',
            count: { $sum: 1 }
          }
        }
      ]);

      // Activity statistics
      const activityStats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalReports: { $sum: '$activityProfile.contributionMetrics.reportsSubmitted' },
            totalValidations: { $sum: '$activityProfile.contributionMetrics.validationsGiven' },
            avgEngagement: { $avg: '$anonymousProfile.activityMetrics.engagementScore' }
          }
        }
      ]);

      // Recent user growth
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentUsers = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      // Security statistics
      const securityStats = {
        quarantinedUsers: await User.countDocuments({ 'securityProfile.quarantineStatus': true }),
        highRiskUsers: await User.countDocuments({ 'securityProfile.securityRiskLevel': { $in: ['high', 'critical'] } }),
        lowTrustUsers: await User.countDocuments({ 'securityProfile.overallTrustScore': { $lt: 30 } })
      };

      res.json({
        success: true,
        statistics: {
          userTypeDistribution: userTypeStats,
          riskLevelDistribution: riskLevelStats,
          activitySummary: activityStats[0] || {},
          recentGrowth: {
            newUsersLast30Days: recentUsers
          },
          securityOverview: securityStats,
          totalUsers: await User.countDocuments(),
          activeUsers: await User.countDocuments({
            'activityProfile.lastSeen': {
              $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          })
        }
      });

    } catch (error) {
      console.error('❌ Get user statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user statistics',
        error: error.message
      });
    }
  }
);

// === DEVICE FINGERPRINT MANAGEMENT ===

// GET /api/user-types/admin/devices - Get device fingerprints
router.get('/admin/devices',
  requireAdmin,
  requirePermission('view_device_fingerprints'),
  async (req, res) => {
    try {
      const {
        riskLevel = 'all',
        quarantined = 'all',
        page = 1,
        limit = 50
      } = req.query;

      const query = {};
      
      if (riskLevel !== 'all') {
        query['securityProfile.riskLevel'] = riskLevel;
      }
      
      if (quarantined !== 'all') {
        query['securityProfile.quarantineStatus'] = quarantined === 'true';
      }

      const devices = await DeviceFingerprint.find(query)
        .sort({ lastSeen: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const totalDevices = await DeviceFingerprint.countDocuments(query);

      // Find associated users for each device
      const devicesWithUsers = await Promise.all(devices.map(async (device) => {
        const user = await User.findOne({
          _id: device.userId
        }).select('userId userType').lean();

        return {
          ...device,
          associatedUser: user
        };
      }));

      res.json({
        success: true,
        devices: devicesWithUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalDevices / limit),
          totalDevices,
          hasMore: page * limit < totalDevices
        }
      });

    } catch (error) {
      console.error('❌ Get devices error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get device fingerprints',
        error: error.message
      });
    }
  }
);

// PUT /api/user-types/admin/device/:fingerprintId/quarantine - Quarantine device
router.put('/admin/device/:fingerprintId/quarantine',
  requireAdmin,
  requirePermission('manage_quarantine'),
  async (req, res) => {
    try {
      const { quarantine, reason } = req.body;
      
      const device = await DeviceFingerprint.findOne({ 
        fingerprintId: req.params.fingerprintId 
      });
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }

      device.securityProfile.quarantineStatus = quarantine;
      if (quarantine) {
        device.securityProfile.quarantineUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        device.securityProfile.quarantineReason = reason || 'Admin quarantine';
        // Log quarantine event to device history
        device.addQuarantineEvent(reason || 'Admin quarantine', 'moderator');
      } else {
        device.securityProfile.quarantineUntil = null;
        device.securityProfile.quarantineReason = null;
      }

      await device.save();

      // Also quarantine associated user
      const user = await User.findById(device.userId);
      
      if (user) {
        user.securityProfile.quarantineStatus = quarantine;
        if (quarantine) {
          user.addSecurityEvent(
            'device_quarantine',
            `Device quarantined by admin: ${reason}`,
            'high'
          );
        } else {
          user.addSecurityEvent(
            'device_unquarantine',
            'Device released from quarantine by admin',
            'low'
          );
        }
        await user.save();
      }

      // --- Audit Log ---
      await logAdminAction(
        req,
        'user_quarantine_status_change',
        { status: quarantine ? 'quarantined' : 'unquarantined', reason, byDevice: true },
        'high',
        { id: device.fingerprintId, type: 'DeviceFingerprint' }
      );

      console.log(`✅ Device ${device.fingerprintId} ${quarantine ? 'quarantined' : 'unquarantined'}`);

      res.json({
        success: true,
        message: `Device ${quarantine ? 'quarantined' : 'unquarantined'} successfully`,
        device: {
          fingerprintId: device.fingerprintId,
          quarantineStatus: device.securityProfile.quarantineStatus
        }
      });

    } catch (error) {
      console.error('❌ Device quarantine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update device quarantine status',
        error: error.message
      });
    }
  }
);

// === BULK OPERATIONS ===

// POST /api/user-types/admin/bulk/quarantine - Bulk quarantine operations
router.post('/admin/bulk/quarantine',
  requireAdmin,
  requirePermission('quarantine_users'),
  requireMinimumTrust(80), // High trust required for bulk operations
  async (req, res) => {
    try {
      const { userIds, quarantine, reason } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      // --- Audit Log for the bulk action ---
      await logAdminAction(
        req,
        'user_quarantine_status_change',
        { action: 'bulk', status: quarantine ? 'quarantined' : 'unquarantined', count: userIds.length, reason },
        'critical' // Bulk operations are critical severity
      );

      const updateData = {
        'securityProfile.quarantineStatus': quarantine
      };

      if (quarantine) {
        updateData['securityProfile.quarantineReason'] = reason || 'Bulk admin quarantine';
        updateData['securityProfile.quarantineUntil'] = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else {
        updateData['securityProfile.quarantineReason'] = null;
        updateData['securityProfile.quarantineUntil'] = null;
      }

      const result = await User.updateMany(
        { _id: { $in: userIds } },
        { $set: updateData }
      );

      // Log security events for each affected user
      for (const userId of userIds) {
        const user = await User.findById(userId);
        if (user) {
          if (quarantine) {
            user.addSecurityEvent(
              'admin_bulk_quarantine',
              `Bulk quarantined by admin: ${reason}`,
              'high'
            );
          } else {
            user.addSecurityEvent(
              'admin_bulk_unquarantine',
              'Bulk released from quarantine by admin',
              'low'
            );
          }
          await user.save();
        }
      }

      console.log(`✅ Bulk ${quarantine ? 'quarantine' : 'unquarantine'} operation: ${result.modifiedCount} users affected`);

      res.json({
        success: true,
        message: `${result.modifiedCount} users ${quarantine ? 'quarantined' : 'unquarantined'} successfully`,
        affectedUsers: result.modifiedCount
      });

    } catch (error) {
      console.error('❌ Bulk quarantine error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk quarantine operation',
        error: error.message
      });
    }
  }
);

module.exports = router;