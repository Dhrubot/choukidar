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

// Enhanced view mode configurations with clustering
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  const { reports, loading, error, refetch } = useReports()

  // ✅ VERIFIED: Using useMapState instead of manual state management
  const {
    mapState,
    mapReady,
    userLocation,
    selectedMarker,
    isUserInBangladesh,
    distanceFromCenter,
    hasHeatmap,
    hasClustering,
    hasMarkers,
    updateMapState,
    resetMapState,
    setMapReady,
    setUserLocation,
    setSelectedMarker,
    centerOnUser,
    centerOnCoordinates,
    isLocationValid,
    hasUserLocation
  } = useMapState({
    defaultCenter: [23.8103, 90.4125], // Dhaka coordinates
    defaultZoom: 11,
    defaultViewMode: 'clusters',
    persistState: true,
    trackUserLocation: true
  })

  // ✅ VERIFIED: Advanced filtering system
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

  // ✅ VERIFIED: UI state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showFilterPresets, setShowFilterPresets] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ✅ VERIFIED: Enhanced cluster stats
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    averageClusterSize: 0,
    largestCluster: 0,
    lastClickedCluster: null
  })

  // ✅ VERIFIED: Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ✅ VERIFIED: Enhanced performance stats with clustering intelligence
  const performanceStats = useMemo(() => {
    const count = filteredReports.length

    return {
      datasetSize: count > 1000 ? 'large' : count > 500 ? 'medium' : 'small',
      isLargeDataset: count > 200,
      shouldRecommendClustering: count > 100 && mapState.viewMode === 'markers',
      shouldWarnHybrid: count > 500 && mapState.viewMode === 'hybrid',
      recommendedViewMode: count > 1000 ? 'clusters' :
        count > 500 ? 'clusters' :
          count > 100 ? 'hybrid' : 'markers',
      estimatedClusters: Math.ceil(count / 15),
      performanceImpact: count > 1000 ? 'high' : count > 500 ? 'medium' : 'low',
      filterEfficiency: reports.length > 0 ? ((count / reports.length) * 100).toFixed(1) : 100
    }
  }, [filteredReports.length, mapState.viewMode, reports.length])

  // ✅ VERIFIED: Smart view mode recommendation system
  useEffect(() => {
    const { datasetSize, recommendedViewMode } = performanceStats

    if (datasetSize === 'large' && mapState.viewMode === 'markers') {
      console.log(`💡 Large dataset detected (${filteredReports.length} reports) - clustering recommended`)
    }
  }, [performanceStats, mapState.viewMode, filteredReports.length])

  // ✅ VERIFIED: View mode change handler
  const handleViewModeChange = useCallback((newMode) => {
    updateMapState({ viewMode: newMode })
    console.log(`📊 Map view changed to: ${newMode} for ${filteredReports.length} reports`)
  }, [updateMapState, filteredReports.length])

  // ✅ VERIFIED: Heatmap options handler
  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    updateMapState({ 
      heatmapOptions: {
        ...mapState.heatmapOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.heatmapOptions])

  // ✅ VERIFIED: Clustering options handler
  const handleClusteringOptionsChange = useCallback((newOptions) => {
    updateMapState({
      clusteringOptions: {
        ...mapState.clusteringOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.clusteringOptions])

  // ✅ VERIFIED: Map ready handler
  const handleMapReady = useCallback((map) => {
    setMapReady(true)
    console.log('🗺️ Map instance ready for enhanced filtering features')
  }, [setMapReady])

  // ✅ VERIFIED: Enhanced cluster click handler
  const handleClusterClick = useCallback((clusterData) => {
    const { cluster, markers, count, bounds } = clusterData

    console.log(`🎯 Cluster clicked: ${count} reports in area`)

    setClusterStats(prev => ({
      ...prev,
      totalClusters: prev.totalClusters,
      lastClickedCluster: {
        count,
        bounds,
        timestamp: Date.now(),
        location: bounds ? bounds.getCenter() : null
      }
    }))
  }, [])

  // ✅ VERIFIED: Enhanced marker click handler
  const handleMarkerClick = useCallback((markerData) => {
    const { report, position, marker } = markerData
    
    console.log(`📍 Marker clicked: ${report.type} incident at ${position.lat}, ${position.lng}`)
    
    setSelectedMarker({
      report,
      position,
      marker,
      timestamp: Date.now()
    })
  }, [setSelectedMarker])

  // ✅ VERIFIED: Quick filter handlers
  const handleQuickSearch = useCallback((searchTerm) => {
    updateFilter('searchTerm', searchTerm)
  }, [updateFilter])

  const handleQuickTypeFilter = useCallback((type) => {
    const currentTypes = filters.incidentTypes || []
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type]
    updateFilter('incidentTypes', newTypes)
  }, [filters.incidentTypes, updateFilter])

  // ✅ VERIFIED: Determine clustering approach
  const shouldUseClustering = useMemo(() => {
    if (mapState.viewMode === 'clusters') return true
    if (mapState.viewMode === 'heatmap') return false
    if (mapState.viewMode === 'hybrid') return filteredReports.length > 100
    if (mapState.viewMode === 'markers') return performanceStats.isLargeDataset
    return false
  }, [mapState.viewMode, filteredReports.length, performanceStats.isLargeDataset])

  // ✅ VERIFIED: User location handler
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
          (error) => {
            console.warn('Location access denied:', error.message)
          }
        )
      }
    }
  }, [hasUserLocation, centerOnUser, setUserLocation])

  // ✅ VERIFIED: Error handling
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

      {/* ✅ PHASE 1: EXTRACTED HEADER COMPONENTS */}
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

      {/* ✅ PHASE 2 & 3: MAIN CONTENT WITH EXTRACTED COMPONENTS */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ✅ PHASE 2: EXTRACTED MAP SECTION (FIXED - includes insights) */}
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

          {/* ✅ PHASE 3: EXTRACTED SIDEBAR */}
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

      {/* ✅ VERIFIED: Enhanced Report CTA - PRESERVED */}
      <div className="bg-white border-t border-neutral-200">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-gradient-to-br from-bangladesh-red to-bangladesh-red-dark text-white rounded-2xl p-8 lg:p-12 text-center shadow-lg">
            <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-white" />
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