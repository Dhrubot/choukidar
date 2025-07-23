// === src/components/Admin/ModerationQueue.jsx ===
import { useState, useEffect } from 'react'
import { 
  Clock, CheckCircle, X, Eye, MapPin, AlertTriangle, Flag,
  Calendar, Globe, Navigation, ExternalLink, ChevronDown,
  Filter, Search, RefreshCw, MoreHorizontal, Shield
} from 'lucide-react'
import apiService from '../../services/api'

const ModerationQueue = () => {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedReports, setSelectedReports] = useState([])
  const [filterStatus, setFilterStatus] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [moderating, setModerating] = useState({})
  const [expandedReport, setExpandedReport] = useState(null)

  // Fetch reports based on filter
  const fetchReports = async () => {
    try {
      setLoading(true)
      let response
      
      // Always fetch all admin reports first, then filter client-side
      // This is more efficient than multiple API calls
      if (filterStatus === 'pending') {
        response = await apiService.getAdminReports() // This gets pending only
      } else {
        // For all other filters, we need all reports
        try {
          response = await apiService.getAllAdminReports() // Try the all reports endpoint
        } catch (error) {
          console.log('getAllAdminReports not available, falling back to getAdminReports')
          response = await apiService.getAdminReports() // Fallback to pending only
        }
      }

      if (response.success) {
        // Handle the correct data structure from backend
        let reportsData = response.data.reports || response.data || [];
        
        // Ensure it's an array
        if (!Array.isArray(reportsData)) {
          console.error('Reports data is not an array:', reportsData);
          reportsData = [];
        }
        
        let filteredReports = reportsData;

        // Apply status filter
        if (filterStatus !== 'all') {
          filteredReports = filteredReports.filter(report => {
            if (filterStatus === 'pending') {
              return report.status === 'pending' || !report.status; // Include reports without status (default pending)
            }
            if (filterStatus === 'flagged') {
              return report.securityFlags?.crossBorderReport || 
                     report.securityFlags?.potentialSpam ||
                     report.securityFlags?.suspiciousLocation
            }
            // For approved, rejected, etc.
            return report.status === filterStatus
          })
        }

        // Apply search filter
        if (searchTerm) {
          filteredReports = filteredReports.filter(report =>
            report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.location.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.type.toLowerCase().includes(searchTerm.toLowerCase())
          )
        }

        // Apply sorting - ensure filteredReports is still an array
        if (Array.isArray(filteredReports)) {
          filteredReports.sort((a, b) => {
            switch (sortBy) {
              case 'newest':
                return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
              case 'oldest':
                return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
              case 'severity':
                return b.severity - a.severity
              case 'type':
                return a.type.localeCompare(b.type)
              default:
                return 0
            }
          })
        }

        setReports(filteredReports)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [filterStatus, searchTerm, sortBy])

  // Moderate individual report
  const moderateReport = async (reportId, action) => {
    try {
      setModerating(prev => ({ ...prev, [reportId]: true }))
      
      const response = await apiService.updateReportStatus(reportId, action)
      
      if (response.success) {
        // Remove from list if we're filtering by pending
        if (filterStatus === 'pending') {
          setReports(prev => prev.filter(r => r._id !== reportId))
        } else {
          // Update status in place
          setReports(prev => prev.map(r => 
            r._id === reportId ? { ...r, status: action, moderatedAt: new Date() } : r
          ))
        }
        
        // Remove from selected if it was selected
        setSelectedReports(prev => prev.filter(id => id !== reportId))
      }
    } catch (err) {
      alert(`Error ${action === 'approved' ? 'approving' : 'rejecting'} report: ${err.message}`)
    } finally {
      setModerating(prev => ({ ...prev, [reportId]: false }))
    }
  }

  // Bulk moderation
  const bulkModerate = async (action) => {
    if (selectedReports.length === 0) return
    
    if (!confirm(`${action === 'approved' ? 'Approve' : 'Reject'} ${selectedReports.length} selected reports?`)) {
      return
    }

    try {
      setLoading(true)
      
      // Process each report individually (could be optimized with bulk API)
      for (const reportId of selectedReports) {
        await apiService.updateReportStatus(reportId, action)
      }
      
      // Refresh the list
      await fetchReports()
      setSelectedReports([])
    } catch (err) {
      alert(`Error processing bulk action: ${err.message}`)
    }
  }

  // Toggle report selection
  const toggleReportSelection = (reportId) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    )
  }

  // Select all visible reports
  const selectAllReports = () => {
    if (selectedReports.length === reports.length) {
      setSelectedReports([])
    } else {
      setSelectedReports(reports.map(r => r._id))
    }
  }

  // Get incident type display
  const getIncidentDisplay = (type) => {
    const types = {
      'chadabaji': { icon: '💰', label: 'Chadabaji', color: 'text-orange-600' },
      'teen_gang': { icon: '👥', label: 'Teen Gang', color: 'text-red-600' },
      'chintai': { icon: '⚠️', label: 'Chintai', color: 'text-yellow-600' },
      'other': { icon: '🚨', label: 'Other', color: 'text-neutral-600' }
    }
    return types[type] || types.other
  }

  // Get severity color and label
  const getSeverityDisplay = (severity) => {
    if (severity <= 2) return { color: 'bg-green-500', label: 'Low' }
    if (severity <= 3) return { color: 'bg-yellow-500', label: 'Medium' }
    if (severity <= 4) return { color: 'bg-orange-500', label: 'High' }
    return { color: 'bg-red-500', label: 'Critical' }
  }

  // Get security flags display
  const getSecurityFlags = (report) => {
    const flags = []
    if (report.securityFlags?.crossBorderReport) flags.push({ label: 'Cross-border', color: 'bg-yellow-100 text-yellow-800' })
    if (report.securityFlags?.potentialSpam) flags.push({ label: 'Potential Spam', color: 'bg-red-100 text-red-800' })
    if (report.securityFlags?.suspiciousLocation) flags.push({ label: 'Suspicious Location', color: 'bg-orange-100 text-orange-800' })
    if (!report.location?.withinBangladesh) flags.push({ label: 'Outside BD', color: 'bg-gray-100 text-gray-800' })
    return flags
  }

  if (loading && reports.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-center py-12">
            <div className="loading-spinner w-8 h-8"></div>
            <span className="ml-3 text-neutral-600">Loading reports...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h2 className="text-xl font-bold text-neutral-800 mb-2">Report Moderation Queue</h2>
              <p className="text-neutral-600">
                {reports.length} reports • {selectedReports.length} selected
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10 pr-4 w-64"
                />
              </div>

              {/* Filter by Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select"
              >
                <option value="pending">Pending Only</option>
                <option value="flagged">Flagged Reports</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Reports</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="severity">High Severity</option>
                <option value="type">By Type</option>
              </select>

              {/* Refresh */}
              <button
                onClick={fetchReports}
                className="btn-outline btn-sm"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedReports.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  {selectedReports.length} reports selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => bulkModerate('approved')}
                    className="btn-primary btn-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve All
                  </button>
                  <button
                    onClick={() => bulkModerate('rejected')}
                    className="btn-secondary btn-sm"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject All
                  </button>
                  <button
                    onClick={() => setSelectedReports([])}
                    className="btn-ghost btn-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reports List */}
      {error && (
        <div className="alert-danger">
          <h4 className="font-medium mb-2">Error Loading Reports</h4>
          <p>{error}</p>
        </div>
      )}

      {reports.length === 0 && !loading ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <Shield className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-600 mb-2">
              No reports found
            </h3>
            <p className="text-neutral-500">
              {filterStatus === 'pending' ? 
                'All caught up! No pending reports to review.' :
                `No reports match your current filter: ${filterStatus}`
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          {reports.length > 0 && (
            <div className="flex items-center">
              <label className="flex items-center text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={selectedReports.length === reports.length}
                  onChange={selectAllReports}
                  className="mr-2"
                />
                Select all {reports.length} reports
              </label>
            </div>
          )}

          {/* Report Cards */}
          {reports.map((report) => {
            const incidentType = getIncidentDisplay(report.type)
            const severityDisplay = getSeverityDisplay(report.severity)
            const securityFlags = getSecurityFlags(report)
            const isExpanded = expandedReport === report._id
            const isSelected = selectedReports.includes(report._id)
            const isProcessing = moderating[report._id]

            return (
              <div
                key={report._id}
                className={`card transition-all duration-200 ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                } ${securityFlags.length > 0 ? 'border-yellow-300' : ''}`}
              >
                <div className="card-body">
                  {/* Report Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Selection Checkbox */}
                      <div className="flex-shrink-0 pt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleReportSelection(report._id)}
                          className="w-4 h-4"
                        />
                      </div>

                      {/* Report Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg">{incidentType.icon}</span>
                          <span className={`font-medium ${incidentType.color}`}>
                            {incidentType.label}
                          </span>
                          
                          {/* Severity Badge */}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white ${severityDisplay.color}`}>
                            Level {report.severity} - {severityDisplay.label}
                          </span>

                          {/* Status Badge */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            report.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                            report.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </div>

                        {/* Security Flags */}
                        {securityFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {securityFlags.map((flag, index) => (
                              <span
                                key={index}
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${flag.color}`}
                              >
                                <Flag className="w-3 h-3 mr-1" />
                                {flag.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Description Preview */}
                        <p className="text-neutral-700 mb-2 line-clamp-2">
                          {report.description}
                        </p>

                        {/* Location & Time */}
                        <div className="flex items-center space-x-4 text-sm text-neutral-500">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {report.location.address || 'Location provided'}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(report.createdAt || report.timestamp).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <Navigation className="w-4 h-4 mr-1" />
                            {report.location.source || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      {/* Expand/Collapse */}
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : report._id)}
                        className="btn-ghost btn-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Approve/Reject */}
                      {report.status === 'pending' && (
                        <>
                          <button
                            onClick={() => moderateReport(report._id, 'approved')}
                            disabled={isProcessing}
                            className="btn-primary btn-sm"
                          >
                            {isProcessing ? (
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => moderateReport(report._id, 'rejected')}
                            disabled={isProcessing}
                            className="btn-secondary btn-sm"
                          >
                            {isProcessing ? (
                              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 space-y-4">
                      {/* Full Description */}
                      <div>
                        <h4 className="font-medium text-neutral-800 mb-2">Full Description</h4>
                        <p className="text-neutral-700 bg-neutral-50 p-3 rounded">{report.description}</p>
                      </div>

                      {/* Location Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-neutral-800 mb-2">Location Details</h4>
                          <div className="space-y-1 text-sm">
                            <div><strong>Address:</strong> {report.location.address || 'Not provided'}</div>
                            <div><strong>Source:</strong> {report.location.source || 'Unknown'}</div>
                            <div><strong>Within Bangladesh:</strong> {report.location.withinBangladesh ? 'Yes' : 'No'}</div>
                            <div><strong>Coordinates:</strong> Obfuscated for privacy</div>
                            {report.location.originalCoordinates && (
                              <div className="text-red-600">
                                <strong>Original:</strong> {report.location.originalCoordinates[1].toFixed(6)}, {report.location.originalCoordinates[0].toFixed(6)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-neutral-800 mb-2">Report Metadata</h4>
                          <div className="space-y-1 text-sm">
                            <div><strong>Submitted:</strong> {new Date(report.createdAt || report.timestamp).toLocaleString()}</div>
                            <div><strong>Report ID:</strong> {report._id}</div>
                            <div><strong>Severity:</strong> {report.severity}/5</div>
                            <div><strong>Country:</strong> {report.reportingCountry || 'BD'}</div>
                            {report.moderatedAt && (
                              <div><strong>Moderated:</strong> {new Date(report.moderatedAt).toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Security Analysis */}
                      {securityFlags.length > 0 && (
                        <div>
                          <h4 className="font-medium text-neutral-800 mb-2 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2 text-yellow-600" />
                            Security Analysis
                          </h4>
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                            <ul className="space-y-1 text-sm">
                              {report.securityFlags?.crossBorderReport && (
                                <li>• Report originates from outside Bangladesh</li>
                              )}
                              {report.securityFlags?.potentialSpam && (
                                <li>• Report flagged as potential spam (short description, repeated characters)</li>
                              )}
                              {report.securityFlags?.suspiciousLocation && (
                                <li>• Location appears suspicious or invalid</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ModerationQueue