// === frontend/src/components/Map/MapPageHeader.jsx ===
import React, { memo } from 'react'
import { 
  Shield, Search, X, Filter, Settings, RefreshCw, MapPin, 
  Target, Zap
} from 'lucide-react'

/**
 * MapPage Header Component - Extracted from MapPage.jsx
 * Handles title, search, quick filters, and control buttons
 */
const MapPageHeader = memo(({
  // Filter stats
  filterStats,
  performanceStats,
  hasActiveFilters,
  
  // Search & filters
  filters,
  onQuickSearch,
  onQuickTypeFilter,
  
  // View mode
  viewMode,
  onViewModeChange,
  
  // UI state
  showAdvancedFilters,
  setShowAdvancedFilters,
  showFilterPresets,
  setShowFilterPresets,
  
  // Data
  reports,
  filteredReports,
  
  // Loading state
  loading,
  onRefetch,
  
  // User location
  hasUserLocation,
  isUserInBangladesh,
  onCenterOnUser,
  
  // Mobile detection
  isMobile = false
}) => {
  return (
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
                    {hasActiveFilters && (
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
                    {hasUserLocation && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${
                        isUserInBangladesh 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        <MapPin className="w-3 h-3 mr-1" />
                        {isUserInBangladesh ? 'In Bangladesh' : 'Outside Bangladesh'}
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
                      onChange={(e) => onQuickSearch(e.target.value)}
                    />
                    {filters.searchTerm && (
                      <button
                        onClick={() => onQuickSearch('')}
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
                        onClick={() => onQuickTypeFilter(type)}
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
                      className={`flex-1 py-2 px-4 rounded-lg border transition-all font-medium text-sm ${showAdvancedFilters || hasActiveFilters
                        ? 'border-bangladesh-green bg-bangladesh-green text-white'
                        : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                        }`}
                    >
                      <Filter className="w-4 h-4 mr-2 inline" />
                      Advanced
                      {hasActiveFilters && (
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
                      onClick={onRefetch}
                      className="py-2 px-4 rounded-lg border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-all font-medium text-sm"
                      disabled={loading}
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* User Location Button */}
                    {hasUserLocation && (
                      <button
                        onClick={onCenterOnUser}
                        className="py-2 px-4 rounded-lg border border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-all font-medium text-sm"
                        title="Center on my location"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    )}
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
                        onClick={() => onViewModeChange('clusters')}
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
      </div>
    </div>
  )
})

MapPageHeader.displayName = 'MapPageHeader'

export default MapPageHeader