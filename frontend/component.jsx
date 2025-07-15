// === frontend/src/pages/MapPage.jsx (ENHANCED with Advanced Filtering System) - PART 1 ===
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
  Filter, Search, MapPin, RefreshCw, Flame, Map, Layers, TrendingUp,
  Users, Shield, Info, BarChart3, Zap, Target, Settings, X, ChevronDown
} from 'lucide-react'
import MapView from '../components/Map/MapView'
import MapLegend from '../components/Map/MapLegend'
import MapViewControls from '../components/Map/MapViewControls'
import AdvancedFilters from '../components/Map/AdvancedFilters'
import FilterPresets from '../components/Map/FilterPresets'
import { useReports } from '../hooks/useReports'
import { useAdvancedFilters } from '../hooks/useAdvancedFilters'

// Enhanced view mode configurations with clustering
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  const { reports, loading, error, refetch } = useReports()

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

  // Map state with intelligent clustering
  const [viewMode, setViewMode] = useState('clusters') // Default to clusters for better performance
  const [heatmapOptions, setHeatmapOptions] = useState({
    radius: 25,
    blur: 15,
    maxZoom: 18
  })
  const [clusteringOptions, setClusteringOptions] = useState({
    enableBengaliNumerals: false,
    showTypeIndicator: true,
    showRiskBadge: true,
    enableAnimations: true
  })
  const [mapInstance, setMapInstance] = useState(null)

  // UI state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showFilterPresets, setShowFilterPresets] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
      shouldRecommendClustering: count > 100 && viewMode === 'markers',
      shouldWarnHybrid: count > 500 && viewMode === 'hybrid',
      recommendedViewMode: count > 1000 ? 'clusters' :
        count > 500 ? 'clusters' :
          count > 100 ? 'hybrid' : 'markers',
      estimatedClusters: Math.ceil(count / 15),
      performanceImpact: count > 1000 ? 'high' : count > 500 ? 'medium' : 'low',
      filterEfficiency: reports.length > 0 ? ((count / reports.length) * 100).toFixed(1) : 100
    }
  }, [filteredReports.length, viewMode, reports.length])

  // Smart view mode recommendation system
  useEffect(() => {
    const { datasetSize, recommendedViewMode } = performanceStats

    if (datasetSize === 'large' && viewMode === 'markers') {
      console.log(`💡 Large dataset detected (${filteredReports.length} reports) - clustering recommended`)
    }
  }, [performanceStats, viewMode, filteredReports.length])

  // Memoized handlers to prevent unnecessary re-renders
  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode)
    console.log(`📊 Map view changed to: ${newMode} for ${filteredReports.length} reports`)
  }, [filteredReports.length])

  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    setHeatmapOptions(prev => ({
      ...prev,
      ...newOptions
    }))
  }, [])

  const handleClusteringOptionsChange = useCallback((newOptions) => {
    setClusteringOptions(prev => ({
      ...prev,
      ...newOptions
    }))
  }, [])

  const handleMapReady = useCallback((map) => {
    setMapInstance(map)
    console.log('🗺️ Map instance ready for enhanced filtering features')
  }, [])

  // Enhanced cluster click handler
  const handleClusterClick = useCallback((clusterData) => {
    console.log(`🎯 Cluster clicked: ${clusterData.count} reports`)
  }, [])

  // Enhanced marker click handler
  const handleMarkerClick = useCallback((markerData) => {
    console.log(`📍 Marker clicked: ${markerData.report.type} incident`)
  }, [])

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

  // Determine which rendering approach to use
  const shouldUseClustering = useMemo(() => {
    if (viewMode === 'clusters') return true
    if (viewMode === 'heatmap') return false
    if (viewMode === 'hybrid') return filteredReports.length > 100
    if (viewMode === 'markers') return performanceStats.isLargeDataset
    return false
  }, [viewMode, filteredReports.length, performanceStats.isLargeDataset])

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

      {/* ENHANCED HEADER WITH ADVANCED FILTERING */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="py-8 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">

              {/* Left Column - Enhanced with Filter Info */}
              <div className="lg:col-span-7">
                <div className="flex items-start space-x-4 mb-6">
                  <div className="flex-shrink-0">
                    <div className="bg-gradient-to-br from-bangladesh-green to-bangladesh-green-dark p-3 rounded-2xl shadow-lg">
                      <Shield className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 leading-tight mb-2">
                      Advanced Crime Intelligence
                    </h1>
                    <p className="text-lg text-bangladesh-green font-medium font-bangla mb-3">
                      চৌকিদারের চোখে শহর
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-neutral-600">
                        <span className="font-semibold text-bangladesh-green">{filterStats.filtered}</span> of {filterStats.total} reports
                      </span>
                      {hasActiveFilters() && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                          {performanceStats.filterEfficiency}% match rate
                        </span>
                      )}
                      {performanceStats.datasetSize === 'large' && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                          <Zap className="w-3 h-3 mr-1" />
                          Large Dataset
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Filter Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-green-800">Safe Areas</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <Target className="w-3 h-3 text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-purple-800">Smart Clusters</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-xl border border-red-200">
                    <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-red-800">High Risk</span>
                  </div>
                  <div className="flex items-center space-x-2 p-3 bg-bangladesh-green/10 rounded-xl border border-bangladesh-green/20">
                    <Filter className="w-3 h-3 text-bangladesh-green flex-shrink-0" />
                    <span className="text-sm font-medium text-bangladesh-green">Filtered</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Enhanced Search & Quick Filters */}
              <div className="lg:col-span-5">
                <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Search & Filters</h3>

                  <div className="space-y-4">
                    {/* Quick Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search incidents, locations..."
                        className="w-full pl-10 pr-4 py-3 text-base border-2 border-neutral-200 rounded-xl focus:border-bangladesh-green focus:ring-0 transition-colors"
                        value={filters.searchTerm || ''}
                        onChange={(e) => handleQuickSearch(e.target.value)}
                      />
                      {filters.searchTerm && (
                        <button
                          onClick={() => handleQuickSearch('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Quick Type Filters */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: 'chadabaji', label: 'Extortion', icon: '💰' },
                        { type: 'teen_gang', label: 'Gangs', icon: '👥' },
                        { type: 'chintai', label: 'Harassment', icon: '⚠️' },
                        { type: 'other', label: 'Other', icon: '🚨' }
                      ].map(({ type, label, icon }) => (
                        <button
                          key={type}
                          onClick={() => handleQuickTypeFilter(type)}
                          className={`p-2 text-sm rounded-lg border transition-all duration-200 ${filters.incidentTypes?.includes(type)
                              ? 'border-bangladesh-green bg-bangladesh-green text-white'
                              : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                            }`}
                        >
                          <span className="mr-1">{icon}</span>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Advanced Filter Toggles */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium text-sm ${showAdvancedFilters || hasActiveFilters()
                            ? 'border-bangladesh-green bg-bangladesh-green text-white'
                            : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                          }`}
                      >
                        <Filter className="w-4 h-4 mr-2 inline" />
                        Advanced
                        {hasActiveFilters() && (
                          <span className="ml-1 bg-white/20 text-xs px-1 py-0.5 rounded">
                            {Object.values(filters).filter(v =>
                              Array.isArray(v) ? v.length > 0 :
                                typeof v === 'object' && v !== null ? Object.values(v).some(val => val !== null && val !== 'all') :
                                  v && v !== 'newest' && v !== 'all'
                            ).length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setShowFilterPresets(!showFilterPresets)}
                        className="py-2 px-4 rounded-lg border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-all font-medium text-sm"
                      >
                        <Settings className="w-4 h-4 mr-2 inline" />
                        Presets
                      </button>

                      <button
                        onClick={refetch}
                        className="py-2 px-4 rounded-lg border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-all font-medium text-sm"
                        disabled={loading}
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {/* Performance Recommendation */}
                    {performanceStats.shouldRecommendClustering && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <div className="text-sm">
                            <span className="font-medium text-purple-800">Performance Tip:</span>
                            <span className="text-purple-700 ml-1">
                              Switch to cluster view for better performance with {filteredReports.length} reports
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleViewModeChange('clusters')}
                          className="mt-2 text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded-full transition-colors"
                        >
                          Switch to Clusters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Filter Summary */}
          {hasActiveFilters() && (
            <div className="pb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="text-blue-900 font-semibold">
                        Showing {filteredReports.length} of {reports.length} reports ({filterStats.filteredPercentage}% match)
                      </span>
                      <div className="text-blue-700 text-sm mt-1">
                        Active filters: {Object.entries(filters).filter(([key, value]) => {
                          if (key === 'searchTerm') return value
                          if (Array.isArray(value)) return value.length > 0
                          if (key === 'severityRange') return value && (value[0] > 1 || value[1] < 5)
                          if (key === 'dateRange') return value && value.preset !== 'all'
                          if (key === 'locationFilter') return value && value.withinBangladesh !== null
                          if (key === 'sortBy') return value !== 'newest'
                          if (key === 'showFlagged') return value
                          return false
                        }).length} applied
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {performanceStats.estimatedClusters > 0 && viewMode === 'clusters' && (
                      <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded-full">
                        ≈ {performanceStats.estimatedClusters} clusters expected
                      </span>
                    )}
                    <button
                      onClick={clearFilters}
                      className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Size Warning */}
          {performanceStats.performanceImpact === 'high' && viewMode !== 'clusters' && viewMode !== 'heatmap' && (
            <div className="pb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="text-amber-900 font-medium">
                        Large Dataset Performance Notice
                      </span>
                      <p className="text-amber-700 text-sm">
                        {filteredReports.length} reports detected. Consider clustering or heatmap view for optimal performance.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewModeChange('clusters')}
                      className="text-amber-600 hover:text-amber-800 font-medium px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm"
                    >
                      Use Clusters
                    </button>
                    <button
                      onClick={() => handleViewModeChange('heatmap')}
                      className="text-amber-600 hover:text-amber-800 font-medium px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm"
                    >
                      Use Heatmap
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ENHANCED MAIN CONTENT WITH ADVANCED FILTERING */}
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
                      viewMode={viewMode}
                      heatmapOptions={heatmapOptions}
                      clusteringOptions={clusteringOptions}
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
                                className={`p-3 rounded-lg transition-all duration-200 ${viewMode === mode
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
                          {viewMode === 'clusters' && (
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
                  {viewMode === 'clusters' && performanceStats.estimatedClusters > 0 && (
                    <div className="text-xs text-purple-600 mt-1">
                      ≈ {performanceStats.estimatedClusters} intelligent clusters
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
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    heatmapOptions={heatmapOptions}
                    onHeatmapOptionsChange={handleHeatmapOptionsChange}
                    reportCount={filteredReports.length}
                  />

                  {/* Clustering Options */}
                  {(viewMode === 'clusters' || viewMode === 'hybrid') && (
                    <div className="mt-4 pt-4 border-t border-neutral-200">
                      <h4 className="font-medium text-neutral-800 mb-3">Clustering Options</h4>

                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={clusteringOptions.showTypeIndicator}
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
                            checked={clusteringOptions.showRiskBadge}
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
                            checked={clusteringOptions.enableAnimations}
                            onChange={(e) => handleClusteringOptionsChange({
                              enableAnimations: e.target.checked
                            })}
                            className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                          />
                          <span className="text-sm">Enable animations</span>
                        </label>
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
                      {VIEW_MODE_CONFIG[viewMode]?.icon && (
                        React.createElement(VIEW_MODE_CONFIG[viewMode].icon, { className: "w-4 h-4 mr-2" })
                      )}
                      {viewMode}
                    </div>
                    <div className="text-sm text-purple-700">Active View Mode</div>
                    {viewMode === 'clusters' && (
                      <div className="text-xs text-purple-600 mt-1">
                        AI-powered grouping
                      </div>
                    )}
                  </div>

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
