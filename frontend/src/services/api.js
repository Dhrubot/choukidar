// === frontend/src/services/api.js (COMPLETE FIXED VERSION) ===
const API_BASE_URL = 'http://localhost:5000/api'

class ApiService {
  // ✅ EXISTING HELPER METHOD PRESERVED
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // ✅ EXISTING HEALTH CHECK PRESERVED
  async healthCheck() {
    return this.request('/health')
  }

  // ========== ✅ EXISTING PUBLIC REPORT METHODS PRESERVED ==========
  
  async submitReport(reportData) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    })
  }

  async getReports() {
    return this.request('/reports')
  }

  async getReport(id) {
    return this.request(`/reports/${id}`)
  }

  // ========== ✅ EXISTING ADMIN METHODS PRESERVED ==========

  async getAdminReports() {
    return this.request('/admin/reports')
  }

  async getAllAdminReports() {
    return this.request('/admin/reports/all')
  }

  async getFlaggedReports() {
    return this.request('/admin/reports/flagged')
  }

  async updateReportStatus(id, status) {
    return this.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  }

  async getAdminDashboard() {
    return this.request('/admin/dashboard')
  }

  async getSecurityAnalytics() {
    return this.request('/admin/analytics/security')
  }

  // ========== ✅ EXISTING BULK OPERATIONS PRESERVED ==========
  
  async bulkUpdateReports(reportIds, status) {
    const results = []
    for (const id of reportIds) {
      try {
        const result = await this.updateReportStatus(id, status)
        results.push({ id, success: true, result })
      } catch (error) {
        results.push({ id, success: false, error: error.message })
      }
    }
    return { success: true, results }
  }

  // ========== ✅ EXISTING ADMIN AUTHENTICATION PLACEHOLDERS PRESERVED ==========
  
  async adminLogin(credentials) {
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  async adminLogout() {
    return this.request('/admin/logout', {
      method: 'POST'
    })
  }

  async verifyAdminSession() {
    return this.request('/admin/verify')
  }

  // ========== ✅ EXISTING ENHANCED FILTERING & SEARCH PRESERVED ==========
  
  async getReportsWithFilter(filters = {}) {
    const params = new URLSearchParams()
    
    if (filters.status) params.append('status', filters.status)
    if (filters.type) params.append('type', filters.type)
    if (filters.severity) params.append('severity', filters.severity)
    if (filters.flagged) params.append('flagged', filters.flagged)
    if (filters.withinBangladesh !== undefined) params.append('withinBangladesh', filters.withinBangladesh)
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.append('dateTo', filters.dateTo)
    if (filters.search) params.append('search', filters.search)
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.limit) params.append('limit', filters.limit)
    if (filters.offset) params.append('offset', filters.offset)

    const queryString = params.toString()
    const endpoint = `/admin/reports${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  // 🔧 FIXED: RESTORED SEARCH REPORTS METHOD
  async searchReports(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    }
    return this.getReportsWithFilter(searchFilters)
  }

  // ========== 🔧 FIXED: RESTORED ANALYTICS & REPORTING METHODS ==========
  
  async getModerationStats(timeframe = '30d') {
    return this.request(`/admin/analytics/moderation?timeframe=${timeframe}`)
  }

  async getGeographicStats() {
    return this.request('/admin/analytics/geographic')
  }

  async exportReports(format = 'csv', filters = {}) {
    const params = new URLSearchParams(filters)
    params.append('format', format)
    
    const response = await fetch(`${API_BASE_URL}/admin/export?${params.toString()}`, {
      headers: {
        'Accept': format === 'csv' ? 'text/csv' : 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error('Export failed')
    }
    
    return format === 'csv' ? response.text() : response.json()
  }

  // ========== 🔧 FIXED: RESTORED REAL-TIME FEATURES PLACEHOLDER ==========
  
  subscribeToUpdates(callback) {
    // TODO: Implement WebSocket or SSE for real-time updates
    console.log('Real-time updates not yet implemented')
    return () => {} // Return unsubscribe function
  }

  // ========== 🔧 FIXED: RESTORED ERROR HANDLING & RETRY ==========
  
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options)
      } catch (error) {
        lastError = error
        
        // Don't retry on 4xx errors (client errors)
        if (error.message.includes('4')) {
          throw error
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }
    
    throw lastError
  }

  // ========== 🔧 FIXED: RESTORED UTILITY METHODS ==========
  
  async getApiInfo() {
    return this.request('/health')
  }

  async checkAdminAccess() {
    try {
      await this.request('/admin/dashboard')
      return true
    } catch (error) {
      return false
    }
  }

  validateReportData(reportData) {
    const errors = []
    
    if (!reportData.type) errors.push('Report type is required')
    if (!reportData.description || reportData.description.length < 10) {
      errors.push('Description must be at least 10 characters')
    }
    if (!reportData.location || !reportData.location.coordinates) {
      errors.push('Location coordinates are required')
    }
    if (!reportData.severity || reportData.severity < 1 || reportData.severity > 5) {
      errors.push('Severity must be between 1 and 5')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  formatApiError(error) {
    if (typeof error === 'string') return error
    
    if (error.message) {
      // Clean up common API error messages
      if (error.message.includes('Failed to fetch')) {
        return 'Unable to connect to server. Please check your internet connection.'
      }
      if (error.message.includes('404')) {
        return 'The requested resource was not found.'
      }
      if (error.message.includes('500')) {
        return 'Server error. Please try again later.'
      }
      return error.message
    }
    
    return 'An unexpected error occurred. Please try again.'
  }

  // ========== 🆕 PHASE 3B: SAFE ZONES METHODS ==========

  // Get public safe zones for map display
  async getSafeZones(options = {}) {
    const params = new URLSearchParams()
    
    // Location-based filtering
    if (options.lat) params.append('lat', options.lat)
    if (options.lng) params.append('lng', options.lng)
    if (options.radius) params.append('radius', options.radius)
    
    // Type and safety filtering
    if (options.minSafety) params.append('minSafety', options.minSafety)
    if (options.zoneType) params.append('zoneType', options.zoneType)
    if (options.category) params.append('category', options.category)
    if (options.district) params.append('district', options.district)
    if (options.limit) params.append('limit', options.limit)

    const queryString = params.toString()
    const endpoint = `/safezones${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  // Get nearby safe zones (shorthand method)
  async getNearbySafeZones(lat, lng, radius = 2000, minSafety = 6) {
    return this.getSafeZones({ lat, lng, radius, minSafety })
  }

  // Get specific safe zone by ID
  async getSafeZone(id) {
    return this.request(`/safezones/${id}`)
  }

  // Get safe zones by district/location
  async getSafeZonesByLocation(district, options = {}) {
    const params = new URLSearchParams()
    
    if (options.thana) params.append('thana', options.thana)
    if (options.zoneType) params.append('zoneType', options.zoneType)
    if (options.minSafety) params.append('minSafety', options.minSafety)
    if (options.limit) params.append('limit', options.limit)

    const queryString = params.toString()
    const endpoint = `/safezones/location/${district}${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  // Get public safe zone analytics
  async getSafeZoneAnalytics() {
    return this.request('/safezones/analytics/public')
  }

  // ========== 🆕 ADMIN SAFE ZONE METHODS ==========

  // Get all safe zones (admin only)
  async getAdminSafeZones(options = {}) {
    const params = new URLSearchParams()
    
    if (options.status) params.append('status', options.status)
    if (options.zoneType) params.append('zoneType', options.zoneType)
    if (options.verificationStatus) params.append('verificationStatus', options.verificationStatus)
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    if (options.limit) params.append('limit', options.limit)
    if (options.offset) params.append('offset', options.offset)

    const queryString = params.toString()
    const endpoint = `/safezones/admin/all${queryString ? `?${queryString}` : ''}`
    
    return this.request(endpoint)
  }

  // Create new safe zone (admin only)
  async createSafeZone(safeZoneData) {
    return this.request('/safezones/admin/create', {
      method: 'POST',
      body: JSON.stringify(safeZoneData)
    })
  }

  // Update safe zone (admin only)
  async updateSafeZone(id, safeZoneData) {
    return this.request(`/safezones/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(safeZoneData)
    })
  }

  // Delete safe zone (admin only)
  async deleteSafeZone(id) {
    return this.request(`/safezones/admin/${id}`, {
      method: 'DELETE'
    })
  }

  // Bulk update safe zone statuses (admin only)
  async bulkUpdateSafeZoneStatus(safeZoneIds, status) {
    return this.request('/safezones/admin/bulk/status', {
      method: 'PUT',
      body: JSON.stringify({ safeZoneIds, status })
    })
  }

  // Get admin safe zone analytics
  async getAdminSafeZoneAnalytics() {
    return this.request('/safezones/admin/analytics')
  }

  // Import safe zones from data (admin only)
  async importSafeZones(safeZones, source = 'import', overwrite = false) {
    return this.request('/safezones/admin/import', {
      method: 'POST',
      body: JSON.stringify({ safeZones, source, overwrite })
    })
  }

  // Export safe zones data (admin only)
  async exportSafeZones(format = 'json', status = 'active') {
    const params = new URLSearchParams({ format, status })
    return this.request(`/safezones/admin/export?${params}`)
  }

  // ========== 🆕 PHASE 3B: UTILITY METHODS FOR INTELLIGENCE ==========

  // Check if safe zones service is available
  async checkSafeZonesAvailability() {
    try {
      const response = await this.getSafeZoneAnalytics()
      return { available: true, data: response.data }
    } catch (error) {
      return { available: false, error: error.message }
    }
  }

  // Get intelligent recommendations based on location
  async getLocationIntelligence(lat, lng) {
    try {
      const [safeZones, reports] = await Promise.all([
        this.getNearbySafeZones(lat, lng, 1000), // 1km radius
        this.getReports() // Get all reports (could be filtered by location)
      ])

      return {
        success: true,
        data: {
          nearbySafeZones: safeZones.features || [],
          nearbyReports: reports.data || [],
          safetyRecommendations: this.generateSafetyRecommendations(safeZones, reports),
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  // Generate basic safety recommendations (client-side logic)
  generateSafetyRecommendations(safeZones, reports) {
    const recommendations = []
    
    if (safeZones.features && safeZones.features.length > 0) {
      const highSafetyZones = safeZones.features.filter(zone => 
        zone.properties.safetyScore >= 8
      )
      
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'safe_zone',
          priority: 'high',
          message: `${highSafetyZones.length} high-safety zones nearby`,
          zones: highSafetyZones.slice(0, 3) // Top 3 zones
        })
      }
    }

    if (reports.data && reports.data.length > 0) {
      const recentReports = reports.data.filter(report => {
        const reportDate = new Date(report.createdAt || report.timestamp)
        const daysDiff = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24)
        return daysDiff <= 7 // Reports from last 7 days
      })

      if (recentReports.length > 0) {
        recommendations.push({
          type: 'caution',
          priority: 'medium',
          message: `${recentReports.length} recent incidents in the area`,
          suggestion: 'Exercise extra caution and consider safer routes'
        })
      }
    }

    return recommendations
  }

  // ========== 🆕 CACHING UTILITIES FOR PERFORMANCE ==========

  // Simple in-memory cache for safe zones
  _safeZoneCache = new Map()
  _cacheExpiry = 5 * 60 * 1000 // 5 minutes

  async getCachedSafeZones(cacheKey, fetchFunction) {
    const cached = this._safeZoneCache.get(cacheKey)
    
    if (cached && (Date.now() - cached.timestamp) < this._cacheExpiry) {
      console.log('🔄 Using cached safe zones data')
      return cached.data
    }

    try {
      const freshData = await fetchFunction()
      this._safeZoneCache.set(cacheKey, {
        data: freshData,
        timestamp: Date.now()
      })
      
      // Cleanup old cache entries
      if (this._safeZoneCache.size > 50) {
        const oldestKey = this._safeZoneCache.keys().next().value
        this._safeZoneCache.delete(oldestKey)
      }
      
      return freshData
    } catch (error) {
      // If fresh fetch fails, return stale cache if available
      if (cached) {
        console.warn('⚠️ Using stale cache due to fetch error:', error.message)
        return cached.data
      }
      throw error
    }
  }

  // Clear safe zone cache
  clearSafeZoneCache() {
    this._safeZoneCache.clear()
    console.log('🗑️ Safe zone cache cleared')
  }

  // ========== 🆕 ENHANCED ERROR HANDLING AND RETRY LOGIC ==========

  async requestWithIntelligenceRetry(endpoint, options = {}, maxRetries = 2) {
    let lastError
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Intelligence retry attempt ${attempt} for ${endpoint}`)
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
        
        return await this.request(endpoint, options)
      } catch (error) {
        lastError = error
        
        // Don't retry for client errors (4xx)
        if (error.message.includes('40')) {
          throw error
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break
        }
        
        console.warn(`⚠️ Request failed (attempt ${attempt + 1}):`, error.message)
      }
    }
    
    throw lastError
  }

  // ========== 🆕 BATCH OPERATIONS FOR EFFICIENCY ==========

  // Batch get multiple safe zones by IDs
  async getBatchSafeZones(ids) {
    const results = []
    const batchSize = 5 // Process in batches to avoid overwhelming the server
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const batchPromises = batch.map(id => 
        this.getSafeZone(id).catch(error => ({ error: error.message, id }))
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return {
      success: true,
      results,
      total: ids.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    }
  }

  // Batch create multiple safe zones (admin only)
  async createBatchSafeZones(safeZonesData) {
    const results = []
    
    for (const safeZoneData of safeZonesData) {
      try {
        const result = await this.createSafeZone(safeZoneData)
        results.push({ success: true, data: result })
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message, 
          safeZone: safeZoneData.name || 'Unknown' 
        })
      }
    }
    
    return {
      success: true,
      results,
      total: safeZonesData.length,
      created: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  }

  // ========== 🆕 INTELLIGENCE INTEGRATION HELPERS ==========

  // Get comprehensive area analysis
  async getAreaAnalysis(lat, lng, radius = 1000) {
    try {
      const [safeZones, reports, analytics] = await Promise.allSettled([
        this.getNearbySafeZones(lat, lng, radius),
        this.getReports(), // TODO: Add location filtering when backend supports it
        this.getSafeZoneAnalytics()
      ])

      const result = {
        location: { lat, lng, radius },
        timestamp: new Date().toISOString(),
        analysis: {}
      }

      // Process safe zones data
      if (safeZones.status === 'fulfilled') {
        const zones = safeZones.value.features || []
        result.analysis.safeZones = {
          total: zones.length,
          averageSafety: zones.length > 0 ? 
            zones.reduce((sum, z) => sum + z.properties.safetyScore, 0) / zones.length : 0,
          highSafety: zones.filter(z => z.properties.safetyScore >= 8).length,
          zones: zones.slice(0, 5) // Top 5 nearest zones
        }
      } else {
        result.analysis.safeZones = { error: safeZones.reason?.message }
      }

      // Process reports data (simplified)
      if (reports.status === 'fulfilled') {
        const reportsData = reports.value.data || []
        result.analysis.incidents = {
          total: reportsData.length,
          recent: reportsData.filter(r => {
            const days = (Date.now() - new Date(r.createdAt || r.timestamp)) / (1000 * 60 * 60 * 24)
            return days <= 30
          }).length
        }
      } else {
        result.analysis.incidents = { error: reports.reason?.message }
      }

      // Process analytics
      if (analytics.status === 'fulfilled') {
        result.analysis.overview = analytics.value.data
      }

      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Get route safety analysis (client-side preparation for routing service)
  async getRouteSafetyData(startLat, startLng, endLat, endLng) {
    try {
      // Get safe zones along potential route corridor
      const midLat = (startLat + endLat) / 2
      const midLng = (startLng + endLng) / 2
      
      // Calculate rough corridor radius
      const distance = this.calculateDistance(startLat, startLng, endLat, endLng)
      const corridorRadius = Math.max(500, distance / 2) // At least 500m, or half the route distance
      
      const safeZones = await this.getNearbySafeZones(midLat, midLng, corridorRadius)
      
      return {
        success: true,
        data: {
          route: { start: [startLat, startLng], end: [endLat, endLng] },
          distance,
          corridorSafeZones: safeZones.features || [],
          safetyScore: this.calculateRouteSafetyScore(safeZones.features || []),
          recommendations: this.generateRouteRecommendations(safeZones.features || [])
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180
    const φ2 = lat2 * Math.PI/180
    const Δφ = (lat2-lat1) * Math.PI/180
    const Δλ = (lng2-lng1) * Math.PI/180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  // Calculate route safety score based on nearby safe zones
  calculateRouteSafetyScore(safeZones) {
    if (safeZones.length === 0) return 3 // Low safety if no safe zones

    const avgSafety = safeZones.reduce((sum, zone) => 
      sum + zone.properties.safetyScore, 0) / safeZones.length
    
    const coverage = Math.min(safeZones.length / 3, 1) // Normalize coverage (max 3 zones = full coverage)
    
    return Math.round((avgSafety * 0.7 + coverage * 10 * 0.3) * 10) / 10
  }

  // Generate route recommendations
  generateRouteRecommendations(safeZones) {
    const recommendations = []
    
    if (safeZones.length === 0) {
      recommendations.push({
        type: 'warning',
        message: 'No safe zones identified along this route',
        suggestion: 'Consider alternative routes with better safety coverage'
      })
    } else {
      const highSafetyZones = safeZones.filter(z => z.properties.safetyScore >= 8)
      if (highSafetyZones.length > 0) {
        recommendations.push({
          type: 'positive',
          message: `Route passes near ${highSafetyZones.length} high-safety zones`,
          suggestion: 'This appears to be a relatively safe route'
        })
      }
      
      const policeStations = safeZones.filter(z => z.properties.zoneType === 'police_station')
      if (policeStations.length > 0) {
        recommendations.push({
          type: 'info',
          message: `${policeStations.length} police stations along route`,
          suggestion: 'Good emergency support availability'
        })
      }
    }
    
    return recommendations
  }
}

// Create and export singleton instance
const apiService = new ApiService()

export default apiService

// 🔧 FIXED: RESTORED EXPORT CLASS FOR TESTING
export { ApiService }

// Export individual methods for convenience
export const {
  // ✅ Existing core methods
  healthCheck,
  submitReport,
  getReports,
  getReport,
  
  // ✅ Existing admin methods
  getAdminReports,
  getAllAdminReports,
  getFlaggedReports,
  updateReportStatus,
  getAdminDashboard,
  getSecurityAnalytics,
  bulkUpdateReports,
  adminLogin,
  adminLogout,
  verifyAdminSession,
  
  // ✅ Existing filtering and search
  getReportsWithFilter,
  searchReports,
  
  // 🔧 FIXED: Restored analytics methods
  getModerationStats,
  getGeographicStats,
  exportReports,
  
  // 🔧 FIXED: Restored real-time placeholder
  subscribeToUpdates,
  
  // 🔧 FIXED: Restored utility methods
  getApiInfo,
  checkAdminAccess,
  validateReportData,
  formatApiError,
  requestWithRetry,
  
  // 🆕 Phase 3B: Safe Zones methods
  getSafeZones,
  getNearbySafeZones,
  getSafeZone,
  getSafeZonesByLocation,
  getSafeZoneAnalytics,
  getAdminSafeZones,
  createSafeZone,
  updateSafeZone,
  deleteSafeZone,
  bulkUpdateSafeZoneStatus,
  getAdminSafeZoneAnalytics,
  importSafeZones,
  exportSafeZones,
  
  // 🆕 Intelligence methods
  checkSafeZonesAvailability,
  getLocationIntelligence,
  getAreaAnalysis,
  getRouteSafetyData,
  
  // 🆕 Utility methods
  getCachedSafeZones,
  clearSafeZoneCache,
  requestWithIntelligenceRetry,
  getBatchSafeZones,
  createBatchSafeZones
} = apiService