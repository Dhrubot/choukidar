// === frontend/src/components/Map/LiveStats.jsx ===
import React, { memo } from 'react'
import { 
  TrendingUp, Zap, Map, Target, Flame, Layers
} from 'lucide-react'

/**
 * LiveStats Component - Extracted from MapPage.jsx Lines 1350-1500
 * Displays live intelligence statistics and performance metrics
 */
const LiveStats = memo(({
  // Data
  filteredReports,
  
  // Performance stats
  performanceStats,
  
  // Map state
  mapState,
  
  // Cluster stats
  clusterStats,
  
  // Selected marker
  selectedMarker,
  
  // Filter stats
  filterStats,
  
  // User location
  hasUserLocation,
  isUserInBangladesh,
  
  // View mode config for icons
  VIEW_MODE_CONFIG = {
    markers: { icon: Map },
    clusters: { icon: Target },
    heatmap: { icon: Flame },
    hybrid: { icon: Layers }
  }
}) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-neutral-200">
      <div className="bg-bangladesh-green p-4 rounded-t-xl">
        <h3 className="font-bold text-white flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Live Intelligence
        </h3>
      </div>
      <div className="p-4 space-y-4">
        
        {/* Reports Analyzed */}
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{filteredReports.length}</div>
          <div className="text-sm text-green-700">Reports Analyzed</div>
          <div className="text-xs text-green-600 mt-1">
            {performanceStats.datasetSize} dataset • {performanceStats.filterEfficiency}% efficiency
          </div>
        </div>

        {/* Active View Mode */}
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-lg font-bold text-purple-600 capitalize flex items-center justify-center">
            {VIEW_MODE_CONFIG[mapState.viewMode]?.icon && (
              React.createElement(VIEW_MODE_CONFIG[mapState.viewMode].icon, { className: "w-4 h-4 mr-2" })
            )}
            {mapState.viewMode}
          </div>
          <div className="text-sm text-purple-700">Active View Mode</div>
          {mapState.viewMode === 'clusters' && (
            <div className="text-xs text-purple-600 mt-1">
              AI-powered grouping
            </div>
          )}
        </div>

        {/* Last Clicked Cluster */}
        {clusterStats.lastClickedCluster && (
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-lg font-bold text-purple-600">
              {clusterStats.lastClickedCluster.count}
            </div>
            <div className="text-sm text-purple-700">Last Clicked Cluster</div>
            <div className="text-xs text-purple-600 mt-1">
              {new Date(clusterStats.lastClickedCluster.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Selected Report */}
        {selectedMarker && (
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              Level {selectedMarker.report.severity}
            </div>
            <div className="text-sm text-blue-700">Selected Report</div>
            <div className="text-xs text-blue-600 mt-1">
              {selectedMarker.report.type} • {new Date(selectedMarker.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Performance Impact */}
        {performanceStats.performanceImpact !== 'low' && (
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-lg font-bold text-amber-600 flex items-center justify-center">
              <Zap className="w-4 h-4 mr-2" />
              {performanceStats.performanceImpact === 'high' ? 'High' : 'Medium'}
            </div>
            <div className="text-sm text-amber-700">Performance Impact</div>
            <div className="text-xs text-amber-600 mt-1">
              Optimizations active
            </div>
          </div>
        )}

        {/* Recent Reports */}
        {filterStats.recentCount > 0 && (
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">{filterStats.recentCount}</div>
            <div className="text-sm text-blue-700">Recent Reports (24h)</div>
            <div className="text-xs text-blue-600 mt-1">
              Fresh intelligence
            </div>
          </div>
        )}

        {/* User Location */}
        {hasUserLocation && (
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {isUserInBangladesh ? '🇧🇩' : '🌍'}
            </div>
            <div className="text-sm text-green-700">Your Location</div>
            <div className="text-xs text-green-600 mt-1">
              {isUserInBangladesh ? 'Bangladesh detected' : 'International view'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

LiveStats.displayName = 'LiveStats'

export default LiveStats