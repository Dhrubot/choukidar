// === frontend/src/hooks/useMapViewMode.js ===
import { useCallback, useMemo, useEffect, useRef } from 'react'

/**
 * Custom hook for MapPage view mode management - Enhanced with persistence
 * Extracted from MapPage.jsx Lines 140-180
 * Handles: View mode changes, Heatmap options, Clustering options, Clustering determination, State persistence
 */
export const useMapViewMode = (mapState, updateMapState, reportCount, performanceStats, userId = null) => {
  const persistenceKeyRef = useRef(`mapViewMode_${userId || 'anonymous'}`)
  const lastSyncRef = useRef(Date.now())
  const isStorageAvailableRef = useRef(true)

  // Check if localStorage is available
  useEffect(() => {
    try {
      const testKey = '__test_storage__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      isStorageAvailableRef.current = true
    } catch (error) {
      console.warn('localStorage not available, using memory-only mode:', error)
      isStorageAvailableRef.current = false
    }
  }, [])

  // Load persisted view mode preferences on mount
  useEffect(() => {
    if (!isStorageAvailableRef.current) return

    const loadPersistedState = () => {
      try {
        const persistedState = localStorage.getItem(persistenceKeyRef.current)
        if (persistedState) {
          const parsed = JSON.parse(persistedState)
          
          // Only apply persisted state if it's recent (within 7 days)
          const isRecent = Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000
          
          if (isRecent && parsed.viewMode && parsed.preferences) {
            // Apply learned preferences based on dataset size patterns
            const currentDatasetSize = reportCount
            const matchingPreference = parsed.preferences.find(pref => 
              currentDatasetSize >= pref.minReports && 
              currentDatasetSize <= pref.maxReports
            )
            
            if (matchingPreference) {
              console.log(`🎯 Applying learned preference: ${matchingPreference.preferredMode} for ${currentDatasetSize} reports`)
              updateMapState({
                viewMode: matchingPreference.preferredMode,
                heatmapOptions: parsed.heatmapOptions || mapState.heatmapOptions,
                clusteringOptions: parsed.clusteringOptions || mapState.clusteringOptions
              })
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load persisted map view state:', error)
      }
    }

    loadPersistedState()
  }, []) // Only run on mount

  // Persist state changes with user preference learning
  const persistViewModeState = useCallback((newState, reportCount) => {
    if (!isStorageAvailableRef.current) {
      console.log('📊 Storage not available, preferences not persisted')
      return
    }

    try {
      const currentState = localStorage.getItem(persistenceKeyRef.current)
      let persistedData = currentState ? JSON.parse(currentState) : {
        preferences: [],
        viewMode: newState.viewMode,
        heatmapOptions: newState.heatmapOptions,
        clusteringOptions: newState.clusteringOptions,
        timestamp: Date.now()
      }

      // Update current state
      persistedData.viewMode = newState.viewMode
      persistedData.heatmapOptions = newState.heatmapOptions || persistedData.heatmapOptions
      persistedData.clusteringOptions = newState.clusteringOptions || persistedData.clusteringOptions
      persistedData.timestamp = Date.now()

      // Learn user preferences based on dataset size
      if (reportCount > 0) {
        const datasetCategory = getDatasetCategory(reportCount)
        const existingPreferenceIndex = persistedData.preferences.findIndex(
          pref => pref.category === datasetCategory
        )

        const preferenceData = {
          category: datasetCategory,
          minReports: getDatasetRange(datasetCategory).min,
          maxReports: getDatasetRange(datasetCategory).max,
          preferredMode: newState.viewMode,
          usageCount: 1,
          lastUsed: Date.now()
        }

        if (existingPreferenceIndex >= 0) {
          // Update existing preference
          const existing = persistedData.preferences[existingPreferenceIndex]
          persistedData.preferences[existingPreferenceIndex] = {
            ...preferenceData,
            usageCount: existing.usageCount + 1
          }
        } else {
          // Add new preference
          persistedData.preferences.push(preferenceData)
        }

        // Keep only the most recent 10 preferences
        persistedData.preferences = persistedData.preferences
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, 10)
      }

      localStorage.setItem(persistenceKeyRef.current, JSON.stringify(persistedData))
      
      // Cross-tab synchronization
      window.dispatchEvent(new CustomEvent('mapViewModeChanged', {
        detail: { userId: userId || 'anonymous', state: persistedData }
      }))
      
    } catch (error) {
      console.warn('Failed to persist map view state:', error)
    }
  }, [userId])

  // Helper functions for dataset categorization
  const getDatasetCategory = (count) => {
    if (count < 50) return 'small'
    if (count < 200) return 'medium'
    if (count < 1000) return 'large'
    return 'xlarge'
  }

  const getDatasetRange = (category) => {
    const ranges = {
      small: { min: 0, max: 49 },
      medium: { min: 50, max: 199 },
      large: { min: 200, max: 999 },
      xlarge: { min: 1000, max: Infinity }
    }
    return ranges[category] || ranges.medium
  }

  // Cross-tab synchronization listener
  useEffect(() => {
    if (!isStorageAvailableRef.current) return

    const handleCrossTabSync = (event) => {
      if (event.detail.userId === (userId || 'anonymous')) {
        const now = Date.now()
        // Throttle updates to prevent infinite loops
        if (now - lastSyncRef.current > 1000) {
          lastSyncRef.current = now
          const { state } = event.detail
          updateMapState({
            viewMode: state.viewMode,
            heatmapOptions: state.heatmapOptions,
            clusteringOptions: state.clusteringOptions
          })
        }
      }
    }

    window.addEventListener('mapViewModeChanged', handleCrossTabSync)
    return () => window.removeEventListener('mapViewModeChanged', handleCrossTabSync)
  }, [userId, updateMapState])

  // ENHANCED: View mode change handler with persistence
  const handleViewModeChange = useCallback((newMode) => {
    const newState = { 
      ...mapState, 
      viewMode: newMode 
    }
    updateMapState({ viewMode: newMode })
    persistViewModeState(newState, reportCount)
    console.log(`📊 Map view changed to: ${newMode} for ${reportCount} reports${isStorageAvailableRef.current ? ' (persisted)' : ' (memory only)'}`)
  }, [updateMapState, mapState, reportCount, persistViewModeState])

  // ENHANCED: Heatmap options handler with persistence
  const handleHeatmapOptionsChange = useCallback((newOptions) => {
    const updatedOptions = {
      ...mapState.heatmapOptions,
      ...newOptions
    }
    const newState = {
      ...mapState,
      heatmapOptions: updatedOptions
    }
    updateMapState({ heatmapOptions: updatedOptions })
    persistViewModeState(newState, reportCount)
  }, [updateMapState, mapState, reportCount, persistViewModeState])

  // ENHANCED: Clustering options handler with persistence
  const handleClusteringOptionsChange = useCallback((newOptions) => {
    const updatedOptions = {
      ...mapState.clusteringOptions,
      ...newOptions
    }
    const newState = {
      ...mapState,
      clusteringOptions: updatedOptions
    }
    updateMapState({ clusteringOptions: updatedOptions })
    persistViewModeState(newState, reportCount)
  }, [updateMapState, mapState, reportCount, persistViewModeState])

  // EXTRACTED: Clustering determination logic from MapPage Lines 255-261
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
    supportsClusteringOptions: mapState.viewMode === 'clusters' || mapState.viewMode === 'hybrid',
    hasStoragePersistence: isStorageAvailableRef.current
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