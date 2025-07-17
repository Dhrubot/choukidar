// === backend/src/models/SafeZone.js (COMPLETE WITH ALL REFINEMENTS) ===
// Enhanced SafeZone Model with Complete Female Safety Integration
// Combines comprehensive female safety features with all refinements and original functionality

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
  
  // REFINED: Enhanced address structure with granular cultural context
  address: {
    // PRESERVED: Original fields
    thana: String,
    district: String,
    division: String,
    landmark: String,
    streetAddress: String,
    street: String,
    area: String,
    postcode: String,
    
    // REFINED: More granular cultural area classification
    culturalArea: {
      type: String,
      enum: [
        'very_conservative',      // Strict Islamic areas
        'conservative',           // Traditional areas
        'moderate_conservative',  // Mixed but leaning traditional
        'moderate',              // Balanced areas
        'liberal',               // Open areas
        'mixed',                 // Diverse population
        'religious_focused',     // Areas around mosques/religious sites
        'commercial_modern',     // Modern business areas
        'residential_family',    // Family-oriented residential
        'student_area',          // University/college areas
        'tourist_area'           // Tourist-friendly zones
      ],
      default: 'moderate'
    },
    
    // REFINED: Enhanced demographic context
    demographicContext: {
      primaryPopulation: {
        type: String,
        enum: ['family_oriented', 'young_professionals', 'students', 'elderly', 'mixed', 'business'],
        default: 'mixed'
      },
      religiousComposition: {
        type: String,
        enum: ['predominantly_muslim', 'mixed_religious', 'secular', 'unknown'],
        default: 'mixed_religious'
      },
      economicLevel: {
        type: String,
        enum: ['low_income', 'middle_income', 'high_income', 'mixed'],
        default: 'mixed'
      },
      educationLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'mixed'],
        default: 'medium'
      }
    },
    
    // REFINED: Proximity to important locations
    proximityFactors: {
      nearMosque: { type: Boolean, default: false },
      nearSchool: { type: Boolean, default: false },
      nearMarket: { type: Boolean, default: false },
      nearUniversity: { type: Boolean, default: false },
      nearGovernmentBuilding: { type: Boolean, default: false },
      nearPublicTransport: { type: Boolean, default: false },
      nearHealthcareCenter: { type: Boolean, default: false }
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
  
  // ENHANCED: Complete female safety configuration with all refinements
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
    
    // REFINED: More sophisticated safety assessment
    safetyAssessment: {
      // Time-based female safety (more granular)
      timeBasedSafety: {
        earlyMorning: {      // 5AM-8AM
          safetyScore: { type: Number, min: 1, max: 10, default: 6 },
          recommendedGroup: { type: Boolean, default: false },
          specialPrecautions: [String]
        },
        morning: {           // 8AM-12PM
          safetyScore: { type: Number, min: 1, max: 10, default: 8 },
          recommendedGroup: { type: Boolean, default: false },
          specialPrecautions: [String]
        },
        afternoon: {         // 12PM-5PM
          safetyScore: { type: Number, min: 1, max: 10, default: 8 },
          recommendedGroup: { type: Boolean, default: false },
          specialPrecautions: [String]
        },
        evening: {           // 5PM-8PM
          safetyScore: { type: Number, min: 1, max: 10, default: 6 },
          recommendedGroup: { type: Boolean, default: true },
          specialPrecautions: [String]
        },
        night: {             // 8PM-12AM
          safetyScore: { type: Number, min: 1, max: 10, default: 4 },
          recommendedGroup: { type: Boolean, default: true },
          specialPrecautions: [String]
        },
        lateNight: {         // 12AM-5AM
          safetyScore: { type: Number, min: 1, max: 10, default: 2 },
          recommendedGroup: { type: Boolean, default: true },
          specialPrecautions: [String]
        }
      },
      
      // REFINED: Weather and seasonal considerations
      seasonalFactors: {
        rainySeasonSafety: { type: Number, min: 1, max: 10, default: 6 },
        festivalSeasonSafety: { type: Number, min: 1, max: 10, default: 5 },
        summerSafety: { type: Number, min: 1, max: 10, default: 7 },
        winterSafety: { type: Number, min: 1, max: 10, default: 8 }
      },
      
      // REFINED: Crowd density impact on female safety
      crowdDensityImpact: {
        lowCrowd: { safetyScore: { type: Number, min: 1, max: 10, default: 7 } },
        mediumCrowd: { safetyScore: { type: Number, min: 1, max: 10, default: 8 } },
        highCrowd: { safetyScore: { type: Number, min: 1, max: 10, default: 6 } },
        veryHighCrowd: { safetyScore: { type: Number, min: 1, max: 10, default: 4 } }
      }
    },
    
    // REFINED: Enhanced cultural appropriateness assessment
    culturalAppropriateness: {
      dresscode: {
        recommended: {
          type: String,
          enum: ['conservative', 'modest', 'casual', 'any'],
          default: 'modest'
        },
        strictlyRequired: { type: Boolean, default: false },
        guidelines: [String]  // Specific dress code guidelines
      },
      
      behaviorGuidelines: {
        voiceLevel: {
          type: String,
          enum: ['quiet', 'normal', 'any'],
          default: 'normal'
        },
        socialInteraction: {
          type: String,
          enum: ['limited', 'respectful', 'open'],
          default: 'respectful'
        },
        photographyRestrictions: { type: Boolean, default: false }
      },
      
      religiousConsiderations: {
        prayerTimeAccommodation: { type: Boolean, default: false },
        halalFoodAvailable: { type: Boolean, default: false },
        religionNeutralSpace: { type: Boolean, default: true }
      }
    },
    
    // REFINED: Specific female amenities and services
    femaleAmenities: {
      femaleRestrooms: {
        available: { type: Boolean, default: false },
        clean: { type: Boolean, default: false },
        private: { type: Boolean, default: false },
        wellMaintained: { type: Boolean, default: false }
      },
      
      nurseryFacilities: {
        available: { type: Boolean, default: false },
        private: { type: Boolean, default: false },
        comfortable: { type: Boolean, default: false }
      },
      
      femaleStaff: {
        available: { type: Boolean, default: false },
        alwaysPresent: { type: Boolean, default: false },
        trained: { type: Boolean, default: false }
      },
      
      separateSpaces: {
        availableWhenNeeded: { type: Boolean, default: false },
        permanentlyDesignated: { type: Boolean, default: false }
      }
    },
    
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
    },
    
    // Track recent incident impact updates
    recentIncidentNotes: [{
      date: { type: Date, default: Date.now },
      incidentCount: Number,
      impactOnScore: Number,
      note: String
    }],
    
    lastIncidentImpactUpdate: { type: Date, default: Date.now }
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
  
  // REFINED: Enhanced operating hours with granular female-only sessions
  operatingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String },
    
    // REFINED: Enhanced female-only hours with more granular control
    femaleOnlyHours: {
      enabled: { type: Boolean, default: false },
      monday: { 
        sessions: [{
          startTime: String,    // e.g., "09:00"
          endTime: String,      // e.g., "12:00"
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String   // e.g., "Women's morning exercise session"
        }]
      },
      tuesday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      wednesday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      thursday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      friday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      saturday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      sunday: { 
        sessions: [{
          startTime: String,
          endTime: String,
          type: { 
            type: String, 
            enum: ['full_female_only', 'female_priority', 'female_safe_space'],
            default: 'female_priority'
          },
          description: String
        }]
      },
      
      // REFINED: Special cultural considerations
      culturalEvents: [{
        name: String,          // e.g., "Eid prayer preparation"
        date: Date,            // Specific date
        startTime: String,     // Start time
        endTime: String,       // End time
        type: {
          type: String,
          enum: ['female_only', 'family_priority', 'conservative_appropriate'],
          default: 'family_priority'
        },
        description: String,
        culturalNotes: String  // Additional cultural context
      }],
      
      // REFINED: Dynamic scheduling based on local culture
      dynamicScheduling: {
        enabled: { type: Boolean, default: false },
        basedOnPrayerTimes: { type: Boolean, default: false },
        avoidConflictingEvents: { type: Boolean, default: true },
        adaptToLocalCustoms: { type: Boolean, default: true }
      }
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
safeZoneSchema.index({ "address.culturalArea": 1 });

// PRESERVED: Original compound indexes + Enhanced
safeZoneSchema.index({ status: 1, zoneType: 1 });
safeZoneSchema.index({ status: 1, safetyScore: -1 });
safeZoneSchema.index({ "address.district": 1, zoneType: 1 });
safeZoneSchema.index({ status: 1, category: 1, "femaleSafety.overallFemaleSafety": -1 });

// PRESERVED: Original virtual + Enhanced
safeZoneSchema.virtual('currentSafetyScore').get(function() {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) {
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
  
  let timePeriod;
  if (hour >= 5 && hour < 8) timePeriod = 'earlyMorning';
  else if (hour >= 8 && hour < 12) timePeriod = 'morning';
  else if (hour >= 12 && hour < 17) timePeriod = 'afternoon';
  else if (hour >= 17 && hour < 20) timePeriod = 'evening';
  else if (hour >= 20 || hour < 2) timePeriod = 'night';
  else timePeriod = 'lateNight';
  
  return this.femaleSafety?.safetyAssessment?.timeBasedSafety?.[timePeriod]?.safetyScore || null;
});

// REFINED: Virtual for getting granular time-based safety
safeZoneSchema.virtual('currentGranularFemaleSafety').get(function() {
  const hour = new Date().getHours();
  
  let timePeriod;
  if (hour >= 5 && hour < 8) timePeriod = 'earlyMorning';
  else if (hour >= 8 && hour < 12) timePeriod = 'morning';
  else if (hour >= 12 && hour < 17) timePeriod = 'afternoon';
  else if (hour >= 17 && hour < 20) timePeriod = 'evening';
  else if (hour >= 20 || hour < 2) timePeriod = 'night';
  else timePeriod = 'lateNight';
  
  return this.femaleSafety?.safetyAssessment?.timeBasedSafety?.[timePeriod] || null;
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

// REFINED: Enhanced method to get time-specific female safety recommendations
safeZoneSchema.methods.getTimeSpecificFemaleSafetyRecommendations = function(hour = new Date().getHours()) {
  const recommendations = [];
  
  // Determine time period
  let timePeriod;
  if (hour >= 5 && hour < 8) timePeriod = 'earlyMorning';
  else if (hour >= 8 && hour < 12) timePeriod = 'morning';
  else if (hour >= 12 && hour < 17) timePeriod = 'afternoon';
  else if (hour >= 17 && hour < 20) timePeriod = 'evening';
  else if (hour >= 20 || hour < 2) timePeriod = 'night';
  else timePeriod = 'lateNight';
  
  const timeData = this.femaleSafety?.safetyAssessment?.timeBasedSafety?.[timePeriod];
  
  if (timeData) {
    // Safety score based recommendations
    if (timeData.safetyScore < 5) {
      recommendations.push({
        type: 'safety',
        priority: 'high',
        message: 'Exercise extra caution during this time',
        icon: 'alert-triangle'
      });
    }
    
    // Group recommendation
    if (timeData.recommendedGroup) {
      recommendations.push({
        type: 'group',
        priority: 'medium',
        message: 'Consider visiting with a friend or family member',
        icon: 'users'
      });
    }
    
    // Special precautions
    if (timeData.specialPrecautions && timeData.specialPrecautions.length > 0) {
      timeData.specialPrecautions.forEach(precaution => {
        recommendations.push({
          type: 'precaution',
          priority: 'medium',
          message: precaution,
          icon: 'shield'
        });
      });
    }
  }
  
  // Cultural area recommendations
  if (this.address?.culturalArea) {
    switch (this.address.culturalArea) {
      case 'very_conservative':
      case 'conservative':
        recommendations.push({
          type: 'cultural',
          priority: 'high',
          message: 'Conservative area - dress modestly and be mindful of local customs',
          icon: 'info'
        });
        break;
      case 'religious_focused':
        recommendations.push({
          type: 'cultural',
          priority: 'medium',
          message: 'Religious area - maintain respectful behavior and dress appropriately',
          icon: 'info'
        });
        break;
    }
  }
  
  // Amenity-based recommendations
  if (this.femaleSafety?.femaleAmenities?.femaleStaff?.available) {
    recommendations.push({
      type: 'amenity',
      priority: 'low',
      message: 'Female staff available for assistance',
      icon: 'user-check'
    });
  }
  
  if (this.femaleSafety?.femaleAmenities?.separateSpaces?.availableWhenNeeded) {
    recommendations.push({
      type: 'amenity',
      priority: 'low',
      message: 'Separate spaces available if needed',
      icon: 'users'
    });
  }
  
  return recommendations;
};

// REFINED: Method to calculate dynamic female safety score
safeZoneSchema.methods.calculateDynamicFemaleSafetyScore = function(options = {}) {
  const {
    timeOfDay = new Date().getHours(),
    crowdLevel = 'medium',
    season = 'normal',
    weatherCondition = 'clear'
  } = options;
  
  let baseScore = this.femaleSafety?.overallFemaleSafety || 5;
  
  // Time adjustment
  const timeData = this.femaleSafety?.safetyAssessment?.timeBasedSafety?.[this.getTimePeriod(timeOfDay)];
  if (timeData) {
    baseScore = (baseScore + timeData.safetyScore) / 2;
  }
  
  // Crowd level adjustment
  const crowdData = this.femaleSafety?.safetyAssessment?.crowdDensityImpact?.[crowdLevel + 'Crowd'];
  if (crowdData) {
    baseScore = (baseScore + crowdData.safetyScore) / 2;
  }
  
  // Seasonal adjustment
  if (season === 'rainy' && this.femaleSafety?.safetyAssessment?.seasonalFactors?.rainySeasonSafety) {
    baseScore = (baseScore + this.femaleSafety.safetyAssessment.seasonalFactors.rainySeasonSafety) / 2;
  }
  
  // Weather adjustment
  if (weatherCondition === 'heavy_rain' || weatherCondition === 'storm') {
    baseScore = Math.max(1, baseScore - 2);
  }
  
  // Cultural area adjustment
  if (this.address?.culturalArea === 'very_conservative' || this.address?.culturalArea === 'conservative') {
    // Conservative areas might be safer in some ways but require more cultural awareness
    baseScore = Math.min(10, baseScore + 1);
  }
  
  return Math.round(baseScore * 10) / 10; // Round to 1 decimal place
};

// Helper to get time period string from hour
safeZoneSchema.methods.getTimePeriod = function(hour) {
  if (hour >= 5 && hour < 8) return 'earlyMorning';
  else if (hour >= 8 && hour < 12) return 'morning';
  else if (hour >= 12 && hour < 17) return 'afternoon';
  else if (hour >= 17 && hour < 20) return 'evening';
  else if (hour >= 20 || hour < 2) return 'night';
  else return 'lateNight';
};


// REFINED: Method to get cultural guidelines for female visitors
safeZoneSchema.methods.getCulturalGuidelinesForFemales = function() {
  const guidelines = {
    dress: [],
    behavior: [],
    timing: [],
    general: []
  };
  
  // Dress code guidelines
  const dresscode = this.femaleSafety?.culturalAppropriateness?.dresscode;
  if (dresscode) {
    switch (dresscode.recommended) {
      case 'conservative':
        guidelines.dress.push('Long sleeves and long pants/skirt recommended');
        guidelines.dress.push('Head covering may be appropriate');
        break;
      case 'modest':
        guidelines.dress.push('Modest clothing recommended');
        guidelines.dress.push('Avoid very short or revealing clothing');
        break;
    }
    
    if (dresscode.guidelines && dresscode.guidelines.length > 0) {
      guidelines.dress.push(...dresscode.guidelines);
    }
  }
  
  // Behavior guidelines
  const behavior = this.femaleSafety?.culturalAppropriateness?.behaviorGuidelines;
  if (behavior) {
    if (behavior.voiceLevel === 'quiet') {
      guidelines.behavior.push('Keep voice levels low and respectful');
    }
    
    if (behavior.photographyRestrictions) {
      guidelines.behavior.push('Photography may be restricted - ask permission first');
    }
    
    if (behavior.socialInteraction === 'limited') {
      guidelines.behavior.push('Maintain respectful distance in social interactions');
    }
  }
  
  // Timing recommendations
  const timeRecommendations = this.femaleSafety?.safetyRecommendations;
  if (timeRecommendations?.avoidAfterDark) {
    guidelines.timing.push('Best visited during daylight hours');
  }
  
  if (timeRecommendations?.accompaniedRecommended) {
    guidelines.timing.push('Consider visiting with companions');
  }
  
  // General guidelines based on cultural area
  if (this.address?.culturalArea) {
    switch (this.address.culturalArea) {
      case 'very_conservative':
        guidelines.general.push('Very conservative area - high cultural sensitivity required');
        guidelines.general.push('Local customs should be strictly observed');
        break;
      case 'conservative':
        guidelines.general.push('Conservative area - be mindful of local customs');
        break;
      case 'religious_focused':
        guidelines.general.push('Religious area - maintain respectful behavior');
        guidelines.general.push('Prayer times may affect accessibility');
        break;
    }
  }
  
  return guidelines;
};

// REFINED: Enhanced method to check female safety compatibility
safeZoneSchema.methods.checkFemaleSafetyCompatibility = function(userPreferences = {}) {
  const compatibility = {
    score: 0,
    issues: [],
    recommendations: [],
    compatible: false
  };
  
  let compatibilityScore = 10; // Start with perfect score
  
  // Check time compatibility
  if (userPreferences.visitTime) {
    const timeSafety = this.calculateDynamicFemaleSafetyScore({
      timeOfDay: userPreferences.visitTime
    });
    
    if (timeSafety < 5) {
      compatibilityScore -= 3;
      compatibility.issues.push('Low safety score for preferred visit time');
      compatibility.recommendations.push('Consider visiting during safer hours');
    }
  }
  
  // Check dress code compatibility
  if (userPreferences.dressPreference) {
    const dresscode = this.femaleSafety?.culturalAppropriateness?.dresscode?.recommended;
    if (dresscode === 'conservative' && userPreferences.dressPreference === 'casual') {
      compatibilityScore -= 2;
      compatibility.issues.push('Dress code mismatch with area expectations');
      compatibility.recommendations.push('Consider more conservative attire');
    }
  }
  
  // Check cultural area compatibility
  if (userPreferences.culturalSensitivity) {
    const culturalArea = this.address?.culturalArea;
    if ((culturalArea === 'very_conservative' || culturalArea === 'conservative') && 
        userPreferences.culturalSensitivity === 'low') {
      compatibilityScore -= 4;
      compatibility.issues.push('High cultural sensitivity required for this area');
      compatibility.recommendations.push('Research local customs before visiting');
    }
  }
  
  // Check amenity requirements
  if (userPreferences.requireFemaleStaff && !this.femaleSafety?.femaleAmenities?.femaleStaff?.available) {
    compatibilityScore -= 2;
    compatibility.issues.push('Female staff not available');
  }
  
  if (userPreferences.requirePrivateSpaces && !this.femaleSafety?.femaleAmenities?.separateSpaces?.availableWhenNeeded) {
    compatibilityScore -= 1;
    compatibility.issues.push('Private spaces may not be available');
  }
  
  compatibility.score = Math.max(0, compatibilityScore);
  compatibility.compatible = compatibility.score >= 6;
  
  return compatibility;
};

// ENHANCED: Method to get female safety recommendations (original preserved)
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
      currentGranularFemaleSafety: this.currentGranularFemaleSafety,
      femaleVerification: this.femaleVerification,
      femaleSafetyRecommendations: this.getFemaleSafetyRecommendations(),
      timeSpecificRecommendations: this.getTimeSpecificFemaleSafetyRecommendations(),
      culturalGuidelines: this.getCulturalGuidelinesForFemales()
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

// REFINED: Find female-friendly safe zones with advanced filtering
safeZoneSchema.statics.findFemaleFriendlySafeZones = function(lat, lng, options = {}) {
  const {
    maxDistance = 2000,
    minFemaleSafetyScore = 6,
    culturallyAppropriate = true,
    timeOfDay = new Date().getHours(),
    requireFemaleStaff = false,
    requirePrivateSpaces = false,
    dressCodeTolerance = 'any',
    crowdLevelPreference = 'any'
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
  
  // Female safety score filter
  query['femaleSafety.overallFemaleSafety'] = { $gte: minFemaleSafetyScore };
  
  // Cultural appropriateness filter
  if (culturallyAppropriate) {
    query['femaleSafety.culturallyAppropriate'] = true;
  }
  
  // Female staff requirement
  if (requireFemaleStaff) {
    query['femaleSafety.femaleAmenities.femaleStaff.available'] = true;
  }
  
  // Private spaces requirement
  if (requirePrivateSpaces) {
    query['femaleSafety.femaleAmenities.separateSpaces.availableWhenNeeded'] = true;
  }
  
  // Dress code tolerance
  if (dressCodeTolerance !== 'any') {
    query['femaleSafety.culturalAppropriateness.dresscode.recommended'] = { 
      $in: this.getDressCodeCompatibility(dressCodeTolerance) 
    };
  }
  
  return this.find(query)
    .sort({ 'femaleSafety.overallFemaleSafety': -1 });
};

// REFINED: Get dress code compatibility array
safeZoneSchema.statics.getDressCodeCompatibility = function(userTolerance) {
  const compatibility = {
    'conservative': ['conservative'],
    'modest': ['conservative', 'modest'],
    'casual': ['conservative', 'modest', 'casual'],
    'any': ['conservative', 'modest', 'casual', 'any']
  };
  
  return compatibility[userTolerance] || ['any'];
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
          $sum: { $cond: [{ $eq: ['$femaleVerification.verifiedByFemale', 1, 0] } , 1, 0] }
        }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return stats;
};

// REFINED: Bulk update female safety scores based on recent incident data
safeZoneSchema.statics.updateFemaleSafetyScoresFromIncidents = async function() {
  try {
    const Report = require('./Report'); // Assuming Report model is available
    
    // Get all female safety reports from last 30 days
    const recentReports = await Report.find({
      type: { 
        $in: [
          'eve_teasing', 'stalking', 'inappropriate_touch', 
          'verbal_harassment', 'unsafe_transport', 'workplace_harassment',
          'domestic_incident', 'unsafe_area_women'
        ]
      },
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      status: 'approved'
    });
    
    // Group reports by location proximity to safe zones
    const safeZones = await this.find({ status: 'active' });
    
    for (const zone of safeZones) {
      const nearbyReports = recentReports.filter(report => {
        const distance = zone.distanceFrom(
          report.location.coordinates[1], 
          report.location.coordinates[0]
        );
        return distance <= zone.radius * 2; // Consider reports within 2x the zone radius
      });
      
      if (nearbyReports.length > 0) {
        // Calculate impact on female safety score
        const impactScore = Math.max(1, Math.min(3, nearbyReports.length));
        const currentScore = zone.femaleSafety?.overallFemaleSafety || 5;
        const newScore = Math.max(1, currentScore - impactScore);
        
        // Update the zone's female safety score
        await this.findByIdAndUpdate(zone._id, {
          'femaleSafety.overallFemaleSafety': newScore,
          'femaleSafety.lastIncidentImpactUpdate': new Date(),
          $push: {
            'femaleSafety.recentIncidentNotes': {
              date: new Date(),
              incidentCount: nearbyReports.length,
              impactOnScore: currentScore - newScore,
              note: `Safety score adjusted based on ${nearbyReports.length} nearby female safety incidents`
            }
          }
        });
      }
    }
    
    console.log('✅ Female safety scores updated based on recent incidents');
    return { success: true, processed: safeZones.length };
    
  } catch (error) {
    console.error('❌ Error updating female safety scores:', error);
    return { success: false, error: error.message };
  }
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