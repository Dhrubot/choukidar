// === frontend/src/pages/MapPage/FilterSummary.jsx ===
import React, { memo, useMemo } from 'react'
import { Filter, BarChart3, PieChart, TrendingUp } from 'lucide-react'

/**
 * FilterSummary Component - Enhanced with detailed statistics
 * Shows active filter summary, clear button, and comprehensive data breakdowns
 * MERGED: Best features from both versions
 */
const FilterSummary = memo(({
  // Data
  filteredReports,
  totalReports,
  filterStats,
  
  // State
  hasActiveFilters,
  
  // Handlers
  onClearFilters,
  
  // Performance
  performanceStats,
  
  // View mode
  viewMode,
  
  // Filters for analysis
  filters
}) => {
  // Calculate detailed statistics
  const detailedStats = useMemo(() => {
    if (!filteredReports || filteredReports.length === 0) {
      return {
        incidentTypeBreakdown: {},
        severityDistribution: {},
        locationBreakdown: {},
        timeDistribution: {}
      }
    }

    // Incident type breakdown with percentages
    const incidentTypeBreakdown = filteredReports.reduce((acc, report) => {
      const type = report.type || 'Unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Convert to percentages
    Object.keys(incidentTypeBreakdown).forEach(type => {
      incidentTypeBreakdown[type] = {
        count: incidentTypeBreakdown[type],
        percentage: ((incidentTypeBreakdown[type] / filteredReports.length) * 100).toFixed(1)
      }
    })

    // Severity distribution
    const severityDistribution = filteredReports.reduce((acc, report) => {
      const severity = report.severity || 'Unknown'
      acc[severity] = (acc[severity] || 0) + 1
      return acc
    }, {})

    // Convert to percentages
    Object.keys(severityDistribution).forEach(severity => {
      severityDistribution[severity] = {
        count: severityDistribution[severity],
        percentage: ((severityDistribution[severity] / filteredReports.length) * 100).toFixed(1)
      }
    })

    // Location breakdown (district/area)
    const locationBreakdown = filteredReports.reduce((acc, report) => {
      const location = report.location?.district || report.location?.area || 'Unknown'
      acc[location] = (acc[location] || 0) + 1
      return acc
    }, {})

    // Convert to percentages and get top 5
    const topLocations = Object.entries(locationBreakdown)
      .map(([location, count]) => ({
        location,
        count,
        percentage: ((count / filteredReports.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      incidentTypeBreakdown,
      severityDistribution,
      locationBreakdown: topLocations,
      timeDistribution: {} // Can be enhanced later
    }
  }, [filteredReports])

  // Don't render if no active filters
  if (!hasActiveFilters) return null

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-blue-900 font-semibold">
                  Showing {filteredReports.length} of {totalReports} reports ({filterStats.filteredPercentage}% match)
                </span>
                <div className="text-blue-700 text-sm mt-1">
                  Active filters: {Object.entries(filters).filter(([key, value]) => {
                    if (key === 'searchTerm') return value
                    if (Array.isArray(value)) return value.length > 0
                    if (key === 'severityRange') return value && (value[0] > 1 || value[1] < 5)
                    if (key === 'dateRange') return value && value.preset !== 'all'
                    if (key === 'locationFilter') return value && value.withinBangladesh !== null
                    if (key === 'sortBy') return value !== 'newest' // RESTORED from old version
                    if (key === 'showFlagged') return value // RESTORED from old version
                    return false
                  }).length} applied
                </div>
              </div>
            </div>
            
            {/* MERGED: Performance indicator + Clear button */}
            <div className="flex items-center space-x-3">
              {/* RESTORED: Performance indicator from old version */}
              {performanceStats.estimatedClusters > 0 && viewMode === 'clusters' && (
                <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap">
                  ≈ {performanceStats.estimatedClusters} clusters expected
                </span>
              )}
              
              {/* ENHANCED: Better clear button with hybrid styling */}
              <button
                onClick={onClearFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center space-x-2 flex-shrink-0"
              >
                <Filter className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* ENHANCED: Statistics Section (from new version) */}
          {filteredReports.length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Incident Type Breakdown */}
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center mb-2">
                    <PieChart className="w-4 h-4 text-blue-600 mr-2" />
                    <h4 className="font-medium text-blue-900">Incident Types</h4>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(detailedStats.incidentTypeBreakdown)
                      .sort(([,a], [,b]) => b.count - a.count)
                      .slice(0, 3)
                      .map(([type, data]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-blue-700 truncate">{type}</span>
                          <span className="text-blue-900 font-medium">
                            {data.count} ({data.percentage}%)
                          </span>
                        </div>
                      ))}
                    {Object.keys(detailedStats.incidentTypeBreakdown).length > 3 && (
                      <div className="text-xs text-blue-500 pt-1">
                        +{Object.keys(detailedStats.incidentTypeBreakdown).length - 3} more types
                      </div>
                    )}
                  </div>
                </div>

                {/* Severity Distribution */}
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-600 mr-2" />
                    <h4 className="font-medium text-blue-900">Severity Levels</h4>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(detailedStats.severityDistribution)
                      .sort(([a], [b]) => b - a)
                      .map(([severity, data]) => (
                        <div key={severity} className="flex justify-between text-sm">
                          <span className="text-blue-700">Level {severity}</span>
                          <span className="text-blue-900 font-medium">
                            {data.count} ({data.percentage}%)
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Top Locations */}
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 mr-2" />
                    <h4 className="font-medium text-blue-900">Top Areas</h4>
                  </div>
                  <div className="space-y-1">
                    {detailedStats.locationBreakdown.slice(0, 3).map((location) => (
                      <div key={location.location} className="flex justify-between text-sm">
                        <span className="text-blue-700 truncate">{location.location}</span>
                        <span className="text-blue-900 font-medium">
                          {location.count} ({location.percentage}%)
                        </span>
                      </div>
                    ))}
                    {detailedStats.locationBreakdown.length > 3 && (
                      <div className="text-xs text-blue-500 pt-1">
                        +{detailedStats.locationBreakdown.length - 3} more areas
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* ENHANCED: Quick insights summary */}
              {filteredReports.length > 10 && (
                <div className="mt-3 p-3 bg-blue-100 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Quick Insights:</span>
                    {Object.keys(detailedStats.incidentTypeBreakdown).length > 1 && (
                      <span className="ml-1">
                        Most common: {Object.entries(detailedStats.incidentTypeBreakdown)
                          .sort(([,a], [,b]) => b.count - a.count)[0][0]}
                      </span>
                    )}
                    {detailedStats.locationBreakdown.length > 0 && (
                      <span className="ml-2">
                        • Hotspot: {detailedStats.locationBreakdown[0].location}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

FilterSummary.displayName = 'FilterSummary'

export default FilterSummary