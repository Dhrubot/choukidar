# API Services Migration Guide

## Overview

This guide helps developers migrate from the monolithic `api-old.js` to the new modular API architecture. The migration is designed to be **completely backward compatible** - existing code will continue to work without any changes.

## Migration Timeline

### Phase 1: Zero-Impact Switch (Immediate)
- Replace `api-old.js` imports with `api.js`
- No code changes required
- Full backward compatibility guaranteed

### Phase 2: Gradual Modernization (Optional)
- Adopt direct service imports where beneficial
- Improve testing with service-specific mocks
- Optimize bundle size with tree-shaking

### Phase 3: Full Modernization (Long-term)
- Use service composition patterns
- Implement advanced caching strategies
- Leverage real-time capabilities

## Quick Start Migration

### 1. Immediate Migration (No Code Changes)

```javascript
// Before
import api from './services/api-old.js';

// After - Just change the import path
import api from './services/api.js';

// Everything else stays exactly the same
const reports = await api.getReports();
const safeZones = await api.getSafeZones();
```

### 2. Verify Migration Success

```javascript
// Test that all functionality works
console.log('API methods available:', Object.getOwnPropertyNames(api));

// Test a few key methods
try {
  const context = await api.getUserContext('test-device');
  console.log('✅ Authentication working');
  
  const reports = await api.getReports();
  console.log('✅ Reports working');
  
  const zones = await api.getSafeZones({ lat: 23.8103, lng: 90.4125 });
  console.log('✅ Safe zones working');
  
  console.log('🎉 Migration successful!');
} catch (error) {
  console.error('❌ Migration issue:', error);
}
```

## Component-by-Component Migration

### React Components

#### Before: Monolithic API
```javascript
import React, { useState, useEffect } from 'react';
import api from '../services/api-old.js';

function ReportsList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const result = await api.getReports();
        setReports(result.data || []);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadReports();
  }, []);

  return (
    <div>
      {loading ? 'Loading...' : reports.map(report => (
        <div key={report.id}>{report.description}</div>
      ))}
    </div>
  );
}
```

#### After: Step 1 - Switch to New API (No Other Changes)
```javascript
import React, { useState, useEffect } from 'react';
import api from '../services/api.js'; // Only change this line

function ReportsList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const result = await api.getReports(); // Works exactly the same
        setReports(result.data || []);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadReports();
  }, []);

  return (
    <div>
      {loading ? 'Loading...' : reports.map(report => (
        <div key={report.id}>{report.description}</div>
      ))}
    </div>
  );
}
```

#### After: Step 2 - Direct Service Import (Optional Optimization)
```javascript
import React, { useState, useEffect } from 'react';
import reportService from '../services/features/reportService.js';

function ReportsList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const result = await reportService.getReports(); // Direct service call
        setReports(result.data || []);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadReports();
  }, []);

  return (
    <div>
      {loading ? 'Loading...' : reports.map(report => (
        <div key={report.id}>{report.description}</div>
      ))}
    </div>
  );
}
```

### Vue Components

#### Before: Monolithic API
```javascript
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <div v-for="zone in safeZones" :key="zone.id">
        {{ zone.properties.name }}
      </div>
    </div>
  </div>
</template>

<script>
import api from '../services/api-old.js';

export default {
  data() {
    return {
      safeZones: [],
      loading: true
    };
  },
  
  async mounted() {
    try {
      const result = await api.getSafeZones({
        lat: this.userLocation.lat,
        lng: this.userLocation.lng
      });
      this.safeZones = result.features || [];
    } catch (error) {
      console.error('Failed to load safe zones:', error);
    } finally {
      this.loading = false;
    }
  }
};
</script>
```

#### After: Direct Service Import
```javascript
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <div v-for="zone in safeZones" :key="zone.id">
        {{ zone.properties.name }}
      </div>
    </div>
  </div>
</template>

<script>
import safeZoneService from '../services/features/safeZoneService.js';

export default {
  data() {
    return {
      safeZones: [],
      loading: true
    };
  },
  
  async mounted() {
    try {
      const result = await safeZoneService.getSafeZones({
        lat: this.userLocation.lat,
        lng: this.userLocation.lng
      });
      this.safeZones = result.features || [];
    } catch (error) {
      console.error('Failed to load safe zones:', error);
    } finally {
      this.loading = false;
    }
  }
};
</script>
```

## Testing Migration

### Before: Monolithic API Testing
```javascript
import { describe, it, expect, vi } from 'vitest';
import api from '../services/api-old.js';
import ReportComponent from '../components/ReportComponent.js';

// Mock the entire API
vi.mock('../services/api-old.js', () => ({
  default: {
    getReports: vi.fn(),
    submitReport: vi.fn(),
    getSafeZones: vi.fn(),
    adminLogin: vi.fn()
    // ... many more methods
  }
}));

describe('ReportComponent', () => {
  it('should load reports', async () => {
    api.getReports.mockResolvedValue({ success: true, data: [] });
    
    const component = new ReportComponent();
    await component.loadReports();
    
    expect(api.getReports).toHaveBeenCalled();
  });
});
```

### After: Modular Service Testing
```javascript
import { describe, it, expect, vi } from 'vitest';
import reportService from '../services/features/reportService.js';
import ReportComponent from '../components/ReportComponent.js';

// Mock only the service you need
vi.mock('../services/features/reportService.js', () => ({
  default: {
    getReports: vi.fn(),
    submitReport: vi.fn()
  }
}));

describe('ReportComponent', () => {
  it('should load reports', async () => {
    reportService.getReports.mockResolvedValue({ success: true, data: [] });
    
    const component = new ReportComponent();
    await component.loadReports();
    
    expect(reportService.getReports).toHaveBeenCalled();
  });
  
  // More focused tests possible
  it('should handle report submission', async () => {
    const mockReport = { type: 'harassment', description: 'Test' };
    reportService.submitReport.mockResolvedValue({ success: true, id: '123' });
    
    const component = new ReportComponent();
    const result = await component.submitReport(mockReport);
    
    expect(reportService.submitReport).toHaveBeenCalledWith(mockReport);
    expect(result.success).toBe(true);
  });
});
```

## Service-Specific Migration Patterns

### Authentication Service Migration

```javascript
// Before: Mixed authentication calls
import api from './services/api-old.js';

class AuthManager {
  async login(credentials) {
    const result = await api.adminLogin(credentials);
    if (result.success) {
      const profile = await api.getAdminProfile();
      const context = await api.getUserContext();
      return { result, profile, context };
    }
    return result;
  }
}

// After: Focused authentication service
import authService from './services/features/authService.js';

class AuthManager {
  async login(credentials) {
    const result = await authService.adminLogin(credentials);
    if (result.success) {
      const profile = await authService.getAdminProfile();
      const context = await authService.getUserContext();
      return { result, profile, context };
    }
    return result;
  }
}
```

### Report Management Migration

```javascript
// Before: All-in-one API calls
import api from './services/api-old.js';

class ReportManager {
  async handleReportWorkflow(reportData) {
    // Submit report
    const submission = await api.submitReport(reportData);
    
    // Get updated reports
    const reports = await api.getReports();
    
    // Check for admin reports if needed
    const adminReports = await api.getAdminReports();
    
    return { submission, reports, adminReports };
  }
}

// After: Focused report service
import reportService from './services/features/reportService.js';

class ReportManager {
  async handleReportWorkflow(reportData) {
    // All report operations in one service
    const submission = await reportService.submitReport(reportData);
    const reports = await reportService.getReports();
    const adminReports = await reportService.getAdminReports();
    
    return { submission, reports, adminReports };
  }
}
```

## Advanced Migration Patterns

### Service Composition

```javascript
// Create higher-level services that compose multiple base services
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';
import { calculateDistance } from './services/utils/geoUtils.js';

class LocationAnalysisService {
  async analyzeLocation(lat, lng, radius = 1000) {
    // Compose multiple services for comprehensive analysis
    const [reports, safeZones] = await Promise.all([
      reportService.getReports(),
      safeZoneService.getNearbySafeZones(lat, lng, radius)
    ]);

    // Use utility functions
    const nearbyReports = reports.data?.filter(report => {
      if (!report.location?.coordinates) return false;
      
      const distance = calculateDistance(
        lat, lng,
        report.location.coordinates[1],
        report.location.coordinates[0]
      );
      
      return distance <= radius;
    });

    return {
      location: { lat, lng, radius },
      safeZones: safeZones.features || [],
      incidents: nearbyReports || [],
      analysis: this.generateAnalysis(safeZones.features, nearbyReports)
    };
  }

  generateAnalysis(safeZones, incidents) {
    return {
      safetyScore: this.calculateSafetyScore(safeZones, incidents),
      recommendations: this.generateRecommendations(safeZones, incidents),
      riskFactors: this.identifyRiskFactors(incidents)
    };
  }
}
```

### Custom Hooks/Composables

```javascript
// React Hook
import { useState, useEffect, useCallback } from 'react';
import reportService from '../services/features/reportService.js';
import behaviorService from '../services/features/behaviorService.js';

export function useReportSubmission() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitReport = useCallback(async (reportData) => {
    setSubmitting(true);
    setError(null);
    
    try {
      // Generate behavior data
      const behaviorData = behaviorService.generateBehaviorSignature();
      
      // Submit with behavior tracking
      const result = await reportService.submitReport(reportData, behaviorData);
      
      if (!result.success) {
        setError(result.message);
      }
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return {
    submitReport,
    submitting,
    error,
    clearError: () => setError(null)
  };
}
```

## Performance Optimization During Migration

### Bundle Size Optimization

```javascript
// Before: Large bundle (loads everything)
import api from './services/api.js';

// After: Smaller bundle (tree-shaking friendly)
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';

// Only the services you import are included in the bundle
```

### Caching Optimization

```javascript
// Leverage service-level caching
import safeZoneService from './services/features/safeZoneService.js';

class MapComponent {
  async loadSafeZones(location) {
    // Service handles caching automatically
    const zones = await safeZoneService.getCachedSafeZones(
      `zones_${location.lat}_${location.lng}`,
      () => safeZoneService.getNearbySafeZones(location.lat, location.lng, 2000)
    );
    
    return zones;
  }
  
  clearCache() {
    // Clear cache when needed
    safeZoneService.clearSafeZoneCache();
  }
}
```

## Rollback Strategy

If you encounter issues during migration, you can easily rollback:

### 1. Quick Rollback
```javascript
// Change import back to original
import api from './services/api-old.js'; // Rollback to original

// Everything else stays the same
const reports = await api.getReports();
```

### 2. Partial Rollback
```javascript
// Keep some components on new API, rollback others
import api from './services/api-old.js';        // Rollback this component
import reportService from './services/features/reportService.js'; // Keep this modern

// Mix and match as needed during transition
```

### 3. Gradual Re-migration
```javascript
// Test individual services before full migration
import api from './services/api.js';

// Test specific functionality
try {
  await api.getReports();
  console.log('✅ Reports working with new API');
} catch (error) {
  console.log('❌ Issue with reports, using fallback');
  // Use api-old.js for this specific call
}
```

## Common Migration Issues and Solutions

### Issue 1: Import Path Confusion
```javascript
// ❌ Wrong - mixing old and new
import api from './services/api-old.js';
import reportService from './services/features/reportService.js';

// ✅ Correct - consistent approach
import api from './services/api.js';
// OR
import reportService from './services/features/reportService.js';
import safeZoneService from './services/features/safeZoneService.js';
```

### Issue 2: Device Fingerprint Not Propagating
```javascript
// ✅ Ensure device fingerprint is set on main API
import api from './services/api.js';

// Set once, propagates to all services
api.setDeviceFingerprint('device-123');

// Now all service calls will use the fingerprint
const reports = await api.getReports();
```

### Issue 3: Testing Mock Conflicts
```javascript
// ❌ Wrong - mocking both old and new
vi.mock('./services/api-old.js');
vi.mock('./services/api.js');

// ✅ Correct - mock only what you're using
vi.mock('./services/api.js', () => ({
  default: {
    getReports: vi.fn(),
    submitReport: vi.fn()
  }
}));
```

## Migration Checklist

### Pre-Migration
- [ ] Backup current working code
- [ ] Review all API usage in your codebase
- [ ] Identify components that use the API
- [ ] Plan migration order (start with least critical components)

### During Migration
- [ ] Update import statements
- [ ] Test each component after migration
- [ ] Verify device fingerprint propagation
- [ ] Update test mocks
- [ ] Check console for errors

### Post-Migration
- [ ] Run full test suite
- [ ] Performance testing
- [ ] User acceptance testing
- [ ] Monitor for errors in production
- [ ] Document any custom patterns used

### Optimization Phase (Optional)
- [ ] Identify components that benefit from direct service imports
- [ ] Implement service composition patterns
- [ ] Optimize bundle size with tree-shaking
- [ ] Implement advanced caching strategies

## Support and Resources

### Documentation
- [README.md](./README.md) - Architecture overview
- [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) - Practical examples
- [Service-specific documentation](#service-documentation) - Individual service docs

### Testing
- Run migration verification: `npm run test:migration`
- Performance comparison: `npm run test:performance`
- Full test suite: `npm test`

### Getting Help
1. Check this migration guide
2. Review the usage examples
3. Test with `api-old.js` to compare behavior
4. Check individual service files for implementation details

---

**Remember: The migration is designed to be completely backward compatible. Take your time, test thoroughly, and migrate at your own pace.**