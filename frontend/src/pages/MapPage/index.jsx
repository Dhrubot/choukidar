// === frontend/src/pages/MapPage.jsx (FINAL: All Components Extracted) ===
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  Map, Target, Flame, Layers, MapPin
} from 'lucide-react'

// ✅ PHASE 1: Header Components
import MapPageHeader from './MapPageHeader'
import FilterSummary from './FilterSummary'
import PerformanceWarnings from './PerformanceWarnings'

// ✅ PHASE 2: Map Components
import MapSection from './MapSection'
import MapInsights from './MapInsights'

// ✅ PHASE 3: Sidebar Components
import MapSidebar from './MapSidebar'
import LiveStats from './LiveStats'
import MapLegendWrapper from './MapLegendWrapper'

// Hooks
import { useReports } from '../../hooks/useReports'
import { useAdvancedFilters } from '../../hooks/useAdvancedFilters'
import { useMapState } from '../../hooks/useMapState'

// ✅ PHASE 4: Custom Hooks
import { useMapPageUI } from '../../hooks/useMapPageUI'
import { useMapPerformance } from '../../hooks/useMapPerformance'
import { useQuickFilters } from '../../hooks/useQuickFilters'
import { useMapInteractions } from '../../hooks/useMapInteractions'
import { useMapViewMode } from '../../hooks/useMapViewMode'

// Enhanced view mode configurations
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  // ✅ CORE DATA & STATE
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

  // ✅ PHASE 4: CUSTOM HOOKS INTEGRATION
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

  // ✅ SIMPLIFIED: Map ready handler
  const handleMapReady = (map) => {
    setMapReady(true)
    console.log('🗺️ Map instance ready for enhanced filtering features')
  }

  // ✅ SIMPLIFIED: User location handler
  const handleCenterOnUser = () => {
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
          (error) => console.warn('Location access denied:', error.message)
        )
      }
    }
  }

  // ✅ ERROR HANDLING
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="alert-danger">
            <h4 className="font-medium mb-2">Error Loading Map</h4>
            <p>{error}</p>
            <button onClick={refetch} className="btn-primary btn-sm mt-3">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">

      {/* ✅ PHASE 1: HEADER COMPONENTS */}
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
      />

      <FilterSummary
        filteredReports={filteredReports}
        totalReports={reports.length}
        filterStats={filterStats}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        performanceStats={performanceStats}
        viewMode={mapState.viewMode}
        filters={filters}
      />

      <PerformanceWarnings
        performanceStats={performanceStats}
        viewMode={mapState.viewMode}
        reportCount={filteredReports.length}
        onViewModeChange={handleViewModeChange}
      />

      {/* ✅ PHASE 2 & 3: MAIN CONTENT */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ✅ MAP SECTION (includes insights) */}
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
            VIEW_MODE_CONFIG={VIEW_MODE_CONFIG}
            filterStats={filterStats}
            clusterStats={clusterStats}
            hasUserLocation={hasUserLocation}
            isUserInBangladesh={isUserInBangladesh}
            hasActiveFilters={hasActiveFilters}
          />

          {/* ✅ SIDEBAR */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="space-y-6">

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
              />

              <MapLegendWrapper
                filterStats={filterStats}
              />

              <LiveStats
                filteredReports={filteredReports}
                performanceStats={performanceStats}
                mapState={mapState}
                clusterStats={clusterStats}
                selectedMarker={selectedMarker}
                filterStats={filterStats}
                hasUserLocation={hasUserLocation}
                isUserInBangladesh={isUserInBangladesh}
                VIEW_MODE_CONFIG={VIEW_MODE_CONFIG}
              />

            </div>
          </div>
        </div>
      </div>

      {/* ✅ REPORT CTA */}
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
              Your anonymous reports power our advanced filtering and intelligence system. Every report helps create safer Bangladesh through smart data analysis.
            </p>
            <a
              href="/report"
              className="inline-block bg-white text-bangladesh-red font-semibold px-8 py-4 rounded-lg hover:bg-neutral-100 transition-colors text-lg"
            >
              Report Incident Now
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})

MapPage.displayName = 'MapPage'

export default MapPage