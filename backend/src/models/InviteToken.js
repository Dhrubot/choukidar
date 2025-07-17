// === backend/src/models/InviteToken.js ===
const mongoose = require('mongoose');

const inviteTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true // Index for quick lookup
  },
  userType: {
    type: String,
    enum: ['admin', 'police', 'researcher'],
    required: true
  },
  email: { // Optional: for targeted invites, can be used for pre-filling or validation
    type: String,
    lowercase: true,
    trim: true,
    sparse: true // Allows multiple nulls, but unique for non-null values
  },
  permissions: [{ // For admin roles, e.g., ['moderation', 'analytics']
    type: String
  }],
  adminLevel: { // Specific to admin
    type: Number,
    min: 1,
    max: 10
  },
  policeAccessLevel: { // Specific to police
    type: String,
    enum: ['read_only', 'standard', 'supervisor', 'chief']
  },
  researcherAccessLevel: { // Specific to researcher
    type: String,
    enum: ['basic', 'full', 'api_access']
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: { // Reference to the User who used this token
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: { // Reference to the admin User who created this invite
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add an index for automatic expiry (TTL index)
// This will automatically delete documents from the collection after the expiresAt date
inviteTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const InviteToken = mongoose.model('InviteToken', inviteTokenSchema);

module.exports = InviteToken;
