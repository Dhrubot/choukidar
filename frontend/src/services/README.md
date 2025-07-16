# SafeStreets API Services - Modular Architecture

## Overview

The SafeStreets API services have been modularized from a single monolithic file into a feature-based architecture. This modular approach improves maintainability, testability, and developer experience while maintaining 100% backward compatibility.

## Architecture

```
services/
├── api.js                    # Main orchestrator (backward compatibility)
├── api-old.js               # Original monolithic file (backup)
├── core/
│   └── apiClient.js         # HTTP infrastructure & caching
├── features/
│   ├── authService.js       # Authentication & user context
│   ├── reportService.js     # Report management & moderation
│   ├── adminService.js      # Admin operations & analytics
│   ├── safeZoneService.js   # Safe zone management & intelligence
│   └── behaviorService.js   # Behavior tracking & device detection
└── utils/
    └── geoUtils.js          # Geographic calculations
```

## Usage Patterns

### 1. Backward Compatible Usage (Recommended for existing code)

```javascript
// Import the main API service (works exactly like before)
import api from './services/api.js';

// All existing code continues to work unchanged
const reports = await api.getReports();
const safeZones = await api.getSafeZones({ lat: 23.8103, lng: 90.4125 });
await api.submitReport(reportData);
```

### 2. Direct Service Imports (New capability)

```javascript
// Import specific services for better tree-shaking and organization
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';

// Use services directly
const reports = await reportService.getReports();
const safeZones = await safeZoneService.getSafeZones({ lat: 23.8103, lng: 90.4125 });
```

### 3. Destructured Imports (Backward compatible)

```javascript
// Import specific methods (works like before)
import { getReports, getSafeZones, submitReport } from './services/api.js';

const reports = await getReports();
const safeZones = await getSafeZones({ lat: 23.8103, lng: 90.4125 });
```

## Service Documentation

### Core API Client (`core/apiClient.js`)

**Purpose**: HTTP infrastructure, authentication headers, caching, and request handling.

```javascript
import apiClient from './services/core/apiClient.js';

// Basic request
const data = await apiClient.request('/endpoint');

// Request with retry
const data = await apiClient.requestWithRetry('/endpoint', options, 3);

// Batch requests
const results = await apiClient.batchRequests([
  { endpoint: '/reports', options: {} },
  { endpoint: '/safezones', options: {} }
]);

// Set device fingerprint
apiClient.setDeviceFingerprint('device-123');

// Get authentication headers
const headers = apiClient.getAuthHeaders();
```

### Authentication Service (`features/authService.js`)

**Purpose**: User authentication, admin login/logout, and security management.

```javascript
import authService from './services/features/authService.js';

// User authentication
const userContext = await authService.getUserContext('device-fingerprint');

// Admin operations
const loginResult = await authService.adminLogin({ username, password });
await authService.adminLogout();
const isValid = await authService.verifyAdminSession();

// Profile management
const profile = await authService.getAdminProfile();
await authService.updateUserPreferences(preferences);

// Security insights
const insights = await authService.getSecurityInsights();
const analytics = await authService.getSecurityAnalytics();
```

### Report Service (`features/reportService.js`)

**Purpose**: Report CRUD operations, moderation, filtering, and community validation.

```javascript
import reportService from './services/features/reportService.js';

// Report operations
await reportService.submitReport(reportData, behaviorData);
const reports = await reportService.getReports(filters);
const report = await reportService.getReport(reportId);

// Admin operations
const adminReports = await reportService.getAdminReports(filters);
await reportService.updateReportStatus(reportId, 'approved');
await reportService.moderateReport(reportId, 'approve', 'Verified incident');

// Advanced filtering
const filteredReports = await reportService.getReportsWithFilter({
  status: 'pending',
  severity: 'high',
  dateFrom: '2024-01-01'
});

// Community features
const femaleReports = await reportService.getFemaleSafetyReports();
await reportService.submitCommunityValidation(reportId, true, validatorInfo);

// Security analysis
const insights = await reportService.getReportSecurityInsights();
const attacks = await reportService.detectCoordinatedAttacks();
```

### Admin Service (`features/adminService.js`)

**Purpose**: User management, device management, analytics, and dashboard operations.

```javascript
import adminService from './services/features/adminService.js';

// User management
const users = await adminService.getUsers({ status: 'active' });
const userDetails = await adminService.getUserDetails(userId);
await adminService.quarantineUser(userId, true, 'Suspicious activity');

// Admin management
await adminService.createAdmin(adminData);
await adminService.updateAdminPermissions(adminId, permissions, 'moderator');

// Device management
const devices = await adminService.getDeviceFingerprints();
await adminService.quarantineDevice(deviceId, true, 'Automated behavior');
await adminService.bulkQuarantine(userIds, true, 'Bulk action');

// Analytics
const stats = await adminService.getModerationStats('7d');
const geoStats = await adminService.getGeographicStats();
const dashboard = await adminService.getAdminDashboard();

// Data export
const csvData = await adminService.exportReports('csv', filters);
```

### Safe Zone Service (`features/safeZoneService.js`)

**Purpose**: Safe zone management, location intelligence, and spatial analysis.

```javascript
import safeZoneService from './services/features/safeZoneService.js';

// Public safe zone queries
const safeZones = await safeZoneService.getSafeZones({
  lat: 23.8103,
  lng: 90.4125,
  radius: 2000,
  minSafety: 7
});

const nearby = await safeZoneService.getNearbySafeZones(lat, lng, 1000);
const zone = await safeZoneService.getSafeZone(zoneId);
const locationZones = await safeZoneService.getSafeZonesByLocation('Dhaka');

// Admin operations
const adminZones = await safeZoneService.getAdminSafeZones();
await safeZoneService.createSafeZone(safeZoneData);
await safeZoneService.updateSafeZone(zoneId, updates);
await safeZoneService.deleteSafeZone(zoneId);

// Bulk operations
await safeZoneService.bulkUpdateSafeZoneStatus(zoneIds, 'active');
const batchResults = await safeZoneService.getBatchSafeZones(zoneIds);

// Intelligence & analysis
const intelligence = await safeZoneService.getLocationIntelligence(lat, lng);
const areaAnalysis = await safeZoneService.getAreaAnalysis(lat, lng, 1000);
const routeSafety = await safeZoneService.getRouteSafetyData(startLat, startLng, endLat, endLng);

// Recommendations
const safetyRecs = safeZoneService.generateSafetyRecommendations(safeZones, reports);
const routeRecs = safeZoneService.generateRouteRecommendations(safeZones);

// Caching
const cached = await safeZoneService.getCachedSafeZones('key', fetchFunction);
safeZoneService.clearSafeZoneCache();
```

### Behavior Service (`features/behaviorService.js`)

**Purpose**: Device detection, behavior tracking, and security analysis.

```javascript
import behaviorService from './services/features/behaviorService.js';

// Device detection
const deviceType = behaviorService.detectDeviceType(); // 'mobile', 'tablet', 'desktop'

// Behavior tracking
behaviorService.trackBehavior('report_submit', { duration: 30000 });
const behaviorData = behaviorService.getBehaviorData();
behaviorService.clearBehaviorData();

// Security analysis
const signature = behaviorService.generateBehaviorSignature(behaviorData);
const analysis = behaviorService.analyzeBehaviorPattern();
const humanScore = behaviorService.calculateHumanBehaviorScore();

// Comprehensive metrics
const metrics = behaviorService.getBehaviorMetrics();
```

### Geographic Utils (`utils/geoUtils.js`)

**Purpose**: Mathematical calculations and geographic utilities.

```javascript
import { calculateDistance, calculateRouteSafetyScore } from './services/utils/geoUtils.js';

// Distance calculation (Haversine formula)
const distance = calculateDistance(lat1, lng1, lat2, lng2); // Returns meters

// Route safety scoring
const safetyScore = calculateRouteSafetyScore(safeZones); // Returns 0-10 score
```

## Migration Guide

### For Existing Components

**No changes required!** All existing imports and usage patterns continue to work:

```javascript
// This continues to work exactly as before
import api from './services/api.js';
const reports = await api.getReports();
```

### For New Development

Consider using direct service imports for better organization:

```javascript
// Instead of importing everything
import api from './services/api.js';

// Import only what you need
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';
```

### Benefits of Direct Imports

1. **Better Tree Shaking**: Only import what you use
2. **Clearer Dependencies**: Explicit about which services you depend on
3. **Easier Testing**: Mock individual services instead of the entire API
4. **Better IDE Support**: More specific autocomplete and type hints

## Testing

### Testing Individual Services

```javascript
// Mock individual services for isolated testing
import { vi } from 'vitest';
import reportService from '../services/features/reportService.js';

// Mock the API client
vi.mock('../services/core/apiClient.js', () => ({
  default: {
    request: vi.fn()
  }
}));

// Test the service
test('should submit report', async () => {
  const mockResponse = { success: true, id: '123' };
  apiClient.request.mockResolvedValue(mockResponse);
  
  const result = await reportService.submitReport(reportData);
  expect(result).toEqual(mockResponse);
});
```

### Testing the Main Orchestrator

```javascript
// Test backward compatibility
import api from '../services/api.js';

test('should maintain backward compatibility', async () => {
  const reports = await api.getReports();
  expect(reports).toBeDefined();
});
```

## Performance Considerations

### Bundle Size

- **Monolithic**: Single large file loaded always
- **Modular**: Only load what you need with direct imports

```javascript
// Loads entire API service
import api from './services/api.js';

// Loads only report service
import reportService from './services/features/reportService.js';
```

### Caching

Caching behavior is preserved and shared across all services:

```javascript
// Cache is shared between direct service usage and main API
const zones1 = await api.getSafeZones(options);        // Caches result
const zones2 = await safeZoneService.getSafeZones(options); // Uses cache
```

## Error Handling

Error handling patterns are preserved across all services:

```javascript
try {
  const result = await reportService.submitReport(data);
  if (!result.success) {
    console.error('Submission failed:', result.message);
  }
} catch (error) {
  console.error('Network error:', error.message);
}
```

## Configuration

Device fingerprint and configuration are automatically propagated:

```javascript
// Set once, applies to all services
api.setDeviceFingerprint('device-123');

// Now all services use the same fingerprint
await reportService.submitReport(data);  // Uses device-123
await safeZoneService.getSafeZones();    // Uses device-123
```

## Best Practices

### 1. Use Direct Imports for New Code

```javascript
// ✅ Good - explicit dependencies
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';

// ❌ Avoid for new code - imports everything
import api from './services/api.js';
```

### 2. Maintain Backward Compatibility

```javascript
// ✅ Good - existing code continues to work
import api from './services/api.js';
const reports = await api.getReports();
```

### 3. Use Service-Specific Methods

```javascript
// ✅ Good - clear intent
import { calculateDistance } from './services/utils/geoUtils.js';
const distance = calculateDistance(lat1, lng1, lat2, lng2);

// ❌ Less clear
import api from './services/api.js';
const distance = api.calculateDistance(lat1, lng1, lat2, lng2);
```

### 4. Mock Services for Testing

```javascript
// ✅ Good - test individual services
vi.mock('./services/features/reportService.js');

// ❌ Harder to test
vi.mock('./services/api.js'); // Mocks everything
```

## Troubleshooting

### Import Issues

If you encounter import issues:

```javascript
// Make sure to use the correct path
import api from './services/api.js';           // ✅ Main orchestrator
import reportService from './services/features/reportService.js'; // ✅ Direct service
```

### Type Issues

If using TypeScript, the services maintain the same interfaces:

```typescript
// Types are preserved
const reports: ReportResponse = await api.getReports();
const reports2: ReportResponse = await reportService.getReports();
```

### Performance Issues

If you notice performance issues:

1. Use direct imports to reduce bundle size
2. Check that caching is working properly
3. Verify that device fingerprint is set correctly

## Support

For issues or questions about the modular API services:

1. Check this documentation first
2. Review the migration verification report
3. Test with the original `api-old.js` to compare behavior
4. Check the individual service files for detailed implementation

---

*This documentation covers the modular API architecture. All existing code continues to work unchanged while new development can take advantage of the improved modular structure.*