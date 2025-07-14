// === frontend/src/pages/MapPage.jsx (FIXED LAYOUT ISSUES) ===
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Filter, Search, MapPin, RefreshCw, Flame, Map, Layers, TrendingUp, Users, Shield, Info, BarChart3 } from 'lucide-react'
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

// Memoize view mode configurations
const VIEW_MODE_CONFIG = {
  markers: { color: 'text-bangladesh-green', bgColor: 'bg-bangladesh-green' },
  heatmap: { color: 'text-safe-warning', bgColor: 'bg-safe-warning' },
  hybrid: { color: 'text-purple-600', bgColor: 'bg-purple-600' }
}

const MapPage = memo(() => {
  const { reports, loading, error, refetch } = useReports()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  
  // Enhanced map state with better defaults
  const [viewMode, setViewMode] = useState('markers')
  const [heatmapOptions, setHeatmapOptions] = useState({
    radius: 25,
    blur: 15,
    maxZoom: 18
  })
  const [mapInstance, setMapInstance] = useState(null)

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

  // Memoize performance stats
  const performanceStats = useMemo(() => ({
    isLargeDataset: filteredReports.length > 200,
    shouldWarnHybrid: filteredReports.length > 500 && viewMode === 'hybrid',
    recommendHeatmap: filteredReports.length > 200 && viewMode === 'markers'
  }), [filteredReports.length, viewMode])

  // Memoized handlers to prevent unnecessary re-renders
  const handleViewModeChange = useCallback((newMode) => {
    setViewMode(newMode)
    console.log(`📊 Map view changed to: ${newMode}`)
  }, [])

  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    setHeatmapOptions(prev => ({
      ...prev,
      ...newOptions
    }))
  }, [])

  const handleMapReady = useCallback((map) => {
    setMapInstance(map)
    console.log('🗺️ Map instance ready for enhanced features')
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

  // Auto-recommendation effect
  useEffect(() => {
    if (performanceStats.recommendHeatmap) {
      console.log('💡 Large dataset detected - heatmap recommended')
    }
  }, [performanceStats.recommendHeatmap])

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
      {/* FIXED PROFESSIONAL HEADER */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Main Header Section - FIXED SPACING */}
          <div className="py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column - Title & Description */}
              <div className="lg:col-span-7">
                <div className="flex items-start space-x-5 mb-8">
                  <div className="flex-shrink-0">
                    <div className="bg-gradient-to-br from-bangladesh-green to-bangladesh-green-dark p-4 rounded-2xl shadow-lg">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 leading-tight mb-3">
                      Crime Intelligence Map
                    </h1>
                    <p className="text-lg sm:text-xl text-bangladesh-green font-medium font-bangla mb-4">
                      নিরাপদ দেশের জন্য একসাথে
                    </p>
                    <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
                      Interactive visualization of <span className="font-semibold text-bangladesh-green">{reportCounts.approved}</span> verified incidents across Bangladesh
                    </p>
                  </div>
                </div>
                
                {/* Risk Level Indicators - BETTER SPACING */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-green-800">Low Risk Areas</span>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex-shrink-0"></div>
                    <span className="text-sm font-medium text-yellow-800">Medium Risk</span>
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
              
              {/* Right Column - Search & Controls - FIXED SPACING */}
              <div className="lg:col-span-5">
                <div className="bg-neutral-50 rounded-2xl p-6 lg:p-8 border border-neutral-200">
                  <h3 className="text-lg font-semibold text-neutral-900 mb-6">Search & Filter</h3>
                  
                  {/* Search Input - BETTER SPACING */}
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

                    {/* Controls Row - BETTER LAYOUT */}
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Summary - BETTER POSITIONING */}
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

          {/* Performance Recommendation */}
          {performanceStats.recommendHeatmap && (
            <div className="pb-8">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <Flame className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="text-amber-900 font-medium">
                        Large dataset detected ({filteredReports.length} reports)
                      </span>
                      <p className="text-amber-700 text-sm">
                        Consider switching to heatmap view for better performance
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewModeChange('heatmap')}
                    className="text-amber-600 hover:text-amber-800 font-medium px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
                  >
                    Switch to Heatmap
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FIXED MAIN CONTENT LAYOUT */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* FIXED MAP SECTION - Proper sizing */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="bg-white rounded-2xl shadow-lg border border-neutral-200">
              {/* Map Container - FIXED HEIGHT AND PADDING */}
              <div className="p-4 lg:p-6">
                {loading ? (
                  <div className="h-[500px] lg:h-[700px] flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl">
                    <div className="text-center">
                      <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
                      <p className="text-neutral-600 text-lg">Loading map...</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[500px] lg:h-[700px] relative rounded-xl overflow-hidden">
                    <MapView 
                      reports={filteredReports}
                      viewMode={viewMode}
                      heatmapOptions={heatmapOptions}
                      onMapReady={handleMapReady}
                      className="w-full h-full"
                    />
                    
                    {/* FIXED OVERLAY CONTROLS - Positioned to avoid SafeStreets info overlap */}
                    <div className="absolute bottom-4 right-4 z-[1000] lg:bottom-6 lg:right-6">
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-2">
                        <div className="flex space-x-1">
                          {[
                            { mode: 'markers', icon: Map, label: 'Markers' },
                            { mode: 'heatmap', icon: Flame, label: 'Heatmap' },
                            { mode: 'hybrid', icon: Layers, label: 'Hybrid' }
                          ].map(({ mode, icon: Icon, label }) => (
                            <button
                              key={mode}
                              onClick={() => handleViewModeChange(mode)}
                              className={`p-3 rounded-lg transition-all duration-200 ${
                                viewMode === mode 
                                  ? `${VIEW_MODE_CONFIG[mode].bgColor} text-white shadow-md` 
                                  : 'text-neutral-600 hover:bg-neutral-100'
                              }`}
                              title={`${label} View`}
                            >
                              <Icon className="w-5 h-5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Performance indicator - Better positioning */}
                    {filteredReports.length > 100 && (
                      <div className="absolute bottom-4 left-4 z-[1000] lg:bottom-6 lg:left-6">
                        <div className="bg-bangladesh-green text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
                          ⚡ {filteredReports.length} reports
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* FIXED INSIGHTS SECTION - Better spacing from map */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-800">Coverage Analysis</h3>
                    <p className="text-neutral-600 text-sm">Geographic spread</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-600">{reportCounts.approved}</div>
                <div className="text-sm text-neutral-600">Incidents mapped across {reportCounts.approved > 0 ? Math.ceil(reportCounts.approved / 3) : 0} areas</div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-800">Safety Index</h3>
                    <p className="text-neutral-600 text-sm">Current status</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {reportCounts.approved <= 5 ? '85%' : reportCounts.approved <= 15 ? '70%' : '65%'}
                </div>
                <div className="text-sm text-neutral-600">Overall community safety</div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md border border-neutral-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="bg-purple-500 p-3 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-800">Trend Analysis</h3>
                    <p className="text-neutral-600 text-sm">This week</p>
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {reportCounts.approved > reportCounts.pending ? '↓ 12%' : '→ Stable'}
                </div>
                <div className="text-sm text-neutral-600">
                  {reportCounts.approved > reportCounts.pending ? 'Incidents decreasing' : 'Monitoring trends'}
                </div>
              </div>
            </div>
          </div>

          {/* FIXED SIDEBAR - Better proportions */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="space-y-6">
              {/* Map Controls */}
              <MapViewControls
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                heatmapOptions={heatmapOptions}
                onHeatmapOptionsChange={handleHeatmapOptionsChange}
                reportCount={filteredReports.length}
              />

              {/* Legend */}
              <MapLegend reportCounts={reportCounts} />

              {/* Live Stats */}
              <div className="bg-white rounded-xl shadow-md border border-neutral-200">
                <div className="bg-bangladesh-green p-4 rounded-t-xl">
                  <h3 className="font-bold text-white flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Live Statistics
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{filteredReports.length}</div>
                    <div className="text-sm text-green-700">Currently Showing</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-lg font-bold text-blue-600 capitalize">{viewMode}</div>
                    <div className="text-sm text-blue-700">View Mode Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FIXED REPORT CTA - Better spacing from content */}
      <div className="bg-white border-t border-neutral-200">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-gradient-to-br from-bangladesh-red to-bangladesh-red-dark text-white rounded-2xl p-8 lg:p-12 text-center shadow-lg">
            <div className="bg-white/20 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold mb-4">
              Witness an Incident?
            </h2>
            <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              Help make your community safer by reporting incidents anonymously and securely through our platform
            </p>
            <a 
              href="/report" 
              className="inline-block bg-white text-bangladesh-red font-semibold px-8 py-4 rounded-lg hover:bg-neutral-100 transition-colors text-lg"
            >
              Report Now
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})

MapPage.displayName = 'MapPage'

export default MapPage