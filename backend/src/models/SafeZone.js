// === backend/src/models/SafeZone.js (COMPLETE MERGED VERSION) ===
// Enhanced SafeZone Model with Female Safety Integration + All Original Features Preserved
// Combines comprehensive female safety features with robust original functionality

const mongoose = require('mongoose');

const safeZoneSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Geographic Data - PRESERVED: Enhanced validation from original
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
  
  // Safe Zone Properties - PRESERVED: Original radius constraints
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
  
  // Enhanced zone types with female safety considerations
  zoneType: {
    type: String,
    enum: [
      // PRESERVED: Original types
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
      'other',
      // ENHANCED: Female safety specific types
      'university',
      'government_building',
      'shopping_mall',
      'bank',
      'atm',
      'bus_station',
      'train_station',
      'airport',
      'hotel',
      'restaurant',
      'park',
      'residential',
      'commercial',
      'industrial',
      'women_center',           // Women's community centers
      'female_clinic',          // Female healthcare facilities
      'girls_school',           // Girls' educational institutions
      'women_shelter',          // Women's shelters and safe houses
      'female_restroom',        // Safe public restrooms for women
      'busy_public_space',      // Busy, well-populated areas
      'female_only_transport',  // Women-only transport stops
      'safe_waiting_area',      // Safe waiting areas for women
      'emergency_booth'         // Emergency call booths
    ],
    required: true
  },
  
  // PRESERVED: Original category system + Enhanced categories
  category: {
    type: String,
    enum: [
      'public_safety', 
      'religious', 
      'educational', 
      'commercial', 
      'transport', 
      'community',
      // ENHANCED: Female safety categories
      'security',
      'healthcare',
      'government',
      'emergency',
      'female_safety',          // General female safety
      'female_healthcare',      // Female-specific healthcare
      'female_education',       // Female education facilities
      'female_services',        // Services specifically for women
      'anti_harassment',        // Anti-harassment zones
      'cultural_safe_space'     // Culturally appropriate spaces
    ],
    required: true
  },
  
  // PRESERVED: Original time-based safety + Enhanced female safety
  timeOfDaySafety: {
    morning: { type: Number, min: 1, max: 10, default: 8 },    // 6AM-12PM
    afternoon: { type: Number, min: 1, max: 10, default: 9 },  // 12PM-6PM
    evening: { type: Number, min: 1, max: 10, default: 7 },    // 6PM-10PM
    night: { type: Number, min: 1, max: 10, default: 5 },      // 10PM-6AM
    lateNight: { type: Number, min: 1, max: 10, default: 3 },   // 12AM-4AM
    // ENHANCED: Female-specific time safety
    femaleSafety: {
      morning: { type: Number, min: 1, max: 10, default: 7 },
      afternoon: { type: Number, min: 1, max: 10, default: 6 },
      evening: { type: Number, min: 1, max: 10, default: 5 },
      night: { type: Number, min: 1, max: 10, default: 3 },
      lateNight: { type: Number, min: 1, max: 10, default: 2 }
    }
  },
  
  // PRESERVED: Original features enum + Enhanced with female safety
  features: [{
    type: String,
    enum: [
      // PRESERVED: Original features
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
      'wifi_available',
      // ENHANCED: Female safety features
      'female_staff',              // Female staff available
      'female_security',           // Female security personnel
      'female_only_spaces',        // Female-only areas
      'safe_waiting_area',         // Safe waiting areas
      'emergency_contacts',        // Emergency contact system
      'harassment_reporting',      // Harassment reporting system
      'cultural_sensitivity',      // Cultural sensitivity training
      'privacy_protection',        // Privacy protection measures
      'family_friendly',           // Family-friendly environment
      'crowd_monitoring',          // Crowd monitoring for safety
      'wheelchair_accessible',     // Accessibility
      'restrooms',                 // Restroom facilities
      'food_available',            // Food services
      'parking_available'          // Parking facilities
    ]
  }],
  
  // PRESERVED: Original address structure + Enhanced with cultural context
  address: {
    // PRESERVED: Original fields
    thana: String,
    district: String,
    division: String,
    landmark: String,
    streetAddress: String,
    // ENHANCED: Additional fields
    street: String,
    area: String,
    postcode: String,
    // ENHANCED: Cultural context
    culturalArea: {
      type: String,
      enum: ['conservative', 'liberal', 'mixed', 'religious', 'commercial', 'residential']
    },
    demographicContext: {
      type: String,
      enum: ['family_area', 'student_area', 'business_area', 'mixed_population']
    }
  },
  
  // PRESERVED: Original verification system + Enhanced
  status: {
    type: String,
    enum: ['active', 'inactive', 'under_review', 'pending_verification', 'pending', 'closed'],
    default: 'active'
  },
  
  verificationStatus: {
    type: String,
    enum: ['verified', 'pending', 'community_reported', 'needs_update', 'unverified', 'community_verified', 'admin_verified', 'female_verified'],
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
  
  // PRESERVED: Original community feedback + Enhanced with female ratings
  communityRating: {
    averageScore: { type: Number, min: 1, max: 10, default: null },
    totalRatings: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    // ENHANCED: Female-specific ratings
    femaleRatings: {
      average: { type: Number, min: 1, max: 10, default: 5 },
      totalRatings: { type: Number, default: 0 },
      recentRatings: [{
        rating: { type: Number, min: 1, max: 10 },
        comment: String,
        timestamp: { type: Date, default: Date.now },
        timeOfDay: { type: String, enum: ['morning', 'afternoon', 'evening', 'night'] }
      }]
    }
  },
  
  // PRESERVED: Original analytics - RESTORED from original
  analytics: {
    viewCount: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 }, // How many times used in route planning
    reportCount: { type: Number, default: 0 }, // Associated crime reports nearby
    lastAnalyzed: { type: Date, default: Date.now }
  },
  
  // ENHANCED: New female safety configuration
  femaleSafety: {
    // Safety ratings specific to women
    overallFemaleSafety: { type: Number, min: 1, max: 10, default: 5 },
    
    // Specific safety aspects
    harassmentRisk: { type: Number, min: 1, max: 10, default: 5 },     // Lower = safer
    stalkingRisk: { type: Number, min: 1, max: 10, default: 5 },       // Lower = safer
    physicalSafety: { type: Number, min: 1, max: 10, default: 5 },     // Higher = safer
    
    // Cultural considerations
    culturallyAppropriate: { type: Boolean, default: true },
    conservativeAreaFriendly: { type: Boolean, default: true },
    religiousContext: { type: Boolean, default: false },
    
    // Special accommodations
    femaleOnlyHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      days: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }]
    },
    
    // Support services
    supportServices: {
      counseling: { type: Boolean, default: false },
      legal_aid: { type: Boolean, default: false },
      medical_assistance: { type: Boolean, default: false },
      shelter_referral: { type: Boolean, default: false },
      emergency_contacts: { type: Boolean, default: false }
    },
    
    // Safety recommendations
    safetyRecommendations: {
      bestTimeToVisit: { type: String, default: 'daytime' },
      accompaniedRecommended: { type: Boolean, default: false },
      avoidAfterDark: { type: Boolean, default: false },
      useMainEntrance: { type: Boolean, default: true },
      stayInPublicAreas: { type: Boolean, default: true }
    }
  },
  
  // ENHANCED: Enhanced reporting and incidents
  reportedIncidents: {
    harassment: { type: Number, default: 0 },
    stalking: { type: Number, default: 0 },
    inappropriate_behavior: { type: Number, default: 0 },
    theft: { type: Number, default: 0 },
    general_safety: { type: Number, default: 0 },
    lastIncident: Date
  },
  
  // PRESERVED: Original metadata + Enhanced
  createdBy: {
    type: String,
    enum: ['admin', 'community', 'algorithm', 'import', 'government', 'ngo', 'female_safety_audit'],
    default: 'admin'
  },
  
  source: {
    type: String,
    enum: ['manual_entry', 'government_data', 'community_submission', 'algorithm_generated'],
    default: 'manual_entry'
  },
  
  // PRESERVED: Original tags - RESTORED
  tags: [String],
  
  // PRESERVED: Original admin notes - RESTORED
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  
  // ENHANCED: Female safety verification
  femaleVerification: {
    verifiedByFemale: { type: Boolean, default: false },
    verifierInfo: String,
    verificationDate: Date,
    verificationComments: String
  },
  
  // ENHANCED: Enhanced metadata
  metadata: {
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    // ENHANCED: Female safety priority
    femaleSafetyPriority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  
  // ENHANCED: Operating hours
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String },
    // ENHANCED: Female-only hours
    femaleOnlyHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String }
    }
  },
  
  // ENHANCED: Contact information
  contactInfo: {
    phone: String,
    email: String,
    website: String,
    // ENHANCED: Female safety contacts
    femaleContactPerson: String,
    emergencyContact: String,
    safetyOfficer: String
  },
  
  // ENHANCED: Additional notes
  notes: {
    type: String,
    maxlength: 1000
  },
  
  // PRESERVED: Original auto-update settings
  autoUpdateSafety: {
    type: Boolean,
    default: true
  },
  
  lastSafetyUpdate: {
    type: Date,
    default: Date.now
  },
  
  // ENHANCED: Female safety update tracking
  lastFemaleSafetyUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// PRESERVED: All original indexes + Enhanced with female safety
safeZoneSchema.index({ "location": "2dsphere" }); // Geospatial index
safeZoneSchema.index({ zoneType: 1 });
safeZoneSchema.index({ category: 1 });
safeZoneSchema.index({ status: 1 });
safeZoneSchema.index({ safetyScore: -1 });
safeZoneSchema.index({ createdAt: -1 });
safeZoneSchema.index({ "address.district": 1 });
safeZoneSchema.index({ "address.thana": 1 });

// ENHANCED: Female safety indexes
safeZoneSchema.index({ "femaleSafety.overallFemaleSafety": -1 });
safeZoneSchema.index({ "femaleSafety.culturallyAppropriate": 1 });
safeZoneSchema.index({ "femaleSafety.conservativeAreaFriendly": 1 });
safeZoneSchema.index({ "femaleVerification.verifiedByFemale": 1 });

// PRESERVED: Original compound indexes + Enhanced
safeZoneSchema.index({ status: 1, zoneType: 1 });
safeZoneSchema.index({ status: 1, safetyScore: -1 });
safeZoneSchema.index({ "address.district": 1, zoneType: 1 });
safeZoneSchema.index({ status: 1, category: 1, "femaleSafety.overallFemaleSafety": -1 });

// PRESERVED: Original virtual + Enhanced
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

// ENHANCED: Virtual for getting current female safety score
safeZoneSchema.virtual('currentFemaleSafetyScore').get(function() {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
    return this.timeOfDaySafety.femaleSafety.morning;
  } else if (hour >= 12 && hour < 18) {
    return this.timeOfDaySafety.femaleSafety.afternoon;
  } else if (hour >= 18 && hour < 22) {
    return this.timeOfDaySafety.femaleSafety.evening;
  } else if (hour >= 22 || hour < 2) {
    return this.timeOfDaySafety.femaleSafety.night;
  } else {
    return this.timeOfDaySafety.femaleSafety.lateNight;
  }
});

// PRESERVED: Original distance method
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

// PRESERVED: Original containsPoint method
safeZoneSchema.methods.containsPoint = function(lat, lng) {
  if (this.location.type === 'Point') {
    const distance = this.distanceFrom(lat, lng);
    return distance <= this.radius;
  }
  // For polygons, would use point-in-polygon algorithm
  return false;
};

// ENHANCED: Method to get female safety recommendations
safeZoneSchema.methods.getFemaleSafetyRecommendations = function() {
  const recommendations = [];
  
  // Time-based recommendations
  if (this.femaleSafety.safetyRecommendations.avoidAfterDark) {
    recommendations.push({
      type: 'time',
      message: 'Best visited during daylight hours',
      priority: 'high'
    });
  }
  
  // Accompaniment recommendations
  if (this.femaleSafety.safetyRecommendations.accompaniedRecommended) {
    recommendations.push({
      type: 'accompaniment',
      message: 'Consider visiting with a friend or family member',
      priority: 'medium'
    });
  }
  
  // Cultural recommendations
  if (this.address.culturalArea === 'conservative') {
    recommendations.push({
      type: 'cultural',
      message: 'Conservative area - dress modestly for comfort',
      priority: 'low'
    });
  }
  
  // Safety features recommendations
  if (this.features.includes('female_staff')) {
    recommendations.push({
      type: 'feature',
      message: 'Female staff available for assistance',
      priority: 'low'
    });
  }
  
  return recommendations;
};

// PRESERVED: Original toGeoJSON method + Enhanced with female safety
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
      timeOfDaySafety: this.timeOfDaySafety,
      // ENHANCED: Female safety data
      femaleSafety: this.femaleSafety,
      currentFemaleSafetyScore: this.currentFemaleSafetyScore,
      femaleVerification: this.femaleVerification,
      femaleSafetyRecommendations: this.getFemaleSafetyRecommendations()
    }
  };
};

// PRESERVED: Original findNearby method + Enhanced with female safety options
safeZoneSchema.statics.findNearby = function(lat, lng, options = {}) {
  const {
    maxDistance = 2000,
    minSafetyScore = 6,
    femaleSafetyMode = false,
    culturallyAppropriate = false,
    timeOfDay = 'any'
  } = options;
  
  const query = {
    status: 'active',
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    }
  };
  
  // Apply female safety filters
  if (femaleSafetyMode) {
    query['femaleSafety.overallFemaleSafety'] = { $gte: minSafetyScore };
    
    if (culturallyAppropriate) {
      query['femaleSafety.culturallyAppropriate'] = true;
    }
  } else {
    query.safetyScore = { $gte: minSafetyScore };
  }
  
  return this.find(query);
};

// PRESERVED: Original findByDistrict method + Enhanced with female safety
safeZoneSchema.statics.findByDistrict = function(district, options = {}) {
  const {
    zoneType = null,
    minSafetyScore = null,
    femaleSafetyMode = false,
    culturalArea = null
  } = options;
  
  const query = {
    status: 'active',
    'address.district': new RegExp(district, 'i')
  };
  
  if (zoneType) {
    query.zoneType = zoneType;
  }
  
  if (minSafetyScore) {
    if (femaleSafetyMode) {
      query['femaleSafety.overallFemaleSafety'] = { $gte: minSafetyScore };
    } else {
      query.safetyScore = { $gte: minSafetyScore };
    }
  }
  
  if (culturalArea) {
    query['address.culturalArea'] = culturalArea;
  }
  
  return this.find(query).sort({ 
    [femaleSafetyMode ? 'femaleSafety.overallFemaleSafety' : 'safetyScore']: -1 
  });
};

// ENHANCED: Static method to find female-specific safe zones
safeZoneSchema.statics.findFemaleSafeZones = function(lat, lng, options = {}) {
  const {
    maxDistance = 2000,
    minFemaleSafetyScore = 6,
    culturallyAppropriate = true,
    timeOfDay = 'any'
  } = options;
  
  const query = {
    status: 'active',
    category: { $in: ['female_safety', 'female_healthcare', 'female_education', 'female_services'] },
    'femaleSafety.overallFemaleSafety': { $gte: minFemaleSafetyScore },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        $maxDistance: maxDistance
      }
    }
  };
  
  if (culturallyAppropriate) {
    query['femaleSafety.culturallyAppropriate'] = true;
  }
  
  return this.find(query);
};

// ENHANCED: Static method to get female safety statistics
safeZoneSchema.statics.getFemaleSafetyStats = async function() {
  const stats = await this.aggregate([
    {
      $match: { 
        status: 'active',
        category: { $in: ['female_safety', 'female_healthcare', 'female_education', 'female_services'] }
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgFemaleSafety: { $avg: '$femaleSafety.overallFemaleSafety' },
        verifiedCount: {
          $sum: { $cond: ['$femaleVerification.verifiedByFemale', 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return stats;
};

// PRESERVED: Original pre-save middleware + Enhanced with female safety
safeZoneSchema.pre('save', function(next) {
  if (this.isModified('safetyScore') || this.isModified('timeOfDaySafety')) {
    this.lastSafetyUpdate = new Date();
  }
  
  // ENHANCED: Update female safety timestamp
  if (this.isModified('femaleSafety')) {
    this.lastFemaleSafetyUpdate = new Date();
  }
  
  next();
});

// PRESERVED: Original post-save middleware + Enhanced with female safety logging
safeZoneSchema.post('save', function(doc) {
  const safetyType = doc.category.includes('female') ? 'Female Safety' : 'General';
  const safetyScore = doc.category.includes('female') ? doc.femaleSafety.overallFemaleSafety : doc.safetyScore;
  
  console.log(`🛡️ ${safetyType} safe zone ${doc.isNew ? 'created' : 'updated'}: ${doc.name} (${doc.zoneType}) - Safety: ${safetyScore}/10`);
  
  // Special logging for female safety zones
  if (doc.category.includes('female') && doc.isNew) {
    console.log(`🌸 Female safety zone created: ${doc.name} - Cultural: ${doc.femaleSafety.culturallyAppropriate ? 'Yes' : 'No'}`);
  }
  
  // Log female verification events
  if (doc.isModified('femaleVerification.verifiedByFemale') && doc.femaleVerification.verifiedByFemale) {
    console.log(`✅ Female verification completed for: ${doc.name}`);
  }
});

const SafeZone = mongoose.model('SafeZone', safeZoneSchema);

module.exports = SafeZone;