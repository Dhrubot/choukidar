// === frontend/src/components/Map/MapSection.jsx ===
import React, { memo } from 'react'
import { 
  MapPin, Zap, Map, Target, Flame, Layers
} from 'lucide-react'
import MapView from '../../components/Map/MapView'

/**
 * MapSection Component - Extracted from MapPage.jsx Lines 700-1000
 * Handles map view, overlays, and view mode controls
 */
const MapSection = memo(({
  // Map state
  mapState,
  
  // Data
  filteredReports,
  
  // Loading state
  loading,
  reports,
  
  // Performance
  performanceStats,
  isFiltering,
  
  // Selected marker
  selectedMarker,
  
  // Map event handlers
  onMapReady,
  onClusterClick,
  onMarkerClick,
  
  // View mode handling
  onViewModeChange,
  
  // View mode configuration
  VIEW_MODE_CONFIG = {
    markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
    clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
    heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
    hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
  }
}) => {
  return (
    <div className="lg:col-span-8 xl:col-span-9">
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-200">
        <div className="p-4 lg:p-6">
          {loading ? (
            <div className="h-[500px] lg:h-[700px] flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl">
              <div className="text-center">
                <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
                <p className="text-neutral-600 text-lg">Loading intelligent map...</p>
                <p className="text-neutral-500 text-sm mt-2">Preparing clustering for {reports.length} reports</p>
              </div>
            </div>
          ) : (
            <div className="h-[500px] lg:h-[700px] relative rounded-xl overflow-hidden">
              <MapView
                reports={filteredReports}
                center={mapState.center}
                zoom={mapState.zoom}
                viewMode={mapState.viewMode}
                heatmapOptions={mapState.heatmapOptions}
                clusteringOptions={mapState.clusteringOptions}
                onMapReady={onMapReady}
                onClusterClick={onClusterClick}
                onMarkerClick={onMarkerClick}
                className="w-full h-full"
              />

              {/* Enhanced Overlay Controls */}
              <div className="absolute bottom-4 right-4 z-[1000] lg:bottom-6 lg:right-6">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-2">
                  <div className="flex space-x-1">
                    {Object.entries(VIEW_MODE_CONFIG).map(([mode, config]) => {
                      const Icon = config.icon
                      return (
                        <button
                          key={mode}
                          onClick={() => onViewModeChange(mode)}
                          className={`p-3 rounded-lg transition-all duration-200 ${mapState.viewMode === mode
                            ? `${config.bgColor} text-white shadow-md`
                            : 'text-neutral-600 hover:bg-neutral-100'
                            }`}
                          title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Performance & Dataset Info */}
              <div className="absolute bottom-4 left-4 z-[1000] lg:bottom-6 lg:left-6">
                <div className="bg-bangladesh-green text-white px-4 py-2 rounded-lg shadow-lg">
                  <div className="text-sm font-medium flex items-center">
                    {performanceStats.datasetSize === 'large' && <Zap className="w-4 h-4 mr-1" />}
                    {filteredReports.length} reports
                    {mapState.viewMode === 'clusters' && (
                      <span className="ml-2 text-xs opacity-90">
                        • Smart clustering active
                      </span>
                    )}
                    {isFiltering && (
                      <span className="ml-2 text-xs opacity-90 flex items-center">
                        <div className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full mr-1"></div>
                        Filtering...
                      </span>
                    )}
                    {selectedMarker && (
                      <span className="ml-2 text-xs opacity-90 flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        Selected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

MapSection.displayName = 'MapSection'

export default MapSection