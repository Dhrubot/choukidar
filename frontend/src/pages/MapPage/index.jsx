// === frontend/src/pages/MapPage/index.jsx (COMPLETE FIXED VERSION) ===
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  Map, Target, Flame, Layers, MapPin
} from 'lucide-react'

// ✅ PHASE 1: Header Components (PRESERVED)
import MapPageHeader from './MapPageHeader'
import FilterSummary from './FilterSummary'
import PerformanceWarnings from './PerformanceWarnings'

// ✅ PHASE 2: Map Components (PRESERVED)
import MapSection from './MapSection'
import MapInsights from './MapInsights'

// ✅ PHASE 3: Sidebar Components (PRESERVED)
import MapSidebar from './MapSidebar'
import LiveStats from './LiveStats'
import MapLegendWrapper from './MapLegendWrapper'

// ✅ EXISTING HOOKS PRESERVED
import { useReports } from '../../hooks/useReports'
import { useAdvancedFilters } from '../../hooks/useAdvancedFilters'
import { useMapState } from '../../hooks/useMapState'

// ✅ PHASE 4: Custom Hooks (PRESERVED)
import { useMapPageUI } from '../../hooks/useMapPageUI'
import { useMapPerformance } from '../../hooks/useMapPerformance'
import { useQuickFilters } from '../../hooks/useQuickFilters'
import { useMapInteractions } from '../../hooks/useMapInteractions'
import { useMapViewMode } from '../../hooks/useMapViewMode'

// ✅ EXISTING VIEW MODE CONFIG PRESERVED
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  // ✅ EXISTING CORE DATA & STATE PRESERVED
  const { reports, loading, error, refetch } = useReports()

  const {
    mapState,
    mapReady,
    userLocation,
    selectedMarker,
    isUserInBangladesh,
    updateMapState,
    setMapReady,
    setUserLocation,
    setSelectedMarker,
    centerOnUser,
    hasUserLocation
  } = useMapState({
    defaultCenter: [23.8103, 90.4125], // Dhaka coordinates
    defaultZoom: 11,
    defaultViewMode: 'clusters',
    persistState: true,
    trackUserLocation: true
  })

  // ✅ EXISTING FILTERS PRESERVED
  const {
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
    isFiltering
  } = useAdvancedFilters(reports, {
    enableUrlPersistence: true,
    debounceMs: 300
  })

  // ✅ EXISTING PHASE 4 CUSTOM HOOKS PRESERVED
  const {
    showAdvancedFilters,
    showFilterPresets,
    isMobile,
    setShowAdvancedFilters,
    setShowFilterPresets
  } = useMapPageUI()

  const {
    performanceStats,
    recommendations
  } = useMapPerformance(filteredReports, reports, mapState.viewMode)

  const {
    handleQuickSearch,
    handleQuickTypeFilter
  } = useQuickFilters(updateFilter, filters)

  const {
    clusterStats,
    handleClusterClick,
    handleMarkerClick
  } = useMapInteractions(setSelectedMarker)

  const {
    handleViewModeChange,
    handleHeatmapOptionsChange,
    handleClusteringOptionsChange,
    shouldUseClustering,
    viewModeUtils
  } = useMapViewMode(mapState, updateMapState, filteredReports.length, performanceStats)

  // 🆕 PHASE 3B: INTELLIGENCE FEATURES STATE
  const [intelligenceFeatures, setIntelligenceFeatures] = useState({
    safeZones: {
      enabled: false,
      selectedZone: null,
      hoveredZone: null,
      lastUpdate: null
    },
    routePlanner: {
      enabled: false,
      selectedRoute: null,
      hoveredRoute: null,
      activeNavigation: false,
      lastCalculation: null
    }
  })

  // ✅ EXISTING SIMPLIFIED HANDLERS PRESERVED
  const handleMapReady = useCallback((map) => {
    setMapReady(true)
    console.log('🗺️ Map instance ready for enhanced filtering features + intelligence')
  }, [setMapReady])

  const handleCenterOnUser = useCallback(() => {
    if (hasUserLocation) {
      centerOnUser()
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy
            })
            centerOnUser()
          },
          (error) => console.warn('Location access denied:', error)
        )
      }
    }
  }, [hasUserLocation, centerOnUser, setUserLocation])

  // 🆕 PHASE 3B: SAFE ZONE EVENT HANDLERS
  const handleSafeZoneSelect = useCallback((safeZone) => {
    setIntelligenceFeatures(prev => ({
      ...prev,
      safeZones: {
        ...prev.safeZones,
        selectedZone: safeZone,
        lastUpdate: new Date()
      }
    }))
    
    console.log('🛡️ Safe zone selected:', safeZone.id, safeZone.safetyScore)
    
    // Optional: Center map on selected safe zone
    if (safeZone.center) {
      updateMapState({
        center: [safeZone.center.lat, safeZone.center.lng],
        zoom: Math.max(mapState.zoom, 15)
      })
    }
  }, [mapState.zoom, updateMapState])

  const handleSafeZoneHover = useCallback((safeZone, isHovering) => {
    setIntelligenceFeatures(prev => ({
      ...prev,
      safeZones: {
        ...prev.safeZones,
        hoveredZone: isHovering ? safeZone : null
      }
    }))
  }, [])

  // 🆕 PHASE 3B: ROUTE PLANNER EVENT HANDLERS
  const handleRouteSelect = useCallback((route) => {
    setIntelligenceFeatures(prev => ({
      ...prev,
      routePlanner: {
        ...prev.routePlanner,
        selectedRoute: route,
        lastCalculation: new Date()
      }
    }))
    
    console.log('🗺️ Route selected:', route.id, `Safety: ${route.safetyScore}/10`)
    
    // Optional: Fit map bounds to show entire route
    if (route.bounds) {
      // Convert route bounds to Leaflet bounds format
      const leafletBounds = [
        [route.bounds.south, route.bounds.west],
        [route.bounds.north, route.bounds.east]
      ]
      // Note: This would need to be passed to MapView to actually fit bounds
      console.log('📏 Route bounds:', leafletBounds)
    }
  }, [])

  const handleRouteHover = useCallback((route, isHovering) => {
    setIntelligenceFeatures(prev => ({
      ...prev,
      routePlanner: {
        ...prev.routePlanner,
        hoveredRoute: isHovering ? route : null
      }
    }))
  }, [])

  // 🆕 PHASE 3B: INTELLIGENCE TOGGLE HANDLERS
  const handleToggleIntelligenceFeature = useCallback((featureType, enabled) => {
    setIntelligenceFeatures(prev => ({
      ...prev,
      [featureType]: {
        ...prev[featureType],
        enabled,
        ...(enabled ? {} : { 
          selectedZone: null, 
          hoveredZone: null, 
          selectedRoute: null, 
          hoveredRoute: null 
        })
      }
    }))
    
    console.log(`🧠 Intelligence feature ${featureType} ${enabled ? 'enabled' : 'disabled'}`)
  }, [])

  // 🆕 DERIVED STATE: Intelligence status
  const intelligenceStatus = useMemo(() => ({
    hasActiveFeatures: intelligenceFeatures.safeZones.enabled || intelligenceFeatures.routePlanner.enabled,
    safeZoneActive: intelligenceFeatures.safeZones.enabled,
    routePlannerActive: intelligenceFeatures.routePlanner.enabled,
    selectedSafeZone: intelligenceFeatures.safeZones.selectedZone,
    selectedRoute: intelligenceFeatures.routePlanner.selectedRoute,
    requiresUserLocation: intelligenceFeatures.safeZones.enabled || intelligenceFeatures.routePlanner.enabled,
    isFullyOperational: hasUserLocation && isUserInBangladesh
  }), [intelligenceFeatures, hasUserLocation, isUserInBangladesh])

  // ✅ EXISTING ERROR HANDLING PRESERVED
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 p-4">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-neutral-800 mb-2">
              Connection Error
            </h2>
            <p className="text-neutral-600 mb-4">
              Unable to load crime data. Please check your connection.
            </p>
            <button 
              onClick={refetch}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      
      {/* 🔧 FIXED: RESTORED COMPLETE HEADER SECTION (OUTSIDE CONTAINER) */}
      <MapPageHeader
        filterStats={filterStats}
        performanceStats={performanceStats}
        hasActiveFilters={hasActiveFilters}
        filters={filters}
        onQuickSearch={handleQuickSearch}
        onQuickTypeFilter={handleQuickTypeFilter}
        viewMode={mapState.viewMode}
        onViewModeChange={handleViewModeChange}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        showFilterPresets={showFilterPresets}
        setShowFilterPresets={setShowFilterPresets}
        reports={reports}
        filteredReports={filteredReports}
        loading={loading}
        onRefetch={refetch}
        hasUserLocation={hasUserLocation}
        isUserInBangladesh={isUserInBangladesh}
        onCenterOnUser={handleCenterOnUser}
        isMobile={isMobile}
        // 🆕 PHASE 3B: INTELLIGENCE PROPS FOR HEADER
        intelligenceStatus={intelligenceStatus}
        onToggleIntelligenceFeature={handleToggleIntelligenceFeature}
      />

      {/* 🔧 FIXED: RESTORED FILTER SUMMARY WITH COMPLETE PROPS */}
      <FilterSummary
        filteredReports={filteredReports}
        totalReports={reports.length}
        filterStats={filterStats}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        performanceStats={performanceStats}
        viewMode={mapState.viewMode}
        filters={filters}
        onUpdateFilter={updateFilter}
        // 🆕 PHASE 3B: INTELLIGENCE STATUS IN FILTER SUMMARY
        intelligenceStatus={intelligenceStatus}
      />

      {/* 🔧 FIXED: RESTORED PERFORMANCE WARNINGS WITH COMPLETE PROPS */}
      <PerformanceWarnings
        performanceStats={performanceStats}
        viewMode={mapState.viewMode}
        reportCount={filteredReports.length}
        onViewModeChange={handleViewModeChange}
        recommendations={recommendations}
        currentViewMode={mapState.viewMode}
        // 🆕 PHASE 3B: INTELLIGENCE CONSIDERATIONS IN PERFORMANCE
        intelligenceActive={intelligenceStatus.hasActiveFeatures}
      />

      {/* 🔧 FIXED: RESTORED ORIGINAL CONTAINER STRUCTURE */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ✅ ENHANCED MAP SECTION WITH INTELLIGENCE */}
          <MapSection
            mapState={mapState}
            filteredReports={filteredReports}
            loading={loading}
            reports={reports}
            performanceStats={performanceStats}
            isFiltering={isFiltering}
            selectedMarker={selectedMarker}
            onMapReady={handleMapReady}
            onClusterClick={handleClusterClick}
            onMarkerClick={handleMarkerClick}
            onViewModeChange={handleViewModeChange}
            filterStats={filterStats}
            clusterStats={clusterStats}
            hasUserLocation={hasUserLocation}
            isUserInBangladesh={isUserInBangladesh}
            hasActiveFilters={hasActiveFilters}
            VIEW_MODE_CONFIG={VIEW_MODE_CONFIG}
            // 🆕 PHASE 3B: INTELLIGENCE PROPS
            userLocation={userLocation}
            onSafeZoneSelect={handleSafeZoneSelect}
            onSafeZoneHover={handleSafeZoneHover}
            onRouteSelect={handleRouteSelect}
            onRouteHover={handleRouteHover}
          />

          {/* 🔧 FIXED: RESTORED SIDEBAR WITH COMPLETE STRUCTURE */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="space-y-6">
              
              {/* ✅ LIVE STATS WITH INTELLIGENCE */}
              <LiveStats
                reports={reports}
                filteredReports={filteredReports}
                loading={loading}
                hasActiveFilters={hasActiveFilters}
                performanceStats={performanceStats}
                filterStats={filterStats}
                mapState={mapState}
                clusterStats={clusterStats}
                selectedMarker={selectedMarker}
                hasUserLocation={hasUserLocation}
                isUserInBangladesh={isUserInBangladesh}
                VIEW_MODE_CONFIG={VIEW_MODE_CONFIG}
                // 🆕 PHASE 3B: INTELLIGENCE STATS
                intelligenceFeatures={intelligenceFeatures}
                intelligenceStatus={intelligenceStatus}
              />

              {/* ✅ MAP LEGEND WITH INTELLIGENCE */}
              <MapLegendWrapper
                viewMode={mapState.viewMode}
                reportCount={filteredReports.length}
                showTypeBreakdown={true}
                showSeverityScale={true}
                filterStats={filterStats}
                // 🆕 PHASE 3B: INTELLIGENCE LEGEND
                showIntelligenceLegend={intelligenceStatus.hasActiveFeatures}
                safeZoneActive={intelligenceStatus.safeZoneActive}
                routePlannerActive={intelligenceStatus.routePlannerActive}
              />

              {/* ✅ SIDEBAR CONTENT WITH INTELLIGENCE */}
              <MapSidebar
                showAdvancedFilters={showAdvancedFilters}
                showFilterPresets={showFilterPresets}
                isMobile={isMobile}
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
                mapState={mapState}
                onViewModeChange={handleViewModeChange}
                onHeatmapOptionsChange={handleHeatmapOptionsChange}
                onClusteringOptionsChange={handleClusteringOptionsChange}
                hasUserLocation={hasUserLocation}
                onCenterOnUser={handleCenterOnUser}
                userLocation={userLocation}
                isUserInBangladesh={isUserInBangladesh}
                // 🆕 PHASE 3B: INTELLIGENCE SIDEBAR PROPS
                intelligenceFeatures={intelligenceFeatures}
                intelligenceStatus={intelligenceStatus}
                onToggleIntelligenceFeature={handleToggleIntelligenceFeature}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 🔧 FIXED: RESTORED COMPLETE REPORT CTA SECTION */}
      <div className="bg-white border-t border-neutral-200">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-gradient-to-br from-bangladesh-red to-bangladesh-red-dark text-white rounded-2xl p-8 lg:p-12 text-center shadow-lg">
            <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <Target className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">
              Help Build Safer Communities
            </h2>
            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              Your anonymous reports power our advanced filtering and intelligence system. Every report helps create safer Bangladesh through smart data analysis{intelligenceStatus.hasActiveFeatures ? ' and AI-powered insights' : ''}.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="/report"
                className="inline-block bg-white text-bangladesh-red font-semibold px-8 py-4 rounded-lg hover:bg-neutral-100 transition-colors text-lg"
              >
                Report Incident Now
              </a>
              {intelligenceStatus.hasActiveFeatures && (
                <div className="text-white/80 text-sm flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  AI Intelligence Active
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 PHASE 3B: INTELLIGENCE FEATURES FLOATING PANEL */}
      {intelligenceStatus.hasActiveFeatures && (
        <div className="fixed bottom-6 left-6 z-[1001] bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-white/20 p-4 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-neutral-800 flex items-center">
              <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-2 animate-pulse"></div>
              Intelligence Active
            </h3>
            <div className="text-xs text-neutral-500">
              {intelligenceStatus.isFullyOperational ? '🟢 Operational' : '🟡 Limited'}
            </div>
          </div>

          {/* Safe Zones Status */}
          {intelligenceStatus.safeZoneActive && (
            <div className="mb-2 p-2 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800 flex items-center">
                  🛡️ Safe Zones
                </span>
                {intelligenceStatus.selectedSafeZone && (
                  <span className="text-xs text-green-600">
                    Score: {intelligenceStatus.selectedSafeZone.safetyScore}/10
                  </span>
                )}
              </div>
              {!hasUserLocation && (
                <p className="text-xs text-green-700 mt-1">
                  Enable location for personalized zones
                </p>
              )}
            </div>
          )}

          {/* Route Planner Status */}
          {intelligenceStatus.routePlannerActive && (
            <div className="mb-2 p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800 flex items-center">
                  🗺️ Smart Routes
                </span>
                {intelligenceStatus.selectedRoute && (
                  <span className="text-xs text-blue-600">
                    Safety: {intelligenceStatus.selectedRoute.safetyScore}/10
                  </span>
                )}
              </div>
              {!hasUserLocation && (
                <p className="text-xs text-blue-700 mt-1">
                  Enable location for route planning
                </p>
              )}
            </div>
          )}

          {/* Location Status */}
          {!intelligenceStatus.isFullyOperational && (
            <div className="mt-3 pt-3 border-t border-neutral-200">
              {!hasUserLocation && (
                <button
                  onClick={handleCenterOnUser}
                  className="w-full text-xs bg-gradient-to-r from-green-500 to-blue-500 text-white py-2 px-3 rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200"
                >
                  📍 Enable Location for Full Features
                </button>
              )}
              {hasUserLocation && !isUserInBangladesh && (
                <p className="text-xs text-amber-600 text-center">
                  ⚠️ Location outside Bangladesh - Limited features
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🆕 DEVELOPMENT INTELLIGENCE DEBUG PANEL */}
      {process.env.NODE_ENV === 'development' && intelligenceStatus.hasActiveFeatures && (
        <div className="fixed bottom-6 right-6 z-[1001] bg-black/80 text-white text-xs p-3 rounded-lg max-w-xs">
          <div className="font-mono">
            <div className="text-green-400 mb-2">🧠 Intelligence Debug</div>
            <div>Safe Zones: {intelligenceStatus.safeZoneActive ? '✅' : '❌'}</div>
            <div>Route Planner: {intelligenceStatus.routePlannerActive ? '✅' : '❌'}</div>
            <div>User Location: {hasUserLocation ? '✅' : '❌'}</div>
            <div>In Bangladesh: {isUserInBangladesh ? '✅' : '❌'}</div>
            <div>Reports: {filteredReports.length}/{reports.length}</div>
            <div>View Mode: {mapState.viewMode}</div>
            {intelligenceStatus.selectedSafeZone && (
              <div className="text-green-300 mt-1">
                Selected Zone: {intelligenceStatus.selectedSafeZone.id}
              </div>
            )}
            {intelligenceStatus.selectedRoute && (
              <div className="text-blue-300 mt-1">
                Selected Route: {intelligenceStatus.selectedRoute.id}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// ✅ DISPLAY NAME PRESERVED
MapPage.displayName = 'MapPage'

export default MapPage