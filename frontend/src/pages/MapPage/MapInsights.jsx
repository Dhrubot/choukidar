// === frontend/src/components/Map/MapInsights.jsx ===
import React, { memo } from 'react'
import { 
  BarChart3, Shield, Target, Zap, MapPin
} from 'lucide-react'

/**
 * MapInsights Component - Extracted from MapPage.jsx Lines 1000-1200
 * Displays 3 insight cards with filtering stats and intelligence
 */
const MapInsights = memo(({
  // Filter stats
  filterStats,
  
  // Performance stats
  performanceStats,
  
  // Cluster stats
  clusterStats,
  
  // Map state
  mapState,
  
  // Selected marker
  selectedMarker,
  
  // User location
  hasUserLocation,
  isUserInBangladesh,
  
  // Active filters
  hasActiveFilters
}) => {
  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Coverage Analysis Card */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-blue-500 p-3 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-800">Coverage Analysis</h3>
            <p className="text-neutral-600 text-sm">Geographic distribution</p>
          </div>
        </div>
        <div className="text-2xl font-bold text-blue-600">{filterStats.filtered}</div>
        <div className="text-sm text-neutral-600">
          Filtered incidents ({filterStats.filteredPercentage}% of total)
          {mapState.viewMode === 'clusters' && performanceStats.estimatedClusters > 0 && (
            <div className="text-xs text-purple-600 mt-1">
              ≈ {performanceStats.estimatedClusters} intelligent clusters
              {clusterStats.totalClusters > 0 && (
                <span className="ml-1">• {clusterStats.totalClusters} active</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Efficiency Card */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-green-500 p-3 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-800">Filter Efficiency</h3>
            <p className="text-neutral-600 text-sm">Match accuracy</p>
          </div>
        </div>
        <div className="text-2xl font-bold text-green-600">
          {performanceStats.filterEfficiency}%
        </div>
        <div className="text-sm text-neutral-600">
          {hasActiveFilters ? 'Active filtering' : 'No filters applied'}
          {hasUserLocation && (
            <div className="text-xs text-neutral-500 mt-1">
              {isUserInBangladesh ? 'Local data available' : 'Global perspective'}
            </div>
          )}
        </div>
      </div>

      {/* Smart Insights Card */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-purple-500 p-3 rounded-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-800">Smart Insights</h3>
            <p className="text-neutral-600 text-sm">Pattern recognition</p>
          </div>
        </div>
        <div className="text-2xl font-bold text-purple-600">
          {performanceStats.datasetSize === 'large' ? 'Advanced' :
            performanceStats.datasetSize === 'medium' ? 'Standard' : 'Basic'}
        </div>
        <div className="text-sm text-neutral-600">
          {performanceStats.datasetSize === 'large' ? 'Machine learning patterns' :
            performanceStats.datasetSize === 'medium' ? 'Statistical analysis' :
              'Monitoring trends'}
          {selectedMarker && (
            <div className="text-xs text-purple-600 mt-1">
              Report #{selectedMarker.report._id?.slice(-6)} selected
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

MapInsights.displayName = 'MapInsights'

export default MapInsights