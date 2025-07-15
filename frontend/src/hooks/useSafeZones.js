// === frontend/src/hooks/useSafeZones.js ===
/**
 * React Hook for Safe Zone Intelligence
 * Provides React integration for the Safe Zone Service
 * Optimized for performance with caching and debouncing
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDebounce } from 'use-debounce'
import safeZoneService from '../services/safeZoneService'

/**
 * Custom hook for managing safe zones
 * @param {Array} reports - Array of crime reports
 * @param {Object} options - Configuration options
 * @returns {Object} Safe zone data and methods
 */
export const useSafeZones = (reports = [], options = {}) => {
  // Configuration with defaults
  const config = {
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    debounceMs: 500,
    enableRealtime: true,
    ...options
  }

  // State management
  const [safeZones, setSafeZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastCalculated, setLastCalculated] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState({
    calculationTime: 0,
    cacheHits: 0,
    totalCalculations: 0
  })

  // Refs for cleanup
  const refreshIntervalRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Debounced reports to prevent excessive calculations
  const [debouncedReports] = useDebounce(reports, config.debounceMs)

  // Memoized options to prevent unnecessary recalculations
  const memoizedOptions = useMemo(() => ({
    timeOfDay: config.timeOfDay || 'current',
    hour: config.hour,
    includeAdminZones: config.includeAdminZones !== false,
    includeDynamicZones: config.includeDynamicZones !== false,
    minSafetyScore: config.minSafetyScore || 7.0
  }), [config.timeOfDay, config.hour, config.includeAdminZones, config.includeDynamicZones, config.minSafetyScore])

  // Calculate safe zones
  const calculateSafeZones = useCallback(async () => {
    if (isCalculating) return
    
    setIsCalculating(true)
    setLoading(true)
    setError(null)

    // Cancel previous calculation if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const startTime = performance.now()

    try {
      console.log('🔄 Calculating safe zones...', {
        reportCount: debouncedReports.length,
        options: memoizedOptions
      })

      const zones = await safeZoneService.calculateSafeZones(
        debouncedReports,
        memoizedOptions
      )

      // Check if calculation was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      setSafeZones(zones)
      setLastCalculated(new Date())
      
      const calculationTime = performance.now() - startTime
      setPerformanceStats(prev => ({
        calculationTime,
        cacheHits: prev.cacheHits,
        totalCalculations: prev.totalCalculations + 1
      }))

      console.log(`✅ Safe zones calculated: ${zones.length} zones in ${calculationTime.toFixed(2)}ms`)

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Safe zone calculation failed:', err)
        setError(err.message)
      }
    } finally {
      setIsCalculating(false)
      setLoading(false)
    }
  }, [debouncedReports, memoizedOptions, isCalculating])

  // Auto-refresh effect
  useEffect(() => {
    if (config.autoRefresh) {
      calculateSafeZones()

      if (config.refreshInterval > 0) {
        refreshIntervalRef.current = setInterval(() => {
          console.log('🔄 Auto-refreshing safe zones...')
          calculateSafeZones()
        }, config.refreshInterval)
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [calculateSafeZones, config.autoRefresh, config.refreshInterval])

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log('🔄 Manual safe zone refresh triggered')
    calculateSafeZones()
  }, [calculateSafeZones])

  // Get safe zone by ID
  const getSafeZoneById = useCallback((id) => {
    return safeZones.find(zone => zone.id === id)
  }, [safeZones])

  // Check if point is in safe zone
  const isPointInSafeZone = useCallback((coordinates) => {
    if (!coordinates || coordinates.length !== 2) return null
    return safeZoneService.isPointInSafeZone(coordinates, debouncedReports, memoizedOptions)
  }, [debouncedReports, memoizedOptions])

  // Get nearby safe zones
  const getNearbyZones = useCallback((coordinates, maxDistance = 1000) => {
    if (!coordinates || coordinates.length !== 2) return []
    return safeZoneService.getNearbyZafeZones(coordinates, debouncedReports, maxDistance, memoizedOptions)
  }, [debouncedReports, memoizedOptions])

  // Get area safety statistics
  const getAreaSafetyStats = useCallback((coordinates, radius = 500) => {
    if (!coordinates || coordinates.length !== 2) return null
    return safeZoneService.getAreaSafetyStats(coordinates, radius, debouncedReports)
  }, [debouncedReports])

  // Clear cache
  const clearCache = useCallback(() => {
    safeZoneService.clearCache()
    setPerformanceStats(prev => ({
      ...prev,
      cacheHits: 0
    }))
    console.log('🗑️ Safe zone cache cleared')
  }, [])

  // Export safe zones
  const exportSafeZones = useCallback(() => {
    return safeZoneService.exportSafeZones(debouncedReports)
  }, [debouncedReports])

  // Get statistics
  const statistics = useMemo(() => {
    const adminZones = safeZones.filter(zone => zone.type !== 'dynamic')
    const dynamicZones = safeZones.filter(zone => zone.type === 'dynamic')
    
    const avgSafetyScore = safeZones.length > 0 ? 
      safeZones.reduce((sum, zone) => sum + zone.safetyScore, 0) / safeZones.length : 0

    const coverageArea = safeZones.reduce((total, zone) => {
      return total + (Math.PI * Math.pow(zone.radius, 2))
    }, 0) / 1000000 // Convert to km²

    return {
      totalZones: safeZones.length,
      adminZones: adminZones.length,
      dynamicZones: dynamicZones.length,
      averageSafetyScore: Math.round(avgSafetyScore * 10) / 10,
      coverageArea: Math.round(coverageArea * 100) / 100, // km²
      lastUpdated: lastCalculated,
      performance: performanceStats
    }
  }, [safeZones, lastCalculated, performanceStats])

  // Categorize zones by safety level
  const categorizedZones = useMemo(() => {
    const categories = {
      high: safeZones.filter(zone => zone.safetyScore >= 8),
      medium: safeZones.filter(zone => zone.safetyScore >= 6 && zone.safetyScore < 8),
      low: safeZones.filter(zone => zone.safetyScore < 6)
    }

    return categories
  }, [safeZones])

  // Get zones by type
  const zonesByType = useMemo(() => {
    const types = {}
    safeZones.forEach(zone => {
      if (!types[zone.type]) {
        types[zone.type] = []
      }
      types[zone.type].push(zone)
    })
    return types
  }, [safeZones])

  return {
    // Core data
    safeZones,
    loading,
    error,
    lastCalculated,
    isCalculating,

    // Statistics
    statistics,
    categorizedZones,
    zonesByType,

    // Methods
    refresh,
    getSafeZoneById,
    isPointInSafeZone,
    getNearbyZones,
    getAreaSafetyStats,
    clearCache,
    exportSafeZones,

    // State
    hasZones: safeZones.length > 0,
    isEmpty: safeZones.length === 0 && !loading,
    hasError: !!error
  }
}

/**
 * Hook for real-time safe zone monitoring
 * @param {Array} coordinates - Location to monitor
 * @param {Array} reports - Crime reports
 * @param {Object} options - Configuration options
 */
export const useSafeZoneMonitor = (coordinates, reports = [], options = {}) => {
  const [currentZone, setCurrentZone] = useState(null)
  const [nearbyZones, setNearbyZones] = useState([])
  const [safetyStats, setSafetyStats] = useState(null)
  const [alerts, setAlerts] = useState([])

  // Debounce coordinates to prevent excessive calculations
  const [debouncedCoordinates] = useDebounce(coordinates, 1000)

  // Monitor location changes
  useEffect(() => {
    if (!debouncedCoordinates || debouncedCoordinates.length !== 2) {
      setCurrentZone(null)
      setNearbyZones([])
      setSafetyStats(null)
      return
    }

    const checkLocation = async () => {
      try {
        // Check if in safe zone
        const zone = safeZoneService.isPointInSafeZone(debouncedCoordinates, reports, options)
        setCurrentZone(zone)

        // Get nearby zones
        const nearby = safeZoneService.getNearbyZafeZones(debouncedCoordinates, reports, 1000, options)
        setNearbyZones(nearby)

        // Get safety statistics
        const stats = safeZoneService.getAreaSafetyStats(debouncedCoordinates, 500, reports)
        setSafetyStats(stats)

        // Generate alerts
        const newAlerts = []
        if (stats && stats.safetyScore < 5) {
          newAlerts.push({
            id: 'low-safety',
            type: 'warning',
            message: 'You are in an area with low safety score',
            severity: 'medium'
          })
        }

        if (stats && stats.incidentCount > 3) {
          newAlerts.push({
            id: 'high-incidents',
            type: 'warning',
            message: `${stats.incidentCount} incidents reported in this area`,
            severity: 'high'
          })
        }

        if (nearby.length === 0) {
          newAlerts.push({
            id: 'no-safe-zones',
            type: 'info',
            message: 'No safe zones nearby - exercise caution',
            severity: 'low'
          })
        }

        setAlerts(newAlerts)

      } catch (error) {
        console.error('❌ Error monitoring safe zones:', error)
      }
    }

    checkLocation()
  }, [debouncedCoordinates, reports, options])

  return {
    currentZone,
    nearbyZones,
    safetyStats,
    alerts,
    isInSafeZone: !!currentZone,
    hasNearbyZones: nearbyZones.length > 0,
    hasAlerts: alerts.length > 0
  }
}

/**
 * Hook for admin safe zone management
 */
export const useAdminSafeZones = () => {
  const [adminZones, setAdminZones] = useState([])
  const [policeStations, setPoliceStations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load initial data
  useEffect(() => {
    try {
      setAdminZones(safeZoneService.adminSafeZones)
      setPoliceStations(safeZoneService.policeStations)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  // Add admin safe zone
  const addAdminZone = useCallback(async (zoneData) => {
    setLoading(true)
    setError(null)

    try {
      const newZone = {
        id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        verified: true,
        type: 'admin',
        ...zoneData
      }

      const updatedZones = [...adminZones, newZone]
      safeZoneService.saveAdminSafeZones(updatedZones)
      setAdminZones(updatedZones)

      console.log('✅ Admin safe zone added:', newZone.id)
      return newZone
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [adminZones])

  // Update admin safe zone
  const updateAdminZone = useCallback(async (zoneId, updates) => {
    setLoading(true)
    setError(null)

    try {
      const updatedZones = adminZones.map(zone => 
        zone.id === zoneId ? { ...zone, ...updates } : zone
      )

      safeZoneService.saveAdminSafeZones(updatedZones)
      setAdminZones(updatedZones)

      console.log('✅ Admin safe zone updated:', zoneId)
      return updatedZones.find(zone => zone.id === zoneId)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [adminZones])

  // Delete admin safe zone
  const deleteAdminZone = useCallback(async (zoneId) => {
    setLoading(true)
    setError(null)

    try {
      const updatedZones = adminZones.filter(zone => zone.id !== zoneId)
      safeZoneService.saveAdminSafeZones(updatedZones)
      setAdminZones(updatedZones)

      console.log('✅ Admin safe zone deleted:', zoneId)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [adminZones])

  // Add police station
  const addPoliceStation = useCallback(async (stationData) => {
    setLoading(true)
    setError(null)

    try {
      const newStation = {
        id: `police_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'main',
        effectiveness: 0.8,
        responseTime: 10,
        ...stationData
      }

      const updatedStations = [...policeStations, newStation]
      safeZoneService.savePoliceStations(updatedStations)
      setPoliceStations(updatedStations)

      console.log('✅ Police station added:', newStation.id)
      return newStation
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [policeStations])

  // Update police station
  const updatePoliceStation = useCallback(async (stationId, updates) => {
    setLoading(true)
    setError(null)

    try {
      const updatedStations = policeStations.map(station => 
        station.id === stationId ? { ...station, ...updates } : station
      )

      safeZoneService.savePoliceStations(updatedStations)
      setPoliceStations(updatedStations)

      console.log('✅ Police station updated:', stationId)
      return updatedStations.find(station => station.id === stationId)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [policeStations])

  // Delete police station
  const deletePoliceStation = useCallback(async (stationId) => {
    setLoading(true)
    setError(null)

    try {
      const updatedStations = policeStations.filter(station => station.id !== stationId)
      safeZoneService.savePoliceStations(updatedStations)
      setPoliceStations(updatedStations)

      console.log('✅ Police station deleted:', stationId)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [policeStations])

  return {
    // Data
    adminZones,
    policeStations,
    loading,
    error,

    // Safe zone methods
    addAdminZone,
    updateAdminZone,
    deleteAdminZone,

    // Police station methods
    addPoliceStation,
    updatePoliceStation,
    deletePoliceStation,

    // Utility methods
    clearCache: () => safeZoneService.clearCache(),
    exportData: () => ({
      adminZones,
      policeStations,
      timestamp: new Date().toISOString()
    }),
    importData: (data) => {
      if (data.adminZones) setAdminZones(data.adminZones)
      if (data.policeStations) setPoliceStations(data.policeStations)
    }
  }
}

export default useSafeZones