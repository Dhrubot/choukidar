// === frontend/src/components/Map/RouteDisplay.jsx ===
/**
 * RouteDisplay - Route Visualization for Leaflet Maps
 * Displays primary and alternative routes with safety indicators
 * Handles route interactions and waypoint markers
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { Navigation, MapPin, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react'

// Route styling based on safety score and type
const getRouteStyle = (route, isSelected = false, isHovered = false) => {
  const { safetyScore = 5, type = 'primary' } = route
  
  let color = '#2563EB' // Default blue
  let weight = 4
  let opacity = 0.7
  
  // Color based on safety score
  if (safetyScore >= 8) {
    color = '#16A34A' // Green - very safe
  } else if (safetyScore >= 6) {
    color = '#22C55E' // Light green - safe
  } else if (safetyScore >= 4) {
    color = '#EAB308' // Yellow - moderate
  } else if (safetyScore >= 2) {
    color = '#F97316' // Orange - risky
  } else {
    color = '#EF4444' // Red - dangerous
  }
  
  // Style variations for route type
  if (type === 'alternative') {
    weight = 3
    opacity = 0.5
  }
  
  // Interactive states
  if (isSelected) {
    weight += 2
    opacity = 0.9
  }
  
  if (isHovered) {
    weight += 1
    opacity = Math.min(opacity + 0.2, 1)
  }
  
  return {
    color,
    weight,
    opacity,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: type === 'alternative' ? '10, 5' : null
  }
}

// Create waypoint icon
const createWaypointIcon = (type, isInteractive = false) => {
  const icons = {
    start: {
      color: '#16A34A',
      symbol: 'M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7l-10-5z',
      label: 'Start'
    },
    end: {
      color: '#EF4444', 
      symbol: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
      label: 'Destination'
    },
    waypoint: {
      color: '#3B82F6',
      symbol: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
      label: 'Waypoint'
    },
    incident: {
      color: '#F59E0B',
      symbol: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.34 16.5C3.57 18.333 4.532 20 6.072 20z',
      label: 'Incident'
    }
  }
  
  const icon = icons[type] || icons.waypoint
  const size = isInteractive ? 32 : 24
  
  return L.divIcon({
    html: `
      <div class="route-waypoint ${isInteractive ? 'interactive' : ''}" style="
        background-color: ${icon.color};
        border: 2px solid white;
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: ${isInteractive ? 'pointer' : 'default'};
      ">
        <svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="${icon.symbol}"></path>
        </svg>
      </div>
    `,
    className: 'route-waypoint-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

// Create route popup content
const createRoutePopup = (route) => {
  const {
    id,
    type = 'primary',
    distance,
    duration,
    safetyScore,
    safetyAnalysis,
    transportMode,
    recommendations
  } = route
  
  const getSafetyLabel = (score) => {
    if (score >= 8) return { label: 'Very Safe', color: '#16A34A' }
    if (score >= 6) return { label: 'Safe', color: '#22C55E' }
    if (score >= 4) return { label: 'Moderate', color: '#EAB308' }
    if (score >= 2) return { label: 'Risky', color: '#F97316' }
    return { label: 'Dangerous', color: '#EF4444' }
  }
  
  const safety = getSafetyLabel(safetyScore)
  
  return `
    <div class="route-popup" style="min-width: 250px;">
      <div style="display: flex; align-items: center; justify-content: between; margin-bottom: 12px;">
        <div style="
          background-color: ${type === 'primary' ? '#2563EB' : '#6B7280'};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-right: 8px;
        ">
          ${type === 'primary' ? 'RECOMMENDED' : 'ALTERNATIVE'}
        </div>
        <div style="
          background-color: ${safety.color};
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
        ">
          ${safety.label}
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: bold; color: #1F2937;">Distance:</span>
          <span style="color: #374151;">${distance || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: bold; color: #1F2937;">Duration:</span>
          <span style="color: #374151;">${duration || 'N/A'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: bold; color: #1F2937;">Safety Score:</span>
          <span style="color: ${safety.color}; font-weight: bold;">${safetyScore}/10</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold; color: #1F2937;">Transport:</span>
          <span style="color: #374151; text-transform: capitalize;">${transportMode || 'walking'}</span>
        </div>
      </div>
      
      ${safetyAnalysis && safetyAnalysis.breakdown ? `
        <div style="
          padding: 8px;
          background-color: #F9FAFB;
          border-radius: 6px;
          margin-bottom: 12px;
          border-left: 3px solid ${safety.color};
        ">
          <div style="font-size: 12px; font-weight: bold; color: #374151; margin-bottom: 4px;">
            Safety Analysis:
          </div>
          <div style="font-size: 11px; color: #6B7280; line-height: 1.4;">
            ${safetyAnalysis.breakdown.incidents ? `
              <div>• ${safetyAnalysis.breakdown.incidents.incidentCount || 0} incidents nearby</div>
            ` : ''}
            ${safetyAnalysis.breakdown.safeZones ? `
              <div>• ${safetyAnalysis.breakdown.safeZones.nearbyZones?.length || 0} safe zones along route</div>
            ` : ''}
            ${safetyAnalysis.breakdown.infrastructure ? `
              <div>• Police proximity: ${safetyAnalysis.breakdown.infrastructure.policeScore?.toFixed(1) || 'N/A'}/10</div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      
      ${recommendations && recommendations.length > 0 ? `
        <div style="
          padding: 8px;
          background-color: #EFF6FF;
          border-radius: 6px;
          margin-bottom: 12px;
          border-left: 3px solid #2563EB;
        ">
          <div style="font-size: 12px; font-weight: bold; color: #1E40AF; margin-bottom: 4px;">
            Recommendations:
          </div>
          <div style="font-size: 11px; color: #3730A3; line-height: 1.4;">
            ${recommendations.slice(0, 2).map(rec => `<div>• ${rec}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <div style="
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #E5E7EB;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <button 
          onclick="window.selectRoute && window.selectRoute('${id}')"
          style="
            background-color: #2563EB;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            font-weight: bold;
          "
        >
          Select Route
        </button>
        <span style="font-size: 11px; color: #9CA3AF;">
          Click line to select
        </span>
      </div>
    </div>
  `
}

const RouteDisplay = ({
  map,
  routes = null,
  isVisible = true,
  onRouteClick = null,
  onLayerReady = null,
  selectedRouteId = null,
  className = ""
}) => {
  // Layer references
  const layerGroupRef = useRef(null)
  const routeLinesRef = useRef(new Map())
  const waypointsRef = useRef(new Map())
  const [hoveredRouteId, setHoveredRouteId] = React.useState(null)

  // Create layer group on mount
  useEffect(() => {
    if (!map) return

    // Create layer group for routes
    layerGroupRef.current = L.layerGroup()
    
    if (isVisible) {
      layerGroupRef.current.addTo(map)
    }

    // Set up global callback for popup route selection
    window.selectRoute = (routeId) => {
      if (onRouteClick) {
        const allRoutes = []
        if (routes?.primary) allRoutes.push(routes.primary)
        if (routes?.alternatives) allRoutes.push(...routes.alternatives)
        
        const route = allRoutes.find(r => r.id === routeId)
        if (route) {
          onRouteClick(route)
        }
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
      delete window.selectRoute
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

  // Memoized route list
  const routeList = useMemo(() => {
    if (!routes) return []
    
    const list = []
    if (routes.primary) {
      list.push({ ...routes.primary, type: 'primary' })
    }
    if (routes.alternatives) {
      routes.alternatives.forEach(route => {
        list.push({ ...route, type: 'alternative' })
      })
    }
    return list
  }, [routes])

  // Update routes on map
  useEffect(() => {
    if (!map || !layerGroupRef.current) return

    // Clear existing routes
    layerGroupRef.current.clearLayers()
    routeLinesRef.current.clear()
    waypointsRef.current.clear()

    routeList.forEach((route, index) => {
      const { id, geometry, waypoints = [], type } = route

      if (!geometry || !geometry.coordinates) {
        console.warn('Invalid route geometry:', route)
        return
      }

      try {
        // Convert GeoJSON coordinates to Leaflet format
        const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]])

        // Create route line
        const isSelected = selectedRouteId === id
        const isHovered = hoveredRouteId === id
        
        const routeLine = L.polyline(latLngs, {
          ...getRouteStyle(route, isSelected, isHovered),
          interactive: true
        })

        // Add popup to route line
        const popupContent = createRoutePopup(route)
        routeLine.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'route-popup-container'
        })

        // Add tooltip for quick info
        const tooltipContent = `
          <div style="text-align: center;">
            <strong>${type === 'primary' ? 'Recommended Route' : `Alternative ${index}`}</strong><br>
            ${route.distance} • ${route.duration}<br>
            Safety: ${route.safetyScore}/10
          </div>
        `
        routeLine.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -10]
        })

        // Event handlers
        routeLine.on('click', () => {
          if (onRouteClick) {
            onRouteClick(route)
          }
        })

        routeLine.on('mouseover', () => {
          setHoveredRouteId(id)
        })

        routeLine.on('mouseout', () => {
          setHoveredRouteId(null)
        })

        // Add to layer group
        layerGroupRef.current.addLayer(routeLine)
        routeLinesRef.current.set(id, routeLine)

        // Add waypoints
        if (waypoints.length > 0) {
          waypoints.forEach((waypoint, wpIndex) => {
            const { coordinates, type: wpType = 'waypoint' } = waypoint
            
            if (coordinates && coordinates.length === 2) {
              const [lng, lat] = coordinates
              const marker = L.marker([lat, lng], {
                icon: createWaypointIcon(wpType, true),
                zIndexOffset: 1000
              })

              // Waypoint popup
              const waypointPopup = `
                <div style="text-align: center; min-width: 150px;">
                  <h4 style="margin: 0 0 8px 0; color: #1F2937;">
                    ${waypoint.name || `${wpType.charAt(0).toUpperCase() + wpType.slice(1)}`}
                  </h4>
                  ${waypoint.description ? `
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280;">
                      ${waypoint.description}
                    </p>
                  ` : ''}
                  <div style="font-size: 12px; color: #9CA3AF;">
                    Route ${type === 'primary' ? 'Recommended' : `Alternative ${index}`}
                  </div>
                </div>
              `
              
              marker.bindPopup(waypointPopup)
              
              // Click handler for waypoints
              marker.on('click', () => {
                if (onRouteClick) {
                  onRouteClick(route)
                }
              })

              layerGroupRef.current.addLayer(marker)
              
              // Store waypoint reference
              if (!waypointsRef.current.has(id)) {
                waypointsRef.current.set(id, [])
              }
              waypointsRef.current.get(id).push(marker)
            }
          })
        }

      } catch (error) {
        console.error('Error creating route display:', error, route)
      }
    })

  }, [map, routeList, selectedRouteId, hoveredRouteId, onRouteClick])

  // Update route styles when selection changes
  useEffect(() => {
    routeLinesRef.current.forEach((routeLine, routeId) => {
      const route = routeList.find(r => r.id === routeId)
      if (route) {
        const isSelected = selectedRouteId === routeId
        const isHovered = hoveredRouteId === routeId
        routeLine.setStyle(getRouteStyle(route, isSelected, isHovered))
      }
    })
  }, [selectedRouteId, hoveredRouteId, routeList])

  // Fit map to show all routes
  const fitToRoutes = useCallback(() => {
    if (!map || routeList.length === 0) return

    const group = new L.featureGroup()
    routeLinesRef.current.forEach(routeLine => {
      group.addLayer(routeLine)
    })

    if (group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), {
        padding: [20, 20]
      })
    }
  }, [map, routeList])

  // Expose methods to parent component
  useEffect(() => {
    if (map && layerGroupRef.current) {
      map.routeDisplay = {
        fitToRoutes,
        highlightRoute: (routeId) => {
          setHoveredRouteId(routeId)
        },
        unhighlightRoute: () => {
          setHoveredRouteId(null)
        },
        getRouteCount: () => routeList.length,
        hasRoutes: () => routeList.length > 0
      }
    }
  }, [map, routeList, fitToRoutes])

  return null // This component doesn't render anything directly
}

// Add CSS for route animations (inject into document head)
const addRouteCSS = () => {
  const css = `
    .route-waypoint.interactive {
      transition: all 0.2s ease;
    }
    
    .route-waypoint.interactive:hover {
      transform: scale(1.2);
    }
    
    .route-popup-container .leaflet-popup-content-wrapper {
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .route-popup-container .leaflet-popup-tip {
      background: white;
    }
    
    .route-waypoint-icon {
      transition: all 0.2s ease;
    }
    
    .leaflet-interactive:hover {
      filter: brightness(1.1);
    }
    
    /* Route line animations */
    .leaflet-interactive {
      transition: all 0.2s ease;
    }
    
    /* Mobile optimizations */
    @media (max-width: 768px) {
      .route-popup {
        font-size: 14px;
      }
      
      .route-waypoint {
        width: 28px !important;
        height: 28px !important;
      }
    }
  `
  
  // Check if CSS is already added
  if (!document.getElementById('route-display-styles')) {
    const style = document.createElement('style')
    style.id = 'route-display-styles'
    style.textContent = css
    document.head.appendChild(style)
  }
}

// Add CSS when component mounts
if (typeof window !== 'undefined') {
  addRouteCSS()
}

export default RouteDisplay