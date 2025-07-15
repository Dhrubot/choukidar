// === frontend/src/pages/MapPage/MapContainer.jsx ===
/**
 * MapContainer - Core Map Rendering Component
 * Integrates MapView with Safe Zones and Route layers
 * Handles performance monitoring and layer management
 */

import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { AlertTriangle, Zap, Shield, Route as RouteIcon } from 'lucide-react'

// Map components
import MapView from '../../components/Map/MapView'
import MapLegend from '../../components/Map/MapLegend'
import SafeZoneLayer from '../../components/Map/SafeZoneLayer'
import RouteDisplay from '../../components/Map/RouteDisplay'

// Performance monitoring
const PERFORMANCE_THRESHOLDS = {
  renderTime: 2000, // 2 seconds
  markerCount: 1000,
  memoryUsage: 50 * 1024 * 1024 // 50MB
}

const MapContainer = memo(({
  reports = [],
  safeZones = [],
  routes = null,
  mapState = {},
  onMapReady,
  onClusterClick,
  onMarkerClick,
  onRouteSelect,
  onSafeZoneSelect,
  userLocation,
  setUserLocation,
  performanceMetrics,
  setPerformanceMetrics,
  className = ""
}) => {
  // Map instance reference
  const mapRef = useRef(null)
  const [mapInstance, setMapInstance] = useState(null)
  const [layersReady, setLayersReady] = useState({
    base: false,
    markers: false,
    safeZones: false,
    routes: false
  })

  // Performance monitoring
  const renderStartTime = useRef(null)
  const [performanceWarnings, setPerformanceWarnings] = useState([])

  // Start performance monitoring
  useEffect(() => {
    renderStartTime.current = performance.now()
  }, [reports, safeZones, routes])

  // Monitor performance after render
  useEffect(() => {
    if (renderStartTime.current && layersReady.base) {
      const renderTime = performance.now() - renderStartTime.current
      
      const newMetrics = {
        renderTime,
        markerCount: reports.length,
        filterTime: 0, // Will be set by filtering system
        lastUpdate: new Date().toISOString()
      }

      setPerformanceMetrics(newMetrics)

      // Check for performance warnings
      const warnings = []
      if (renderTime > PERFORMANCE_THRESHOLDS.renderTime) {
        warnings.push({
          type: 'slow_render',
          message: `Map rendering took ${Math.round(renderTime)}ms (threshold: ${PERFORMANCE_THRESHOLDS.renderTime}ms)`,
          severity: 'warning'
        })
      }

      if (reports.length > PERFORMANCE_THRESHOLDS.markerCount) {
        warnings.push({
          type: 'high_marker_count',
          message: `${reports.length} markers loaded (consider clustering or filtering)`,
          severity: 'info'
        })
      }

      setPerformanceWarnings(warnings)
      renderStartTime.current = null
    }
  }, [layersReady.base, reports.length, setPerformanceMetrics])

  // Handle map ready
  const handleMapReady = useCallback((map) => {
    console.log('🗺️ MapContainer: Map instance ready')
    setMapInstance(map)
    setLayersReady(prev => ({ ...prev, base: true }))
    
    if (onMapReady) {
      onMapReady(map)
    }
  }, [onMapReady])

  // Handle safe zone layer ready
  const handleSafeZoneLayerReady = useCallback(() => {
    console.log('🛡️ MapContainer: Safe zone layer ready')
    setLayersReady(prev => ({ ...prev, safeZones: true }))
  }, [])

  // Handle route layer ready
  const handleRouteLayerReady = useCallback(() => {
    console.log('🛣️ MapContainer: Route layer ready')
    setLayersReady(prev => ({ ...prev, routes: true }))
  }, [])

  // Handle markers ready
  const handleMarkersReady = useCallback(() => {
    console.log('📍 MapContainer: Markers layer ready')
    setLayersReady(prev => ({ ...prev, markers: true }))
  }, [])

  // Memoized layer visibility
  const layerVisibility = useMemo(() => {
    const { viewMode = 'clusters' } = mapState
    
    return {
      markers: viewMode === 'markers' || viewMode === 'hybrid',
      clusters: viewMode === 'clusters' || viewMode === 'hybrid',
      heatmap: viewMode === 'heatmap' || viewMode === 'hybrid',
      safeZones: true, // Always show safe zones
      routes: routes && (routes.primary || (routes.alternatives && routes.alternatives.length > 0))
    }
  }, [mapState.viewMode, routes])

  // Memoized legend data
  const legendData = useMemo(() => {
    const items = []

    // Base legend items
    if (layerVisibility.markers || layerVisibility.clusters) {
      items.push({
        type: 'incident',
        label: 'Crime Reports',
        color: '#DC2626',
        count: reports.length
      })
    }

    // Safe zones
    if (layerVisibility.safeZones && safeZones.length > 0) {
      items.push({
        type: 'safeZone',
        label: 'Safe Zones',
        color: '#16A34A',
        count: safeZones.length
      })
    }

    // Routes
    if (layerVisibility.routes && routes) {
      items.push({
        type: 'route',
        label: 'Planned Route',
        color: '#2563EB',
        count: routes.alternatives ? routes.alternatives.length + 1 : 1
      })
    }

    // Heatmap
    if (layerVisibility.heatmap) {
      items.push({
        type: 'heatmap',
        label: 'Crime Density',
        color: 'gradient',
        description: 'Green (safe) to Red (dangerous)'
      })
    }

    return items
  }, [layerVisibility, reports.length, safeZones.length, routes])

  // Handle user location detection
  const handleLocationUpdate = useCallback((location) => {
    if (setUserLocation) {
      setUserLocation(location)
    }
  }, [setUserLocation])

  // All layers ready check
  const allLayersReady = useMemo(() => {
    return layersReady.base && layersReady.markers && 
           (safeZones.length === 0 || layersReady.safeZones) &&
           (!routes || layersReady.routes)
  }, [layersReady, safeZones.length, routes])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Main Map */}
      <div className="w-full h-full">
        <MapView
          reports={reports}
          viewMode={mapState.viewMode}
          heatmapOptions={mapState.heatmapOptions}
          clusteringOptions={mapState.clusteringOptions}
          center={mapState.center}
          zoom={mapState.zoom}
          onMapReady={handleMapReady}
          onClusterClick={onClusterClick}
          onMarkerClick={onMarkerClick}
          onMarkersReady={handleMarkersReady}
          userLocation={userLocation}
          onLocationUpdate={handleLocationUpdate}
          className="w-full h-full"
        />
      </div>

      {/* Safe Zone Layer */}
      {mapInstance && layerVisibility.safeZones && (
        <SafeZoneLayer
          map={mapInstance}
          safeZones={safeZones}
          isVisible={layerVisibility.safeZones}
          userLocation={userLocation}
          onZoneClick={onSafeZoneSelect}
          onLayerReady={handleSafeZoneLayerReady}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      {/* Route Display Layer */}
      {mapInstance && layerVisibility.routes && routes && (
        <RouteDisplay
          map={mapInstance}
          routes={routes}
          isVisible={layerVisibility.routes}
          onRouteClick={onRouteSelect}
          onLayerReady={handleRouteLayerReady}
          className="absolute inset-0 pointer-events-none"
        />
      )}

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] lg:bottom-6 lg:left-6">
        <MapLegend
          items={legendData}
          viewMode={mapState.viewMode}
          compactMode={true}
          className="bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-white/20"
        />
      </div>

      {/* Loading Overlay */}
      {!allLayersReady && (
        <div className="absolute inset-0 bg-neutral-50/80 backdrop-blur-sm flex items-center justify-center z-[999]">
          <div className="text-center">
            <div className="loading-spinner w-8 h-8 mx-auto mb-3"></div>
            <p className="text-sm text-neutral-600 font-medium">
              Loading map layers...
            </p>
            <div className="text-xs text-neutral-500 mt-1">
              {layersReady.base ? '✓' : '○'} Map • 
              {layersReady.markers ? '✓' : '○'} Reports • 
              {layersReady.safeZones ? '✓' : '○'} Safe Zones • 
              {layersReady.routes ? '✓' : '○'} Routes
            </div>
          </div>
        </div>
      )}

      {/* Performance Warnings */}
      {performanceWarnings.length > 0 && (
        <div className="absolute top-4 right-4 z-[1000] space-y-2">
          {performanceWarnings.map((warning, index) => (
            <div
              key={index}
              className={`rounded-lg p-3 shadow-md border ${
                warning.severity === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {warning.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    warning.severity === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    Performance Notice
                  </p>
                  <p className={`text-xs ${
                    warning.severity === 'warning' ? 'text-yellow-700' : 'text-blue-700'
                  }`}>
                    {warning.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layer Status Indicators (Development Mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 rounded-lg p-2 text-xs">
          <div className="font-medium text-neutral-700 mb-1">Layer Status:</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Shield className="w-3 h-3 text-green-600" />
              <span className={layersReady.safeZones ? 'text-green-600' : 'text-neutral-400'}>
                Safe Zones ({safeZones.length})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <RouteIcon className="w-3 h-3 text-blue-600" />
              <span className={layersReady.routes ? 'text-blue-600' : 'text-neutral-400'}>
                Routes {routes ? `(${routes.alternatives ? routes.alternatives.length + 1 : 1})` : '(0)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// Add display name for debugging
MapContainer.displayName = 'MapContainer'

export default MapContainer