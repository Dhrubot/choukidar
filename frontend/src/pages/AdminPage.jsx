// === src/pages/AdminPage.jsx (ENHANCED - Complete Admin Dashboard) ===
import { useState, useEffect, useRef } from 'react'
import { 
  Shield, Users, TrendingUp, Clock, AlertTriangle, CheckCircle, 
  Eye, Flag, Globe, MapPin, RefreshCw, ArrowRight, ExternalLink,
  FileText, Calendar, Activity
} from 'lucide-react'
import apiService from '../services/api'

function AdminPage() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    security: {
      crossBorderReports: 0,
      potentialSpam: 0,
      bangladeshReports: 0,
      flaggedReports: 0
    },
    sourceBreakdown: []
  })
  
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const refreshIntervalRef = useRef(null)

  // Fetch enhanced dashboard data
  const fetchDashboardData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true)
      
      // Fetch dashboard stats (your existing API)
      const dashboardResponse = await apiService.getAdminDashboard()
      if (dashboardResponse.success) {
        setStats(dashboardResponse.data)
      }

      // Fetch recent activity (pending reports as activity feed)
      const reportsResponse = await apiService.getAdminReports()
      if (reportsResponse.success) {
        // Take the 5 most recent reports as "activity"
        const recent = reportsResponse.data
          .slice(0, 5)
          .map(report => ({
            id: report._id,
            type: 'report_submitted',
            message: `New ${report.type.replace('_', ' ')} report in ${report.location.address}`,
            timestamp: report.createdAt || report.timestamp,
            severity: report.severity,
            reportType: report.type,
            flags: report.securityFlags
          }))
        setRecentActivity(recent)
      }

      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchDashboardData(true)
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchDashboardData(false) // Silent refresh
      }, 30000) // Every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh])

  // Manual refresh
  const handleManualRefresh = () => {
    fetchDashboardData(false)
  }

  // Calculate key metrics
  const moderationBacklog = stats.pending
  const approvalRate = stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0
  const securityRisk = stats.security.flaggedReports > 0 ? 'High' : 'Low'
  const bangladeshCoverage = stats.total > 0 ? ((stats.security.bangladeshReports / stats.total) * 100).toFixed(1) : 0

  if (loading && stats.total === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="flex items-center justify-center py-20">
            <div className="loading-spinner w-8 h-8"></div>
            <span className="ml-3 text-neutral-600">Loading admin dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error && stats.total === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="alert-danger">
            <h4 className="font-medium mb-2">Error Loading Dashboard</h4>
            <p>{error}</p>
            <button onClick={() => fetchDashboardData(true)} className="btn-primary btn-sm mt-3">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container-safe">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
                Admin Dashboard
              </h1>
              <p className="text-neutral-600">
                Manage and moderate community reports • Last updated {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              {/* Auto-refresh toggle */}
              <label className="flex items-center text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh (30s)
              </label>
              
              {/* Manual refresh */}
              <button
                onClick={handleManualRefresh}
                className="btn-outline btn-sm flex items-center"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="text-sm text-neutral-600">Moderation Queue</div>
              <div className={`text-2xl font-bold ${moderationBacklog > 10 ? 'text-red-600' : 'text-neutral-800'}`}>
                {moderationBacklog}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="text-sm text-neutral-600">Approval Rate</div>
              <div className="text-2xl font-bold text-green-600">{approvalRate}%</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="text-sm text-neutral-600">Security Risk</div>
              <div className={`text-2xl font-bold ${securityRisk === 'High' ? 'text-red-600' : 'text-green-600'}`}>
                {securityRisk}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-neutral-200">
              <div className="text-sm text-neutral-600">BD Coverage</div>
              <div className="text-2xl font-bold text-bangladesh-green">{bangladeshCoverage}%</div>
            </div>
          </div>
        </div>

        {/* Main Stats Grid - Enhanced */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card group hover:shadow-medium transition-all duration-300">
            <div className="card-body text-center">
              <div className="bg-neutral-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 group-hover:bg-neutral-200 transition-colors">
                <Shield className="w-6 h-6 text-neutral-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.total}</h3>
              <p className="text-neutral-600 text-sm">Total Reports</p>
              <div className="text-xs text-neutral-400 mt-1">All time</div>
            </div>
          </div>
          
          <div className="card group hover:shadow-medium transition-all duration-300">
            <div className="card-body text-center">
              <div className="bg-orange-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-200 transition-colors">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.pending}</h3>
              <p className="text-neutral-600 text-sm">Pending Review</p>
              <div className="text-xs text-neutral-400 mt-1">Needs action</div>
            </div>
          </div>
          
          <div className="card group hover:shadow-medium transition-all duration-300">
            <div className="card-body text-center">
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 group-hover:bg-green-200 transition-colors">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.approved}</h3>
              <p className="text-neutral-600 text-sm">Approved</p>
              <div className="text-xs text-green-600 mt-1">Public on map</div>
            </div>
          </div>
          
          <div className="card group hover:shadow-medium transition-all duration-300">
            <div className="card-body text-center">
              <div className="bg-red-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 group-hover:bg-red-200 transition-colors">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.rejected}</h3>
              <p className="text-neutral-600 text-sm">Rejected</p>
              <div className="text-xs text-neutral-400 mt-1">Archived</div>
            </div>
          </div>
        </div>

        {/* Quick Actions Section - NEW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Moderation Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-neutral-800 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-orange-600" />
                Moderation Queue
              </h3>
            </div>
            <div className="card-body">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-orange-600 mb-2">{stats.pending}</div>
                <p className="text-sm text-neutral-600">Reports awaiting review</p>
              </div>
              
              {stats.pending > 0 ? (
                <button className="btn-secondary w-full flex items-center justify-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Review Pending ({stats.pending})
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </button>
              ) : (
                <div className="text-center text-green-600 text-sm">
                  ✅ All caught up! No pending reports.
                </div>
              )}
              
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Avg. review time:</span>
                  <span>~2 minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Alerts */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-neutral-800 flex items-center">
                <Flag className="w-5 h-5 mr-2 text-red-600" />
                Security Alerts
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Flagged Reports:</span>
                  <span className={`font-medium ${stats.security.flaggedReports > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.security.flaggedReports}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Cross-border:</span>
                  <span className="font-medium text-neutral-800">{stats.security.crossBorderReports}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Potential Spam:</span>
                  <span className="font-medium text-neutral-800">{stats.security.potentialSpam}</span>
                </div>
              </div>
              
              {stats.security.flaggedReports > 0 ? (
                <button className="btn-outline w-full mt-4 flex items-center justify-center text-red-600 border-red-600 hover:bg-red-50">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Review Flagged Reports
                </button>
              ) : (
                <div className="text-center text-green-600 text-sm mt-4">
                  🛡️ No security alerts
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-neutral-800 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-bangladesh-green" />
                Quick Analytics
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Bangladesh Reports:</span>
                  <span className="font-medium text-bangladesh-green">{bangladeshCoverage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Approval Rate:</span>
                  <span className="font-medium text-green-600">{approvalRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600">Most Common:</span>
                  <span className="font-medium text-neutral-800">
                    {stats.sourceBreakdown[0]?._id || 'N/A'}
                  </span>
                </div>
              </div>
              
              <button className="btn-outline w-full mt-4 flex items-center justify-center">
                <FileText className="w-4 h-4 mr-2" />
                View Full Analytics
                <ExternalLink className="w-3 h-3 ml-auto" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Activity Feed - NEW */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-neutral-800 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-safe-primary" />
                Recent Activity
              </h3>
            </div>
            <div className="card-body">
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 bg-neutral-50 rounded-lg">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.severity >= 4 ? 'bg-red-100' : 
                        activity.severity >= 3 ? 'bg-yellow-100' : 'bg-green-100'
                      }`}>
                        {activity.reportType === 'chadabaji' && '💰'}
                        {activity.reportType === 'teen_gang' && '👥'}
                        {activity.reportType === 'chintai' && '⚠️'}
                        {activity.reportType === 'other' && '🚨'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-800 truncate">
                          {activity.message}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-neutral-500">
                            {new Date(activity.timestamp).toLocaleTimeString()}
                          </p>
                          {activity.flags?.crossBorderReport && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              Cross-border
                            </span>
                          )}
                          {activity.flags?.potentialSpam && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                              Flagged
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-neutral-500 py-8">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div className="card">
            <div className="card-header">
              <h3 className="font-bold text-neutral-800 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-safe-info" />
                System Status
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium">Report Submission</span>
                  </div>
                  <span className="text-sm text-green-600">Operational</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium">Map Services</span>
                  </div>
                  <span className="text-sm text-green-600">Operational</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm font-medium">Database</span>
                  </div>
                  <span className="text-sm text-green-600">Operational</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${autoRefresh ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-sm font-medium">Auto-refresh</span>
                  </div>
                  <span className={`text-sm ${autoRefresh ? 'text-green-600' : 'text-yellow-600'}`}>
                    {autoRefresh ? 'Active' : 'Paused'}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Next auto-refresh:</span>
                  <span>{autoRefresh ? '30s' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Current Stats Summary */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-neutral-800">Detailed Statistics</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-neutral-700 mb-3">Report Status Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Pending Review:</span>
                    <span className="font-medium text-orange-600">{stats.pending} reports</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Approved & Public:</span>
                    <span className="font-medium text-green-600">{stats.approved} reports</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Rejected/Spam:</span>
                    <span className="font-medium text-red-600">{stats.rejected} reports</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-neutral-700 mb-3">Security Overview</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Bangladesh Reports:</span>
                    <span className="font-medium text-bangladesh-green">{stats.security.bangladeshReports}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Cross-border Reports:</span>
                    <span className="font-medium text-yellow-600">{stats.security.crossBorderReports}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Flagged for Review:</span>
                    <span className="font-medium text-red-600">{stats.security.flaggedReports}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-neutral-700 mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="btn-primary btn-sm w-full">
                    Review Pending Reports ({stats.pending})
                  </button>
                  <button className="btn-outline btn-sm w-full">
                    View All Reports ({stats.total})
                  </button>
                  <button className="btn-ghost btn-sm w-full">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPage