// === frontend/src/hooks/useMapState.js ===
/**
 * useMapState Hook - Centralized Map State Management
 * Handles map center, zoom, view modes, and layer options
 * Persists state to localStorage for user preferences
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

// Default map configuration for Bangladesh
const DEFAULT_MAP_STATE = {
  center: [23.8103, 90.4125], // Dhaka coordinates
  zoom: 11,
  viewMode: 'clusters', // markers, clusters, heatmap, hybrid
  heatmapOptions: {
    radius: 25,
    blur: 15,
    maxZoom: 18,
    gradient: {
      0.0: 'green',
      0.5: 'yellow', 
      1.0: 'red'
    }
  },
  clusteringOptions: {
    enableBengaliNumerals: false,
    showTypeIndicator: true,
    showRiskBadge: true,
    enableAnimations: true,
    chunkedLoading: true,
    maxMarkersBeforeCluster: 50,
    animateAddingMarkers: false,
    zoomThresholds: {
      6: { radius: 100, maxZoom: 8 },
      8: { radius: 70, maxZoom: 10 },
      10: { radius: 45, maxZoom: 12 },
      12: { radius: 30, maxZoom: 14 },
      14: { radius: 20, maxZoom: 16 }
    }
  }
}

// Storage keys
const STORAGE_KEYS = {
  MAP_STATE: 'safestreets_map_state',
  USER_LOCATION: 'safestreets_user_location',
  VIEW_PREFERENCES: 'safestreets_view_preferences'
}

/**
 * useMapState Hook
 * @param {Object} options - Configuration options
 * @param {Array} options.defaultCenter - Default map center coordinates
 * @param {number} options.defaultZoom - Default zoom level
 * @param {string} options.defaultViewMode - Default view mode
 * @param {boolean} options.persistState - Whether to persist state to localStorage
 * @param {boolean} options.trackUserLocation - Whether to track user location
 * @returns {Object} Map state and control functions
 */
const useMapState = (options = {}) => {
  const {
    defaultCenter = DEFAULT_MAP_STATE.center,
    defaultZoom = DEFAULT_MAP_STATE.zoom,
    defaultViewMode = DEFAULT_MAP_STATE.viewMode,
    persistState = true,
    trackUserLocation = true
  } = options

  // Initialize state from localStorage or defaults
  const [mapState, setMapState] = useState(() => {
    if (!persistState) {
      return {
        ...DEFAULT_MAP_STATE,
        center: defaultCenter,
        zoom: defaultZoom,
        viewMode: defaultViewMode
      }
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MAP_STATE)
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          ...DEFAULT_MAP_STATE,
          ...parsed,
          // Override with provided defaults
          center: defaultCenter,
          zoom: defaultZoom,
          viewMode: defaultViewMode
        }
      }
    } catch (error) {
      console.warn('Failed to load map state from localStorage:', error)
    }

    return {
      ...DEFAULT_MAP_STATE,
      center: defaultCenter,
      zoom: defaultZoom,
      viewMode: defaultViewMode
    }
  })

  // Map readiness state
  const [mapReady, setMapReady] = useState(false)
  
  // User location state
  const [userLocation, setUserLocation] = useState(() => {
    if (!trackUserLocation || !persistState) return null

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_LOCATION)
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.warn('Failed to load user location from localStorage:', error)
      return null
    }
  })

  // Selected marker state
  const [selectedMarker, setSelectedMarker] = useState(null)

  // Persist map state to localStorage
  useEffect(() => {
    if (!persistState) return

    try {
      const stateToSave = {
        viewMode: mapState.viewMode,
        heatmapOptions: mapState.heatmapOptions,
        clusteringOptions: mapState.clusteringOptions
        // Note: Don't persist center/zoom as they change frequently
      }
      localStorage.setItem(STORAGE_KEYS.MAP_STATE, JSON.stringify(stateToSave))
    } catch (error) {
      console.warn('Failed to persist map state to localStorage:', error)
    }
  }, [mapState.viewMode, mapState.heatmapOptions, mapState.clusteringOptions, persistState])

  // Persist user location to localStorage
  useEffect(() => {
    if (!persistState || !trackUserLocation) return

    try {
      if (userLocation) {
        localStorage.setItem(STORAGE_KEYS.USER_LOCATION, JSON.stringify(userLocation))
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER_LOCATION)
      }
    } catch (error) {
      console.warn('Failed to persist user location to localStorage:', error)
    }
  }, [userLocation, persistState, trackUserLocation])

  // Update map state
  const updateMapState = useCallback((updates) => {
    setMapState(prev => {
      const newState = { ...prev, ...updates }
      
      // Validate state updates
      if (updates.zoom && (updates.zoom < 1 || updates.zoom > 20)) {
        console.warn('Invalid zoom level:', updates.zoom)
        return prev
      }

      if (updates.center && (!Array.isArray(updates.center) || updates.center.length !== 2)) {
        console.warn('Invalid center coordinates:', updates.center)
        return prev
      }

      if (updates.viewMode && !['markers', 'clusters', 'heatmap', 'hybrid'].includes(updates.viewMode)) {
        console.warn('Invalid view mode:', updates.viewMode)
        return prev
      }

      return newState
    })
  }, [])

  // Reset map state to defaults
  const resetMapState = useCallback(() => {
    setMapState({
      ...DEFAULT_MAP_STATE,
      center: defaultCenter,
      zoom: defaultZoom,
      viewMode: defaultViewMode
    })
    
    if (persistState) {
      try {
        localStorage.removeItem(STORAGE_KEYS.MAP_STATE)
      } catch (error) {
        console.warn('Failed to clear map state from localStorage:', error)
      }
    }
  }, [defaultCenter, defaultZoom, defaultViewMode, persistState])

  // Update user location with validation
  const updateUserLocation = useCallback((location) => {
    if (!location) {
      setUserLocation(null)
      return
    }

    // Validate location object
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      console.warn('Invalid user location format:', location)
      return
    }

    // Check if location is within Bangladesh (approximate bounds)
    const bangladeshBounds = {
      north: 26.7,
      south: 20.3,
      east: 92.8,
      west: 88.0
    }

    if (
      location.lat < bangladeshBounds.south || location.lat > bangladeshBounds.north ||
      location.lng < bangladeshBounds.west || location.lng > bangladeshBounds.east
    ) {
      console.warn('Location appears to be outside Bangladesh:', location)
      // Still set the location but log the warning
    }

    setUserLocation({
      lat: location.lat,
      lng: location.lng,
      timestamp: new Date().toISOString(),
      accuracy: location.accuracy || null
    })
  }, [])

  // Auto-detect user location
  useEffect(() => {
    if (!trackUserLocation || userLocation) return

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          console.warn('Geolocation error:', error.message)
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    }
  }, [trackUserLocation, userLocation, updateUserLocation])

  // Memoized derived state
  const derivedState = useMemo(() => ({
    // Check if user is in Bangladesh
    isUserInBangladesh: userLocation ? (
      userLocation.lat >= 20.3 && userLocation.lat <= 26.7 &&
      userLocation.lng >= 88.0 && userLocation.lng <= 92.8
    ) : null,
    
    // Distance from center
    distanceFromCenter: userLocation ? (
      Math.sqrt(
        Math.pow(userLocation.lat - mapState.center[0], 2) +
        Math.pow(userLocation.lng - mapState.center[1], 2)
      )
    ) : null,
    
    // Whether heatmap is active
    hasHeatmap: mapState.viewMode === 'heatmap' || mapState.viewMode === 'hybrid',
    
    // Whether clustering is active
    hasClustering: mapState.viewMode === 'clusters' || mapState.viewMode === 'hybrid',
    
    // Whether individual markers are shown
    hasMarkers: mapState.viewMode === 'markers' || mapState.viewMode === 'hybrid'
  }), [mapState, userLocation])

  // Center map on user location
  const centerOnUser = useCallback(() => {
    if (userLocation) {
      updateMapState({
        center: [userLocation.lat, userLocation.lng],
        zoom: Math.max(mapState.zoom, 14)
      })
    }
  }, [userLocation, mapState.zoom, updateMapState])

  // Center map on coordinates
  const centerOnCoordinates = useCallback((lat, lng, zoom = null) => {
    updateMapState({
      center: [lat, lng],
      zoom: zoom || mapState.zoom
    })
  }, [mapState.zoom, updateMapState])

  return {
    // State
    mapState,
    mapReady,
    userLocation,
    selectedMarker,
    
    // Derived state
    ...derivedState,
    
    // Actions
    updateMapState,
    resetMapState,
    setMapReady,
    setUserLocation: updateUserLocation,
    setSelectedMarker,
    centerOnUser,
    centerOnCoordinates,
    
    // Utilities
    isLocationValid: Boolean(userLocation && userLocation.lat && userLocation.lng),
    hasUserLocation: Boolean(userLocation),
    
    // Debug info (only in development)
    ...(process.env.NODE_ENV === 'development' && {
      _debug: {
        persistState,
        trackUserLocation,
        storageKeys: STORAGE_KEYS,
        defaultState: DEFAULT_MAP_STATE
      }
    })
  }
}

export default useMapState