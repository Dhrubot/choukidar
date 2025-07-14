// === frontend/src/components/Map/MapView.jsx (ENHANCED) ===
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import HeatmapLayer from './HeatmapLayer'

// Fix default marker icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const MapView = ({ 
  reports = [], 
  center = [23.8103, 90.4125], 
  zoom = 11,
  viewMode = 'markers', // 'markers', 'heatmap', 'hybrid'
  heatmapOptions = {},
  onMapReady = null,
  className = ""
}) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [isMapReady, setIsMapReady] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Create map centered on Dhaka, Bangladesh
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: true
    }).setView(center, zoom)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Enhanced custom control for SafeStreets
    const info = L.control({ position: 'topright' })
    info.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-control-custom')
      div.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <div style="font-weight: bold; color: #006A4E; margin-bottom: 6px; display: flex; align-items: center;">
            🛡️ SafeStreets Bangladesh
          </div>
          <div style="font-size: 11px; color: #666; line-height: 1.3;">
            🔴 Critical • 🟠 High • 🟡 Medium • 🟢 Low Risk<br>
            <span style="color: #888;">Real-time crime intelligence</span>
          </div>
        </div>
      `
      return div
    }
    info.addTo(map)

    // View mode indicator control
    const viewModeInfo = L.control({ position: 'topleft' })
    viewModeInfo.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-control-viewmode')
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
    viewModeInfo.addTo(map)

    mapInstanceRef.current = map
    setIsMapReady(true)

    // Notify parent that map is ready
    if (onMapReady) {
      onMapReady(map)
    }

    console.log('🗺️ Enhanced MapView initialized with heatmap support')

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        setIsMapReady(false)
      }
    }
  }, [center, zoom])

  // Update view mode indicator
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const viewModeControl = mapInstanceRef.current._container?.querySelector('.leaflet-control-viewmode')
    if (viewModeControl) {
      const modeLabels = {
        markers: '📍 Markers View',
        heatmap: '🔥 Heatmap View', 
        hybrid: '🔍 Hybrid View'
      }
      
      const modeColors = {
        markers: '#006A4E',
        heatmap: '#F59E0B',
        hybrid: '#8B5CF6'
      }

      viewModeControl.innerHTML = `
        <span style="color: ${modeColors[viewMode]};">
          ${modeLabels[viewMode]} • ${reports.length} reports
        </span>
      `
    }
  }, [viewMode, reports.length])

  // Update markers when reports change or view mode includes markers
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []

    // Only show markers in 'markers' or 'hybrid' mode
    if ((viewMode === 'markers' || viewMode === 'hybrid') && reports.length > 0) {
      addMarkersToMap(reports)
    }
  }, [reports, viewMode])

  // Add markers to map with enhanced styling
  const addMarkersToMap = (reports) => {
    reports.forEach(report => {
      if (!report.location?.coordinates) return

      const [lng, lat] = report.location.coordinates
      
      // Skip invalid coordinates
      if (!lat || !lng || lat === 0 || lng === 0) return

      // Enhanced marker styling
      const markerColor = getSeverityColor(report.severity)
      const incidentIcon = getIncidentIcon(report.type)
      const pulseClass = report.severity >= 4 ? 'animate-pulse' : ''

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

      marker.addTo(mapInstanceRef.current)
      markersRef.current.push(marker)
    })

    // Adjust map view to show all markers if needed
    if (markersRef.current.length > 0 && viewMode === 'markers') {
      const group = new L.featureGroup(markersRef.current)
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.05))
    }

    console.log(`📍 Added ${markersRef.current.length} markers to map`)
  }

  // Enhanced marker color based on severity
  const getSeverityColor = (severity) => {
    const colors = {
      1: '#10B981', // Green - Low
      2: '#84CC16', // Light green
      3: '#F59E0B', // Yellow - Medium  
      4: '#F97316', // Orange - High
      5: '#EF4444'  // Red - Critical
    }
    return colors[severity] || colors[3]
  }

  // Get incident icon with better emoji selection
  const getIncidentIcon = (type) => {
    const icons = {
      'chadabaji': '💰',
      'teen_gang': '👥', 
      'chintai': '⚠️',
      'other': '🚨'
    }
    return icons[type] || icons.other
  }

  // Create enhanced popup content
  const createEnhancedPopup = (report) => {
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
              ${typeLabels[report.type] || 'Criminal Activity'}
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 2px;">
              Severity: <span style="color: ${severityColor}; font-weight: 600;">${severityLabels[report.severity]}</span>
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Location</div>
          <div style="color: #6B7280; font-size: 12px; line-height: 1.3;">
            📍 ${report.location.address || 'General area (privacy protected)'}
          </div>
        </div>
        
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 13px;">Description</div>
          <div style="color: #6B7280; font-size: 12px; line-height: 1.4; background: #F9FAFB; padding: 8px; border-radius: 6px;">
            ${report.description.length > 120 ? report.description.substring(0, 120) + '...' : report.description}
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #E5E7EB;">
          <div style="font-size: 11px; color: #9CA3AF;">
            📅 ${reportDate}
          </div>
          <div style="font-size: 11px; color: #9CA3AF;">
            ID: ${report._id.slice(-6)}
          </div>
        </div>
      </div>
    `
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef} 
        className="w-full h-full min-h-[400px] rounded-lg"
        style={{ zIndex: 1 }}
      />
      
      {/* Heatmap Layer */}
      {isMapReady && (
        <HeatmapLayer
          map={mapInstanceRef.current}
          reports={reports}
          isVisible={viewMode === 'heatmap' || viewMode === 'hybrid'}
          heatmapOptions={heatmapOptions}
        />
      )}
    </div>
  )
}

export default MapView