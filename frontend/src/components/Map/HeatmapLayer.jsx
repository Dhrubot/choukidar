// === frontend/src/components/Map/HeatmapLayer.jsx (COMPLETE + FIXED) ===
import { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet.heat'

const HeatmapLayer = ({ 
  map, 
  reports = [], 
  isVisible = false,
  heatmapOptions = {}
}) => {
  const heatLayerRef = useRef(null)

  // Default heatmap configuration optimized for Bangladesh crime data - MEMOIZED
  const defaultOptions = useMemo(() => ({
    radius: 25, // Base radius for heat points
    blur: 15, // Blur factor for smoother gradients
    maxZoom: 18, // Maximum zoom for heatmap visibility
    max: 1.0, // Maximum heat intensity
    gradient: {
      0.0: '#00ff00', // Green - Safe areas
      0.2: '#80ff00', // Light green
      0.4: '#ffff00', // Yellow - Moderate risk
      0.6: '#ff8000', // Orange
      0.8: '#ff4000', // Red-orange  
      1.0: '#ff0000'  // Red - High danger
    },
    ...heatmapOptions
  }), [heatmapOptions])

  // Convert reports to heatmap data points with severity weighting - MEMOIZED
  const prepareHeatmapData = useCallback((reports) => {
    return reports
      .filter(report => {
        // Only include approved reports with valid coordinates
        return report.status === 'approved' && 
               report.location?.coordinates && 
               Array.isArray(report.location.coordinates) &&
               report.location.coordinates.length === 2
      })
      .map(report => {
        const [lng, lat] = report.location.coordinates
        
        // Skip invalid coordinates
        if (!lat || !lng || lat === 0 || lng === 0) return null
        
        // Calculate heat intensity based on severity
        // Severity 1-2: Low heat (0.2-0.4)
        // Severity 3: Medium heat (0.5)  
        // Severity 4-5: High heat (0.7-1.0)
        let intensity
        if (report.severity <= 2) {
          intensity = 0.2 + (report.severity - 1) * 0.2 // 0.2-0.4
        } else if (report.severity === 3) {
          intensity = 0.5
        } else {
          intensity = 0.6 + (report.severity - 4) * 0.4 // 0.6-1.0
        }

        // Additional weighting by incident type
        const typeWeights = {
          'chadabaji': 1.0,     // Extortion - high community impact
          'teen_gang': 1.2,     // Teen gangs - high danger
          'chintai': 0.8,       // Harassment - significant but lower
          'other': 0.9          // Other incidents
        }

        const typeWeight = typeWeights[report.type] || 0.9
        const finalIntensity = Math.min(intensity * typeWeight, 1.0)

        return [lat, lng, finalIntensity]
      })
      .filter(point => point !== null) // Remove invalid points
  }, [])

  // Memoize the heatmap data to prevent recalculation on every render
  const heatmapData = useMemo(() => {
    return prepareHeatmapData(reports)
  }, [reports, prepareHeatmapData])

  // Update heatmap when reports or visibility changes - FIXED DEPENDENCIES
  useEffect(() => {
    if (!map) return

    // Remove existing heatmap layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    // Create new heatmap if visible and has data
    if (isVisible && reports.length > 0) {
      if (heatmapData.length > 0) {
        // Create heatmap layer
        heatLayerRef.current = L.heatLayer(heatmapData, defaultOptions)
        heatLayerRef.current.addTo(map)

        console.log(`🔥 Heatmap created with ${heatmapData.length} data points`)
      } else {
        console.log('⚠️ No valid heatmap data points found')
      }
    }

    // Cleanup function
    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current)
        heatLayerRef.current = null
      }
    }
  }, [map, reports, isVisible, heatmapData, defaultOptions]) // FIXED: Using memoized values

  // Update heatmap options when they change - FIXED DEPENDENCIES
  useEffect(() => {
    if (heatLayerRef.current && isVisible) {
      // Update heatmap options
      heatLayerRef.current.setOptions(defaultOptions)
    }
  }, [defaultOptions, isVisible]) // FIXED: Using memoized defaultOptions

  // This component doesn't render anything visible - it manages the Leaflet layer
  return null
}

// Export different heatmap presets for different use cases
export const HeatmapPresets = {
  // General crime density
  default: {
    radius: 25,
    blur: 15,
    maxZoom: 18
  },
  
  // High detail for zoomed-in views
  detailed: {
    radius: 15,
    blur: 10,
    maxZoom: 20
  },
  
  // Broad overview for city-wide analysis
  overview: {
    radius: 40,
    blur: 25,
    maxZoom: 16
  },

  // Mobile-optimized with better performance
  mobile: {
    radius: 20,
    blur: 12,
    maxZoom: 17
  }
}

export default HeatmapLayer