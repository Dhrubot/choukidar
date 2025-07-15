// === frontend/src/hooks/useMapInteractions.js ===
import { useState, useCallback } from 'react'

/**
 * Custom hook for MapPage map interactions (clusters and markers)
 * Extracted from MapPage.jsx Lines 190-230
 * Handles: Cluster stats, Cluster clicks, Marker clicks
 */
export const useMapInteractions = (setSelectedMarker) => {
  // ✅ EXTRACTED: Cluster stats state from MapPage Lines 79-84
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    averageClusterSize: 0,
    largestCluster: 0,
    lastClickedCluster: null
  })

  // ✅ EXTRACTED: Enhanced cluster click handler from MapPage Lines 195-209
  const handleClusterClick = useCallback((clusterData) => {
    const { cluster, markers, count, bounds } = clusterData

    console.log(`🎯 Cluster clicked: ${count} reports in area`)

    setClusterStats(prev => ({
      ...prev,
      totalClusters: prev.totalClusters,
      lastClickedCluster: {
        count,
        bounds,
        timestamp: Date.now(),
        location: bounds ? bounds.getCenter() : null
      }
    }))
  }, [])

  // ✅ EXTRACTED: Enhanced marker click handler from MapPage Lines 212-223
  const handleMarkerClick = useCallback((markerData) => {
    const { report, position, marker } = markerData
    
    console.log(`📍 Marker clicked: ${report.type} incident at ${position.lat}, ${position.lng}`)
    
    setSelectedMarker({
      report,
      position,
      marker,
      timestamp: Date.now()
    })
  }, [setSelectedMarker])

  return {
    clusterStats,
    handleClusterClick,
    handleMarkerClick
  }
}