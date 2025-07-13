// === src/components/Map/MapView.jsx ===
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const MapView = ({ reports = [], center = [23.8103, 90.4125], zoom = 11 }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Create map centered on Dhaka, Bangladesh
    const map = L.map(mapRef.current).setView(center, zoom)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Custom control for SafeStreets
    const info = L.control({ position: 'topright' })
    info.onAdd = function() {
      const div = L.DomUtil.create('div', 'leaflet-control-custom')
      div.innerHTML = `
        <div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="font-weight: bold; color: #006A4E; margin-bottom: 5px;">SafeStreets Bangladesh</div>
          <div style="font-size: 12px; color: #666;">
            🔴 High Risk &nbsp;&nbsp; 🟡 Medium Risk &nbsp;&nbsp; 🟢 Low Risk
          </div>
        </div>
      `
      return div
    }
    info.addTo(map)

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [center, zoom])

  // Update markers when reports change
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []

    // Add new markers for each report
    reports.forEach(report => {
      if (!report.location?.coordinates) return

      const [lng, lat] = report.location.coordinates
      
      // Skip invalid coordinates
      if (!lat || !lng || lat === 0 || lng === 0) return

      // Choose marker color based on severity
      const getMarkerColor = (severity) => {
        if (severity <= 2) return '#10B981' // Green
        if (severity <= 3) return '#F59E0B' // Yellow  
        if (severity <= 4) return '#F97316' // Orange
        return '#EF4444' // Red
      }

      // Choose marker icon based on incident type
      const getIncidentIcon = (type) => {
        switch (type) {
          case 'chadabaji': return '💰'
          case 'teen_gang': return '👥'
          case 'chintai': return '⚠️'
          default: return '🚨'
        }
      }

      // Create custom marker
      const markerColor = getMarkerColor(report.severity)
      const incidentIcon = getIncidentIcon(report.type)

      const customIcon = L.divIcon({
        html: `
          <div style="
            background-color: ${markerColor};
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
          ">
            ${incidentIcon}
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      })

      // Create marker
      const marker = L.marker([lat, lng], { icon: customIcon })

      // Format date
      const reportDate = new Date(report.createdAt || report.timestamp).toLocaleDateString('en-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })

      // Create popup content
      const popupContent = `
        <div style="font-family: Inter, sans-serif; max-width: 250px;">
          <div style="font-weight: bold; color: #006A4E; margin-bottom: 8px; font-size: 16px;">
            ${incidentIcon} ${report.type.charAt(0).toUpperCase() + report.type.slice(1).replace('_', ' ')}
          </div>
          
          <div style="margin-bottom: 10px;">
            <strong>Location:</strong><br>
            <span style="color: #666;">${report.location.address || 'Location provided'}</span>
          </div>
          
          <div style="margin-bottom: 10px;">
            <strong>Description:</strong><br>
            <span style="color: #666;">${report.description.length > 100 ? report.description.substring(0, 100) + '...' : report.description}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div>
              <strong>Severity:</strong>
              <span style="
                background: ${markerColor}; 
                color: white; 
                padding: 2px 8px; 
                border-radius: 12px; 
                font-size: 12px; 
                margin-left: 5px;
              ">
                Level ${report.severity}
              </span>
            </div>
          </div>
          
          <div style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 8px;">
            Reported: ${reportDate}
          </div>
        </div>
      `

      marker.bindPopup(popupContent)
      marker.addTo(mapInstanceRef.current)
      markersRef.current.push(marker)
    })

    // Adjust map view to show all markers
    if (markersRef.current.length > 0) {
      const group = new L.featureGroup(markersRef.current)
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1))
    }
  }, [reports])

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full min-h-[400px] rounded-lg"
      style={{ zIndex: 1 }}
    />
  )
}

export default MapView