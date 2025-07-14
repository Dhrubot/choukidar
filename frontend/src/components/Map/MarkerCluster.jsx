// === src/components/Map/MarkerCluster.jsx ===
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useMapClustering } from '../../hooks/useMapClustering'
import { useClusterIcons, injectClusterCSS } from './ClusterIcon'

/**
 * MarkerCluster Component - Intelligent clustering for SafeStreets Bangladesh
 * Handles 1000+ markers with hybrid clustering strategy and mobile optimization
 */
const MarkerCluster = ({ 
  map, 
  reports = [], 
  isVisible = true,
  clusteringOptions = {},
  onClusterClick = null,
  onMarkerClick = null,
  className = ""
}) => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState(null)
  const initializationRef = useRef(false)
  const lastReportsRef = useRef([])
  
  // Clustering configuration with Bangladesh-optimized defaults
  const defaultClusterOptions = useMemo(() => ({
    // Mobile-first configuration
    enableBengaliNumerals: false, // Can be toggled for localization
    showTypeIndicator: true,
    showRiskBadge: true,
    enableAnimations: true,
    
    // Performance settings for large datasets
    chunkedLoading: true,
    maxMarkersBeforeCluster: 50,
    animateAddingMarkers: false, // Disabled for performance with 1000+ markers
    
    // Bangladesh-specific zoom thresholds
    zoomThresholds: {
      6: { radius: 100, maxZoom: 8 },   // Country level - very aggressive
      8: { radius: 70, maxZoom: 10 },   // Regional level
      10: { radius: 45, maxZoom: 12 },  // City level  
      12: { radius: 30, maxZoom: 14 },  // District level
      14: { radius: 20, maxZoom: 16 }   // Neighborhood level
    },
    
    ...clusteringOptions
  }), [clusteringOptions])

  // Initialize clustering system
  const {
    processReports,
    handleZoomChange,
    cleanup,
    isProcessing,
    clusterStats,
    clusterGroup
  } = useMapClustering(reports, defaultClusterOptions)

  // Initialize cluster icons
  const { createIcon } = useClusterIcons(defaultClusterOptions)

  // Inject cluster CSS on mount
  useEffect(() => {
    injectClusterCSS()
  }, [])

  // Initialize clustering when map and reports are ready
  useEffect(() => {
    if (!map || !isVisible || initializationRef.current) return

    const initializeClustering = async () => {
      try {
        setError(null)
        
        // Process initial reports if available
        if (reports.length > 0) {
          console.log(`🎯 Initializing clustering with ${reports.length} reports`)
          await processReports(reports, map)
        }
        
        // Set up zoom change handler
        map.on('zoomend', () => handleZoomChange(map))
        
        // Set up cluster event handlers
        setupClusterEventHandlers(map)
        
        setIsInitialized(true)
        initializationRef.current = true
        
        console.log('✅ MarkerCluster initialized successfully')
        
      } catch (error) {
        console.error('❌ Error initializing clustering:', error)
        setError(error.message)
      }
    }

    initializeClustering()

    // Cleanup on unmount
    return () => {
      if (map) {
        map.off('zoomend')
        cleanup(map)
      }
      initializationRef.current = false
      setIsInitialized(false)
    }
  }, [map, isVisible]) // Only depend on map and visibility

  // Handle reports updates
  useEffect(() => {
    if (!map || !isInitialized || !isVisible) return

    // Check if reports actually changed to avoid unnecessary processing
    const reportsChanged = reports.length !== lastReportsRef.current.length ||
      reports.some((report, index) => {
        const lastReport = lastReportsRef.current[index]
        return !lastReport || report._id !== lastReport._id
      })

    if (reportsChanged) {
      console.log(`🔄 Updating clusters: ${lastReportsRef.current.length} → ${reports.length} reports`)
      
      processReports(reports, map).catch(error => {
        console.error('❌ Error updating clusters:', error)
        setError(error.message)
      })
      
      lastReportsRef.current = [...reports]
    }
  }, [reports, map, isInitialized, isVisible, processReports])

  // Setup enhanced cluster event handlers
  const setupClusterEventHandlers = useCallback((map) => {
    // Custom cluster click handler
    const handleClusterClickEvent = (event) => {
      const cluster = event.layer
      const markers = cluster.getAllChildMarkers()
      
      // Call custom handler if provided
      if (onClusterClick) {
        onClusterClick({
          cluster,
          markers,
          count: markers.length,
          bounds: cluster.getBounds()
        })
      }
      
      // Default behavior: zoom to cluster bounds
      map.fitBounds(cluster.getBounds(), {
        padding: [20, 20],
        maxZoom: 16
      })
    }

    // Custom marker click handler
    const handleMarkerClickEvent = (event) => {
      const marker = event.layer
      const reportData = marker.options?.reportData
      
      if (onMarkerClick && reportData) {
        onMarkerClick({
          marker,
          report: reportData,
          position: marker.getLatLng()
        })
      }
    }

    // Listen for cluster events
    map.on('clusterclick', handleClusterClickEvent)
    map.on('click', handleMarkerClickEvent)

    // Custom events from cluster popups
    window.addEventListener('clusterZoomIn', (event) => {
      if (event.detail?.bounds) {
        map.fitBounds(event.detail.bounds, { padding: [20, 20] })
      }
    })

    window.addEventListener('clusterViewDetails', (event) => {
      if (event.detail) {
        console.log('📊 Cluster details requested:', event.detail)
        // Could open a detailed modal or sidebar here
      }
    })

    return () => {
      map.off('clusterclick', handleClusterClickEvent)
      map.off('click', handleMarkerClickEvent)
      window.removeEventListener('clusterZoomIn')
      window.removeEventListener('clusterViewDetails')
    }
  }, [onClusterClick, onMarkerClick])

  // Handle visibility changes
  useEffect(() => {
    if (!map || !clusterGroup) return

    if (isVisible) {
      if (!map.hasLayer(clusterGroup)) {
        map.addLayer(clusterGroup)
      }
    } else {
      if (map.hasLayer(clusterGroup)) {
        map.removeLayer(clusterGroup)
      }
    }
  }, [map, clusterGroup, isVisible])

  // Performance monitoring for large datasets
  useEffect(() => {
    if (reports.length > 500) {
      console.log(`⚡ Performance mode: ${reports.length} reports detected`)
      
      // Could implement additional optimizations here
      // - Reduce animation frequency
      // - Increase clustering aggressiveness
      // - Enable virtual scrolling for popups
    }
  }, [reports.length])

  // Memoized cluster statistics for display
  const enhancedStats = useMemo(() => ({
    ...clusterStats,
    performanceLevel: reports.length > 1000 ? 'heavy' : 
                     reports.length > 500 ? 'moderate' : 'light',
    estimatedClusters: Math.ceil(reports.length / (map?.getZoom() > 12 ? 10 : 25)),
    memoryUsage: reports.length * 0.5 // Rough estimate in KB
  }), [clusterStats, reports.length, map])

  // Error boundary for clustering operations
  if (error) {
    return (
      <div className={`cluster-error ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Clustering Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    setError(null)
                    if (map && reports.length > 0) {
                      processReports(reports, map)
                    }
                  }}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Retry Clustering
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Loading state for large datasets
  if (isProcessing && reports.length > 100) {
    return (
      <div className={`cluster-loading ${className}`}>
        <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/20 p-3">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-bangladesh-green"></div>
            <div>
              <div className="text-sm font-medium text-neutral-800">
                Processing {reports.length} reports...
              </div>
              <div className="text-xs text-neutral-600">
                Creating intelligent clusters
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Debug information in development
  if (process.env.NODE_ENV === 'development' && isInitialized) {
    console.log('🎯 MarkerCluster Stats:', enhancedStats)
  }

  // Component doesn't render anything visible - it manages Leaflet layers
  return null
}

// Performance optimization wrapper
const MemoizedMarkerCluster = React.memo(MarkerCluster, (prevProps, nextProps) => {
  // Custom comparison for reports array
  const reportsEqual = prevProps.reports.length === nextProps.reports.length &&
    prevProps.reports.every((report, index) => 
      report._id === nextProps.reports[index]?._id
    )

  return (
    reportsEqual &&
    prevProps.map === nextProps.map &&
    prevProps.isVisible === nextProps.isVisible &&
    JSON.stringify(prevProps.clusteringOptions) === JSON.stringify(nextProps.clusteringOptions)
  )
})

MemoizedMarkerCluster.displayName = 'MarkerCluster'

export default MemoizedMarkerCluster

// Export utilities for external use
export {
  useMapClustering,
  useClusterIcons
}