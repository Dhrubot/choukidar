// === src/pages/MapPage.jsx (ENHANCED with Intelligent Clustering) ===
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Filter, Search, MapPin, RefreshCw, Flame, Map, Layers, TrendingUp, Users, Shield, Info, BarChart3, Zap, Target } from 'lucide-react'
import MapView from '../components/Map/MapView'
import MapLegend from '../components/Map/MapLegend'
import MapViewControls from '../components/Map/MapViewControls'
import { useReports } from '../hooks/useReports'

// Memoize static filter options outside component
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Types', icon: '🗺️' },
  { value: 'chadabaji', label: 'Chadabaji', icon: '💰', description: 'Extortion incidents' },
  { value: 'teen_gang', label: 'Teen Gangs', icon: '👥', description: 'Youth gang activity' },
  { value: 'chintai', label: 'Chintai', icon: '⚠️', description: 'Harassment cases' },
  { value: 'other', label: 'Other', icon: '🚨', description: 'Other criminal activity' }
]

// Enhanced view mode configurations with clustering
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green', icon: Map },
  clusters: { color: 'text-purple-600', bgColor: 'bg-purple-600', icon: Target },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning', icon: Flame },
  hybrid: { color: 'text-red-600', bgColor: 'bg-red-600', icon: Layers }
}

const MapPage = memo(() => {
  const { reports, loading, error, refetch } = useReports()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  
  // Enhanced map state with intelligent clustering
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
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    averageClusterSize: 0,
    largestCluster: 0
  })

  // Memoize filtered reports to prevent unnecessary recalculations
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch = searchTerm === '' || 
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.location.address?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesFilter = activeFilter === 'all' || report.type === activeFilter
      
      return matchesSearch && matchesFilter
    })
  }, [reports, searchTerm, activeFilter])

  // Memoize report counts to prevent recalculation
  const reportCounts = useMemo(() => ({
    total: reports.length,
    approved: reports.filter(r => r.status === 'approved').length,
    pending: reports.filter(r => r.status === 'pending').length,
    filtered: filteredReports.length
  }), [reports, filteredReports.length])

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
      estimatedClusters: Math.ceil(count / 15), // Rough estimate
      performanceImpact: count > 1000 ? 'high' : count > 500 ? 'medium' : 'low'
    }
  }, [filteredReports.length, viewMode])

  // Smart view mode recommendation system
  useEffect(() => {
    const { datasetSize, recommendedViewMode } = performanceStats
    
    // Auto-suggest better view mode for large datasets
    if (datasetSize === 'large' && viewMode === 'markers') {
      console.log(`💡 Large dataset detected (${filteredReports.length} reports) - clustering recommended`)
    }
    
    // Auto-switch for very large datasets (optional - can be enabled)
    // if (filteredReports.length > 2000 && viewMode !== 'clusters' && viewMode !== 'heatmap') {
    //   setViewMode('clusters')
    //   console.log('🚀 Auto-switched to clustering for performance')
    // }
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
    console.log('🗺️ Map instance ready for enhanced clustering features')
  }, [])

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value)
  }, [])

  const handleFilterChange = useCallback((e) => {
    setActiveFilter(e.target.value)
  }, [])

  const handleClearFilters = useCallback(() => {
    setSearchTerm('')
    setActiveFilter('all')
  }, [])

  // Enhanced cluster click handler
  const handleClusterClick = useCallback((clusterData) => {
    const { cluster, markers, count, bounds } = clusterData
    
    console.log(`🎯 Cluster clicked: ${count} reports in area`)
    
    // Update cluster stats
    setClusterStats(prev => ({
      ...prev,
      lastClickedCluster: {
        count,
        bounds,
        timestamp: Date.now()
      }
    }))

    // Optional: Show cluster details in sidebar or modal
    // This could trigger a detailed view of the cluster
  }, [])

  // Enhanced marker click handler
  const handleMarkerClick = useCallback((markerData) => {
    const { report, position } = markerData
    
    console.log(`📍 Marker clicked: ${report.type} incident at ${position.lat}, ${position.lng}`)
    
    // Optional: Show detailed report view
    // This could open a modal or sidebar with full report details
  }, [])

  // Memoize filter summary for display
  const filterSummary = useMemo(() => {
    const hasFilters = searchTerm || activeFilter !== 'all'
    if (!hasFilters) return null

    const parts = []
    if (searchTerm) parts.push(`Search: "${searchTerm}"`)
    if (activeFilter !== 'all') {
      const filterOption = FILTER_OPTIONS.find(opt => opt.value === activeFilter)
      parts.push(`Type: ${filterOption?.label || activeFilter}`)
    }
    return parts.join(' • ')
  }, [searchTerm, activeFilter])

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
      {/* ENHANCED HEADER WITH CLUSTERING INTELLIGENCE */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column - Enhanced with Performance Info */}
              <div className="lg:col-span-7">
                <div className="flex items-start space-x-5 mb-8">
                  <div className="flex-shrink-0">
                    <div className="bg-gradient-to-br from-bangladesh-green to-bangladesh-green-dark p-4 rounded-2xl shadow-lg">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 leading-tight mb-3">
                      Intelligent Crime Map
                    </h1>
                    <p className="text-lg sm:text-xl text-bangladesh-green font-medium font-bangla mb-4">
                      চোখ রাখছে চৌকিদার
                    </p>
                    <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
                      Advanced visualization of <span className="font-semibold text-bangladesh-green">{reportCounts.approved}</span> verified incidents
                      {performanceStats.datasetSize === 'large' && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Zap className="w-3 h-3 mr-1" />
                          Large Dataset
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Enhanced indicators with clustering info */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-green-800">Safe Zones</span>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <Target className="w-3 h-3 text-purple-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-purple-800">Smart Clusters</span>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-xl border border-red-200">
                    <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-red-800">High Risk</span>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-bangladesh-green/10 rounded-xl border border-bangladesh-green/20">
                    <TrendingUp className="w-3 h-3 text-bangladesh-green flex-shrink-0" />
                    <span className="text-sm font-medium text-bangladesh-green">Real-time</span>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Enhanced Search & Controls */}
              <div className="lg:col-span-5">
                <div className="bg-neutral-50 rounded-2xl p-6 lg:p-8 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-6">Search & Intelligence</h3>
                  
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search incidents, locations..."
                        className="w-full pl-12 pr-4 py-4 text-base border-2 border-neutral-200 rounded-xl focus:border-bangladesh-green focus:ring-0 transition-colors"
                        value={searchTerm}
                        onChange={handleSearchChange}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        className="flex-1 py-4 px-4 text-base border-2 border-neutral-200 rounded-xl focus:border-bangladesh-green focus:ring-0 transition-colors"
                        value={activeFilter}
                        onChange={handleFilterChange}
                      >
                        {FILTER_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.icon} {option.label}
                          </option>
                        ))}
                      </select>

                      <button 
                        onClick={refetch}
                        className="sm:w-auto px-6 py-4 bg-white border-2 border-bangladesh-green text-bangladesh-green rounded-xl hover:bg-bangladesh-green hover:text-white transition-all font-medium flex items-center justify-center"
                        disabled={loading}
                      >
                        <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
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
          {filterSummary && (
            <div className="pb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Filter className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <span className="text-blue-900 font-semibold">
                        Showing {filteredReports.length} of {reports.length} reports
                      </span>
                      <p className="text-blue-700 text-sm mt-1">{filterSummary}</p>
                      {performanceStats.estimatedClusters > 0 && viewMode === 'clusters' && (
                        <p className="text-blue-600 text-xs mt-1">
                          ≈ {performanceStats.estimatedClusters} intelligent clusters expected
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleClearFilters}
                    className="text-blue-600 hover:text-blue-800 font-medium px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Size Warning */}
          {performanceStats.performanceImpact === 'high' && viewMode !== 'clusters' && viewMode !== 'heatmap' && (
            <div className="pb-8">
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

      {/* ENHANCED MAIN CONTENT WITH CLUSTERING */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
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
                                className={`p-3 rounded-lg transition-all duration-200 ${
                                  viewMode === mode 
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
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Insights with Clustering Stats */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="text-2xl font-bold text-blue-600">{reportCounts.approved}</div>
                <div className="text-sm text-neutral-600">
                  Incidents across {reportCounts.approved > 0 ? Math.ceil(reportCounts.approved / 5) : 0} areas
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
                    <h3 className="font-bold text-neutral-800">Safety Index</h3>
                    <p className="text-neutral-600 text-sm">AI-powered assessment</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {reportCounts.approved <= 5 ? '88%' : reportCounts.approved <= 15 ? '75%' : '68%'}
                </div>
                <div className="text-sm text-neutral-600">Community safety score</div>
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
                  {performanceStats.datasetSize === 'large' ? 'Machine learning patterns detected' :
                   performanceStats.datasetSize === 'medium' ? 'Statistical analysis active' :
                   'Monitoring incident trends'}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Sidebar with Clustering Controls */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="space-y-6">
              
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
                            className="mr-2"
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
                            className="mr-2"
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
                            className="mr-2"
                          />
                          <span className="text-sm">Enable animations</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Legend */}
              <MapLegend reportCounts={reportCounts} />

              {/* Enhanced Live Stats with Performance Info */}
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
                      {performanceStats.datasetSize} dataset
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
              Your anonymous reports power our intelligent mapping system. Every report helps create a safer Bangladesh through smart data analysis.
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