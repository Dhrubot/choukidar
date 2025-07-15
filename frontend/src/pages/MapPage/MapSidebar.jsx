// === frontend/src/pages/MapPage/MapSidebar.jsx ===
/**
 * MapSidebar - Integrated Panel System
 * Houses filters, safe zones, routes, and details panels
 * Mobile-responsive with smooth transitions
 */

import React, { useState, useCallback, useMemo, memo } from 'react'
import {
  Filter, Shield, Navigation, BarChart3, MapPin, X, ChevronDown,
  Settings, Info, Star, Clock, Users, TrendingUp, Zap, RefreshCw,
  AlertTriangle, CheckCircle, Route as RouteIcon
} from 'lucide-react'

// Import existing and new components
import AdvancedFilters from '../../components/Map/AdvancedFilters'
import FilterPresets from '../../components/Map/FilterPresets'
import SafeZones from '../../components/Map/SafeZones'
import RoutePlanner from '../../components/Map/RoutePlanner'

// Panel configuration
const PANELS = {
  filters: {
    id: 'filters',
    title: 'Advanced Filters',
    icon: Filter,
    color: 'bg-bangladesh-green',
    description: 'Filter reports by type, date, severity'
  },
  safezones: {
    id: 'safezones',
    title: 'Safe Zones',
    icon: Shield,
    color: 'bg-green-600',
    description: 'View and navigate to safe areas'
  },
  routes: {
    id: 'routes',
    title: 'Route Planning',
    icon: Navigation,
    color: 'bg-blue-600',
    description: 'Plan safer routes and get recommendations'
  },
  analytics: {
    id: 'analytics',
    title: 'Statistics',
    icon: BarChart3,
    color: 'bg-purple-600',
    description: 'View crime statistics and trends'
  },
  details: {
    id: 'details',
    title: 'Report Details',
    icon: Info,
    color: 'bg-orange-600',
    description: 'View selected report information'
  }
}

const MapSidebar = memo(({
  isOpen,
  onClose,
  activePanel,
  onPanelChange,
  
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
  onSafeZoneSelect,
  userLocation,
  
  // Route props
  routes,
  routeLoading,
  routeStatistics,
  recommendations,
  quotaWarnings,
  routingAvailable,
  hasRoutes,
  onRouteSelect,
  calculateRoute,
  clearRoute,
  
  // Selected marker
  selectedMarker,
  
  // Performance metrics
  performanceMetrics,
  
  className = ""
}) => {
  // Internal state
  const [expandedSections, setExpandedSections] = useState({
    filters: true,
    presets: false,
    stats: true
  })

  // Handle section expansion
  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }, [])

  // Handle panel navigation
  const handlePanelClick = useCallback((panelId) => {
    if (activePanel === panelId && isOpen) {
      onClose()
    } else {
      onPanelChange(panelId)
    }
  }, [activePanel, isOpen, onClose, onPanelChange])

  // Memoized panel content
  const renderPanelContent = useMemo(() => {
    switch (activePanel) {
      case 'filters':
        return (
          <div className="space-y-4">
            {/* Filter Presets */}
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <button
                onClick={() => toggleSection('presets')}
                className="w-full p-4 flex items-center justify-between text-left border-b border-neutral-100"
              >
                <h3 className="font-semibold text-neutral-800 flex items-center">
                  <Star className="w-4 h-4 mr-2 text-yellow-600" />
                  Filter Presets
                </h3>
                <ChevronDown 
                  className={`w-4 h-4 text-neutral-500 transition-transform ${
                    expandedSections.presets ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              {expandedSections.presets && (
                <div className="p-4">
                  <FilterPresets
                    presets={filterPresets}
                    onLoadPreset={loadFilterPreset}
                    onSavePreset={saveFilterPreset}
                    onDeletePreset={deleteFilterPreset}
                    currentFilters={filters}
                  />
                </div>
              )}
            </div>

            {/* Advanced Filters */}
            <AdvancedFilters
              filters={filters}
              updateFilter={updateFilter}
              updateNestedFilter={updateNestedFilter}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              applyDatePreset={applyDatePreset}
              isFiltering={isFiltering}
              reportCount={filteredReports.length}
              totalReports={filterStats.totalReports}
            />

            {/* Filter Statistics */}
            {expandedSections.stats && filterStats && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-200">
                <div className="bg-bangladesh-green p-4 rounded-t-xl">
                  <h3 className="font-bold text-white flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Filter Results
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-bangladesh-green">
                        {filteredReports.length}
                      </div>
                      <div className="text-sm text-neutral-600">Showing</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-neutral-700">
                        {filterStats.totalReports}
                      </div>
                      <div className="text-sm text-neutral-600">Total</div>
                    </div>
                  </div>
                  
                  {filterStats.byType && (
                    <div className="pt-3 border-t border-neutral-200">
                      <div className="text-sm font-medium text-neutral-700 mb-2">By Type:</div>
                      <div className="space-y-2">
                        {Object.entries(filterStats.byType).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-sm">
                            <span className="capitalize text-neutral-600">{type}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      case 'safezones':
        return (
          <SafeZones
            reports={filteredReports}
            userLocation={userLocation}
            onZoneSelect={onSafeZoneSelect}
            className="space-y-4"
            showControls={true}
            showStatistics={true}
            enableMonitoring={true}
          />
        )

      case 'routes':
        return (
          <div className="space-y-4">
            {/* Quota Warning */}
            {quotaWarnings && quotaWarnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">API Usage Notice</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {quotaWarnings[0]?.message || 'Route planning may be limited today'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Route Planner */}
            <RoutePlanner
              reports={filteredReports}
              userLocation={userLocation}
              onRouteSelect={onRouteSelect}
              className="space-y-4"
              showAdvanced={true}
              enableMonitoring={true}
              defaultTransportMode="walking"
            />

            {/* Route Statistics */}
            {routeStatistics && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-200">
                <div className="bg-blue-600 p-4 rounded-t-xl">
                  <h3 className="font-bold text-white flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Route Statistics
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {routeStatistics.totalRoutes || 0}
                      </div>
                      <div className="text-sm text-neutral-600">Routes Found</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {routeStatistics.averageSafety?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="text-sm text-neutral-600">Avg Safety</div>
                    </div>
                  </div>
                  
                  {routeStatistics.bestRoute && (
                    <div className="pt-3 border-t border-neutral-200">
                      <div className="text-sm font-medium text-neutral-700 mb-2">
                        Recommended Route:
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-800">
                            {routeStatistics.bestRoute.distance} • {routeStatistics.bestRoute.duration}
                          </span>
                          <span className="text-sm font-medium text-green-700">
                            Safety: {routeStatistics.bestRoute.safetyScore}/10
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-4">
            {/* Overview Statistics */}
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-purple-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Crime Statistics
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {filteredReports.length}
                    </div>
                    <div className="text-sm text-neutral-600">Total Reports</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {safeZones.length}
                    </div>
                    <div className="text-sm text-neutral-600">Safe Zones</div>
                  </div>
                </div>

                {performanceMetrics && (
                  <div className="pt-3 border-t border-neutral-200">
                    <div className="text-sm font-medium text-neutral-700 mb-2">Performance:</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Render Time:</span>
                        <span className="font-medium">
                          {Math.round(performanceMetrics.renderTime)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Last Update:</span>
                        <span className="font-medium text-xs">
                          {performanceMetrics.lastUpdate ? 
                            new Date(performanceMetrics.lastUpdate).toLocaleTimeString() : 
                            'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Safe Zone Statistics */}
            {safeZoneStats && (
              <div className="bg-white rounded-xl shadow-md border border-neutral-200">
                <div className="bg-green-600 p-4 rounded-t-xl">
                  <h3 className="font-bold text-white flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Safety Overview
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {safeZoneStats.averageSafety?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="text-xs text-neutral-600">Avg Safety</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">
                        {safeZoneStats.coverageArea || 'N/A'}
                      </div>
                      <div className="text-xs text-neutral-600">Coverage</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">
                        {safeZoneStats.adminZones || 0}
                      </div>
                      <div className="text-xs text-neutral-600">Verified</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'details':
        if (!selectedMarker) {
          return (
            <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <h3 className="text-lg font-medium text-neutral-700 mb-2">No Report Selected</h3>
              <p className="text-neutral-500 text-sm">
                Click on a marker on the map to view report details
              </p>
            </div>
          )
        }

        return (
          <div className="space-y-4">
            {/* Report Details */}
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-orange-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Report Details
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-neutral-700">Type:</label>
                  <p className="capitalize text-neutral-900">{selectedMarker.type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Severity:</label>
                  <p className="text-neutral-900">{selectedMarker.severity}/5</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Date:</label>
                  <p className="text-neutral-900">
                    {new Date(selectedMarker.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Description:</label>
                  <p className="text-neutral-900 text-sm leading-relaxed">
                    {selectedMarker.description || 'No description provided'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6 text-center">
            <Settings className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <h3 className="text-lg font-medium text-neutral-700 mb-2">Panel Not Found</h3>
            <p className="text-neutral-500 text-sm">
              The requested panel is not available
            </p>
          </div>
        )
    }
  }, [
    activePanel, expandedSections, toggleSection, filters, filteredReports, filterStats,
    filterPresets, updateFilter, updateNestedFilter, clearFilters, hasActiveFilters,
    applyDatePreset, saveFilterPreset, loadFilterPreset, deleteFilterPreset, isFiltering,
    safeZones, safeZonesLoading, safeZoneStats, categorizedZones, onSafeZoneSelect,
    userLocation, routes, routeLoading, routeStatistics, recommendations, quotaWarnings,
    routingAvailable, hasRoutes, onRouteSelect, calculateRoute, clearRoute, selectedMarker,
    performanceMetrics
  ])

  // Panel tabs
  const availablePanels = useMemo(() => {
    const panels = [PANELS.filters, PANELS.safezones]
    
    // Add routes panel if routing is available
    if (routingAvailable) {
      panels.push(PANELS.routes)
    }
    
    panels.push(PANELS.analytics)
    
    // Add details panel if a marker is selected
    if (selectedMarker) {
      panels.push(PANELS.details)
    }
    
    return panels
  }, [routingAvailable, selectedMarker])

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-[998]"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-neutral-50 shadow-xl z-[999] transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:shadow-none lg:border-l lg:border-neutral-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } ${className}`}
      >
        {/* Header */}
        <div className="bg-white border-b border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-800">
              {PANELS[activePanel]?.title || 'Map Controls'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors lg:hidden"
            >
              <X className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
          
          {/* Panel Description */}
          <p className="text-sm text-neutral-600 mt-1">
            {PANELS[activePanel]?.description || 'Manage map settings and view information'}
          </p>
        </div>

        {/* Panel Tabs */}
        <div className="bg-white border-b border-neutral-200 px-4 py-2">
          <div className="flex space-x-1 overflow-x-auto">
            {availablePanels.map((panel) => {
              const Icon = panel.icon
              const isActive = activePanel === panel.id
              
              return (
                <button
                  key={panel.id}
                  onClick={() => handlePanelClick(panel.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? `${panel.color} text-white shadow-md`
                      : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{panel.title}</span>
                  
                  {/* Notification badges */}
                  {panel.id === 'routes' && hasRoutes && (
                    <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                      {routes.alternatives ? routes.alternatives.length + 1 : 1}
                    </span>
                  )}
                  {panel.id === 'safezones' && safeZones.length > 0 && (
                    <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                      {safeZones.length}
                    </span>
                  )}
                  {panel.id === 'filters' && hasActiveFilters && (
                    <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                      •
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderPanelContent}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-neutral-200 p-4">
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <span>
              {filteredReports.length} reports • {safeZones.length} safe zones
            </span>
            <div className="flex items-center space-x-2">
              {routingAvailable && (
                <span className="flex items-center space-x-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  <span className="text-xs">Routes</span>
                </span>
              )}
              <span className="text-xs text-neutral-400">
                v{process.env.REACT_APP_VERSION || '1.0.0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

// Add display name for debugging
MapSidebar.displayName = 'MapSidebar'

export default MapSidebar