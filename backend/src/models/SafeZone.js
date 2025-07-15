// === backend/src/models/SafeZone.js ===
const mongoose = require('mongoose');

const safeZoneSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  
  // Geographic Data
  location: {
    type: {
      type: String,
      enum: ['Point', 'Polygon'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed, // Array for Point [lng, lat], nested array for Polygon
      required: true,
      validate: {
        validator: function(coords) {
          if (this.location.type === 'Point') {
            return Array.isArray(coords) && coords.length === 2 &&
                   coords[1] >= -90 && coords[1] <= 90 && // Valid latitude
                   coords[0] >= -180 && coords[0] <= 180; // Valid longitude
          } else if (this.location.type === 'Polygon') {
            return Array.isArray(coords) && coords.length >= 1 &&
                   Array.isArray(coords[0]) && coords[0].length >= 4; // Polygon must be closed
          }
          return false;
        },
        message: 'Invalid coordinates for location type'
      }
    }
  },
  
  // Safe Zone Properties
  radius: {
    type: Number,
    min: 50,    // Minimum 50 meters
    max: 2000,  // Maximum 2 kilometers
    default: 200
  },
  
  safetyScore: {
    type: Number,
    min: 1,
    max: 10,
    required: true,
    default: 7
  },
  
  // Zone Type and Category
  zoneType: {
    type: String,
    enum: [
      'police_station',
      'hospital',
      'school',
      'mosque',
      'temple',
      'church',
      'community_center',
      'market',
      'transport_hub',
      'well_lit_area',
      'cctv_monitored',
      'community_patrol',
      'admin_designated',
      'other'
    ],
    required: true
  },
  
  category: {
    type: String,
    enum: ['public_safety', 'religious', 'educational', 'commercial', 'transport', 'community'],
    required: true
  },
  
  // Time-based Safety
  timeOfDaySafety: {
    morning: { type: Number, min: 1, max: 10, default: 8 },    // 6AM-12PM
    afternoon: { type: Number, min: 1, max: 10, default: 9 },  // 12PM-6PM
    evening: { type: Number, min: 1, max: 10, default: 7 },    // 6PM-10PM
    night: { type: Number, min: 1, max: 10, default: 5 },      // 10PM-6AM
    lateNight: { type: Number, min: 1, max: 10, default: 3 }   // 12AM-4AM
  },
  
  // Features and Amenities
  features: [{
    type: String,
    enum: [
      'cctv_surveillance',
      'police_presence',
      'security_guard',
      'well_lit',
      'emergency_phone',
      'first_aid',
      'crowd_density_high',
      'public_transport_nearby',
      'community_watch',
      'mobile_tower',
      'wifi_available'
    ]
  }],
  
  // Address and Location Details
  address: {
    thana: String,
    district: String,
    division: String,
    landmark: String,
    streetAddress: String
  },
  
  // Verification and Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'under_review', 'pending_verification'],
    default: 'active'
  },
  
  verificationStatus: {
    type: String,
    enum: ['verified', 'pending', 'community_reported', 'needs_update'],
    default: 'pending'
  },
  
  verifiedBy: {
    type: String, // Admin ID or verification source
    default: null
  },
  
  verifiedAt: {
    type: Date,
    default: null
  },
  
  // Community Feedback
  communityRating: {
    averageScore: { type: Number, min: 1, max: 10, default: null },
    totalRatings: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Analytics and Usage
  analytics: {
    viewCount: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 }, // How many times used in route planning
    reportCount: { type: Number, default: 0 }, // Associated crime reports nearby
    lastAnalyzed: { type: Date, default: Date.now }
  },
  
  // Metadata
  createdBy: {
    type: String,
    enum: ['admin', 'community', 'algorithm', 'import'],
    default: 'admin'
  },
  
  source: {
    type: String,
    enum: ['manual_entry', 'government_data', 'community_submission', 'algorithm_generated'],
    default: 'manual_entry'
  },
  
  tags: [String],
  
  // Additional Notes for Admins
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Auto-update settings
  autoUpdateSafety: {
    type: Boolean,
    default: true
  },
  
  lastSafetyUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
safeZoneSchema.index({ "location": "2dsphere" }); // Geospatial index
safeZoneSchema.index({ zoneType: 1 });
safeZoneSchema.index({ category: 1 });
safeZoneSchema.index({ status: 1 });
safeZoneSchema.index({ safetyScore: -1 });
safeZoneSchema.index({ createdAt: -1 });
safeZoneSchema.index({ "address.district": 1 });
safeZoneSchema.index({ "address.thana": 1 });

// Compound indexes for common queries
safeZoneSchema.index({ status: 1, zoneType: 1 });
safeZoneSchema.index({ status: 1, safetyScore: -1 });
safeZoneSchema.index({ "address.district": 1, zoneType: 1 });

// Virtual for getting the current time-of-day safety score
safeZoneSchema.virtual('currentSafetyScore').get(function() {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
    return this.timeOfDaySafety.morning;
  } else if (hour >= 12 && hour < 18) {
    return this.timeOfDaySafety.afternoon;
  } else if (hour >= 18 && hour < 22) {
    return this.timeOfDaySafety.evening;
  } else if (hour >= 22 || hour < 2) {
    return this.timeOfDaySafety.night;
  } else {
    return this.timeOfDaySafety.lateNight;
  }
});

// Method to calculate distance from a point
safeZoneSchema.methods.distanceFrom = function(lat, lng) {
  if (this.location.type === 'Point') {
    const [zoneLng, zoneLat] = this.location.coordinates;
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat * Math.PI/180;
    const φ2 = zoneLat * Math.PI/180;
    const Δφ = (zoneLat-lat) * Math.PI/180;
    const Δλ = (zoneLng-lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }
  return null; // For polygons, would need more complex calculation
};

// Method to check if point is within safe zone
safeZoneSchema.methods.containsPoint = function(lat, lng) {
  if (this.location.type === 'Point') {
    const distance = this.distanceFrom(lat, lng);
    return distance <= this.radius;
  }
  // For polygons, would use point-in-polygon algorithm
  return false;
};

// Method to get zone as GeoJSON
safeZoneSchema.methods.toGeoJSON = function() {
  return {
    type: 'Feature',
    geometry: {
      type: this.location.type,
      coordinates: this.location.coordinates
    },
    properties: {
      id: this._id,
      name: this.name,
      description: this.description,
      zoneType: this.zoneType,
      category: this.category,
      safetyScore: this.safetyScore,
      currentSafetyScore: this.currentSafetyScore,
      radius: this.radius,
      features: this.features,
      address: this.address,
      status: this.status,
      verificationStatus: this.verificationStatus,
      communityRating: this.communityRating,
      timeOfDaySafety: this.timeOfDaySafety
    }
  };
};

// Static method to find safe zones near a location
safeZoneSchema.statics.findNearby = function(lat, lng, maxDistance = 2000, minSafetyScore = 6) {
  return this.find({
    status: 'active',
    safetyScore: { $gte: minSafetyScore },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

// Static method to get safe zones by district
safeZoneSchema.statics.findByDistrict = function(district, options = {}) {
  const query = {
    status: 'active',
    'address.district': new RegExp(district, 'i')
  };
  
  if (options.zoneType) {
    query.zoneType = options.zoneType;
  }
  
  if (options.minSafetyScore) {
    query.safetyScore = { $gte: options.minSafetyScore };
  }
  
  return this.find(query).sort({ safetyScore: -1 });
};

// Pre-save middleware to update lastSafetyUpdate when safety scores change
safeZoneSchema.pre('save', function(next) {
  if (this.isModified('safetyScore') || this.isModified('timeOfDaySafety')) {
    this.lastSafetyUpdate = new Date();
  }
  next();
});

// Post-save middleware to log safe zone creation/updates
safeZoneSchema.post('save', function(doc) {
  console.log(`🛡️ Safe zone ${doc.isNew ? 'created' : 'updated'}: ${doc.name} (${doc.zoneType}) - Safety: ${doc.safetyScore}/10`);
});

const SafeZone = mongoose.model('SafeZone', safeZoneSchema);

module.exports = SafeZone;