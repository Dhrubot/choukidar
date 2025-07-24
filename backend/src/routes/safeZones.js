// === backend/src/routes/safeZones.js ===
const express = require('express');
const router = express.Router();
const SafeZone = require('../models/SafeZone');
const AuditLog = require('../models/AuditLog'); // Import AuditLog for admin action logging
const { requireAdmin, requirePermission } = require('../middleware/roleBasedAccess'); // Corrected import
const { userTypeDetection } = require('../middleware/userTypeDetection'); // Import userTypeDetection
const { cacheLayer, cacheMiddleware } = require('../middleware/cacheLayer'); // Import Redis caching
const crypto = require('crypto'); // For hashing cache keys

// Apply user type detection to all routes in this router
router.use(userTypeDetection);

/**
 * Helper function to create an audit log entry for admin actions on safe zones.
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

// GET public safe zones (for map display)
router.get('/', 
  cacheMiddleware(600, (req) => {
    // Custom cache key for map queries - 10 minute cache
    const queryHash = crypto.createHash('md5')
      .update(JSON.stringify({
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius || 5000,
        minSafety: req.query.minSafety || 6,
        zoneType: req.query.zoneType,
        category: req.query.category,
        district: req.query.district,
        limit: req.query.limit || 100
      }))
      .digest('hex');
    return `safezones:map:${queryHash}`;
  }),
  async (req, res) => {
  try {
    const {
      lat,
      lng,
      radius = 5000,        // Default 5km radius
      minSafety = 6,        // Minimum safety score
      zoneType,
      category,
      district,
      limit = 100
    } = req.query;

    let query = { status: 'active' };

    // Add safety score filter
    if (minSafety) {
      query.safetyScore = { $gte: parseFloat(minSafety) };
    }

    // Add type filters
    if (zoneType) {
      query.zoneType = zoneType;
    }

    if (category) {
      query.category = category;
    }

    if (district) {
      query['address.district'] = new RegExp(district, 'i');
    }

    let safeZones;

    // If coordinates provided, find nearby zones
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const maxDistance = parseInt(radius);

      safeZones = await SafeZone.find({
        ...query,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: maxDistance
          }
        }
      })
      .limit(parseInt(limit))
      .select('-adminNotes -analytics.viewCount') // Exclude internal data
      .lean();

    } else {
      // Get all zones without location filter
      safeZones = await SafeZone.find(query)
        .sort({ safetyScore: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .select('-adminNotes -analytics.viewCount')
        .lean();
    }

    // Convert to GeoJSON format
    const geoJsonFeatures = safeZones.map(zone => {
      // Calculate distance if user location provided
      let distance = null;
      if (lat && lng && zone.location.type === 'Point') {
        const [zoneLng, zoneLat] = zone.location.coordinates;
        const R = 6371e3; // Earth's radius in meters
        const φ1 = parseFloat(lat) * Math.PI/180;
        const φ2 = zoneLat * Math.PI/180;
        const Δφ = (zoneLat - parseFloat(lat)) * Math.PI/180;
        const Δλ = (zoneLng - parseFloat(lng)) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distance = Math.round(R * c); // Distance in meters
      }

      // Calculate current time-based safety score
      const hour = new Date().getHours();
      let currentSafetyScore;
      if (hour >= 6 && hour < 12) {
        currentSafetyScore = zone.timeOfDaySafety?.morning || zone.safetyScore;
      } else if (hour >= 12 && hour < 18) {
        currentSafetyScore = zone.timeOfDaySafety?.afternoon || zone.safetyScore;
      } else if (hour >= 18 && hour < 22) {
        currentSafetyScore = zone.timeOfDaySafety?.evening || zone.safetyScore;
      } else if (hour >= 22 || hour < 2) {
        currentSafetyScore = zone.timeOfDaySafety?.night || zone.safetyScore;
      } else {
        currentSafetyScore = zone.timeOfDaySafety?.lateNight || zone.safetyScore;
      }

      return {
        type: 'Feature',
        geometry: zone.location,
        properties: {
          id: zone._id,
          name: zone.name,
          description: zone.description,
          zoneType: zone.zoneType,
          category: zone.category,
          safetyScore: zone.safetyScore,
          currentSafetyScore,
          radius: zone.radius,
          features: zone.features || [],
          address: zone.address || {},
          verificationStatus: zone.verificationStatus,
          communityRating: zone.communityRating || {},
          timeOfDaySafety: zone.timeOfDaySafety || {},
          distance,
          lastUpdated: zone.updatedAt
        }
      };
    });

    console.log(`✅ Retrieved ${safeZones.length} safe zones${lat && lng ? ` near ${lat}, ${lng}` : ''}`);

    res.json({
      success: true,
      count: safeZones.length,
      type: 'FeatureCollection',
      features: geoJsonFeatures,
      metadata: {
        query: {
          location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
          radius: lat && lng ? parseInt(radius) : null,
          minSafety: parseFloat(minSafety),
          filters: { zoneType, category, district }
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching safe zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching safe zones',
      error: error.message
    });
  }
});

// GET specific safe zone by ID
router.get('/:id', 
  cacheMiddleware(1800, (req) => {
    // Cache individual safe zones for 30 minutes
    return `safezone:detail:${req.params.id}`;
  }),
  async (req, res) => {
  try {
    const safeZone = await SafeZone.findById(req.params.id)
      .select('-adminNotes'); // Exclude admin notes from public API

    if (!safeZone) {
      return res.status(404).json({
        success: false,
        message: 'Safe zone not found'
      });
    }

    // Increment view count
    await SafeZone.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.viewCount': 1 }
    });

    res.json({
      success: true,
      data: safeZone.toGeoJSON()
    });

  } catch (error) {
    console.error('❌ Error fetching safe zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching safe zone',
      error: error.message
    });
  }
});

// GET safe zones by district/thana
router.get('/location/:district', 
  cacheMiddleware(900, (req) => {
    // Cache location-based queries for 15 minutes
    const queryHash = crypto.createHash('md5')
      .update(JSON.stringify({
        district: req.params.district,
        thana: req.query.thana,
        zoneType: req.query.zoneType,
        minSafety: req.query.minSafety || 6,
        limit: req.query.limit || 50
      }))
      .digest('hex');
    return `safezones:location:${queryHash}`;
  }),
  async (req, res) => {
  try {
    const { district } = req.params;
    const { thana, zoneType, minSafety = 6, limit = 50 } = req.query;

    let query = {
      status: 'active',
      'address.district': new RegExp(district, 'i'),
      safetyScore: { $gte: parseFloat(minSafety) }
    };

    if (thana) {
      query['address.thana'] = new RegExp(thana, 'i');
    }

    if (zoneType) {
      query.zoneType = zoneType;
    }

    const safeZones = await SafeZone.find(query)
      .sort({ safetyScore: -1 })
      .limit(parseInt(limit))
      .select('-adminNotes -analytics.viewCount')
      .lean();

    const geoJsonFeatures = safeZones.map(zone => ({
      type: 'Feature',
      geometry: zone.location,
      properties: {
        id: zone._id,
        name: zone.name,
        description: zone.description,
        zoneType: zone.zoneType,
        category: zone.category,
        safetyScore: zone.safetyScore,
        radius: zone.radius,
        features: zone.features || [],
        address: zone.address || {},
        verificationStatus: zone.verificationStatus,
        communityRating: zone.communityRating || {}
      }
    }));

    console.log(`✅ Retrieved ${safeZones.length} safe zones for ${district}${thana ? `/${thana}` : ''}`);

    res.json({
      success: true,
      count: safeZones.length,
      location: { district, thana },
      type: 'FeatureCollection',
      features: geoJsonFeatures
    });

  } catch (error) {
    console.error('❌ Error fetching safe zones by location:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching safe zones by location',
      error: error.message
    });
  }
});

// GET safe zone analytics (public statistics)
router.get('/analytics/public', 
  cacheMiddleware(1800, () => {
    // Cache analytics for 30 minutes - same for all users
    return 'safezones:analytics:public';
  }),
  async (req, res) => {
  try {
    const stats = await SafeZone.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          totalZones: { $sum: 1 },
          averageSafety: { $avg: '$safetyScore' },
          highSafetyZones: {
            $sum: { $cond: [{ $gte: ['$safetyScore', 8] }, 1, 0] }
          },
          mediumSafetyZones: {
            $sum: { $cond: [{ $and: [{ $gte: ['$safetyScore', 6] }, { $lt: ['$safetyScore', 8] }] }, 1, 0] }
          },
          lowSafetyZones: {
            $sum: { $cond: [{ $lt: ['$safetyScore', 6] }, 1, 0] }
          }
        }
      }
    ]);

    const zoneTypeBreakdown = await SafeZone.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$zoneType',
          count: { $sum: 1 },
          averageSafety: { $avg: '$safetyScore' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const districtBreakdown = await SafeZone.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$address.district',
          count: { $sum: 1 },
          averageSafety: { $avg: '$safetyScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalZones: 0,
          averageSafety: 0,
          highSafetyZones: 0,
          mediumSafetyZones: 0,
          lowSafetyZones: 0
        },
        byType: zoneTypeBreakdown,
        byDistrict: districtBreakdown,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching safe zone analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching safe zone analytics',
      error: error.message
    });
  }
});

// ========== ADMIN ENDPOINTS ==========

// GET all safe zones (admin only)
router.get('/admin/all', 
  requireAdmin, 
  requirePermission('view_safe_zones'),
  async (req, res) => {
  try {
    const {
      status,
      zoneType,
      verificationStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 100,
      offset = 0
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (zoneType) query.zoneType = zoneType;
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const safeZones = await SafeZone.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await SafeZone.countDocuments(query);

    console.log(`✅ Admin retrieved ${safeZones.length} safe zones (${total} total)`);

    res.json({
      success: true,
      count: safeZones.length,
      total,
      data: safeZones,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + safeZones.length) < total
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin safe zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin safe zones',
      error: error.message
    });
  }
});

// POST create new safe zone (admin only)
router.post('/admin/create', 
  requireAdmin, 
  requirePermission('create_safe_zones'),
  async (req, res) => {
  try {
    const safeZoneData = {
      ...req.body,
      createdBy: 'admin',
      source: 'manual_entry',
      verifiedBy: req.userContext.user.roleData.admin.username,
      verifiedAt: new Date(),
      verificationStatus: 'admin_verified'
    };

    const safeZone = new SafeZone(safeZoneData);
    await safeZone.save();

    // --- Audit Log ---
    await logAdminAction(
        req,
        'safezone_create',
        { name: safeZone.name, zoneType: safeZone.zoneType },
        'high',
        { id: safeZone._id, type: 'SafeZone', name: safeZone.name }
    );

      // === FIX #2: GRANULAR CACHE INVALIDATION ===
    await Promise.all([
        cacheLayer.delete('safezones:analytics:public'),
        cacheLayer.delete('admin:dashboard:stats')
        // Let map view caches expire naturally via their TTL
    ]);

    console.log(`✅ Admin created safe zone: ${safeZone.name} (${safeZone.zoneType})`);

    res.status(201).json({
      success: true,
      message: 'Safe zone created successfully',
      data: safeZone.toGeoJSON()
    });

  } catch (error) {
    console.error('❌ Error creating safe zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating safe zone',
      error: error.message
    });
  }
});

// PUT update safe zone (admin only)
router.put('/admin/:id', 
  requireAdmin, 
  requirePermission('edit_safe_zones'),
  async (req, res) => {
  try {
    const safeZone = await SafeZone.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        lastSafetyUpdate: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!safeZone) {
      return res.status(404).json({
        success: false,
        message: 'Safe zone not found'
      });
    }

    // --- Audit Log ---
    await logAdminAction(
        req,
        'safezone_update',
        { updatedFields: Object.keys(req.body) },
        'medium',
        { id: safeZone._id, type: 'SafeZone', name: safeZone.name }
    );

    // Invalidate relevant caches after updating a safe zone
     await Promise.all([
        cacheLayer.delete(`safezone:detail:${req.params.id}`), // Invalidate this specific zone
        cacheLayer.delete('safezones:analytics:public'),
        cacheLayer.delete('admin:dashboard:stats')
    ]);

    console.log(`✅ Admin updated safe zone: ${safeZone.name}`);

    res.json({
      success: true,
      message: 'Safe zone updated successfully',
      data: safeZone.toGeoJSON()
    });

  } catch (error) {
    console.error('❌ Error updating safe zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating safe zone',
      error: error.message
    });
  }
});

// DELETE safe zone (admin only)
router.delete('/admin/:id', 
  requireAdmin, 
  requirePermission('delete_safe_zones'),
  async (req, res) => {
  try {
    const safeZone = await SafeZone.findByIdAndDelete(req.params.id);

    if (!safeZone) {
      return res.status(404).json({
        success: false,
        message: 'Safe zone not found'
      });
    }

    // --- Audit Log ---
    await logAdminAction(
        req,
        'safezone_delete',
        {},
        'high',
        { id: safeZone._id, type: 'SafeZone', name: safeZone.name }
    );

    // Invalidate relevant caches after deleting a safe zone
    // === FIX #2: GRANULAR CACHE INVALIDATION ===
    await Promise.all([
        cacheLayer.delete(`safezone:detail:${req.params.id}`),
        cacheLayer.delete('safezones:analytics:public'),
        cacheLayer.delete('admin:dashboard:stats')
    ])

    console.log(`✅ Admin deleted safe zone: ${safeZone.name}`);

    res.json({
      success: true,
      message: 'Safe zone deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting safe zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting safe zone',
      error: error.message
    });
  }
});

// PUT bulk update safe zone statuses (admin only)
router.put('/admin/bulk/status', 
  requireAdmin, 
  requirePermission('manage_safe_zone_categories'),
  async (req, res) => {
  try {
    const { safeZoneIds, status } = req.body;

    if (!Array.isArray(safeZoneIds) || !status) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Provide safeZoneIds array and status.'
      });
    }

    const result = await SafeZone.updateMany(
      { _id: { $in: safeZoneIds } },
      { 
        status,
        lastSafetyUpdate: new Date()
      }
    );

    // --- Audit Log ---
    await logAdminAction(
        req,
        'safezone_bulk_update',
        { safeZoneIds, status, count: result.modifiedCount },
        'high'
    );

    // Invalidate relevant caches after bulk updating safe zones
    await cacheLayer.deletePattern('safezones:*');
    await cacheLayer.deletePattern('admin:*');

    console.log(`✅ Admin bulk updated ${result.modifiedCount} safe zones to status: ${status}`);

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} safe zones`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error bulk updating safe zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating safe zones',
      error: error.message
    });
  }
});

// GET admin analytics and statistics
router.get('/admin/analytics', 
  requireAdmin, 
  requirePermission('view_admin_analytics'),
  async (req, res) => {
  try {
    // Overall statistics
    const overallStats = await SafeZone.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending_verification'] }, 1, 0] } },
          verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] } },
          averageSafety: { $avg: '$safetyScore' },
          totalViews: { $sum: '$analytics.viewCount' },
          totalUsage: { $sum: '$analytics.usageCount' }
        }
      }
    ]);

    // Zone type breakdown
    const zoneTypeStats = await SafeZone.aggregate([
      {
        $group: {
          _id: '$zoneType',
          count: { $sum: 1 },
          averageSafety: { $avg: '$safetyScore' },
          verified: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // District distribution
    const districtStats = await SafeZone.aggregate([
      {
        $group: {
          _id: '$address.district',
          count: { $sum: 1 },
          averageSafety: { $avg: '$safetyScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await SafeZone.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Safety score distribution
    const safetyDistribution = await SafeZone.aggregate([
      {
        $bucket: {
          groupBy: '$safetyScore',
          boundaries: [1, 3, 5, 7, 9, 11],
          default: 'other',
          output: {
            count: { $sum: 1 },
            zones: { $push: { name: '$name', id: '$_id' } }
          }
        }
      }
    ]);

    // Verification status breakdown
    const verificationStats = await SafeZone.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Top performing zones (by usage)
    const topZones = await SafeZone.find({})
      .sort({ 'analytics.usageCount': -1 })
      .limit(10)
      .select('name zoneType safetyScore analytics address')
      .lean();

    res.json({
      success: true,
      data: {
        overview: overallStats[0] || {},
        byZoneType: zoneTypeStats,
        byDistrict: districtStats,
        recentActivity,
        safetyDistribution,
        verificationBreakdown: verificationStats,
        topPerforming: topZones,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error fetching admin analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin analytics',
      error: error.message
    });
  }
});

// POST import safe zones from data (admin only)
router.post('/admin/import', 
  requireAdmin, 
  requirePermission('system_configuration'),
  async (req, res) => {
  try {
    const { safeZones, source = 'import', overwrite = false } = req.body;

    if (!Array.isArray(safeZones)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format. Expected array of safe zones.'
      });
    }

    // --- Audit Log for the import action itself ---
    await logAdminAction(
        req,
        'data_import',
        { source: 'safeZones', count: safeZones.length, overwrite },
        'high'
    );

    const results = {
      created: 0,
      updated: 0,
      errors: []
    };

    for (const zoneData of safeZones) {
      try {
        // Add import metadata
        const safeZoneData = {
          ...zoneData,
          source,
          createdBy: 'import',
          verificationStatus: 'pending'
        };

        // Check if zone already exists (by name and coordinates)
        const existingZone = await SafeZone.findOne({
          name: zoneData.name,
          'location.coordinates': zoneData.location.coordinates
        });

        if (existingZone && !overwrite) {
          results.errors.push({
            name: zoneData.name,
            error: 'Zone already exists'
          });
          continue;
        }

        if (existingZone && overwrite) {
          await SafeZone.findByIdAndUpdate(existingZone._id, safeZoneData);
          results.updated++;
        } else {
          const newZone = new SafeZone(safeZoneData);
          await newZone.save();
          results.created++;
        }

      } catch (error) {
        results.errors.push({
          name: zoneData.name || 'Unknown',
          error: error.message
        });
      }
    }

    // Invalidate relevant caches after importing safe zones
    await cacheLayer.deletePattern('safezones:*');
    await cacheLayer.deletePattern('admin:*');

    console.log(`✅ Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      success: true,
      message: 'Import completed',
      results
    });

  } catch (error) {
    console.error('❌ Error importing safe zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing safe zones',
      error: error.message
    });
  }
});

// GET export safe zones data (admin only)
router.get('/admin/export', 
  requireAdmin, 
  requirePermission('export_data'),
  async (req, res) => {
  try {
    const { format = 'json', status = 'active' } = req.query;

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const safeZones = await SafeZone.find(query)
      .sort({ createdAt: -1 })
      .lean();
      
    // --- Audit Log ---
    await logAdminAction(
        req,
        'data_export',
        { source: 'safeZones', format, count: safeZones.length },
        'high'
    );

    if (format === 'geojson') {
      const geoJsonFeatures = safeZones.map(zone => ({
        type: 'Feature',
        geometry: zone.location,
        properties: {
          ...zone,
          _id: zone._id.toString(),
          location: undefined // Remove duplicate location data
        }
      }));

      res.json({
        type: 'FeatureCollection',
        features: geoJsonFeatures,
        metadata: {
          exportedAt: new Date().toISOString(),
          count: safeZones.length,
          source: 'SafeStreets Bangladesh Admin'
        }
      });
    } else {
      res.json({
        success: true,
        data: safeZones,
        metadata: {
          exportedAt: new Date().toISOString(),
          count: safeZones.length,
          format: 'json'
        }
      });
    }

    console.log(`✅ Admin exported ${safeZones.length} safe zones in ${format} format`);

  } catch (error) {
    console.error('❌ Error exporting safe zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting safe zones',
      error: error.message
    });
  }
});

module.exports = router;