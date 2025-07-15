// === frontend/src/components/Map/FilterSummary.jsx ===
import React, { memo } from 'react'
import { Filter } from 'lucide-react'

/**
 * FilterSummary Component - Extracted from MapPage.jsx
 * Shows active filter summary and clear button
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
                    if (key === 'sortBy') return value !== 'newest'
                    if (key === 'showFlagged') return value
                    return false
                  }).length} applied
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {performanceStats.estimatedClusters > 0 && viewMode === 'clusters' && (
                <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded-full">
                  ≈ {performanceStats.estimatedClusters} clusters expected
                </span>
              )}
              <button
                onClick={onClearFilters}
                className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

FilterSummary.displayName = 'FilterSummary'

export default FilterSummary