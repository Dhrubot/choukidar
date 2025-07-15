// === frontend/src/components/Map/MapSidebar.jsx ===
import React, { memo } from 'react'
import { 
  Target, MapPin
} from 'lucide-react'
import AdvancedFilters from '../../components/Map/AdvancedFilters'
import FilterPresets from '../../components/Map/FilterPresets'
import MapViewControls from '../../components/Map/MapViewControls'

/**
 * MapSidebar Component - Extracted from MapPage.jsx Lines 1200-1400
 * Handles sidebar panels: Advanced Filters, Filter Presets, Map Controls
 */
const MapSidebar = memo(({
  // UI state
  showAdvancedFilters,
  showFilterPresets,
  isMobile,
  
  // Filter data and handlers
  filters,
  filteredReports,
  filterStats,
  filterPresets,
  filterHistory,
  updateFilter,
  updateNestedFilter,
  clearFilters,
  hasActiveFilters,
  applyDatePreset,
  datePresets,
  saveFilterPreset,
  loadFilterPreset,
  deleteFilterPreset,
  isFiltering,
  
  // Map state and handlers
  mapState,
  onViewModeChange,
  onHeatmapOptionsChange,
  onClusteringOptionsChange,
  
  // User location
  hasUserLocation,
  onCenterOnUser,
  userLocation,
  isUserInBangladesh
}) => {
  return (
    <div className="space-y-6">

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <AdvancedFilters
          filters={filters}
          filteredReports={filteredReports}
          filterStats={filterStats}
          filterPresets={filterPresets}
          filterHistory={filterHistory}
          updateFilter={updateFilter}
          updateNestedFilter={updateNestedFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          applyDatePreset={applyDatePreset}
          datePresets={datePresets}
          saveFilterPreset={saveFilterPreset}
          loadFilterPreset={loadFilterPreset}
          deleteFilterPreset={deleteFilterPreset}
          isFiltering={isFiltering}
          isMobile={isMobile}
        />
      )}

      {/* Filter Presets Panel */}
      {showFilterPresets && (
        <FilterPresets
          filterPresets={filterPresets}
          filterHistory={filterHistory}
          loadFilterPreset={loadFilterPreset}
          deleteFilterPreset={deleteFilterPreset}
        />
      )}

      {/* Enhanced Map Controls with Clustering Options */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200">
        <div className="bg-purple-600 p-4 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Intelligent Controls
          </h3>
        </div>
        <div className="p-4">
          <MapViewControls
            viewMode={mapState.viewMode}
            onViewModeChange={onViewModeChange}
            heatmapOptions={mapState.heatmapOptions}
            onHeatmapOptionsChange={onHeatmapOptionsChange}
            reportCount={filteredReports.length}
          />

          {/* Clustering Options */}
          {(mapState.viewMode === 'clusters' || mapState.viewMode === 'hybrid') && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <h4 className="font-medium text-neutral-800 mb-3">Clustering Options</h4>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions.showTypeIndicator}
                    onChange={(e) => onClusteringOptionsChange({
                      showTypeIndicator: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Show incident type badges</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions.showRiskBadge}
                    onChange={(e) => onClusteringOptionsChange({
                      showRiskBadge: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Highlight high-risk clusters</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions.enableAnimations}
                    onChange={(e) => onClusteringOptionsChange({
                      enableAnimations: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Enable animations</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions.enableBengaliNumerals}
                    onChange={(e) => onClusteringOptionsChange({
                      enableBengaliNumerals: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Bengali numerals (বাংলা সংখ্যা)</span>
                </label>
              </div>
            </div>
          )}

          {/* User Location Controls */}
          {hasUserLocation && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <h4 className="font-medium text-neutral-800 mb-3">Location Controls</h4>
              <div className="space-y-3">
                <button
                  onClick={onCenterOnUser}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-bangladesh-green text-white rounded-lg hover:bg-bangladesh-green-dark transition-colors text-sm font-medium"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Center on My Location</span>
                </button>
                
                <div className="text-xs text-neutral-500 space-y-1">
                  <div>📍 Location: {isUserInBangladesh ? 'Bangladesh' : 'International'}</div>
                  {userLocation && (
                    <div>🎯 Accuracy: ±{userLocation.accuracy ? Math.round(userLocation.accuracy) : 'Unknown'}m</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

MapSidebar.displayName = 'MapSidebar'

export default MapSidebar