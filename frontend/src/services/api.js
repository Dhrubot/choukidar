// === src/services/api.js ===
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

  // Admin methods
  async getAdminReports() {
    return this.request('/admin/reports')
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
}

// Create and export a single instance
const apiService = new ApiService()
export default apiService