// === frontend/src/pages/MapPage.jsx (PHASE 1: Header Components Extracted) ===
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  Filter, Search, MapPin, RefreshCw, Flame, Map, Layers, TrendingUp,
  Users, Shield, Info, BarChart3, Zap, Target, Settings, X, ChevronDown
} from 'lucide-react'
import MapView from '../../components/Map/MapView'
import MapLegend from '../../components/Map/MapLegend'
import MapViewControls from '../../components/Map/MapViewControls'
import AdvancedFilters from '../../components/Map/AdvancedFilters'
import FilterPresets from '../../components/Map/FilterPresets'
import MapPageHeader from './MapPageHeader'
import FilterSummary from './FilterSummary'
import PerformanceWarnings from './PerformanceWarnings'
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

  // Using useMapState instead of manual state management
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

  // Advanced filtering system
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

  // UI state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showFilterPresets, setShowFilterPresets] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Enhanced cluster stats
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    averageClusterSize: 0,
    largestCluster: 0,
    lastClickedCluster: null
  })

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Enhanced performance stats with clustering intelligence
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

  // Smart view mode recommendation system
  useEffect(() => {
    const { datasetSize, recommendedViewMode } = performanceStats

    if (datasetSize === 'large' && mapState.viewMode === 'markers') {
      console.log(`💡 Large dataset detected (${filteredReports.length} reports) - clustering recommended`)
    }
  }, [performanceStats, mapState.viewMode, filteredReports.length])

  // View mode change handler
  const handleViewModeChange = useCallback((newMode) => {
    updateMapState({ viewMode: newMode })
    console.log(`📊 Map view changed to: ${newMode} for ${filteredReports.length} reports`)
  }, [updateMapState, filteredReports.length])

  // Heatmap options handler
  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    updateMapState({ 
      heatmapOptions: {
        ...mapState.heatmapOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.heatmapOptions])

  // Clustering options handler
  const handleClusteringOptionsChange = useCallback((newOptions) => {
    updateMapState({
      clusteringOptions: {
        ...mapState.clusteringOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.clusteringOptions])

  // Map ready handler
  const handleMapReady = useCallback((map) => {
    setMapReady(true)
    console.log('🗺️ Map instance ready for enhanced filtering features')
  }, [setMapReady])

  // Enhanced cluster click handler
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

  // Enhanced marker click handler
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

  // Quick filter handlers
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

  // Determine clustering approach
  const shouldUseClustering = useMemo(() => {
    if (mapState.viewMode === 'clusters') return true
    if (mapState.viewMode === 'heatmap') return false
    if (mapState.viewMode === 'hybrid') return filteredReports.length > 100
    if (mapState.viewMode === 'markers') return performanceStats.isLargeDataset
    return false
  }, [mapState.viewMode, filteredReports.length, performanceStats.isLargeDataset])

  // User location handler
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

  // Error handling
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

      {/* MAIN CONTENT WITH ADVANCED FILTERING */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Enhanced Map Section */}
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
                      onMapReady={handleMapReady}
                      onClusterClick={handleClusterClick}
                      onMarkerClick={handleMarkerClick}
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
                                onClick={() => handleViewModeChange(mode)}
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

            {/* Enhanced Insights with Filtering Stats */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  {hasActiveFilters() ? 'Active filtering' : 'No filters applied'}
                  {hasUserLocation && (
                    <div className="text-xs text-neutral-500 mt-1">
                      {isUserInBangladesh ? 'Local data available' : 'Global perspective'}
                    </div>
                  )}
                </div>
              </div>

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
          </div>

          {/* Enhanced Sidebar with Advanced Filtering */}
          <div className="lg:col-span-4 xl:col-span-3">
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
                    onViewModeChange={handleViewModeChange}
                    heatmapOptions={mapState.heatmapOptions}
                    onHeatmapOptionsChange={handleHeatmapOptionsChange}
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
                            onChange={(e) => handleClusteringOptionsChange({
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
                            onChange={(e) => handleClusteringOptionsChange({
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
                            onChange={(e) => handleClusteringOptionsChange({
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
                            onChange={(e) => handleClusteringOptionsChange({
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
                          onClick={handleCenterOnUser}
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

              {/* Map Legend */}
              <MapLegend reportCounts={{
                total: filterStats.total,
                approved: filterStats.filtered,
                pending: 0
              }} />

              {/* Enhanced Live Stats with Filter Performance */}
              <div className="bg-white rounded-xl shadow-md border border-neutral-200">
                <div className="bg-bangladesh-green p-4 rounded-t-xl">
                  <h3 className="font-bold text-white flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Live Intelligence
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{filteredReports.length}</div>
                    <div className="text-sm text-green-700">Reports Analyzed</div>
                    <div className="text-xs text-green-600 mt-1">
                      {performanceStats.datasetSize} dataset • {performanceStats.filterEfficiency}% efficiency
                    </div>
                  </div>

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

                  {filterStats.recentCount > 0 && (
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{filterStats.recentCount}</div>
                      <div className="text-sm text-blue-700">Recent Reports (24h)</div>
                      <div className="text-xs text-blue-600 mt-1">
                        Fresh intelligence
                      </div>
                    </div>
                  )}

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
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Report CTA */}
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