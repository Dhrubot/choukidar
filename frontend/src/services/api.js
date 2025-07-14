// === src/services/api.js (UPDATED - Enhanced Admin Methods) ===
const API_BASE_URL = 'http://localhost:5000/api'

class ApiService {
  // Helper method for making requests
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

  // Health check
  async healthCheck() {
    return this.request('/health')
  }

  // ========== PUBLIC REPORT METHODS ==========
  
  // Submit a new report
  async submitReport(reportData) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    })
  }

  // Get all approved reports (for map)
  async getReports() {
    return this.request('/reports')
  }

  // Get single report by ID
  async getReport(id) {
    return this.request(`/reports/${id}`)
  }

  // ========== ADMIN METHODS ==========

  // Get pending reports (admin only)
  async getAdminReports() {
    return this.request('/admin/reports')
  }

  // Get all reports (admin only) - NEW
  async getAllAdminReports() {
    return this.request('/admin/reports/all')
  }

  // Get flagged reports (admin only) - NEW
  async getFlaggedReports() {
    return this.request('/admin/reports/flagged')
  }

  // Update report status (approve/reject)
  async updateReportStatus(id, status) {
    return this.request(`/admin/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  }

  // Get admin dashboard stats
  async getAdminDashboard() {
    return this.request('/admin/dashboard')
  }

  // Get security analytics (admin only) - NEW
  async getSecurityAnalytics() {
    return this.request('/admin/analytics/security')
  }

  // ========== BULK OPERATIONS (Future Enhancement) ==========
  
  // Bulk update report statuses - PLACEHOLDER
  async bulkUpdateReports(reportIds, status) {
    // For now, we'll process individually
    // In future, create a dedicated bulk endpoint
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

  // ========== ADMIN AUTHENTICATION (Future Enhancement) ==========
  
  // Admin login - PLACEHOLDER
  async adminLogin(credentials) {
    // TODO: Implement admin authentication
    return this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  // Admin logout - PLACEHOLDER
  async adminLogout() {
    // TODO: Implement admin logout
    return this.request('/admin/logout', {
      method: 'POST'
    })
  }

  // Verify admin session - PLACEHOLDER
  async verifyAdminSession() {
    // TODO: Implement session verification
    return this.request('/admin/verify')
  }

  // ========== ENHANCED FILTERING & SEARCH ==========
  
  // Get reports with advanced filtering - NEW
  async getReportsWithFilter(filters = {}) {
    const params = new URLSearchParams()
    
    // Add filter parameters
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

  // Search reports by text - NEW
  async searchReports(searchTerm, filters = {}) {
    const searchFilters = {
      ...filters,
      search: searchTerm
    }
    return this.getReportsWithFilter(searchFilters)
  }

  // ========== ANALYTICS & REPORTING ==========
  
  // Get moderation statistics - NEW
  async getModerationStats(timeframe = '30d') {
    return this.request(`/admin/analytics/moderation?timeframe=${timeframe}`)
  }

  // Get geographic distribution - NEW
  async getGeographicStats() {
    return this.request('/admin/analytics/geographic')
  }

  // Export reports data - NEW
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

  // ========== REAL-TIME FEATURES (Future Enhancement) ==========
  
  // Subscribe to real-time updates - PLACEHOLDER
  subscribeToUpdates(callback) {
    // TODO: Implement WebSocket or SSE for real-time updates
    console.log('Real-time updates not yet implemented')
    return () => {} // Return unsubscribe function
  }

  // ========== ERROR HANDLING & RETRY ==========
  
  // Request with retry logic
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

  // ========== UTILITY METHODS ==========
  
  // Get API health and version info
  async getApiInfo() {
    return this.request('/health')
  }

  // Check if admin endpoints are available
  async checkAdminAccess() {
    try {
      await this.request('/admin/dashboard')
      return true
    } catch (error) {
      return false
    }
  }

  // Validate report data before submission
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

  // Format API error for display
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
}

// Create and export a single instance
const apiService = new ApiService()
export default apiService

// Export the class as well for testing
export { ApiService }