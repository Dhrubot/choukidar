// === frontend/src/components/Map/SafeZones.jsx ===
/**
 * Safe Zones Component for SafeStreets Bangladesh
 * Displays safe zones on the map with interactive features
 * Consistent with existing SafeStreets styling and patterns
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  Shield, ShieldCheck, MapPin, Clock, Users, Star, 
  Info, AlertTriangle, CheckCircle, Eye, EyeOff,
  BarChart3, Navigation, Zap 
} from 'lucide-react'
import { useSafeZones, useSafeZoneMonitor } from '../../hooks/useSafeZones'

const SafeZones = ({ 
  reports = [], 
  userLocation = null, 
  onZoneSelect = null,
  onZoneHover = null,
  className = "",
  showControls = true,
  showStatistics = true,
  enableMonitoring = true
}) => {
  // Safe zone state
  const {
    safeZones,
    loading,
    error,
    statistics,
    categorizedZones,
    refresh,
    isPointInSafeZone,
    getNearbyZones,
    getAreaSafetyStats
  } = useSafeZones(reports, {
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    includeAdminZones: true,
    includeDynamicZones: true,
    minSafetyScore: 6.0
  })

  // Location monitoring
  const {
    currentZone,
    nearbyZones,
    safetyStats,
    alerts,
    isInSafeZone
  } = useSafeZoneMonitor(userLocation, reports, { 
    enabled: enableMonitoring 
  })

  // UI state
  const [selectedZone, setSelectedZone] = useState(null)
  const [showOnlyNearby, setShowOnlyNearby] = useState(false)
  const [filterBySafety, setFilterBySafety] = useState('all') // all, high, medium, low
  const [showDetails, setShowDetails] = useState(true)
  const [expandedSection, setExpandedSection] = useState('zones')

  // Filter zones based on UI state
  const filteredZones = useMemo(() => {
    let zones = safeZones

    // Filter by proximity if enabled
    if (showOnlyNearby && userLocation) {
      const nearby = getNearbyZones(userLocation, 2000) // 2km radius
      zones = zones.filter(zone => nearby.some(nz => nz.id === zone.id))
    }

    // Filter by safety level
    if (filterBySafety !== 'all') {
      zones = zones.filter(zone => {
        switch (filterBySafety) {
          case 'high': return zone.safetyScore >= 8
          case 'medium': return zone.safetyScore >= 6 && zone.safetyScore < 8
          case 'low': return zone.safetyScore < 6
          default: return true
        }
      })
    }

    return zones
  }, [safeZones, showOnlyNearby, filterBySafety, userLocation, getNearbyZones])

  // Handle zone selection
  const handleZoneSelect = useCallback((zone) => {
    setSelectedZone(zone)
    if (onZoneSelect) {
      onZoneSelect(zone)
    }
  }, [onZoneSelect])

  // Handle zone hover
  const handleZoneHover = useCallback((zone) => {
    if (onZoneHover) {
      onZoneHover(zone)
    }
  }, [onZoneHover])

  // Get safety color
  const getSafetyColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // Get zone type icon
  const getZoneTypeIcon = (type) => {
    switch (type) {
      case 'educational': return '🎓'
      case 'recreational': return '🌳'
      case 'public': return '🏛️'
      case 'commercial': return '🏪'
      case 'admin': return '⭐'
      case 'dynamic': return '🔍'
      default: return '📍'
    }
  }

  if (loading && safeZones.length === 0) {
    return (
      <div className={`safe-zones-container ${className}`}>
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-bangladesh-green"></div>
            <span className="text-neutral-600">Calculating safe zones...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`safe-zones-container ${className}`}>
        <div className="bg-white rounded-xl shadow-md border border-red-200 p-6">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Error loading safe zones: {error}</span>
          </div>
          <button
            onClick={refresh}
            className="mt-3 btn-secondary text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`safe-zones-container ${className}`}>
      {/* Current Location Status */}
      {enableMonitoring && userLocation && (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 mb-4">
          <div className="bg-bangladesh-green p-4 rounded-t-xl">
            <h3 className="font-bold text-white flex items-center">
              <Navigation className="w-5 h-5 mr-2" />
              Your Location Status
            </h3>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Current Zone Status */}
            <div className={`p-3 rounded-lg ${isInSafeZone ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
              <div className="flex items-center space-x-2">
                {isInSafeZone ? (
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <Shield className="w-5 h-5 text-yellow-600" />
                )}
                <span className={`font-medium ${isInSafeZone ? 'text-green-800' : 'text-yellow-800'}`}>
                  {isInSafeZone ? `In Safe Zone: ${currentZone?.name}` : 'Not in designated safe zone'}
                </span>
              </div>
              
              {currentZone && (
                <div className="mt-2 text-sm text-neutral-600">
                  <div className="flex items-center justify-between">
                    <span>Safety Score:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSafetyColor(currentZone.safetyScore)}`}>
                      {currentZone.safetyScore.toFixed(1)}/10
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Area Safety Stats */}
            {safetyStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 p-3 rounded-lg">
                  <div className="text-xs text-neutral-500 mb-1">Area Safety</div>
                  <div className={`text-lg font-bold ${getSafetyColor(safetyStats.safetyScore).split(' ')[0]}`}>
                    {safetyStats.safetyScore.toFixed(1)}/10
                  </div>
                </div>
                <div className="bg-neutral-50 p-3 rounded-lg">
                  <div className="text-xs text-neutral-500 mb-1">Nearby Safe Zones</div>
                  <div className="text-lg font-bold text-bangladesh-green">
                    {nearbyZones.length}
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="space-y-2">
                {alerts.map((alert, index) => (
                  <div key={index} className={`p-2 rounded text-sm border ${
                    alert.severity === 'high' ? 'bg-red-50 border-red-200 text-red-800' :
                    alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    {alert.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls and Filters */}
      {showControls && (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 mb-4">
          <div className="bg-purple-600 p-4 rounded-t-xl">
            <h3 className="font-bold text-white flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Safe Zone Controls
            </h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Safety Level Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Safety Level
                </label>
                <select
                  value={filterBySafety}
                  onChange={(e) => setFilterBySafety(e.target.value)}
                  className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
                >
                  <option value="all">All Zones</option>
                  <option value="high">High Safety (8+)</option>
                  <option value="medium">Medium Safety (6-8)</option>
                  <option value="low">Low Safety (&lt;6)</option>
                </select>
              </div>

              {/* Proximity Filter */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Location Filter
                </label>
                <button
                  onClick={() => setShowOnlyNearby(!showOnlyNearby)}
                  disabled={!userLocation}
                  className={`w-full p-2 rounded-lg border transition-colors ${
                    showOnlyNearby 
                      ? 'bg-bangladesh-green text-white border-bangladesh-green' 
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  } ${!userLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {showOnlyNearby ? 'Nearby Only' : 'Show All'}
                </button>
              </div>

              {/* Refresh Control */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Actions
                </label>
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="w-full p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Updating...' : 'Refresh Zones'}
                </button>
              </div>
            </div>

            {/* Toggle Details */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
              <span className="text-sm font-medium text-neutral-700">Show Details</span>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`p-2 rounded-lg transition-colors ${
                  showDetails ? 'text-bangladesh-green' : 'text-neutral-400'
                }`}
              >
                {showDetails ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Panel */}
      {showStatistics && statistics && (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 mb-4">
          <div className="bg-green-600 p-4 rounded-t-xl">
            <h3 className="font-bold text-white flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Safe Zone Statistics
            </h3>
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-bangladesh-green">
                  {statistics.totalZones}
                </div>
                <div className="text-sm text-neutral-600">Total Zones</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {statistics.averageSafetyScore.toFixed(1)}
                </div>
                <div className="text-sm text-neutral-600">Avg Safety</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {statistics.coverageArea}
                </div>
                <div className="text-sm text-neutral-600">km² Coverage</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {statistics.adminZones}
                </div>
                <div className="text-sm text-neutral-600">Verified</div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="text-sm font-medium text-neutral-700 mb-3">Safety Categories</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-green-600">
                    {categorizedZones.high.length}
                  </div>
                  <div className="text-xs text-green-700">High Safety</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-yellow-600">
                    {categorizedZones.medium.length}
                  </div>
                  <div className="text-xs text-yellow-700">Medium Safety</div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <div className="text-lg font-bold text-red-600">
                    {categorizedZones.low.length}
                  </div>
                  <div className="text-xs text-red-700">Low Safety</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe Zones List */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200">
        <div className="bg-bangladesh-green p-4 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center justify-between">
            <span className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Safe Zones ({filteredZones.length})
            </span>
            {filteredZones.length !== safeZones.length && (
              <span className="text-xs bg-white/20 px-2 py-1 rounded">
                Filtered
              </span>
            )}
          </h3>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {filteredZones.length === 0 ? (
            <div className="p-6 text-center text-neutral-500">
              <Shield className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <div className="text-lg font-medium mb-2">No Safe Zones Found</div>
              <div className="text-sm">
                {filterBySafety !== 'all' || showOnlyNearby 
                  ? 'Try adjusting your filters to see more zones'
                  : 'Safe zones will appear here once calculated'
                }
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-200">
              {filteredZones.map((zone, index) => (
                <div
                  key={zone.id}
                  className={`p-4 hover:bg-neutral-50 cursor-pointer transition-colors ${
                    selectedZone?.id === zone.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleZoneSelect(zone)}
                  onMouseEnter={() => handleZoneHover(zone)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Zone Header */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getZoneTypeIcon(zone.type)}</span>
                        <div>
                          <h4 className="font-medium text-neutral-900">{zone.name}</h4>
                          <div className="flex items-center space-x-3 text-sm text-neutral-600">
                            <span className="capitalize">{zone.type}</span>
                            {zone.verified && (
                              <span className="flex items-center text-green-600">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Safety Score */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-neutral-600">Safety Score:</span>
                        <div className={`px-2 py-1 rounded text-sm font-medium ${getSafetyColor(zone.safetyScore)}`}>
                          {zone.safetyScore.toFixed(1)}/10
                        </div>
                      </div>

                      {/* Zone Details */}
                      {showDetails && (
                        <div className="space-y-2 text-sm">
                          {/* Description */}
                          {zone.description && (
                            <p className="text-neutral-600 text-xs">{zone.description}</p>
                          )}

                          {/* Metrics */}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-neutral-500">Radius:</span>
                              <span className="font-medium">{zone.radius}m</span>
                            </div>
                            
                            {zone.incidentDensity !== undefined && (
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-500">Incidents:</span>
                                <span className="font-medium">{zone.incidentDensity.toFixed(2)}/km²</span>
                              </div>
                            )}
                          </div>

                          {/* Score Breakdown */}
                          {zone.scoreBreakdown && showDetails && selectedZone?.id === zone.id && (
                            <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
                              <div className="text-xs font-medium text-neutral-700 mb-2">Score Breakdown:</div>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span>Incident Density:</span>
                                  <span>{zone.scoreBreakdown.densityScore?.toFixed(1) || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Police Proximity:</span>
                                  <span>{zone.scoreBreakdown.policeScore?.toFixed(1) || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Lighting:</span>
                                  <span>{zone.scoreBreakdown.lightingScore?.toFixed(1) || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Time Factor:</span>
                                  <span>{zone.scoreBreakdown.timeScore?.toFixed(1) || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Time Restrictions */}
                          {zone.timeRestrictions && (
                            <div className="flex items-center space-x-1 text-xs text-orange-600">
                              <Clock className="w-3 h-3" />
                              <span>
                                Safe: {zone.timeRestrictions.startHour}:00 - {zone.timeRestrictions.endHour}:00
                              </span>
                            </div>
                          )}

                          {/* Distance from user */}
                          {userLocation && zone.distance !== undefined && (
                            <div className="flex items-center space-x-1 text-xs text-blue-600">
                              <Navigation className="w-3 h-3" />
                              <span>{Math.round(zone.distance)}m away</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-col space-y-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleZoneSelect(zone)
                        }}
                        className="p-1 text-neutral-400 hover:text-bangladesh-green transition-colors"
                        title="View details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      
                      {zone.verified && (
                        <div className="p-1 text-green-500" title="Verified safe zone">
                          <Star className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Info */}
      {statistics?.performance && showDetails && (
        <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Last calculated: {statistics.lastUpdated?.toLocaleTimeString()}</span>
            <span className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>{statistics.performance.calculationTime?.toFixed(0)}ms</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SafeZones