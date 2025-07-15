// === frontend/src/hooks/useMapViewMode.js ===
import { useCallback, useMemo } from 'react'

/**
 * Custom hook for MapPage view mode management
 * Extracted from MapPage.jsx Lines 140-180
 * Handles: View mode changes, Heatmap options, Clustering options, Clustering determination
 */
export const useMapViewMode = (mapState, updateMapState, reportCount, performanceStats) => {
  // ✅ EXTRACTED: View mode change handler from MapPage Lines 142-146
  const handleViewModeChange = useCallback((newMode) => {
    updateMapState({ viewMode: newMode })
    console.log(`📊 Map view changed to: ${newMode} for ${reportCount} reports`)
  }, [updateMapState, reportCount])

  // ✅ EXTRACTED: Heatmap options handler from MapPage Lines 149-156
  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    updateMapState({ 
      heatmapOptions: {
        ...mapState.heatmapOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.heatmapOptions])

  // ✅ EXTRACTED: Clustering options handler from MapPage Lines 159-166
  const handleClusteringOptionsChange = useCallback((newOptions) => {
    updateMapState({
      clusteringOptions: {
        ...mapState.clusteringOptions,
        ...newOptions
      }
    })
  }, [updateMapState, mapState.clusteringOptions])

  // ✅ EXTRACTED: Clustering determination logic from MapPage Lines 255-261
  const shouldUseClustering = useMemo(() => {
    if (mapState.viewMode === 'clusters') return true
    if (mapState.viewMode === 'heatmap') return false
    if (mapState.viewMode === 'hybrid') return reportCount > 100
    if (mapState.viewMode === 'markers') return performanceStats.isLargeDataset
    return false
  }, [mapState.viewMode, reportCount, performanceStats.isLargeDataset])

  // Enhanced view mode utilities
  const viewModeUtils = useMemo(() => ({
    isClusterMode: mapState.viewMode === 'clusters',
    isHeatmapMode: mapState.viewMode === 'heatmap',
    isHybridMode: mapState.viewMode === 'hybrid',
    isMarkerMode: mapState.viewMode === 'markers',
    supportsHeatmapOptions: mapState.viewMode === 'heatmap' || mapState.viewMode === 'hybrid',
    supportsClusteringOptions: mapState.viewMode === 'clusters' || mapState.viewMode === 'hybrid'
  }), [mapState.viewMode])

  return {
    // Handlers
    handleViewModeChange,
    handleHeatmapOptionsChange,
    handleClusteringOptionsChange,
    
    // Computed values
    shouldUseClustering,
    viewModeUtils
  }
}