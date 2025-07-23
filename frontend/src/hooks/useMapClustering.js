// === src/hooks/useMapClustering.js ===
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import L from 'leaflet'

/**
 * Custom hook for intelligent map clustering
 * Optimized for large datasets (1000+ markers) with hybrid clustering strategy
 */
export const useMapClustering = (reports = [], options = {}) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    totalMarkers: 0,
    averageClusterSize: 0
  })
  
  const clusterGroupRef = useRef(null)
  const lastZoomLevel = useRef(11)

  // Default clustering configuration optimized for Bangladesh
  const defaultConfig = useMemo(() => ({
    // Zoom-dependent clustering radii
    zoomThresholds: {
      6: { radius: 80, maxZoom: 8 },   // Country view - aggressive clustering
      8: { radius: 60, maxZoom: 10 },  // Regional view - moderate clustering  
      10: { radius: 40, maxZoom: 12 }, // City view - light clustering
      12: { radius: 25, maxZoom: 14 }, // District view - minimal clustering
      14: { radius: 15, maxZoom: 16 }  // Neighborhood view - fine clustering
    },
    
    // Performance optimizations
    animate: true,
    animateAddingMarkers: true,
    disableClusteringAtZoom: 16, // Show individual markers at street level
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false, // Disabled for mobile performance
    zoomToBoundsOnClick: true,
    spiderfyDistanceMultiplier: 1.5, // Larger for mobile touch targets
    
    // Mobile optimizations
    iconCreateFunction: null, // Will be set by clustering logic
    maxClusterRadius: 80,
    
    ...options
  }), [options])

  // Dynamic clustering configuration based on dataset size
  const dynamicConfig = useMemo(() => {
    const datasetSize = reports.length
    let adjustedConfig = { ...defaultConfig }
    
    // Adjust clustering parameters based on dataset size
    if (datasetSize < 50) {
      // Small dataset - minimal clustering for better visibility
      adjustedConfig.maxClusterRadius = 30
      adjustedConfig.disableClusteringAtZoom = 14
      adjustedConfig.zoomThresholds = {
        6: { radius: 40, maxZoom: 8 },
        8: { radius: 30, maxZoom: 10 },
        10: { radius: 20, maxZoom: 12 },
        12: { radius: 15, maxZoom: 14 },
        14: { radius: 10, maxZoom: 16 }
      }
    } else if (datasetSize < 200) {
      // Medium dataset - moderate clustering
      adjustedConfig.maxClusterRadius = 50
      adjustedConfig.disableClusteringAtZoom = 15
    } else if (datasetSize < 1000) {
      // Large dataset - standard clustering
      adjustedConfig.maxClusterRadius = 80
      adjustedConfig.disableClusteringAtZoom = 16
    } else {
      // Very large dataset - aggressive clustering for performance
      adjustedConfig.maxClusterRadius = 120
      adjustedConfig.disableClusteringAtZoom = 17
      adjustedConfig.animate = false // Disable animations for performance
      adjustedConfig.animateAddingMarkers = false
      adjustedConfig.zoomThresholds = {
        6: { radius: 120, maxZoom: 8 },
        8: { radius: 100, maxZoom: 10 },
        10: { radius: 80, maxZoom: 12 },
        12: { radius: 60, maxZoom: 14 },
        14: { radius: 40, maxZoom: 16 }
      }
    }
    
    return adjustedConfig
  }, [reports.length, defaultConfig])

  // Hybrid clustering weight calculation
  const calculateClusterWeight = useCallback((report) => {
    // Base weight from severity (1-5 scale)
    let weight = report.severity || 3
    
    // Incident type multipliers for clustering priority
    const typeWeights = {
      'teen_gang': 1.4,    // High priority - dangerous
      'chadabaji': 1.2,    // High priority - organized crime
      'chintai': 1.0,      // Standard priority
      'other': 0.8         // Lower priority - general incidents
    }
    
    // Apply type weight
    weight *= typeWeights[report.type] || 1.0
    
    // Recent incidents get higher weight (last 7 days)
    const reportDate = new Date(report.createdAt || report.timestamp)
    const daysSinceReport = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceReport <= 7) {
      weight *= 1.3 // Recent incidents more prominent
    } else if (daysSinceReport <= 30) {
      weight *= 1.1 // Somewhat recent
    }
    
    return Math.min(weight, 10) // Cap at 10 for consistency
  }, [])

  // Determine cluster color based on dominant characteristics
  const getClusterColor = useCallback((markers) => {
    if (!markers || markers.length === 0) return '#6B7280' // neutral gray
    
    // Calculate dominant incident type
    const typeCounts = markers.reduce((acc, marker) => {
      const type = marker.options?.reportData?.type || 'other'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})
    
    const dominantType = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    )
    
    // Calculate average severity
    const totalSeverity = markers.reduce((sum, marker) => 
      sum + (marker.options?.reportData?.severity || 3), 0
    )
    const avgSeverity = totalSeverity / markers.length
    
    // Base colors by incident type
    const typeColors = {
      'chadabaji': '#F59E0B',    // Amber - organized crime
      'teen_gang': '#EF4444',    // Red - dangerous gangs
      'chintai': '#F97316',      // Orange - harassment
      'other': '#6B7280'         // Gray - general incidents
    }
    
    let baseColor = typeColors[dominantType] || typeColors.other
    
    // Intensity based on average severity
    if (avgSeverity >= 4) {
      // High severity - darker, more intense
      baseColor = baseColor.replace('#', '').match(/.{2}/g)
      const [r, g, b] = baseColor.map(hex => Math.max(0, parseInt(hex, 16) - 40))
      return `rgb(${r}, ${g}, ${b})`
    } else if (avgSeverity <= 2) {
      // Low severity - lighter, less intense  
      baseColor = baseColor.replace('#', '').match(/.{2}/g)
      const [r, g, b] = baseColor.map(hex => Math.min(255, parseInt(hex, 16) + 40))
      return `rgb(${r}, ${g}, ${b})`
    }
    
    return baseColor
  }, [])

  // Get cluster icon size based on count
  const getClusterSize = useCallback((count) => {
    if (count >= 100) return { size: 60, textSize: '14px', ringSize: 4 }
    if (count >= 50) return { size: 50, textSize: '13px', ringSize: 3 }
    if (count >= 20) return { size: 42, textSize: '12px', ringSize: 3 }
    if (count >= 10) return { size: 36, textSize: '11px', ringSize: 2 }
    if (count >= 5) return { size: 32, textSize: '10px', ringSize: 2 }
    return { size: 28, textSize: '9px', ringSize: 2 }
  }, [])

  // Custom icon creation function for clusters
  const createClusterIcon = useCallback((cluster) => {
    const markers = cluster.getAllChildMarkers()
    const count = markers.length
    const color = getClusterColor(markers)
    const { size, textSize, ringSize } = getClusterSize(count)
    
    // Calculate danger level for visual cues
    const avgSeverity = markers.reduce((sum, marker) => 
      sum + (marker.options?.reportData?.severity || 3), 0
    ) / markers.length
    
    const isDangerous = avgSeverity >= 4
    const pulseClass = isDangerous ? 'animate-pulse' : ''
    const ringColor = isDangerous ? '#EF4444' : color
    
    // Format count for display
    const displayCount = count >= 1000 ? `${Math.floor(count/1000)}k+` : count.toString()
    
    return L.divIcon({
      html: `
        <div class="cluster-marker ${pulseClass}" style="
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: ${ringSize}px solid ${ringColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          position: relative;
          z-index: 1000;
        ">
          <span style="
            color: white;
            font-weight: bold;
            font-size: ${textSize};
            text-shadow: 0 1px 2px rgba(0,0,0,0.7);
            user-select: none;
          ">${displayCount}</span>
          ${isDangerous ? `
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              background: #EF4444;
              border: 2px solid white;
              border-radius: 50%;
              z-index: 1001;
            "></div>
          ` : ''}
        </div>
      `,
      className: 'custom-cluster-icon',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    })
  }, [getClusterColor, getClusterSize])

  // Initialize cluster group with current configuration
  const initializeClusterGroup = useCallback((map) => {
    if (!map) return null

    const currentZoom = map.getZoom()
    lastZoomLevel.current = currentZoom
    
    // Get zoom-appropriate configuration
    const zoomConfig = Object.keys(dynamicConfig.zoomThresholds)
      .reverse()
      .find(zoom => currentZoom >= parseInt(zoom))
    
    const activeConfig = dynamicConfig.zoomThresholds[zoomConfig] || 
                        dynamicConfig.zoomThresholds[14]

    const clusterGroup = L.markerClusterGroup({
      ...dynamicConfig,
      maxClusterRadius: activeConfig.radius,
      disableClusteringAtZoom: activeConfig.maxZoom,
      iconCreateFunction: createClusterIcon,
      
      // Enhanced popup on cluster click
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      
      // Mobile-optimized events
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50
    })

    clusterGroupRef.current = clusterGroup
    return clusterGroup
  }, [dynamicConfig, createClusterIcon])

  // Process reports into clustered markers
  const processReports = useCallback(async (reports, map) => {
    if (!map || !reports || reports.length === 0) return null

    setIsProcessing(true)
    
    try {
      // Clear existing cluster group
      if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
        map.removeLayer(clusterGroupRef.current)
      }

      // Initialize new cluster group
      const clusterGroup = initializeClusterGroup(map)
      if (!clusterGroup) return null

      // Process reports in chunks for performance
      const chunkSize = 100
      const totalChunks = Math.ceil(reports.length / chunkSize)
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = reports.slice(i * chunkSize, (i + 1) * chunkSize)
        
        const markers = chunk
          .filter(report => report.location?.coordinates)
          .map(report => {
            const [lng, lat] = report.location.coordinates
            
            if (!lat || !lng || lat === 0 || lng === 0) return null

            // Calculate clustering weight
            const weight = calculateClusterWeight(report)
            
            // Create marker with enhanced data
            const marker = L.marker([lat, lng], {
              reportData: report,
              clusterWeight: weight
            })

            // Add popup with report info
            const popupContent = createReportPopup(report)
            marker.bindPopup(popupContent, {
              maxWidth: 280,
              className: 'custom-report-popup'
            })

            return marker
          })
          .filter(marker => marker !== null)

        clusterGroup.addLayers(markers)
        
        // Allow UI to update between chunks
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // Add cluster group to map
      map.addLayer(clusterGroup)

      // Update statistics
      setClusterStats({
        totalClusters: clusterGroup.getVisibleParent ? 
          Object.keys(clusterGroup._featureGroup._layers).length : 0,
        totalMarkers: reports.length,
        averageClusterSize: reports.length > 0 ? 
          Math.round(reports.length / Math.max(1, clusterGroup._topClusterLevel?.getChildCount() || 1)) : 0
      })

      console.log(`🎯 Processed ${reports.length} reports into clusters`)
      return clusterGroup

    } catch (error) {
      console.error('Error processing cluster data:', error)
      return null
    } finally {
      setIsProcessing(false)
    }
  }, [initializeClusterGroup, calculateClusterWeight])

  // Create enhanced popup content for individual reports
  const createReportPopup = useCallback((report) => {
    const incidentIcons = {
      'chadabaji': '💰',
      'teen_gang': '👥',
      'chintai': '⚠️',
      'other': '🚨'
    }

    const typeLabels = {
      'chadabaji': 'Chadabaji (Extortion)',
      'teen_gang': 'Teen Gang Activity',
      'chintai': 'Chintai (Harassment)', 
      'other': 'Other Criminal Activity'
    }

    const severityColors = {
      1: '#10B981', 2: '#84CC16', 3: '#F59E0B', 4: '#F97316', 5: '#EF4444'
    }

    const reportDate = new Date(report.createdAt || report.timestamp)
      .toLocaleDateString('en-BD', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })

    return `
      <div style="font-family: Inter, sans-serif; max-width: 260px;">
        <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid ${severityColors[report.severity]};">
          <span style="font-size: 24px; margin-right: 8px;">${incidentIcons[report.type]}</span>
          <div>
            <div style="font-weight: bold; color: #006A4E; font-size: 16px;">
              ${typeLabels[report.type]}
            </div>
            <div style="font-size: 12px; color: #666;">
              Severity: <span style="color: ${severityColors[report.severity]}; font-weight: 600;">Level ${report.severity}</span>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">📍 Location</div>
          <div style="color: #6B7280; font-size: 12px;">
            ${report.location.address || 'General area (privacy protected)'}
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Description</div>
          <div style="color: #6B7280; font-size: 12px; background: #F9FAFB; padding: 8px; border-radius: 6px;">
            ${report.description.length > 120 ? report.description.substring(0, 120) + '...' : report.description}
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
          <div style="font-size: 11px; color: #9CA3AF;">📅 ${reportDate}</div>
          <div style="font-size: 11px; color: #9CA3AF;">ID: ${report._id?.slice(-6) || 'Unknown'}</div>
        </div>
      </div>
    `
  }, [])

  // Handle zoom changes for dynamic clustering
  const handleZoomChange = useCallback((map) => {
    if (!map || !clusterGroupRef.current) return

    const currentZoom = map.getZoom()
    const zoomDiff = Math.abs(currentZoom - lastZoomLevel.current)
    
    // Only reconfigure if significant zoom change
    if (zoomDiff >= 2) {
      lastZoomLevel.current = currentZoom
      
      // Reinitialize with new zoom-appropriate settings
      const reports = clusterGroupRef.current.getLayers()
        .map(layer => layer.options?.reportData)
        .filter(report => report)
      
      if (reports.length > 0) {
        processReports(reports, map)
      }
    }
  }, [processReports])

  // Cleanup function
  const cleanup = useCallback((map) => {
    if (map && clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
      map.removeLayer(clusterGroupRef.current)
    }
    clusterGroupRef.current = null
    setClusterStats({ totalClusters: 0, totalMarkers: 0, averageClusterSize: 0 })
  }, [])

  return {
    processReports,
    handleZoomChange,
    cleanup,
    isProcessing,
    clusterStats,
    clusterGroup: clusterGroupRef.current
  }
}