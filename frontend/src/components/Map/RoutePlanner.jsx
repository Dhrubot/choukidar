// === frontend/src/components/Map/RoutePlanner.jsx ===
/**
 * Route Planner Component for SafeStreets Bangladesh
 * DECOUPLED from Safe Zone Service - can be enabled/disabled independently
 * Consistent with existing SafeStreets styling patterns
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  Navigation, Route, MapPin, Clock, Shield, AlertTriangle,
  Settings, Zap, TrendingUp, Users, RefreshCw, X, ChevronDown,
  CheckCircle, XCircle, Info, BarChart3, Car, Bike, Footprints
} from 'lucide-react'
import { useRouting, useRouteComparison, useRouteMonitoring } from '../../hooks/useRouting'
import { getQuotaStatus, isQuotaLow } from '../../services/requestManager'

const RoutePlanner = ({ 
  reports = [], 
  userLocation = null,
  onRouteSelect = null,
  onRouteHover = null,
  className = "",
  showAdvanced = true,
  enableMonitoring = true,
  defaultTransportMode = 'walking'
}) => {
  // Routing state
  const {
    routes,
    loading,
    error,
    routeStatistics,
    recommendations,
    quotaWarnings,
    calculateRoute,
    setRouteEndpoints,
    clearRoute,
    refreshRoute,
    setTransportMode,
    isAvailable,
    isEnabled,
    hasRoutes,
    hasAlternatives
  } = useRouting({
    enabled: true,
    transportMode: defaultTransportMode,
    maxAlternatives: 2
  })

  // UI state
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [showRouteDetails, setShowRouteDetails] = useState(true)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [transportMode, setTransportModeState] = useState(defaultTransportMode)
  const [timeOfDay, setTimeOfDay] = useState('current')
  const [avoidRecentIncidents, setAvoidRecentIncidents] = useState(true)
  const [showQuotaInfo, setShowQuotaInfo] = useState(false)

  // Route comparison for alternatives
  const routeIds = useMemo(() => {
    if (!routes) return []
    const ids = [routes.primary?.id].filter(Boolean)
    if (routes.alternatives) {
      ids.push(...routes.alternatives.map(alt => alt.id))
    }
    return ids
  }, [routes])

  const { comparison } = useRouteComparison(routeIds, routes)

  // Route monitoring
  const activeRoute = useMemo(() => {
    if (!routes || !selectedRouteId) return routes?.primary || null
    return routes.alternatives?.find(r => r.id === selectedRouteId) || routes.primary
  }, [routes, selectedRouteId])

  const {
    progress,
    nearbyIncidents,
    routeAlerts,
    estimatedArrival,
    isOnRoute
  } = useRouteMonitoring(activeRoute, userLocation, reports)

  // Transport mode options
  const transportModes = [
    { id: 'walking', label: 'Walking', icon: Footprints, description: 'Pedestrian routes' },
    { id: 'rickshaw', label: 'Rickshaw', icon: Bike, description: 'Rickshaw-friendly routes' },
    { id: 'bus', label: 'Bus/Car', icon: Car, description: 'Vehicle routes' }
  ]

  // Handle coordinate input (simplified - could be enhanced with geocoding)
  const handleCalculateRoute = useCallback(async () => {
    if (!startInput || !endInput) {
      alert('Please enter both start and end locations')
      return
    }

    // Simple coordinate parsing (format: "lat,lng")
    const parseCoords = (input) => {
      const parts = input.split(',').map(p => parseFloat(p.trim()))
      return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? [parts[1], parts[0]] : null
    }

    const startCoords = parseCoords(startInput)
    const endCoords = parseCoords(endInput)

    if (!startCoords || !endCoords) {
      alert('Please enter coordinates in format: lat,lng (e.g., 23.8103, 90.4125)')
      return
    }

    await calculateRoute(startCoords, endCoords, {
      transportMode,
      timeOfDay,
      reports,
      avoidRecentIncidents
    })
  }, [startInput, endInput, transportMode, timeOfDay, reports, avoidRecentIncidents, calculateRoute])

  // Handle transport mode change
  const handleTransportModeChange = useCallback((mode) => {
    setTransportModeState(mode)
    setTransportMode(mode)
  }, [setTransportMode])

  // Handle route selection
  const handleRouteSelect = useCallback((route) => {
    setSelectedRouteId(route.id)
    if (onRouteSelect) {
      onRouteSelect(route)
    }
  }, [onRouteSelect])

  // Get safety color for scores
  const getSafetyColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // Format duration
  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  // Format distance
  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(1)}km`
  }

  if (!isAvailable) {
    return (
      <div className={`route-planner-container ${className}`}>
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 p-6">
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Route Planning Unavailable</h3>
            <p className="text-neutral-600 mb-4">
              Route planning service is currently disabled or API quota exceeded.
            </p>
            {quotaWarnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-yellow-800">
                  {quotaWarnings.map((warning, index) => (
                    <div key={index}>{warning.message}</div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`route-planner-container ${className}`}>
      {/* Route Planning Interface */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200 mb-4">
        <div className="bg-blue-600 p-4 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center justify-between">
            <span className="flex items-center">
              <Navigation className="w-5 h-5 mr-2" />
              Route Planner
            </span>
            {isQuotaLow('directions', 0.2) && (
              <button
                onClick={() => setShowQuotaInfo(!showQuotaInfo)}
                className="text-yellow-200 hover:text-white"
                title="Quota warning"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            )}
          </h3>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Quota Warning */}
          {showQuotaInfo && isQuotaLow('directions', 0.2) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center space-x-2 text-yellow-800">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">API Quota Warning</span>
              </div>
              <div className="text-sm text-yellow-700 mt-1">
                Route calculations are limited. Some features may be unavailable.
              </div>
            </div>
          )}

          {/* Route Input */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Start Location (lat, lng)
              </label>
              <input
                type="text"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                placeholder="23.8103, 90.4125"
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                End Location (lat, lng)
              </label>
              <input
                type="text"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                placeholder="23.7500, 90.3750"
                className="w-full p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Transport Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Transport Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {transportModes.map((mode) => {
                const IconComponent = mode.icon
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleTransportModeChange(mode.id)}
                    className={`p-3 rounded-lg border transition-colors ${
                      transportMode === mode.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 mx-auto mb-1" />
                    <div className="text-xs font-medium">{mode.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="border-t border-neutral-200 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Time of Day
                  </label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="current">Current Time</option>
                    <option value="morning">Morning (6AM-12PM)</option>
                    <option value="afternoon">Afternoon (12PM-6PM)</option>
                    <option value="evening">Evening (6PM-10PM)</option>
                    <option value="night">Night (10PM-6AM)</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="avoidIncidents"
                    checked={avoidRecentIncidents}
                    onChange={(e) => setAvoidRecentIncidents(e.target.checked)}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="avoidIncidents" className="text-sm text-neutral-700">
                    Avoid recent incidents
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleCalculateRoute}
              disabled={loading || !startInput || !endInput}
              className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              <span>{loading ? 'Calculating...' : 'Find Safe Route'}</span>
            </button>
            
            {hasRoutes && (
              <button
                onClick={clearRoute}
                className="px-4 py-3 bg-neutral-500 text-white rounded-lg hover:bg-neutral-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-white rounded-xl shadow-md border border-red-200 mb-4 p-4">
          <div className="flex items-center space-x-3 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Route Calculation Failed</span>
          </div>
          <p className="text-red-700 mt-2 text-sm">{error}</p>
          <button
            onClick={refreshRoute}
            className="mt-3 btn-secondary text-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Route Monitoring (when user is on route) */}
      {enableMonitoring && isOnRoute && activeRoute && (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200 mb-4">
          <div className="bg-green-600 p-4 rounded-t-xl">
            <h3 className="font-bold text-white flex items-center">
              <Route className="w-5 h-5 mr-2" />
              Route Progress
            </h3>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm text-neutral-600 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            {/* ETA */}
            {estimatedArrival && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">Estimated Arrival:</span>
                <span className="font-medium">{estimatedArrival.toLocaleTimeString()}</span>
              </div>
            )}

            {/* Route Alerts */}
            {routeAlerts.length > 0 && (
              <div className="space-y-2">
                {routeAlerts.map((alert, index) => (
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

      {/* Route Results */}
      {hasRoutes && (
        <div className="space-y-4">
          {/* Route Statistics */}
          {routeStatistics && (
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-purple-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Route Overview
                </h3>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatDistance(routeStatistics.totalDistance)}
                    </div>
                    <div className="text-sm text-neutral-600">Distance</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatDuration(routeStatistics.estimatedDuration)}
                    </div>
                    <div className="text-sm text-neutral-600">Duration</div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getSafetyColor(routeStatistics.primarySafetyScore).split(' ')[0]}`}>
                      {routeStatistics.primarySafetyScore.toFixed(1)}
                    </div>
                    <div className="text-sm text-neutral-600">Safety Score</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {routeStatistics.totalRoutes}
                    </div>
                    <div className="text-sm text-neutral-600">Routes Found</div>
                  </div>
                </div>

                {/* Transport Mode & Time */}
                <div className="mt-4 pt-4 border-t border-neutral-200 flex items-center justify-between text-sm text-neutral-600">
                  <span>Transport: {routeStatistics.transportMode}</span>
                  <span>Calculated: {routeStatistics.lastCalculated?.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Primary Route */}
          <div className="bg-white rounded-xl shadow-md border border-neutral-200">
            <div className="bg-bangladesh-green p-4 rounded-t-xl">
              <h3 className="font-bold text-white flex items-center justify-between">
                <span className="flex items-center">
                  <Route className="w-5 h-5 mr-2" />
                  Primary Route
                </span>
                {routes.primary?.isFallback && (
                  <span className="text-xs bg-white/20 px-2 py-1 rounded">
                    Fallback
                  </span>
                )}
              </h3>
            </div>
            
            <div className="p-4">
              {routes.primary && (
                <RouteCard 
                  route={routes.primary}
                  isSelected={selectedRouteId === routes.primary.id || !selectedRouteId}
                  onSelect={() => handleRouteSelect(routes.primary)}
                  showDetails={showRouteDetails}
                  isPrimary={true}
                />
              )}
            </div>
          </div>

          {/* Alternative Routes */}
          {hasAlternatives && (
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-orange-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Alternative Routes ({routes.alternatives.length})
                </h3>
              </div>
              
              <div className="divide-y divide-neutral-200">
                {routes.alternatives.map((route, index) => (
                  <div key={route.id} className="p-4">
                    <RouteCard 
                      route={route}
                      isSelected={selectedRouteId === route.id}
                      onSelect={() => handleRouteSelect(route)}
                      showDetails={showRouteDetails}
                      isAlternative={true}
                      alternativeIndex={index + 1}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Comparison */}
          {comparison && comparison.routes.length > 1 && (
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-indigo-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Route Comparison
                </h3>
              </div>
              
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-green-700 mb-1">Safest Route</div>
                    <div className="font-bold text-green-800">
                      {comparison.metrics.safest.safetyAnalysis?.overallScore.toFixed(1)}/10
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-700 mb-1">Shortest Route</div>
                    <div className="font-bold text-blue-800">
                      {formatDistance(comparison.metrics.shortest.distance)}
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm text-purple-700 mb-1">Fastest Route</div>
                    <div className="font-bold text-purple-800">
                      {formatDuration(comparison.metrics.fastest.duration)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-neutral-200">
              <div className="bg-yellow-600 p-4 rounded-t-xl">
                <h3 className="font-bold text-white flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Safety Recommendations
                </h3>
              </div>
              
              <div className="p-4">
                <ul className="space-y-2">
                  {recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-yellow-600 mt-0.5">•</span>
                      <span className="text-neutral-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Toggle Details */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowRouteDetails(!showRouteDetails)}
              className="flex items-center space-x-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              <span>{showRouteDetails ? 'Hide' : 'Show'} Route Details</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showRouteDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Route Card Component
const RouteCard = ({ 
  route, 
  isSelected, 
  onSelect, 
  showDetails, 
  isPrimary = false, 
  isAlternative = false, 
  alternativeIndex = 0 
}) => {
  const getSafetyColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100'
    if (score >= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(1)}km`
  }

  const formatDuration = (seconds) => {
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const safetyScore = route.safetyAnalysis?.overallScore || 0

  return (
    <div 
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:border-neutral-300'
      }`}
      onClick={onSelect}
    >
      {/* Route Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isPrimary && <span className="text-green-600 font-medium text-sm">Primary</span>}
          {isAlternative && <span className="text-orange-600 font-medium text-sm">Alternative {alternativeIndex}</span>}
          {route.isFallback && <span className="text-neutral-500 text-sm">(Fallback)</span>}
        </div>
        
        <div className={`px-2 py-1 rounded text-sm font-medium ${getSafetyColor(safetyScore)}`}>
          {safetyScore.toFixed(1)}/10
        </div>
      </div>

      {/* Route Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900">
            {formatDistance(route.distance)}
          </div>
          <div className="text-xs text-neutral-600">Distance</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900">
            {formatDuration(route.duration)}
          </div>
          <div className="text-xs text-neutral-600">Duration</div>
        </div>
        
        <div className="text-center">
          <div className={`text-lg font-bold ${getSafetyColor(safetyScore).split(' ')[0]}`}>
            {route.safetyAnalysis?.breakdown?.incidents?.incidentCount || 0}
          </div>
          <div className="text-xs text-neutral-600">Incidents</div>
        </div>
      </div>

      {/* Safety Analysis Details */}
      {showDetails && route.safetyAnalysis?.breakdown && (
        <div className="space-y-3 pt-3 border-t border-neutral-200">
          <div className="text-sm font-medium text-neutral-700">Safety Breakdown:</div>
          
          {/* Safety Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-500">Incident Density:</span>
              <span className="font-medium">
                {route.safetyAnalysis.breakdown.incidents?.score?.toFixed(1) || 'N/A'}/10
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-neutral-500">Safe Zones:</span>
              <span className="font-medium">
                {route.safetyAnalysis.breakdown.safeZones?.nearbyZones?.length || 0}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-neutral-500">Police Proximity:</span>
              <span className="font-medium">
                {route.safetyAnalysis.breakdown.infrastructure?.policeScore?.toFixed(1) || 'N/A'}/10
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-neutral-500">Lighting Score:</span>
              <span className="font-medium">
                {route.safetyAnalysis.breakdown.infrastructure?.lightingScore?.toFixed(1) || 'N/A'}/10
              </span>
            </div>
          </div>

          {/* Recent Incidents Warning */}
          {route.safetyAnalysis.breakdown.incidents?.recentIncidents > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <div className="flex items-center space-x-1 text-yellow-800 text-xs">
                <AlertTriangle className="w-3 h-3" />
                <span>
                  {route.safetyAnalysis.breakdown.incidents.recentIncidents} recent incident(s) along this route
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div className="flex items-center justify-center mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-center space-x-1 text-blue-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Selected Route</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoutePlanner