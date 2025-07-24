// === backend/src/models/AuditLog.js ===
// Audit Log Model for SafeStreets Bangladesh
// Records sensitive actions for security, compliance, and accountability.

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Who performed the action
  actor: {
    userId: { type: String, ref: 'User', index: true }, // Mongoose _id of the user
    userType: { type: String, enum: ['anonymous', 'admin', 'police', 'researcher', 'system'], default: 'system' },
    username: String, // For display, e.g., admin username
    deviceFingerprint: String, // Device from which action was performed
    ipAddress: String, // Hashed IP or obfuscated IP
  },
  
  // What action was performed
  actionType: {
    type: String,
    required: true,
    enum: [
      'admin_login', 'admin_logout', 'admin_password_change', 'admin_2fa_setup', 'admin_2fa_disable',
      'user_permission_change', 'user_quarantine_status_change', 'user_role_change', 'user_delete',
      'report_status_change', 'safezone_create', 'safezone_update', 'safezone_delete',
      'invite_token_generate', 'invite_token_use',
      'system_config_update', 'data_export', 'data_import',
      'security_alert_review', 'security_policy_change',
      'password_reset_request', 'password_reset_complete', 'email_verification_request', 'email_verification_complete'
    ]
  },
  
  // When the action occurred
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Details of the action
  details: mongoose.Schema.Types.Mixed, // Flexible object to store relevant data
  
  // Outcome of the action
  outcome: {
    type: String,
    enum: ['success', 'failure', 'pending'],
    default: 'success'
  },
  
  // Reason for failure, if applicable
  failureReason: String,
  
  // Contextual information
  target: { // The entity affected by the action (e.g., user ID, report ID)
    id: String,
    type: String, // e.g., 'user', 'report', 'safezone'
    name: String // e.g., username, report type
  },
  
  // Severity of the action (for filtering/alerting)
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// REMOVED: Schema-level indexes - now managed centrally by optimizedIndexes.js
// This prevents duplicate index creation and provides better management

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;