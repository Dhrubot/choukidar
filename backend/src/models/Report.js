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
      required: true
    },
    address: String,
    obfuscated: {
      type: Boolean,
      default: true
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
  moderatedAt: Date
}, {
  timestamps: true
});

// Index for geospatial queries
reportSchema.index({ "location.coordinates": "2dsphere" });

module.exports = mongoose.model('Report', reportSchema);