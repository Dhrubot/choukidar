// === frontend/src/pages/MapPage/index.jsx ===
/**
 * MapPage Main Orchestrator - SafeStreets Bangladesh
 * Modular structure with integrated Safe Zone Intelligence & Route Safety
 * Maintains all existing functionality while adding new features
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { 
  Filter, Search, MapPin, RefreshCw, Flame, Map, Layers, TrendingUp,
  Users, Shield, Info, BarChart3, Zap, Target, Settings, X, ChevronDown,
  Navigation, Route, AlertTriangle, CheckCircle
} from 'lucide-react'

// Components
import MapContainer from './MapContainer'
import MapSidebar from './MapSidebar'
import MapToolbar from './MapToolbar'

// Hooks
import { useReports } from '../../hooks/useReports'
import { useAdvancedFilters } from '../../hooks/useAdvancedFilters'
import { useMapState } from '../../hooks/useMapState'
import { useSafeZones } from '../../hooks/useSafeZones'
import { useRouting } from '../../hooks/useRouting'

// Services
import { getQuotaStatus, isQuotaLow } from '../../services/requestManager'

// Enhanced view mode configurations with clustering
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  // Core data hooks
  const { reports, loading, error, refetch } = useReports()

  // Advanced filtering system
  const {
    filters,
    filteredReports,
    filterStats,
    filterPresets,
    updateFilter,
    updateNestedFilter,
    clearFilters,
    hasActiveFilters,
    applyDatePreset,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    isFiltering
  } = useAdvancedFilters(reports, {
    enableUrlPersistence: true,
    debounceMs: 300
  })

  // Map state management
  const {
    mapState,
    updateMapState,
    resetMapState,
    mapReady,
    setMapReady,
    userLocation,
    setUserLocation,
    selectedMarker,
    setSelectedMarker
  } = useMapState({
    defaultCenter: [23.8103, 90.4125], // Dhaka
    defaultZoom: 11,
    defaultViewMode: 'clusters'
  })

  // Safe Zones integration
  const {
    safeZones,
    loading: safeZonesLoading,
    error: safeZonesError,
    statistics: safeZoneStats,
    categorizedZones,
    refresh: refreshSafeZones,
    isPointInSafeZone,
    getNearbyZones
  } = useSafeZones(filteredReports, {
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    includeAdminZones: true,
    includeDynamicZones: true,
    minSafetyScore: 6.0
  })

  // Route planning integration
  const {
    routes,
    loading: routeLoading,
    error: routeError,
    routeStatistics,
    recommendations,
    quotaWarnings,
    calculateRoute,
    clearRoute,
    isAvailable: routingAvailable,
    hasRoutes
  } = useRouting({
    enabled: true,
    transportMode: 'walking',
    maxAlternatives: 2
  })

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activePanel, setActivePanel] = useState('filters') // filters, safezones, routes, legend
  const [showStats, setShowStats] = useState(true)
  const [quotaStatus, setQuotaStatus] = useState(null)

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState({
    renderTime: 0,
    markerCount: 0,
    filterTime: 0,
    lastUpdate: null
  })

  // Check API quota status on mount
  useEffect(() => {
    const checkQuota = async () => {
      try {
        const status = await getQuotaStatus()
        setQuotaStatus(status)
      } catch (error) {
        console.warn('Failed to check quota status:', error)
      }
    }

    checkQuota()
    const interval = setInterval(checkQuota, 5 * 60 * 1000) // Check every 5 minutes
    return () => clearInterval(interval)
  }, [])

  // Handle view mode changes
  const handleViewModeChange = useCallback((newMode) => {
    updateMapState({ viewMode: newMode })
    
    // Track performance for hybrid mode
    if (newMode === 'hybrid' && filteredReports.length > 500) {
      console.warn('⚠️ Hybrid mode with large dataset - monitoring performance')
    }
  }, [updateMapState, filteredReports.length])

  // Handle heatmap options changes
  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    updateMapState({ 
      heatmapOptions: { 
        ...mapState.heatmapOptions, 
        ...newOptions 
      } 
    })
  }, [updateMapState, mapState.heatmapOptions])

  // Handle clustering options changes
  const handleClusteringOptionsChange = useCallback((newOptions) => {
    updateMapState({ 
      clusteringOptions: { 
        ...mapState.clusteringOptions, 
        ...newOptions 
      } 
    })
  }, [updateMapState, mapState.clusteringOptions])

  // Handle map events
  const handleMapReady = useCallback(() => {
    setMapReady(true)
    console.log('🗺️ Map initialized successfully')
  }, [setMapReady])

  const handleClusterClick = useCallback((cluster) => {
    console.log('🎯 Cluster clicked:', cluster)
    // Handle cluster interaction
  }, [])

  const handleMarkerClick = useCallback((marker) => {
    setSelectedMarker(marker)
    setSidebarOpen(true)
    setActivePanel('details')
    console.log('📍 Marker clicked:', marker)
  }, [setSelectedMarker])

  // Handle sidebar panel changes
  const handlePanelChange = useCallback((panel) => {
    setActivePanel(panel)
    if (!sidebarOpen) {
      setSidebarOpen(true)
    }
  }, [sidebarOpen])

  // Handle route selection
  const handleRouteSelect = useCallback((route) => {
    console.log('🛣️ Route selected:', route)
    // Route will be displayed on map via RouteDisplay component
  }, [])

  // Handle safe zone selection
  const handleSafeZoneSelect = useCallback((zone) => {
    console.log('🛡️ Safe zone selected:', zone)
    // Center map on safe zone
    updateMapState({
      center: zone.coordinates,
      zoom: Math.max(mapState.zoom, 14)
    })
  }, [updateMapState, mapState.zoom])

  // Refresh all data
  const handleRefreshAll = useCallback(async () => {
    try {
      await Promise.all([
        refetch(),
        refreshSafeZones()
      ])
      console.log('🔄 All data refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh data:', error)
    }
  }, [refetch, refreshSafeZones])

  // Memoized sidebar props
  const sidebarProps = useMemo(() => ({
    isOpen: sidebarOpen,
    onClose: () => setSidebarOpen(false),
    activePanel,
    onPanelChange: handlePanelChange,
    
    // Filter props
    filters,
    filteredReports,
    filterStats,
    filterPresets,
    updateFilter,
    updateNestedFilter,
    clearFilters,
    hasActiveFilters,
    applyDatePreset,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    isFiltering,
    
    // Safe zone props
    safeZones,
    safeZonesLoading,
    safeZoneStats,
    categorizedZones,
    onSafeZoneSelect: handleSafeZoneSelect,
    userLocation,
    
    // Route props
    routes,
    routeLoading,
    routeStatistics,
    recommendations,
    quotaWarnings,
    routingAvailable,
    hasRoutes,
    onRouteSelect: handleRouteSelect,
    calculateRoute,
    clearRoute,
    
    // Selected marker
    selectedMarker,
    
    // Performance metrics
    performanceMetrics
  }), [
    sidebarOpen, activePanel, handlePanelChange, filters, filteredReports, filterStats,
    filterPresets, updateFilter, updateNestedFilter, clearFilters, hasActiveFilters,
    applyDatePreset, saveFilterPreset, loadFilterPreset, deleteFilterPreset, isFiltering,
    safeZones, safeZonesLoading, safeZoneStats, categorizedZones, handleSafeZoneSelect,
    userLocation, routes, routeLoading, routeStatistics, recommendations, quotaWarnings,
    routingAvailable, hasRoutes, handleRouteSelect, calculateRoute, clearRoute,
    selectedMarker, performanceMetrics
  ])

  // Memoized map container props
  const mapContainerProps = useMemo(() => ({
    reports: filteredReports,
    safeZones,
    routes,
    mapState,
    onMapReady: handleMapReady,
    onClusterClick: handleClusterClick,
    onMarkerClick: handleMarkerClick,
    onRouteSelect: handleRouteSelect,
    onSafeZoneSelect: handleSafeZoneSelect,
    userLocation,
    setUserLocation,
    performanceMetrics,
    setPerformanceMetrics
  }), [
    filteredReports, safeZones, routes, mapState, handleMapReady,
    handleClusterClick, handleMarkerClick, handleRouteSelect,
    handleSafeZoneSelect, userLocation, setUserLocation,
    performanceMetrics, setPerformanceMetrics
  ])

  // Loading state
  if (loading && reports.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner w-16 h-16 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Loading SafeStreets Map</h2>
          <p className="text-neutral-600">Initializing intelligent map systems...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">Map Loading Error</h2>
          <p className="text-neutral-600 mb-4">
            Failed to load map data. Please check your connection and try again.
          </p>
          <button
            onClick={handleRefreshAll}
            className="btn-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <MapToolbar
        viewMode={mapState.viewMode}
        onViewModeChange={handleViewModeChange}
        heatmapOptions={mapState.heatmapOptions}
        onHeatmapOptionsChange={handleHeatmapOptionsChange}
        clusteringOptions={mapState.clusteringOptions}
        onClusteringOptionsChange={handleClusteringOptionsChange}
        reportCount={filteredReports.length}
        hasActiveFilters={hasActiveFilters}
        onOpenFilters={() => handlePanelChange('filters')}
        onOpenSafeZones={() => handlePanelChange('safezones')}
        onOpenRoutes={() => handlePanelChange('routes')}
        onRefresh={handleRefreshAll}
        quotaStatus={quotaStatus}
        safeZoneCount={safeZones.length}
        hasRoutes={hasRoutes}
        routingAvailable={routingAvailable}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex relative">
        {/* Map Container */}
        <div className="flex-1 relative">
          <MapContainer {...mapContainerProps} />
        </div>

        {/* Sidebar */}
        <MapSidebar {...sidebarProps} />
      </div>

      {/* Mobile bottom panel indicator */}
      {!sidebarOpen && (
        <div className="lg:hidden fixed bottom-4 right-4 z-[1000]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="bg-bangladesh-green text-white p-3 rounded-full shadow-lg hover:bg-safe-primary transition-colors"
          >
            <Filter className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Quota warning notification */}
      {quotaStatus && isQuotaLow(quotaStatus) && (
        <div className="fixed top-20 right-4 z-[1001] lg:top-24 lg:right-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  API Quota Low
                </p>
                <p className="text-xs text-yellow-700">
                  Route planning may be limited today
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// Add display name for debugging
MapPage.displayName = 'MapPage'

export default MapPage