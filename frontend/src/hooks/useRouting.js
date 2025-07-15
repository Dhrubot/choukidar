// === frontend/src/hooks/useRouting.js ===
/**
 * React Hook for Route Safety Intelligence
 * DECOUPLED from Safe Zone Service - can be enabled/disabled independently
 * Optimized for performance and cost management
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDebounce } from 'use-debounce'
import routingService from '../services/routingService'
import { getQuotaStatus, isQuotaLow } from '../services/requestManager'

/**
 * Custom hook for safe route calculation
 * @param {Object} options - Configuration options
 * @returns {Object} Routing data and methods
 */
export const useRouting = (options = {}) => {
  // Configuration with defaults
  const config = {
    enabled: true,
    autoCalculate: false,
    debounceMs: 1000,
    maxAlternatives: 2,
    transportMode: 'walking',
    ...options
  }

  // Core state
  const [routes, setRoutes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Route calculation state
  const [startCoords, setStartCoords] = useState(null)
  const [endCoords, setEndCoords] = useState(null)
  const [routeOptions, setRouteOptions] = useState(config)

  // Service status
  const [serviceStatus, setServiceStatus] = useState(null)
  const [quotaStatus, setQuotaStatus] = useState(null)

  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState({
    totalRequests: 0,
    cacheHits: 0,
    apiCalls: 0,
    averageResponseTime: 0,
    quotaUsage: 0
  })

  // Refs for cleanup
  const abortControllerRef = useRef(null)
  const statusCheckIntervalRef = useRef(null)

  // Debounced coordinates to prevent excessive API calls
  const [debouncedStartCoords] = useDebounce(startCoords, config.debounceMs)
  const [debouncedEndCoords] = useDebounce(endCoords, config.debounceMs)

  // Check service status periodically
  useEffect(() => {
    const checkStatus = () => {
      setServiceStatus(routingService.getStatus())
      setQuotaStatus(getQuotaStatus())
    }

    checkStatus() // Initial check
    
    statusCheckIntervalRef.current = setInterval(checkStatus, 30000) // Every 30 seconds

    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
      }
    }
  }, [])

  // Auto-calculate routes when coordinates change (if enabled)
  useEffect(() => {
    if (config.autoCalculate && 
        debouncedStartCoords && 
        debouncedEndCoords && 
        config.enabled &&
        routingService.isAvailable()) {
      calculateRoute(debouncedStartCoords, debouncedEndCoords, routeOptions)
    }
  }, [debouncedStartCoords, debouncedEndCoords, config.autoCalculate, config.enabled])

  // Calculate safe route
  const calculateRoute = useCallback(async (start, end, options = {}) => {
    if (!routingService.isAvailable()) {
      setError('Routing service not available')
      return null
    }

    if (!start || !end || start.length !== 2 || end.length !== 2) {
      setError('Invalid coordinates provided')
      return null
    }

    if (isCalculating) {
      console.log('⚠️ Route calculation already in progress')
      return null
    }

    setIsCalculating(true)
    setLoading(true)
    setError(null)

    // Cancel previous calculation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const startTime = performance.now()

    try {
      console.log('🗺️ Calculating safe route...', {
        start,
        end,
        transportMode: options.transportMode || config.transportMode,
        enabled: config.enabled
      })

      const routeData = await routingService.calculateSafeRoute(start, end, {
        transportMode: options.transportMode || config.transportMode,
        maxAlternatives: options.maxAlternatives || config.maxAlternatives,
        reports: options.reports || [],
        timeOfDay: options.timeOfDay || 'current',
        avoidRecentIncidents: options.avoidRecentIncidents !== false
      })

      // Check if calculation was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return null
      }

      setRoutes(routeData)
      
      const responseTime = performance.now() - startTime
      setPerformanceStats(prev => ({
        totalRequests: prev.totalRequests + 1,
        cacheHits: prev.cacheHits + (routeData?.metadata?.fromCache ? 1 : 0),
        apiCalls: prev.apiCalls + (routeData?.metadata?.quotaUsed?.directions || 0),
        averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
        quotaUsage: routeData?.metadata?.quotaUsed?.remaining?.daily?.percentage || prev.quotaUsage
      }))

      console.log(`✅ Route calculated in ${responseTime.toFixed(2)}ms`)
      return routeData

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Route calculation failed:', err)
        setError(err.message)
      }
      return null
    } finally {
      setIsCalculating(false)
      setLoading(false)
    }
  }, [isCalculating, config.transportMode, config.maxAlternatives, config.enabled])

  // Set route endpoints
  const setRouteEndpoints = useCallback((start, end) => {
    setStartCoords(start)
    setEndCoords(end)
    setRoutes(null) // Clear previous routes
    setError(null)
  }, [])

  // Clear current route
  const clearRoute = useCallback(() => {
    setRoutes(null)
    setStartCoords(null)
    setEndCoords(null)
    setError(null)
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  // Refresh current route
  const refreshRoute = useCallback(() => {
    if (startCoords && endCoords) {
      setRoutes(null)
      calculateRoute(startCoords, endCoords, routeOptions)
    }
  }, [startCoords, endCoords, routeOptions, calculateRoute])

  // Enable/disable routing service
  const setEnabled = useCallback((enabled) => {
    routingService.setEnabled(enabled)
    setRouteOptions(prev => ({ ...prev, enabled }))
    
    if (!enabled) {
      clearRoute()
    }
    
    console.log(`🗺️ Routing ${enabled ? 'enabled' : 'disabled'}`)
  }, [clearRoute])

  // Set transport mode
  const setTransportMode = useCallback((mode) => {
    setRouteOptions(prev => ({ ...prev, transportMode: mode }))
    
    // Recalculate if we have coordinates
    if (startCoords && endCoords && config.enabled) {
      calculateRoute(startCoords, endCoords, { ...routeOptions, transportMode: mode })
    }
  }, [startCoords, endCoords, routeOptions, calculateRoute, config.enabled])

  // Set API key
  const setApiKey = useCallback((apiKey) => {
    routingService.setApiKey(apiKey)
    console.log('🔑 Routing API key updated')
  }, [])

  // Get route by ID
  const getRouteById = useCallback((routeId) => {
    if (!routes) return null
    
    if (routes.primary?.id === routeId) {
      return routes.primary
    }
    
    return routes.alternatives?.find(route => route.id === routeId) || null
  }, [routes])

  // Export current route
  const exportRoute = useCallback((routeId) => {
    return routingService.exportRoute(routeId)
  }, [])

  // Clear routing cache
  const clearCache = useCallback(() => {
    routingService.clearCache()
    setPerformanceStats(prev => ({
      ...prev,
      cacheHits: 0
    }))
    console.log('🗑️ Routing cache cleared')
  }, [])

  // Route statistics
  const routeStatistics = useMemo(() => {
    if (!routes) return null

    const primary = routes.primary
    const alternatives = routes.alternatives || []
    const allRoutes = [primary, ...alternatives]

    const stats = {
      totalRoutes: allRoutes.length,
      primarySafetyScore: primary?.safetyAnalysis?.overallScore || 0,
      averageSafetyScore: allRoutes.length > 0 ? 
        allRoutes.reduce((sum, route) => sum + (route.safetyAnalysis?.overallScore || 0), 0) / allRoutes.length : 0,
      safestRoute: allRoutes.reduce((safest, route) => 
        (route.safetyAnalysis?.overallScore || 0) > (safest?.safetyAnalysis?.overallScore || 0) ? route : safest
      , allRoutes[0]),
      shortestRoute: allRoutes.reduce((shortest, route) => 
        route.distance < (shortest?.distance || Infinity) ? route : shortest
      , allRoutes[0]),
      totalDistance: primary?.distance || 0,
      estimatedDuration: primary?.duration || 0,
      transportMode: routes.metadata?.transportMode || 'walking',
      hasAlternatives: alternatives.length > 0,
      lastCalculated: routes.metadata?.timestamp ? new Date(routes.metadata.timestamp) : null
    }

    return stats
  }, [routes])

  // Route recommendations
  const recommendations = useMemo(() => {
    if (!routes?.primary?.safetyAnalysis) return []

    const analysis = routes.primary.safetyAnalysis
    const recs = [...(analysis.recommendations || [])]

    // Add performance-based recommendations
    if (isQuotaLow('directions', 0.2)) {
      recs.push('⚠️ API quota running low - route calculations may be limited')
    }

    if (routes.alternatives?.length > 0) {
      const safestAlt = routes.alternatives.reduce((safest, route) => 
        (route.safetyAnalysis?.overallScore || 0) > (safest?.safetyAnalysis?.overallScore || 0) ? route : safest
      )
      
      if (safestAlt.safetyAnalysis?.overallScore > routes.primary.safetyAnalysis.overallScore + 1) {
        recs.push(`💡 Consider alternative route with ${safestAlt.safetyAnalysis.overallScore.toFixed(1)}/10 safety score`)
      }
    }

    return recs
  }, [routes])

  // Service availability check
  const isAvailable = useMemo(() => {
    return config.enabled && 
           routingService.isAvailable() && 
           !isQuotaLow('directions', 0.05)
  }, [config.enabled, quotaStatus])

  // Quota warnings
  const quotaWarnings = useMemo(() => {
    const warnings = []
    
    if (isQuotaLow('directions', 0.1)) {
      warnings.push({
        type: 'quota',
        level: 'warning',
        message: 'Route calculation quota running low'
      })
    }
    
    if (isQuotaLow('directions', 0.05)) {
      warnings.push({
        type: 'quota',
        level: 'critical',
        message: 'Route calculations may be disabled soon due to quota limits'
      })
    }

    if (!serviceStatus?.apiKey || serviceStatus.apiKey === 'missing') {
      warnings.push({
        type: 'config',
        level: 'error',
        message: 'API key not configured - routing service unavailable'
      })
    }

    return warnings
  }, [serviceStatus, quotaStatus])

  return {
    // Core data
    routes,
    loading,
    error,
    isCalculating,

    // Route endpoints
    startCoords,
    endCoords,

    // Statistics and status
    routeStatistics,
    performanceStats,
    serviceStatus,
    quotaStatus,
    recommendations,
    quotaWarnings,

    // Methods
    calculateRoute,
    setRouteEndpoints,
    clearRoute,
    refreshRoute,
    setEnabled,
    setTransportMode,
    setApiKey,
    getRouteById,
    exportRoute,
    clearCache,

    // State checks
    hasRoutes: !!routes,
    hasAlternatives: routes?.alternatives?.length > 0,
    isAvailable,
    isEnabled: config.enabled,
    hasError: !!error,
    hasWarnings: quotaWarnings.length > 0
  }
}

/**
 * Hook for route comparison and analysis
 * @param {Array} routeIds - Array of route IDs to compare
 * @param {Object} routes - Routes object from useRouting
 */
export const useRouteComparison = (routeIds = [], routes = null) => {
  const [comparison, setComparison] = useState(null)

  useEffect(() => {
    if (!routes || routeIds.length === 0) {
      setComparison(null)
      return
    }

    try {
      const routesToCompare = []
      
      // Get primary route if included
      if (routeIds.includes(routes.primary?.id)) {
        routesToCompare.push(routes.primary)
      }
      
      // Get alternatives if included
      routes.alternatives?.forEach(alt => {
        if (routeIds.includes(alt.id)) {
          routesToCompare.push(alt)
        }
      })

      if (routesToCompare.length < 2) {
        setComparison(null)
        return
      }

      // Calculate comparison metrics
      const comparisonData = {
        routes: routesToCompare.map(route => ({
          id: route.id,
          distance: route.distance,
          duration: route.duration,
          safetyScore: route.safetyAnalysis?.overallScore || 0,
          incidentCount: route.safetyAnalysis?.breakdown?.incidents?.incidentCount || 0,
          nearbyZones: route.safetyAnalysis?.breakdown?.safeZones?.nearbyZones?.length || 0
        })),
        
        metrics: {
          safest: routesToCompare.reduce((safest, route) => 
            (route.safetyAnalysis?.overallScore || 0) > (safest?.safetyAnalysis?.overallScore || 0) ? route : safest
          ),
          shortest: routesToCompare.reduce((shortest, route) => 
            route.distance < shortest.distance ? route : shortest
          ),
          fastest: routesToCompare.reduce((fastest, route) => 
            route.duration < fastest.duration ? route : fastest
          )
        },
        
        differences: {
          maxSafetyDiff: Math.max(...routesToCompare.map(r => r.safetyAnalysis?.overallScore || 0)) - 
                        Math.min(...routesToCompare.map(r => r.safetyAnalysis?.overallScore || 0)),
          maxDistanceDiff: Math.max(...routesToCompare.map(r => r.distance)) - 
                          Math.min(...routesToCompare.map(r => r.distance)),
          maxTimeDiff: Math.max(...routesToCompare.map(r => r.duration)) - 
                      Math.min(...routesToCompare.map(r => r.duration))
        }
      }

      setComparison(comparisonData)

    } catch (error) {
      console.error('❌ Error comparing routes:', error)
      setComparison(null)
    }
  }, [routeIds, routes])

  return {
    comparison,
    hasComparison: !!comparison,
    routeCount: comparison?.routes?.length || 0
  }
}

/**
 * Hook for route monitoring and real-time updates
 * @param {Object} activeRoute - Currently active route
 * @param {Array} userLocation - Current user location [lng, lat]
 * @param {Array} reports - Crime reports for monitoring
 */
export const useRouteMonitoring = (activeRoute, userLocation, reports = []) => {
  const [progress, setProgress] = useState(0)
  const [nearbyIncidents, setNearbyIncidents] = useState([])
  const [routeAlerts, setRouteAlerts] = useState([])
  const [estimatedArrival, setEstimatedArrival] = useState(null)

  // Debounce location updates
  const [debouncedLocation] = useDebounce(userLocation, 5000) // 5 second intervals

  useEffect(() => {
    if (!activeRoute || !debouncedLocation || debouncedLocation.length !== 2) {
      setProgress(0)
      setNearbyIncidents([])
      setRouteAlerts([])
      setEstimatedArrival(null)
      return
    }

    try {
      // Calculate progress along route
      const routeLength = activeRoute.distance || 0
      const userPoint = { type: 'Point', coordinates: debouncedLocation }
      
      // This is a simplified progress calculation - could be enhanced with more precise geometry
      const startPoint = { type: 'Point', coordinates: activeRoute.geometry.coordinates[0] }
      const endPoint = { type: 'Point', coordinates: activeRoute.geometry.coordinates[activeRoute.geometry.coordinates.length - 1] }
      
      const totalDistance = routeLength
      const distanceFromStart = 0 // Would need proper calculation here
      const progressPercent = Math.min(100, (distanceFromStart / totalDistance) * 100)
      
      setProgress(progressPercent)

      // Check for nearby incidents
      const nearby = reports.filter(report => {
        if (!report.location?.coordinates) return false
        
        // Simple distance check - could be enhanced with route buffer analysis
        const reportPoint = { type: 'Point', coordinates: report.location.coordinates }
        // Calculate distance and check if within 200m of route
        return true // Simplified for now
      })

      setNearbyIncidents(nearby)

      // Generate alerts
      const alerts = []
      if (nearby.length > 0) {
        alerts.push({
          type: 'incident',
          message: `${nearby.length} incident(s) reported near your route`,
          severity: nearby.some(r => r.severity >= 4) ? 'high' : 'medium'
        })
      }

      setRouteAlerts(alerts)

      // Calculate estimated arrival
      const remainingDistance = routeLength * (1 - progressPercent / 100)
      const remainingTime = (activeRoute.duration || 0) * (1 - progressPercent / 100)
      
      if (remainingTime > 0) {
        const arrivalTime = new Date(Date.now() + remainingTime * 1000)
        setEstimatedArrival(arrivalTime)
      }

    } catch (error) {
      console.error('❌ Error monitoring route:', error)
    }
  }, [activeRoute, debouncedLocation, reports])

  return {
    progress,
    nearbyIncidents,
    routeAlerts,
    estimatedArrival,
    isOnRoute: progress > 0,
    hasIncidents: nearbyIncidents.length > 0,
    hasAlerts: routeAlerts.length > 0
  }
}

export default useRouting