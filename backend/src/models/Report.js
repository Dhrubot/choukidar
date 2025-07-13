// === backend/src/models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['chadabaji', 'teen_gang', 'chintai', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[1] >= -90 && coords[1] <= 90 && // Valid latitude
                 coords[0] >= -180 && coords[0] <= 180; // Valid longitude
        },
        message: 'Invalid coordinates'
      }
    },
    address: String,
    obfuscated: {
      type: Boolean,
      default: true
    },
    // NEW SECURITY FIELDS
    source: {
      type: String,
      enum: ['GPS', 'Search', 'Map Click', 'default'],
      default: 'default'
    },
    withinBangladesh: {
      type: Boolean,
      default: true
    },
    // Store original coordinates privately for admin use
    originalCoordinates: {
      type: [Number],
      select: false // Hidden by default in queries
    }
  },
  severity: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  media: [{
    type: String, // URLs to uploaded files
  }],
  anonymous: {
    type: Boolean,
    default: true
  },
  ipHash: String, // For rate limiting, not stored as plain IP
  moderatedBy: String,
  moderatedAt: Date,
  
  // NEW SECURITY & ANALYTICS FIELDS
  reportingCountry: {
    type: String,
    default: 'BD' // ISO country code
  },
  securityFlags: {
    suspiciousLocation: { type: Boolean, default: false },
    crossBorderReport: { type: Boolean, default: false },
    potentialSpam: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Index for geospatial queries
reportSchema.index({ "location.coordinates": "2dsphere" });

// Index for security queries
reportSchema.index({ "location.withinBangladesh": 1 });
reportSchema.index({ "securityFlags.crossBorderReport": 1 });

// Middleware to obfuscate coordinates and detect security issues
reportSchema.pre('save', function(next) {
  if (this.isNew) {
    const [lng, lat] = this.location.coordinates;
    
    // Store original coordinates for admin use
    this.location.originalCoordinates = [lng, lat];
    
    // Check if location is within Bangladesh
    const bangladeshBounds = {
      north: 26.0,
      south: 20.0,
      east: 93.0,
      west: 88.0
    };
    
    const withinBD = lat >= bangladeshBounds.south && 
                     lat <= bangladeshBounds.north && 
                     lng >= bangladeshBounds.west && 
                     lng <= bangladeshBounds.east;
    
    this.location.withinBangladesh = withinBD;
    
    // Set security flags
    if (!withinBD) {
      this.securityFlags.crossBorderReport = true;
    }
    
    // Obfuscate coordinates (add random offset within 100m radius)
    if (this.location.obfuscated) {
      const offsetLat = (Math.random() - 0.5) * 0.002; // ~100m
      const offsetLng = (Math.random() - 0.5) * 0.002; // ~100m
      
      this.location.coordinates = [
        lng + offsetLng,
        lat + offsetLat
      ];
    }
  }
  
  next();
});

module.exports = mongoose.model('Report', reportSchema);