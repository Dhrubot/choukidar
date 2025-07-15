// === frontend/src/pages/MapPage/MapSection.jsx (FIXED - Complete Enhancement) ===
import React, { memo, useState, useCallback } from 'react'
import { 
  MapPin, Zap, Map, Target, Flame, Layers, 
  Shield, Navigation, Eye, EyeOff, Settings
} from 'lucide-react'
import MapView from '../../components/Map/MapView'
import MapInsights from './MapInsights'

/**
 * MapSection Component - Enhanced with Phase 3B Safe Zones & Route Intelligence
 * Handles map view, overlays, and insights cards + NEW intelligence features
 * FIXED: Restored missing performance overlay and corrected MapInsights props
 */
const MapSection = memo(({
  // ✅ EXISTING PROPS PRESERVED
  mapState,
  filteredReports,
  loading,
  reports,
  performanceStats,
  isFiltering,
  selectedMarker,
  onMapReady,
  onClusterClick,
  onMarkerClick,
  onViewModeChange,
  filterStats,
  clusterStats,
  hasUserLocation,
  isUserInBangladesh,
  hasActiveFilters,
  
  // 🆕 PHASE 3B: NEW PROPS FOR INTELLIGENCE FEATURES
  userLocation = null,
  onSafeZoneSelect = null,
  onSafeZoneHover = null,
  onRouteSelect = null,
  onRouteHover = null,
  
  // ✅ VIEW MODE CONFIG PRESERVED
  VIEW_MODE_CONFIG = {
    markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
    clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
    heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
    hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
  }
}) => {
  // 🆕 PHASE 3B: INTELLIGENCE FEATURES STATE
  const [showSafeZones, setShowSafeZones] = useState(false)
  const [showRoutePlanner, setShowRoutePlanner] = useState(false)
  const [showIntelligenceSettings, setShowIntelligenceSettings] = useState(false)
  
  // 🆕 PHASE 3B: SAFE ZONE OPTIONS
  const [safeZoneOptions, setSafeZoneOptions] = useState({
    showDynamicZones: true,
    showAdminZones: true,
    showPoliceStations: true,
    minSafetyScore: 6.0,
    radiusMultiplier: 1.0,
    enableMonitoring: hasUserLocation
  })
  
  // 🆕 PHASE 3B: ROUTE PLANNER OPTIONS
  const [routePlannerOptions, setRoutePlannerOptions] = useState({
    transportMode: 'walking',
    prioritizeSafety: true,
    avoidRecentIncidents: true,
    maxDetourRatio: 1.3,
    timeOfDay: 'current',
    enableMonitoring: hasUserLocation
  })

  // 🆕 PHASE 3B: INTELLIGENCE TOGGLE HANDLERS
  const handleToggleSafeZones = useCallback(() => {
    setShowSafeZones(prev => !prev)
    console.log(`🛡️ Safe Zones ${!showSafeZones ? 'enabled' : 'disabled'}`)
  }, [showSafeZones])

  const handleToggleRoutePlanner = useCallback(() => {
    setShowRoutePlanner(prev => !prev)
    console.log(`🗺️ Route Planner ${!showRoutePlanner ? 'enabled' : 'disabled'}`)
  }, [showRoutePlanner])

  const handleToggleIntelligenceSettings = useCallback(() => {
    setShowIntelligenceSettings(prev => !prev)
  }, [])

  // 🆕 PHASE 3B: SAFE ZONE OPTIONS HANDLERS
  const handleSafeZoneOptionChange = useCallback((key, value) => {
    setSafeZoneOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  // 🆕 PHASE 3B: ROUTE PLANNER OPTIONS HANDLERS
  const handleRoutePlannerOptionChange = useCallback((key, value) => {
    setRoutePlannerOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  // 🆕 PHASE 3B: ENHANCED VIEW MODE CONFIG WITH INTELLIGENCE
  const ENHANCED_VIEW_MODE_CONFIG = {
    ...VIEW_MODE_CONFIG,
    // Add intelligence indicators to existing modes
    ...(showSafeZones || showRoutePlanner ? {
      markers: { ...VIEW_MODE_CONFIG.markers, intelligence: true },
      clusters: { ...VIEW_MODE_CONFIG.clusters, intelligence: true },
      heatmap: { ...VIEW_MODE_CONFIG.heatmap, intelligence: true },
      hybrid: { ...VIEW_MODE_CONFIG.hybrid, intelligence: true }
    } : {})
  }

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
                {/* 🆕 INTELLIGENCE LOADING INDICATORS */}
                {(showSafeZones || showRoutePlanner) && (
                  <p className="text-green-600 text-sm mt-1">
                    🧠 Initializing safety intelligence...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-[500px] lg:h-[700px] relative rounded-xl overflow-hidden">
              {/* ✅ ENHANCED MAPVIEW WITH INTELLIGENCE PROPS */}
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
                // 🆕 PHASE 3B: INTELLIGENCE PROPS
                userLocation={userLocation}
                showSafeZones={showSafeZones}
                showRoutePlanner={showRoutePlanner}
                safeZoneOptions={safeZoneOptions}
                routePlannerOptions={routePlannerOptions}
                onSafeZoneSelect={onSafeZoneSelect}
                onSafeZoneHover={onSafeZoneHover}
                onRouteSelect={onRouteSelect}
                onRouteHover={onRouteHover}
              />

              {/* ✅ EXISTING VIEW MODE CONTROLS + ENHANCED */}
              <div className="absolute bottom-4 right-4 z-[1000] lg:bottom-6 lg:right-6">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-2">
                  {/* ✅ EXISTING VIEW MODE CONTROLS (RESTORED ORIGINAL ICON SIZE) */}
                  <div className="flex space-x-1 mb-2">
                    {Object.entries(ENHANCED_VIEW_MODE_CONFIG).map(([mode, config]) => {
                      const Icon = config.icon
                      return (
                        <button
                          key={mode}
                          onClick={() => onViewModeChange(mode)}
                          className={`p-3 rounded-lg transition-all duration-200 ${
                            mapState.viewMode === mode
                              ? `${config.bgColor} text-white shadow-md`
                              : 'hover:bg-neutral-100 text-neutral-600'
                          } ${config.intelligence ? 'ring-2 ring-green-200' : ''}`}
                          title={`Switch to ${mode} view${config.intelligence ? ' (Intelligence Active)' : ''}`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      )
                    })}
                  </div>

                  {/* 🆕 PHASE 3B: INTELLIGENCE CONTROLS */}
                  <div className="flex space-x-1 border-t border-white/30 pt-2">
                    {/* Safe Zones Toggle */}
                    <button
                      onClick={handleToggleSafeZones}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        showSafeZones
                          ? 'bg-green-600 text-white shadow-md'
                          : 'hover:bg-green-50 text-green-600 border border-green-200'
                      }`}
                      title={`${showSafeZones ? 'Hide' : 'Show'} Safe Zones`}
                    >
                      <Shield className="w-4 h-4" />
                    </button>

                    {/* Route Planner Toggle */}
                    <button
                      onClick={handleToggleRoutePlanner}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        showRoutePlanner
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'hover:bg-blue-50 text-blue-600 border border-blue-200'
                      }`}
                      title={`${showRoutePlanner ? 'Hide' : 'Show'} Route Planner`}
                    >
                      <Navigation className="w-4 h-4" />
                    </button>

                    {/* Intelligence Settings */}
                    {(showSafeZones || showRoutePlanner) && (
                      <button
                        onClick={handleToggleIntelligenceSettings}
                        className={`p-2 rounded-lg transition-all duration-200 ${
                          showIntelligenceSettings
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'hover:bg-purple-50 text-purple-600 border border-purple-200'
                        }`}
                        title="Intelligence Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 🔧 FIXED: RESTORED PERFORMANCE & DATASET INFO OVERLAY */}
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
                    {/* 🆕 INTELLIGENCE INDICATORS */}
                    {(showSafeZones || showRoutePlanner) && (
                      <span className="ml-2 text-xs opacity-90 flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        AI Active
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 🆕 PHASE 3B: INTELLIGENCE SETTINGS PANEL */}
              {showIntelligenceSettings && (showSafeZones || showRoutePlanner) && (
                <div className="absolute top-4 left-4 z-[1100] bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 max-w-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-neutral-800 flex items-center">
                      <Zap className="w-4 h-4 mr-2 text-purple-600" />
                      Intelligence Settings
                    </h3>
                    <button
                      onClick={handleToggleIntelligenceSettings}
                      className="p-1 hover:bg-neutral-100 rounded"
                    >
                      <EyeOff className="w-4 h-4 text-neutral-500" />
                    </button>
                  </div>

                  {/* Safe Zones Settings */}
                  {showSafeZones && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        Safe Zones
                      </h4>
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={safeZoneOptions.showDynamicZones}
                            onChange={(e) => handleSafeZoneOptionChange('showDynamicZones', e.target.checked)}
                            className="w-3 h-3 mr-2"
                          />
                          Dynamic Zones
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={safeZoneOptions.showAdminZones}
                            onChange={(e) => handleSafeZoneOptionChange('showAdminZones', e.target.checked)}
                            className="w-3 h-3 mr-2"
                          />
                          Admin Zones
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={safeZoneOptions.showPoliceStations}
                            onChange={(e) => handleSafeZoneOptionChange('showPoliceStations', e.target.checked)}
                            className="w-3 h-3 mr-2"
                          />
                          Police Stations
                        </label>
                        <div>
                          <label className="block text-neutral-600 mb-1">
                            Min Safety Score: {safeZoneOptions.minSafetyScore}
                          </label>
                          <input
                            type="range"
                            min="4"
                            max="10"
                            step="0.5"
                            value={safeZoneOptions.minSafetyScore}
                            onChange={(e) => handleSafeZoneOptionChange('minSafetyScore', parseFloat(e.target.value))}
                            className="w-full h-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Route Planner Settings */}
                  {showRoutePlanner && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                        <Navigation className="w-3 h-3 mr-1" />
                        Route Planner
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="block text-neutral-600 mb-1">Transport Mode</label>
                          <select
                            value={routePlannerOptions.transportMode}
                            onChange={(e) => handleRoutePlannerOptionChange('transportMode', e.target.value)}
                            className="w-full p-1 border rounded text-xs"
                          >
                            <option value="walking">Walking</option>
                            <option value="rickshaw">Rickshaw</option>
                            <option value="bus">Bus</option>
                          </select>
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={routePlannerOptions.prioritizeSafety}
                            onChange={(e) => handleRoutePlannerOptionChange('prioritizeSafety', e.target.checked)}
                            className="w-3 h-3 mr-2"
                          />
                          Prioritize Safety
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={routePlannerOptions.avoidRecentIncidents}
                            onChange={(e) => handleRoutePlannerOptionChange('avoidRecentIncidents', e.target.checked)}
                            className="w-3 h-3 mr-2"
                          />
                          Avoid Recent Incidents
                        </label>
                        <div>
                          <label className="block text-neutral-600 mb-1">
                            Max Detour: {Math.round((routePlannerOptions.maxDetourRatio - 1) * 100)}%
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="2"
                            step="0.1"
                            value={routePlannerOptions.maxDetourRatio}
                            onChange={(e) => handleRoutePlannerOptionChange('maxDetourRatio', parseFloat(e.target.value))}
                            className="w-full h-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🆕 INTELLIGENCE STATUS INDICATOR */}
              {(showSafeZones || showRoutePlanner) && !showIntelligenceSettings && (
                <div className="absolute top-4 left-4 z-[1000] bg-gradient-to-r from-green-500 to-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1"></div>
                      Intelligence Active
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🔧 FIXED: RESTORED ALL ORIGINAL MAPINSIGHTS PROPS */}
        <MapInsights
          filteredReports={filteredReports}
          filterStats={filterStats}
          clusterStats={clusterStats}
          mapState={mapState}
          selectedMarker={selectedMarker}
          hasUserLocation={hasUserLocation}
          isUserInBangladesh={isUserInBangladesh}
          hasActiveFilters={hasActiveFilters}
          performanceStats={performanceStats}
          // 🆕 PHASE 3B: INTELLIGENCE INSIGHTS
          showSafeZones={showSafeZones}
          showRoutePlanner={showRoutePlanner}
          safeZoneOptions={safeZoneOptions}
          routePlannerOptions={routePlannerOptions}
        />
      </div>
    </div>
  )
})

// Add display name for debugging
MapSection.displayName = 'MapSection'

export default MapSection