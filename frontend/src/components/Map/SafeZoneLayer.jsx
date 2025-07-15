// === frontend/src/components/Map/SafeZoneLayer.jsx ===
/**
 * SafeZoneLayer - Leaflet Integration for Safe Zones
 * Renders safe zones as circles and polygons on the map
 * Handles click events and tooltips
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { Shield, Star, MapPin, Clock } from 'lucide-react'

// Safe zone styling based on safety score
const getSafeZoneStyle = (zone) => {
  const { safetyScore, type, isActive } = zone
  
  let baseColor = '#16A34A' // Green
  let opacity = 0.3
  let fillOpacity = 0.1
  
  // Color based on safety score
  if (safetyScore >= 8) {
    baseColor = '#16A34A' // Dark green
  } else if (safetyScore >= 6) {
    baseColor = '#22C55E' // Light green  
  } else if (safetyScore >= 4) {
    baseColor = '#EAB308' // Yellow
  } else {
    baseColor = '#F97316' // Orange
  }
  
  // Special styling for admin zones
  if (type === 'admin') {
    opacity = 0.5
    fillOpacity = 0.15
    baseColor = '#2563EB' // Blue for verified zones
  }
  
  // Active state styling
  if (isActive) {
    opacity = 0.8
    fillOpacity = 0.3
  }
  
  return {
    color: baseColor,
    weight: 2,
    opacity,
    fillColor: baseColor,
    fillOpacity,
    dashArray: type === 'dynamic' ? '5, 5' : null
  }
}

// Create safe zone icon
const createSafeZoneIcon = (zone) => {
  const { safetyScore, type } = zone
  
  let color = '#16A34A'
  if (safetyScore >= 8) color = '#16A34A'
  else if (safetyScore >= 6) color = '#22C55E'
  else if (safetyScore >= 4) color = '#EAB308'
  else color = '#F97316'
  
  const iconType = type === 'admin' ? 'star' : 'shield'
  
  return L.divIcon({
    html: `
      <div class="safe-zone-marker" style="
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          ${iconType === 'star' 
            ? '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>'
            : '<path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z"></path>'
          }
        </svg>
      </div>
    `,
    className: 'safe-zone-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  })
}

// Create popup content for safe zones
const createPopupContent = (zone) => {
  const {
    name,
    type,
    safetyScore,
    description,
    coverage,
    lastUpdated,
    verifiedBy
  } = zone
  
  return `
    <div class="safe-zone-popup" style="min-width: 200px;">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <div style="
          background-color: ${type === 'admin' ? '#2563EB' : '#16A34A'};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-right: 8px;
        ">
          ${type === 'admin' ? 'VERIFIED' : 'SAFE ZONE'}
        </div>
        <div style="
          background-color: #F3F4F6;
          color: #374151;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
        ">
          ${safetyScore}/10
        </div>
      </div>
      
      <h4 style="margin: 0 0 8px 0; font-weight: bold; color: #1F2937;">
        ${name || 'Safe Zone'}
      </h4>
      
      ${description ? `
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; line-height: 1.4;">
          ${description}
        </p>
      ` : ''}
      
      <div style="font-size: 12px; color: #6B7280; line-height: 1.4;">
        ${coverage ? `<div>Coverage: ${coverage.toFixed(1)} km²</div>` : ''}
        ${verifiedBy ? `<div>Verified by: ${verifiedBy}</div>` : ''}
        ${lastUpdated ? `<div>Updated: ${new Date(lastUpdated).toLocaleDateString()}</div>` : ''}
      </div>
      
      <div style="
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #E5E7EB;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <button 
          onclick="window.selectSafeZone && window.selectSafeZone('${zone.id}')"
          style="
            background-color: #16A34A;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
          "
        >
          Navigate Here
        </button>
        <span style="font-size: 11px; color: #9CA3AF;">
          Click to select
        </span>
      </div>
    </div>
  `
}

const SafeZoneLayer = ({
  map,
  safeZones = [],
  isVisible = true,
  userLocation = null,
  onZoneClick = null,
  onLayerReady = null,
  className = ""
}) => {
  // Layer reference
  const layerGroupRef = useRef(null)
  const markersRef = useRef(new Map())
  const circlesRef = useRef(new Map())

  // Create layer group on mount
  useEffect(() => {
    if (!map) return

    // Create layer group for safe zones
    layerGroupRef.current = L.layerGroup()
    
    if (isVisible) {
      layerGroupRef.current.addTo(map)
    }

    // Set up global callback for popup navigation
    window.selectSafeZone = (zoneId) => {
      const zone = safeZones.find(z => z.id === zoneId)
      if (zone && onZoneClick) {
        onZoneClick(zone)
      }
    }

    // Notify parent that layer is ready
    if (onLayerReady) {
      onLayerReady()
    }

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.remove()
      }
      delete window.selectSafeZone
    }
  }, [map, isVisible, onLayerReady])

  // Update visibility
  useEffect(() => {
    if (!map || !layerGroupRef.current) return

    if (isVisible) {
      if (!map.hasLayer(layerGroupRef.current)) {
        layerGroupRef.current.addTo(map)
      }
    } else {
      if (map.hasLayer(layerGroupRef.current)) {
        layerGroupRef.current.remove()
      }
    }
  }, [map, isVisible])

  // Memoized safe zones with enhanced data
  const enhancedSafeZones = useMemo(() => {
    return safeZones.map(zone => {
      // Calculate distance from user if location available
      let distanceFromUser = null
      if (userLocation && zone.coordinates) {
        const latDiff = userLocation.lat - zone.coordinates[0]
        const lngDiff = userLocation.lng - zone.coordinates[1]
        distanceFromUser = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111.32 // Rough km conversion
      }

      return {
        ...zone,
        distanceFromUser,
        isNearby: distanceFromUser ? distanceFromUser < 2 : false, // Within 2km
        isActive: false // Will be set by click handlers
      }
    })
  }, [safeZones, userLocation])

  // Update safe zones on map
  useEffect(() => {
    if (!map || !layerGroupRef.current) return

    // Clear existing markers and circles
    layerGroupRef.current.clearLayers()
    markersRef.current.clear()
    circlesRef.current.clear()

    enhancedSafeZones.forEach(zone => {
      const { id, coordinates, radius = 500, type } = zone

      if (!coordinates || coordinates.length !== 2) {
        console.warn('Invalid safe zone coordinates:', zone)
        return
      }

      const [lat, lng] = coordinates

      try {
        // Create circle for zone coverage
        const circle = L.circle([lat, lng], {
          radius: radius,
          ...getSafeZoneStyle(zone)
        })

        // Create marker for zone center
        const marker = L.marker([lat, lng], {
          icon: createSafeZoneIcon(zone)
        })

        // Add popup to marker
        const popupContent = createPopupContent(zone)
        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'safe-zone-popup-container'
        })

        // Add tooltip on hover
        const tooltipContent = `
          <div style="text-align: center;">
            <strong>${zone.name || 'Safe Zone'}</strong><br>
            Safety: ${zone.safetyScore}/10
            ${zone.distanceFromUser ? `<br>Distance: ${zone.distanceFromUser.toFixed(1)}km` : ''}
          </div>
        `
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -10]
        })

        // Click handlers
        const handleClick = () => {
          if (onZoneClick) {
            onZoneClick(zone)
          }
        }

        marker.on('click', handleClick)
        circle.on('click', handleClick)

        // Hover effects
        marker.on('mouseover', () => {
          circle.setStyle({
            ...getSafeZoneStyle({ ...zone, isActive: true })
          })
        })

        marker.on('mouseout', () => {
          circle.setStyle({
            ...getSafeZoneStyle(zone)
          })
        })

        // Add to layer group
        layerGroupRef.current.addLayer(circle)
        layerGroupRef.current.addLayer(marker)

        // Store references
        markersRef.current.set(id, marker)
        circlesRef.current.set(id, circle)

      } catch (error) {
        console.error('Error creating safe zone layer:', error, zone)
      }
    })

  }, [map, enhancedSafeZones, onZoneClick])

  // Highlight nearest safe zones
  useEffect(() => {
    if (!userLocation) return

    markersRef.current.forEach((marker, zoneId) => {
      const zone = enhancedSafeZones.find(z => z.id === zoneId)
      if (zone && zone.isNearby) {
        // Add pulsing effect for nearby zones
        const icon = marker.getIcon()
        if (icon && icon.options && icon.options.html) {
          const pulsingHtml = icon.options.html.replace(
            'class="safe-zone-marker"',
            'class="safe-zone-marker safe-zone-nearby"'
          )
          marker.setIcon(L.divIcon({
            ...icon.options,
            html: pulsingHtml
          }))
        }
      }
    })
  }, [userLocation, enhancedSafeZones])

  // Public methods for external control
  const highlightZone = useCallback((zoneId) => {
    const circle = circlesRef.current.get(zoneId)
    const marker = markersRef.current.get(zoneId)
    const zone = enhancedSafeZones.find(z => z.id === zoneId)
    
    if (circle && zone) {
      circle.setStyle({
        ...getSafeZoneStyle({ ...zone, isActive: true })
      })
    }
    
    if (marker) {
      marker.openPopup()
    }
  }, [enhancedSafeZones])

  const unhighlightZone = useCallback((zoneId) => {
    const circle = circlesRef.current.get(zoneId)
    const zone = enhancedSafeZones.find(z => z.id === zoneId)
    
    if (circle && zone) {
      circle.setStyle(getSafeZoneStyle(zone))
    }
  }, [enhancedSafeZones])

  const centerOnZone = useCallback((zoneId) => {
    const zone = enhancedSafeZones.find(z => z.id === zoneId)
    if (zone && zone.coordinates && map) {
      map.setView(zone.coordinates, Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 1
      })
      
      // Highlight the zone briefly
      highlightZone(zoneId)
      setTimeout(() => unhighlightZone(zoneId), 3000)
    }
  }, [map, enhancedSafeZones, highlightZone, unhighlightZone])

  // Get zones visible in current map bounds
  const getVisibleZones = useCallback(() => {
    if (!map) return []
    
    const bounds = map.getBounds()
    return enhancedSafeZones.filter(zone => {
      if (!zone.coordinates) return false
      const [lat, lng] = zone.coordinates
      return bounds.contains([lat, lng])
    })
  }, [map, enhancedSafeZones])

  // Get zones near a specific point
  const getZonesNearPoint = useCallback((point, radiusKm = 2) => {
    if (!point || !point.lat || !point.lng) return []
    
    return enhancedSafeZones.filter(zone => {
      if (!zone.coordinates) return false
      
      const [lat, lng] = zone.coordinates
      const latDiff = point.lat - lat
      const lngDiff = point.lng - lng
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111.32
      
      return distance <= radiusKm
    })
  }, [enhancedSafeZones])

  // Get zone statistics
  const getZoneStatistics = useCallback(() => {
    const stats = {
      total: enhancedSafeZones.length,
      byType: {},
      bySafety: {
        high: 0,   // 8-10
        medium: 0, // 5-7
        low: 0     // 0-4
      },
      averageSafety: 0,
      nearbyCount: 0
    }

    enhancedSafeZones.forEach(zone => {
      // Count by type
      stats.byType[zone.type] = (stats.byType[zone.type] || 0) + 1
      
      // Count by safety level
      if (zone.safetyScore >= 8) stats.bySafety.high++
      else if (zone.safetyScore >= 5) stats.bySafety.medium++
      else stats.bySafety.low++
      
      // Count nearby zones
      if (zone.isNearby) stats.nearbyCount++
    })

    // Calculate average safety
    if (enhancedSafeZones.length > 0) {
      stats.averageSafety = enhancedSafeZones.reduce((sum, zone) => sum + zone.safetyScore, 0) / enhancedSafeZones.length
    }

    return stats
  }, [enhancedSafeZones])

  // Expose methods to parent component
  useEffect(() => {
    if (map && layerGroupRef.current) {
      map.safeZoneLayer = {
        highlightZone,
        unhighlightZone,
        centerOnZone,
        getZoneCount: () => enhancedSafeZones.length,
        getVisibleZones,
        getZonesNearPoint,
        getZoneStatistics,
        refreshZones: () => {
          // Force re-render by clearing and rebuilding
          if (layerGroupRef.current) {
            layerGroupRef.current.clearLayers()
            markersRef.current.clear()
            circlesRef.current.clear()
          }
        }
      }
    }
  }, [map, enhancedSafeZones, highlightZone, unhighlightZone, centerOnZone, getVisibleZones, getZonesNearPoint, getZoneStatistics])

  return null // This component doesn't render anything directly
}

// Add CSS for animations (inject into document head)
const addSafeZoneCSS = () => {
  const css = `
    .safe-zone-nearby {
      animation: pulse-green 2s infinite;
    }
    
    @keyframes pulse-green {
      0% {
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
      }
    }
    
    .safe-zone-popup-container .leaflet-popup-content-wrapper {
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .safe-zone-popup-container .leaflet-popup-tip {
      background: white;
    }
    
    .safe-zone-icon {
      transition: all 0.2s ease;
    }
    
    .safe-zone-icon:hover {
      transform: scale(1.1);
    }
    
    /* Mobile optimizations */
    @media (max-width: 768px) {
      .safe-zone-popup {
        font-size: 14px;
      }
      
      .safe-zone-marker {
        width: 20px !important;
        height: 20px !important;
      }
      
      .safe-zone-popup button {
        padding: 6px 10px !important;
        font-size: 11px !important;
      }
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .safe-zone-marker {
        border-width: 3px !important;
      }
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
      .safe-zone-nearby {
        animation: none;
      }
      
      .safe-zone-icon {
        transition: none;
      }
    }
  `
  
  // Check if CSS is already added
  if (!document.getElementById('safe-zone-styles')) {
    const style = document.createElement('style')
    style.id = 'safe-zone-styles'
    style.textContent = css
    document.head.appendChild(style)
  }
}

// Add CSS when component mounts
if (typeof window !== 'undefined') {
  addSafeZoneCSS()
}

export default SafeZoneLayer