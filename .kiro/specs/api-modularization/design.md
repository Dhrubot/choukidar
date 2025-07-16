# Design Document

## Overview

This design document outlines the modularization of the monolithic `api-old.js` file into a feature-based service architecture. The design ensures 100% backward compatibility while improving code organization, maintainability, and developer experience. The modularization follows a systematic line-by-line migration approach to guarantee no functionality is lost.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Main API Service                        │
│                    (api.js - Orchestrator)                 │
├─────────────────────────────────────────────────────────────┤
│  Maintains 100% backward compatibility                      │
│  Delegates to feature services                              │
│  Preserves all original method signatures                   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Feature Services Layer                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Auth Service  │  Report Service │    Admin Service        │
├─────────────────┼─────────────────┼─────────────────────────┤
│ SafeZone Service│ Behavior Service│    Core API Client      │
└─────────────────┴─────────────────┴─────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Utility Layer                          │
├─────────────────────────────────────────────────────────────┤
│              Geographic Utils (geoUtils.js)                │
└─────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

#### 1. Core API Client (`core/apiClient.js`)
**Responsibility:** HTTP infrastructure and cross-cutting concerns
- HTTP request handling (`request`, `requestWithRetry`, `requestWithIntelligenceRetry`)
- Batch request processing (`batchRequests`)
- Authentication header management (`getAuthHeaders`)
- Device fingerprint management (`setDeviceFingerprint`)
- Caching infrastructure (`_safeZoneCache`, `_cacheExpiry`)
- Error handling and response formatting
- Base URL configuration and environment setup

#### 2. Authentication Service (`features/authService.js`)
**Responsibility:** User authentication and authorization
- User context management (`getUserContext`)
- Admin authentication (`adminLogin`, `adminLogout`, `verifyAdminSession`)
- Profile management (`getAdminProfile`, `updateUserPreferences`)
- Security insights (`getSecurityInsights`, `getSecurityAnalytics`)
- Future authentication features (`registerPolice`, `registerResearcher`)

#### 3. Report Service (`features/reportService.js`)
**Responsibility:** Report management and community features
- Report CRUD operations (`submitReport`, `getReports`, `getReport`)
- Admin report management (`getAdminReports`, `getAllAdminReports`, `updateReportStatus`)
- Report moderation (`moderateReport`, `getFlaggedReports`)
- Advanced filtering and search (`getReportsWithFilter`, `searchReports`)
- Community validation (`submitCommunityValidation`, `getValidationQueue`)
- Female safety reports (`getFemaleSafetyReports`, `getFemaleSafetyStats`)
- Security analysis (`getReportSecurityInsights`, `detectCoordinatedAttacks`)
- Bulk operations (`bulkUpdateReports`)

#### 4. Admin Service (`features/adminService.js`)
**Responsibility:** Administrative operations and analytics
- User management (`getUsers`, `getUserDetails`, `quarantineUser`)
- Admin management (`createAdmin`, `updateAdminPermissions`)
- Device management (`getDeviceFingerprints`, `quarantineDevice`)
- Bulk operations (`bulkQuarantine`)
- Statistics and analytics (`getUserStatistics`, `getModerationStats`, `getGeographicStats`)
- Dashboard data (`getAdminDashboard`, `getAdminAnalytics`)
- Data export (`exportReports`)
- Access control (`checkAdminAccess`)

#### 5. Safe Zone Service (`features/safeZoneService.js`)
**Responsibility:** Location intelligence and safe zone management
- Public safe zone queries (`getSafeZones`, `getNearbySafeZones`, `getSafeZone`)
- Location-based queries (`getSafeZonesByLocation`)
- Admin safe zone management (`getAdminSafeZones`, `createSafeZone`, `updateSafeZone`, `deleteSafeZone`)
- Bulk safe zone operations (`bulkUpdateSafeZoneStatus`, `bulkUpdateSafeZones`)
- Safe zone analytics (`getSafeZoneAnalytics`, `getAdminSafeZoneAnalytics`)
- Data import/export (`importSafeZones`, `exportSafeZones`)
- Location intelligence (`getLocationIntelligence`, `getAreaAnalysis`, `getRouteSafetyData`)
- Availability checks (`checkSafeZonesAvailability`)
- Batch operations (`getBatchSafeZones`, `createBatchSafeZones`)
- Caching utilities (`getCachedSafeZones`, `clearSafeZoneCache`)
- Safety recommendations (`generateSafetyRecommendations`, `generateRouteRecommendations`)

#### 6. Behavior Service (`features/behaviorService.js`)
**Responsibility:** User behavior tracking and device detection
- Device type detection (`detectDeviceType`)
- Behavior tracking and analytics
- Device fingerprinting support
- Human behavior scoring for security

#### 7. Geographic Utils (`utils/geoUtils.js`)
**Responsibility:** Geographic calculations and utilities
- Distance calculations (`calculateDistance`)
- Route safety scoring (`calculateRouteSafetyScore`)
- Geographic mathematical operations

## Components and Interfaces

### Main API Service Interface (Orchestrator Pattern)

The main `api.js` file acts as an orchestrator that maintains the exact same interface as the original monolithic service:

```javascript
class ApiService {
  constructor() {
    // Preserve original configuration
    this.baseURL = apiClient.baseURL;
    this.deviceFingerprint = null;
    this._safeZoneCache = apiClient._safeZoneCache;
    this._cacheExpiry = apiClient._cacheExpiry;
  }

  // Delegate all methods to appropriate services
  async getUserContext(deviceFingerprint) {
    return authService.getUserContext(deviceFingerprint);
  }
  
  async submitReport(reportData, behaviorData = {}) {
    return reportService.submitReport(reportData, behaviorData);
  }
  
  // ... all other methods delegated similarly
}
```

### Service Communication Pattern

Services communicate through the core API client and maintain loose coupling:

```javascript
// Each service imports and uses the core API client
import apiClient from '../core/apiClient.js';

class AuthService {
  async getUserContext(deviceFingerprint) {
    apiClient.setDeviceFingerprint(deviceFingerprint);
    return apiClient.request('/auth/user/context');
  }
}
```

### Dependency Injection Pattern

The main orchestrator injects the device fingerprint into all services:

```javascript
setDeviceFingerprint(fingerprint) {
  this.deviceFingerprint = fingerprint;
  // Propagate to all services
  apiClient.setDeviceFingerprint(fingerprint);
  authService.setDeviceFingerprint(fingerprint);
  reportService.setDeviceFingerprint(fingerprint);
  // ... other services
}
```

## Data Models

### Service Configuration Model
```javascript
{
  baseURL: string,
  deviceFingerprint: string | null,
  _safeZoneCache: Map,
  _cacheExpiry: number
}
```

### Request/Response Models
All existing request and response models are preserved exactly as they were in the original implementation.

### Cache Model
```javascript
{
  data: any,
  timestamp: number
}
```

## Error Handling

### Error Handling Strategy
- Preserve all existing error handling patterns
- Maintain identical error response formats
- Keep all console logging and error messages
- Preserve retry logic and exponential backoff
- Maintain batch request error handling

### Error Response Format
```javascript
{
  success: false,
  message: string,
  error: string
}
```

## Testing Strategy

### Unit Testing Approach
1. **Service Isolation Testing**: Each service can be tested independently
2. **Mock API Client**: Core API client can be mocked for service testing
3. **Integration Testing**: Main orchestrator tested with real services
4. **Backward Compatibility Testing**: Ensure all original functionality works
5. **Performance Testing**: Verify no performance degradation

### Test Coverage Requirements
- 100% method coverage for all migrated functionality
- Error handling path coverage
- Cache behavior testing
- Retry mechanism testing
- Batch operation testing

### Testing Structure
```
tests/
├── unit/
│   ├── core/
│   │   └── apiClient.test.js
│   ├── features/
│   │   ├── authService.test.js
│   │   ├── reportService.test.js
│   │   ├── adminService.test.js
│   │   ├── safeZoneService.test.js
│   │   └── behaviorService.test.js
│   └── utils/
│       └── geoUtils.test.js
├── integration/
│   └── api.test.js
└── compatibility/
    └── backwardCompatibility.test.js
```

## Migration Strategy

### Phase 1: Core Infrastructure
1. Create `core/apiClient.js` with all HTTP functionality
2. Migrate request methods, retry logic, batch operations
3. Migrate authentication headers and device fingerprint management
4. Migrate caching infrastructure

### Phase 2: Feature Services
1. Create each feature service file
2. Migrate methods line-by-line from original file
3. Ensure each service uses the core API client
4. Preserve all comments, documentation, and logic

### Phase 3: Orchestrator Creation
1. Create main `api.js` orchestrator
2. Import all feature services
3. Create delegation methods for all original functionality
4. Ensure 100% backward compatibility

### Phase 4: Validation and Testing
1. Run comprehensive tests
2. Verify all functionality works identically
3. Performance testing and optimization
4. Documentation updates

## Performance Considerations

### Caching Strategy
- Maintain existing safe zone caching mechanism
- Preserve cache expiry and cleanup logic
- Keep cache performance characteristics

### Bundle Size Impact
- Modular imports allow for tree-shaking
- Optional direct service imports reduce bundle size
- Maintain lazy loading capabilities

### Runtime Performance
- No additional overhead from delegation pattern
- Preserve all existing optimizations
- Maintain batch operation efficiency

## Security Considerations

### Authentication Flow
- Preserve all existing authentication mechanisms
- Maintain device fingerprinting security
- Keep admin token management identical

### Data Validation
- Preserve all existing validation logic
- Maintain security checks and filters
- Keep quarantine and moderation functionality

## Deployment Strategy

### Backward Compatibility Guarantee
- All existing imports continue to work
- No breaking changes to public API
- Gradual migration path for components

### Rollback Plan
- Keep original `api-old.js` as backup
- Easy rollback by changing import paths
- Comprehensive testing before deployment