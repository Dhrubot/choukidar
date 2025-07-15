// === src/components/Map/MapView.jsx (ENHANCED with Safe Zones & Route Intelligence) ===
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

// ✅ EXISTING COMPONENTS PRESERVED
import HeatmapLayer from './HeatmapLayer'
import MarkerCluster from './MarkerCluster'

// 🆕 PHASE 3B: NEW COMPONENTS
import SafeZones from './SafeZones'
import RoutePlanner from './RoutePlanner'

// Fix default marker icon issue in Leaflet (PRESERVED)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const MapView = ({ 
  // ✅ EXISTING PROPS PRESERVED
  reports = [], 
  center = [23.8103, 90.4125], 
  zoom = 11,
  viewMode = 'markers', // 'markers', 'heatmap', 'hybrid', 'clusters'
  heatmapOptions = {},
  clusteringOptions = {},
  onMapReady = null,
  onClusterClick = null,
  onMarkerClick = null,
  className = "",
  
  // 🆕 PHASE 3B: NEW PROPS FOR SAFE ZONES & ROUTING
  userLocation = null,
  showSafeZones = false,
  showRoutePlanner = false,
  safeZoneOptions = {},
  routePlannerOptions = {},
  onSafeZoneSelect = null,
  onSafeZoneHover = null,
  onRouteSelect = null,
  onRouteHover = null
}) => {
  // ✅ EXISTING STATE PRESERVED
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [performanceMode, setPerformanceMode] = useState('normal')

  // ✅ EXISTING MEMOIZED CONFIG PRESERVED
  const mapConfig = useMemo(() => ({
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true,
    touchZoom: true,
    boxZoom: true,
    keyboard: true,
    preferCanvas: reports.length > 500 // Use canvas for better performance with large datasets
  }), [reports.length])

  const tileLayerConfig = useMemo(() => ({
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }
  }), [])

  // ✅ EXISTING RENDERING STRATEGY PRESERVED
  const renderingStrategy = useMemo(() => {
    const count = reports.length
    
    if (count > 1000) {
      return {
        mode: 'performance',
        preferClustering: true,
        defaultViewMode: 'clusters',
        chunkSize: 50
      }
    } else if (count > 500) {
      return {
        mode: 'balanced',
        preferClustering: true,
        defaultViewMode: 'hybrid',
        chunkSize: 100
      }
    } else {
      return {
        mode: 'normal',
        preferClustering: false,
        defaultViewMode: 'markers',
        chunkSize: 200
      }
    }
  }, [reports.length])

  // 🆕 ENHANCED CLUSTERING OPTIONS WITH SAFE ZONE INTEGRATION
  const enhancedClusteringOptions = useMemo(() => {
    const baseOptions = {
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
      },
      ...clusteringOptions
    }

    // 🆕 INTEGRATE SAFE ZONE AWARENESS INTO CLUSTERING
    if (showSafeZones) {
      baseOptions.safeZoneAware = true
      baseOptions.highlightSafeZoneClusters = true
    }

    return baseOptions
  }, [clusteringOptions, showSafeZones])

  // ✅ EXISTING MAP INITIALIZATION EFFECT PRESERVED
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Create map instance
    const map = L.map(mapRef.current, {
      center,
      zoom,
      ...mapConfig
    })

    // Add tile layer
    L.tileLayer(tileLayerConfig.url, tileLayerConfig.options).addTo(map)

    // ✅ EXISTING LEGEND CONTROL PRESERVED
    const info = L.control({ position: 'topright' })
    info.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-control-legend')
      div.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <div style="font-weight: bold; color: #006A4E; margin-bottom: 6px; display: flex; align-items: center;">
            🛡️ SafeStreets Bangladesh
          </div>
          <div style="font-size: 11px; color: #666; line-height: 1.3;">
            🔴 Critical • 🟠 High • 🟡 Medium • 🟢 Low Risk<br>
            <span style="color: #888;">Intelligent crime mapping</span>
          </div>
        </div>
      `
      return div
    }
    info.addTo(map)

    // ✅ EXISTING PERFORMANCE INDICATOR PRESERVED
    const performanceInfo = L.control({ position: 'topleft' })
    performanceInfo.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-control-performance')
      div.style.cssText = `
        background: white; 
        padding: 8px 12px; 
        border-radius: 6px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border: 1px solid #e2e8f0;
        font-size: 12px;
        font-weight: 500;
        color: #374151;
        margin-bottom: 10px;
      `
      return div
    }
    performanceInfo.addTo(map)

    // 🆕 PHASE 3B: ADD SAFE ZONE & ROUTE CONTROLS
    if (showSafeZones || showRoutePlanner) {
      const intelligenceInfo = L.control({ position: 'topleft' })
      intelligenceInfo.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-control-intelligence')
        div.style.cssText = `
          background: linear-gradient(135deg, #006A4E 0%, #00A86B 100%); 
          padding: 8px 12px; 
          border-radius: 6px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          border: 1px solid rgba(255,255,255,0.2);
          font-size: 11px;
          font-weight: 600;
          color: white;
          margin-bottom: 8px;
          text-align: center;
        `
        
        let content = '🧠 Safety Intelligence Active'
        if (showSafeZones && showRoutePlanner) {
          content += '<br><span style="font-size: 10px; opacity: 0.9;">🛡️ Safe Zones • 🗺️ Smart Routing</span>'
        } else if (showSafeZones) {
          content += '<br><span style="font-size: 10px; opacity: 0.9;">🛡️ Safe Zones Active</span>'
        } else if (showRoutePlanner) {
          content += '<br><span style="font-size: 10px; opacity: 0.9;">🗺️ Smart Routing Active</span>'
        }
        
        div.innerHTML = content
        return div
      }
      intelligenceInfo.addTo(map)
    }

    mapInstanceRef.current = map
    setIsMapReady(true)

    // Notify parent that map is ready
    if (onMapReady) {
      onMapReady(map)
    }

    console.log(`🗺️ Enhanced MapView initialized - ${renderingStrategy.mode} mode for ${reports.length} reports`)
    if (showSafeZones) console.log('🛡️ Safe Zones overlay enabled')
    if (showRoutePlanner) console.log('🗺️ Route Intelligence enabled')

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        setIsMapReady(false)
      }
    }
  }, []) // FIXED: Empty dependency array - map should only initialize once

  // ✅ EXISTING PERFORMANCE INDICATOR UPDATE PRESERVED
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const performanceControl = mapInstanceRef.current._container?.querySelector('.leaflet-control-performance')
    if (performanceControl) {
      const modeLabels = {
        markers: '📍 Individual Markers',
        clusters: '🎯 Smart Clusters',
        heatmap: '🔥 Density Heatmap', 
        hybrid: '🔍 Hybrid View'
      }
      
      const modeColors = {
        markers: '#006A4E',
        clusters: '#8B5CF6',
        heatmap: '#F59E0B',
        hybrid: '#EF4444'
      }

      const actualViewMode = renderingStrategy.preferClustering && viewMode === 'markers' ? 'clusters' : viewMode
      const performanceLabel = renderingStrategy.mode === 'performance' ? ' ⚡' : 
                              renderingStrategy.mode === 'balanced' ? ' ⚖️' : ''

      performanceControl.innerHTML = `
        <span style="color: ${modeColors[actualViewMode]};">
          ${modeLabels[actualViewMode]} • ${reports.length} reports${performanceLabel}
        </span>
      `
    }
  }, [viewMode, reports.length, renderingStrategy])

  // ✅ EXISTING UTILITY FUNCTIONS PRESERVED
  const getSeverityColor = useCallback((severity) => {
    const colors = {
      1: '#10B981', // Green - Low
      2: '#84CC16', // Light green
      3: '#F59E0B', // Yellow - Medium  
      4: '#F97316', // Orange - High
      5: '#EF4444'  // Red - Critical
    }
    return colors[severity] || colors[3]
  }, [])

  const getIncidentIcon = useCallback((type) => {
    const icons = {
      'chadabaji': '💰',
      'teen_gang': '👥', 
      'chintai': '⚠️',
      'other': '🚨'
    }
    return icons[type] || icons.other
  }, [])

  // ✅ EXISTING POPUP CREATION PRESERVED
  const createEnhancedPopup = useCallback((report) => {
    const incidentIcon = getIncidentIcon(report.type)
    const severityColor = getSeverityColor(report.severity)
    const reportDate = new Date(report.createdAt || report.timestamp).toLocaleDateString('en-BD', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const typeLabels = {
      'chadabaji': 'Chadabaji (Extortion)',
      'teen_gang': 'Teen Gang Activity', 
      'chintai': 'Chintai (Harassment)',
      'other': 'Other Criminal Activity'
    }

    const severityLabels = {
      1: 'Low Risk',
      2: 'Low-Medium Risk', 
      3: 'Medium Risk',
      4: 'High Risk',
      5: 'Critical Risk'
    }

    return `
      <div style="font-family: Inter, sans-serif; max-width: 260px;">
        <div style="display: flex; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid ${severityColor};">
          <span style="font-size: 24px; margin-right: 8px;">${incidentIcon}</span>
          <div>
            <div style="font-weight: bold; color: #006A4E; font-size: 16px; line-height: 1.2;">
              ${typeLabels[report.type]}
            </div>
            <div style="background: ${severityColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block; margin-top: 4px;">
              ${severityLabels[report.severity]}
            </div>
          </div>
        </div>
        <div style="margin-bottom: 10px;">
          <div style="font-weight: 600; color: #374151; font-size: 13px; margin-bottom: 4px;">Description:</div>
          <div style="color: #6B7280; font-size: 12px; line-height: 1.4;">${report.description}</div>
        </div>
        <div style="padding-top: 8px; border-top: 1px solid #E5E7EB;">
          <div style="color: #9CA3AF; font-size: 11px;">
            📅 ${reportDate}
          </div>
          <div style="color: #9CA3AF; font-size: 11px; margin-top: 2px;">
            🆔 ${report._id?.slice(-8) || 'Unknown'}
          </div>
        </div>
      </div>
    `
  }, [getSeverityColor, getIncidentIcon])

  // ✅ EXISTING MARKER CREATION PRESERVED
  const addIndividualMarkers = useCallback((reports) => {
    // Clear existing markers first
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []

    if (!mapInstanceRef.current || !reports?.length) return

    console.log(`📍 Adding ${reports.length} individual markers...`)

    // Chunked loading for performance
    const processChunk = (startIndex) => {
      const endIndex = Math.min(startIndex + renderingStrategy.chunkSize, reports.length)
      const chunk = reports.slice(startIndex, endIndex)

      chunk.forEach(report => {
        if (!report.location?.coordinates || report.location.coordinates.length !== 2) {
          console.warn('Invalid coordinates for report:', report._id)
          return
        }

        const [lng, lat] = report.location.coordinates
        const markerColor = getSeverityColor(report.severity)
        const incidentIcon = getIncidentIcon(report.type)

        // Enhanced marker with subtle animation for recent reports
        const isRecent = Date.now() - new Date(report.createdAt || report.timestamp).getTime() < 24 * 60 * 60 * 1000
        const pulseClass = isRecent ? 'animate-pulse' : ''

        // Create enhanced custom marker
        const customIcon = L.divIcon({
          html: `
            <div class="custom-marker ${pulseClass}" style="
              background-color: ${markerColor};
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 3px solid white;
              box-shadow: 0 3px 12px rgba(0,0,0,0.4);
              font-size: 16px;
              position: relative;
              z-index: 1000;
            ">
              ${incidentIcon}
            </div>
          `,
          className: 'custom-div-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })

        // Create marker with enhanced popup
        const marker = L.marker([lat, lng], { icon: customIcon })

        // Enhanced popup content
        const popupContent = createEnhancedPopup(report)
        marker.bindPopup(popupContent, {
          maxWidth: 280,
          className: 'custom-popup'
        })

        // Add click handler
        marker.on('click', () => {
          if (onMarkerClick) {
            onMarkerClick({
              marker,
              report,
              position: marker.getLatLng()
            })
          }
        })

        marker.addTo(mapInstanceRef.current)
        markersRef.current.push(marker)
      })

      // Process next chunk
      if (endIndex < reports.length) {
        // Use requestAnimationFrame for smooth loading
        requestAnimationFrame(() => processChunk(endIndex))
      } else {
        // Adjust map view to show all markers if reasonable number
        if (markersRef.current.length > 0 && markersRef.current.length <= 50) {
          const group = new L.featureGroup(markersRef.current)
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.05))
        }
        console.log(`📍 Added ${markersRef.current.length} individual markers`)
      }
    }

    if (reports.length > 0) {
      processChunk(0)
    }
  }, [getSeverityColor, getIncidentIcon, createEnhancedPopup, renderingStrategy.chunkSize, onMarkerClick])

  // ✅ EXISTING CLUSTERING LOGIC PRESERVED
  const shouldUseClustering = useMemo(() => {
    if (viewMode === 'clusters') return true
    if (viewMode === 'heatmap') return false
    if (viewMode === 'hybrid') return reports.length > 100
    if (viewMode === 'markers') return renderingStrategy.preferClustering
    return false
  }, [viewMode, reports.length, renderingStrategy.preferClustering])

  const shouldShowIndividualMarkers = useMemo(() => {
    if (viewMode === 'heatmap') return false
    if (viewMode === 'clusters') return false
    if (viewMode === 'hybrid') return reports.length <= 100
    if (viewMode === 'markers') return !shouldUseClustering
    return false
  }, [viewMode, reports.length, shouldUseClustering])

  // ✅ EXISTING MARKER EFFECTS PRESERVED
  useEffect(() => {
    if (!mapInstanceRef.current || !shouldShowIndividualMarkers) {
      // Clear existing markers if not showing individual markers
      markersRef.current.forEach(marker => {
        mapInstanceRef.current.removeLayer(marker)
      })
      markersRef.current = []
      return
    }

    if (reports.length > 0) {
      addIndividualMarkers(reports)
    }
  }, [reports, shouldShowIndividualMarkers, addIndividualMarkers])

  // ✅ EXISTING CLUSTER CLICK HANDLER PRESERVED
  const handleClusterClick = useCallback((clusterData) => {
    console.log(`🎯 Cluster clicked: ${clusterData.count} reports`)
    
    if (onClusterClick) {
      onClusterClick(clusterData)
    }
    
    // Default behavior is handled by the MarkerCluster component
  }, [onClusterClick])

  // ✅ EXISTING PERFORMANCE MONITORING PRESERVED
  useEffect(() => {
    const newPerformanceMode = reports.length > 1000 ? 'heavy' : 
                             reports.length > 500 ? 'moderate' : 'normal'
    
    if (newPerformanceMode !== performanceMode) {
      setPerformanceMode(newPerformanceMode)
      console.log(`⚡ Performance mode changed: ${performanceMode} → ${newPerformanceMode}`)
    }
  }, [reports.length, performanceMode])

  // 🆕 PHASE 3B: SAFE ZONE EVENT HANDLERS
  const handleSafeZoneSelect = useCallback((safeZone) => {
    console.log('🛡️ Safe zone selected:', safeZone.id)
    if (onSafeZoneSelect) {
      onSafeZoneSelect(safeZone)
    }
  }, [onSafeZoneSelect])

  const handleSafeZoneHover = useCallback((safeZone, isHovering) => {
    if (onSafeZoneHover) {
      onSafeZoneHover(safeZone, isHovering)
    }
  }, [onSafeZoneHover])

  // 🆕 PHASE 3B: ROUTE EVENT HANDLERS
  const handleRouteSelect = useCallback((route) => {
    console.log('🗺️ Route selected:', route.id)
    if (onRouteSelect) {
      onRouteSelect(route)
    }
  }, [onRouteSelect])

  const handleRouteHover = useCallback((route, isHovering) => {
    if (onRouteHover) {
      onRouteHover(route, isHovering)
    }
  }, [onRouteHover])

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full min-h-[400px] rounded-lg"
        style={{ zIndex: 1 }}
      />
      
      {/* ✅ EXISTING MARKER CLUSTERING PRESERVED */}
      {isMapReady && shouldUseClustering && (
        <MarkerCluster
          map={mapInstanceRef.current}
          reports={reports}
          isVisible={true}
          clusteringOptions={enhancedClusteringOptions}
          onClusterClick={handleClusterClick}
          onMarkerClick={onMarkerClick}
        />
      )}
      
      {/* ✅ EXISTING HEATMAP LAYER PRESERVED */}
      {isMapReady && (viewMode === 'heatmap' || viewMode === 'hybrid') && (
        <HeatmapLayer
          map={mapInstanceRef.current}
          reports={reports}
          isVisible={true}
          heatmapOptions={heatmapOptions}
        />
      )}

      {/* 🆕 PHASE 3B: SAFE ZONES OVERLAY */}
      {isMapReady && showSafeZones && (
        <SafeZones
          map={mapInstanceRef.current}
          reports={reports}
          userLocation={userLocation}
          isVisible={true}
          options={safeZoneOptions}
          onZoneSelect={handleSafeZoneSelect}
          onZoneHover={handleSafeZoneHover}
          showControls={false} // Map overlay mode
          showStatistics={false}
          enableMonitoring={true}
        />
      )}

      {/* 🆕 PHASE 3B: ROUTE PLANNER OVERLAY */}
      {isMapReady && showRoutePlanner && (
        <RoutePlanner
          map={mapInstanceRef.current}
          reports={reports}
          userLocation={userLocation}
          isVisible={true}
          options={routePlannerOptions}
          onRouteSelect={handleRouteSelect}
          onRouteHover={handleRouteHover}
          showAdvanced={false} // Map overlay mode
          enableMonitoring={true}
        />
      )}

      {/* ✅ EXISTING PERFORMANCE WARNING PRESERVED */}
      {performanceMode === 'heavy' && viewMode === 'markers' && !shouldUseClustering && (
        <div className="absolute top-4 left-4 z-[1000] bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-xs">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">
                Performance Notice
              </h3>
              <div className="mt-1 text-sm text-amber-700">
                <p>Large dataset ({reports.length} reports). Consider using cluster or heatmap view for better performance.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 PHASE 3B: INTELLIGENCE FEATURES STATUS */}
      {(showSafeZones || showRoutePlanner) && (
        <div className="absolute top-4 right-4 z-[1000] bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-2 text-xs">
          <div className="flex items-center space-x-2">
            {showSafeZones && (
              <span className="flex items-center text-green-700">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Safe Zones
              </span>
            )}
            {showRoutePlanner && (
              <span className="flex items-center text-blue-700">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                Smart Routes
              </span>
            )}
          </div>
        </div>
      )}

      {/* ✅ EXISTING DEBUG INFO PRESERVED (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-black/75 text-white text-xs p-2 rounded">
          <div>Reports: {reports.length}</div>
          <div>Mode: {viewMode}</div>
          <div>Strategy: {renderingStrategy.mode}</div>
          <div>Clustering: {shouldUseClustering ? 'Yes' : 'No'}</div>
          <div>Performance: {performanceMode}</div>
          {/* 🆕 PHASE 3B: INTELLIGENCE DEBUG INFO */}
          {showSafeZones && <div className="text-green-400">🛡️ Safe Zones: Active</div>}
          {showRoutePlanner && <div className="text-blue-400">🗺️ Routing: Active</div>}
        </div>
      )}
    </div>
  )
}

export default MapView