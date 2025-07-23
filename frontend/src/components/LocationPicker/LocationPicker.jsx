// === src/components/LocationPicker/LocationPicker.jsx (IMPROVED - Better mobile UX) ===
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Search, Navigation, Check, AlertCircle, X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import useGeocoding from '../../hooks/useGeocoding'
import { mapOptions, geocodingOptions } from '../../config/locationConfig'
import { handleLocationError } from '../../services/utils/errorHandler'

// Fix default marker icon issue in Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const LocationPicker = ({ 
  onLocationSelect, 
  initialLocation = null,
  userLocation = null,
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(initialLocation)
  const [mapCenter, setMapCenter] = useState(mapOptions.defaultCenter)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Use the geocoding hook
  const { 
    searchPlaces, 
    reverseGeocode, 
    getCurrentPosition, 
    isWithinBangladesh,
    isLoading: geocodingLoading,
    error: geocodingError 
  } = useGeocoding()

  // Initialize map when expanded
  useEffect(() => {
    if (!isExpanded || !mapRef.current || mapInstanceRef.current) return

    // Create map with config options
    const map = L.map(mapRef.current, mapOptions.leafletOptions)
      .setView(mapCenter, mapOptions.defaultZoom)

    // Add tile layer using configuration
    L.tileLayer(mapOptions.tileLayer.url, {
      attribution: mapOptions.tileLayer.attribution,
      maxZoom: mapOptions.tileLayer.maxZoom,
    }).addTo(map)

    // Handle map clicks
    map.on('click', (e) => {
      const { lat, lng } = e.latlng
      handleLocationSelect({ lat, lng }, 'Map Click')
    })

    mapInstanceRef.current = map

    // Set initial marker if location exists
    if (selectedLocation) {
      addMarker(selectedLocation.lat, selectedLocation.lng)
    } else if (userLocation) {
      // Center on user location if available
      map.setView([userLocation.lat, userLocation.lng], 15)
      setMapCenter([userLocation.lat, userLocation.lng])
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [isExpanded, mapCenter])

  // Add or update marker on map
  const addMarker = (lat, lng) => {
    if (!mapInstanceRef.current) return

    // Remove existing marker
    if (markerRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current)
    }

    // Create custom marker icon
    const customIcon = L.divIcon({
      html: `
        <div style="
          background-color: #EF4444;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      className: 'custom-location-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    })

    // Add new marker
    markerRef.current = L.marker([lat, lng], { 
      icon: customIcon,
      draggable: true 
    }).addTo(mapInstanceRef.current)

    // Handle marker drag
    markerRef.current.on('dragend', (e) => {
      const { lat, lng } = e.target.getLatLng()
      handleLocationSelect({ lat, lng }, 'Marker Drag')
    })

    // Center map on marker
    mapInstanceRef.current.setView([lat, lng], 15)
  }

  // Handle location selection from any source
  const handleLocationSelect = async (coords, source) => {
    console.log(`📍 Location selected via ${source}:`, coords)
    
    try {
      // Get address for the coordinates
      const addressData = await reverseGeocode(coords.lat, coords.lng)
      
      const locationData = {
        lat: coords.lat,
        lng: coords.lng,
        address: addressData.formattedAddress,
        fullAddress: addressData.fullAddress,
        source,
        withinBangladesh: isWithinBangladesh(coords.lat, coords.lng)
      }

      setSelectedLocation(locationData)
      addMarker(coords.lat, coords.lng)
      
      // Call parent callback
      if (onLocationSelect) {
        onLocationSelect(locationData)
      }
    } catch (error) {
      console.error('Error processing location:', error)
      
      // Fallback location data
      const locationData = {
        lat: coords.lat,
        lng: coords.lng,
        address: 'Selected Location',
        fullAddress: 'Selected Location',
        source,
        withinBangladesh: isWithinBangladesh(coords.lat, coords.lng)
      }

      setSelectedLocation(locationData)
      addMarker(coords.lat, coords.lng)
      
      if (onLocationSelect) {
        onLocationSelect(locationData)
      }
    }
  }

  // Search for locations
  const searchLocations = async (query) => {
    if (!query.trim() || query.length < geocodingOptions.searchBehavior.minQueryLength) {
      setSearchResults([])
      return
    }
    
    try {
      const results = await searchPlaces(query, {
        limit: geocodingOptions.searchBehavior.maxResults,
        countrycodes: geocodingOptions.nominatim.searchParams.countrycodes
      })
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    }
  }

  // Handle search input with debouncing
  const handleSearchInput = (value) => {
    setSearchQuery(value)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value)
    }, geocodingOptions.searchBehavior.debounceMs)
  }

  // Use current GPS location - IMPROVED with better UX
  const useCurrentLocation = async () => {
    setGpsLoading(true)
    try {
      const position = await getCurrentPosition()
      await handleLocationSelect({ lat: position.lat, lng: position.lng }, 'GPS')
      setIsExpanded(true) // Show map to confirm
    } catch (error) {
      const errorResponse = handleLocationError(error, 'LocationPicker')
      setGpsError(errorResponse.userMessage || 'Unable to get your current location')
    } finally {
      setGpsLoading(false)
    }
  }

  // Clear all location data
  const clearLocation = () => {
    setSelectedLocation(null)
    setSearchQuery('')
    setSearchResults([])
    if (markerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(markerRef.current)
      markerRef.current = null
    }
    if (onLocationSelect) {
      onLocationSelect(null)
    }
  }

  return (
    <div className={`location-picker ${className}`}>
      {/* Compact Display */}
      <div className="border border-neutral-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            <MapPin className="w-5 h-5 text-bangladesh-green mr-3 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {selectedLocation ? (
                <div>
                  <div className="font-medium text-neutral-800 flex items-center">
                    📍 Location Selected
                    {selectedLocation.withinBangladesh === false && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Outside BD
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-600 mt-1 truncate">
                    {selectedLocation.address}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">
                    via {selectedLocation.source} • {selectedLocation.lat.toFixed(mapOptions.obfuscation.coordinateDecimalPlaces)}, {selectedLocation.lng.toFixed(mapOptions.obfuscation.coordinateDecimalPlaces)}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-neutral-800">
                    Select Location
                  </div>
                  <div className="text-sm text-neutral-600">
                    Choose via GPS, search, or map click
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-3">
            {selectedLocation && (
              <button
                type="button"
                onClick={clearLocation}
                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                title="Clear location"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn-secondary btn-sm"
            >
              {isExpanded ? 'Collapse' : 'Choose'}
            </button>
          </div>
        </div>

        {/* Quick Actions - IMPROVED mobile layout */}
        {!isExpanded && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={gpsLoading}
              className="btn-primary btn-sm flex items-center"
            >
              {gpsLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
              ) : (
                <Navigation className="w-4 h-4 mr-1" />
              )}
              Use GPS
            </button>
            
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="btn-secondary btn-sm flex items-center"
            >
              <Search className="w-4 h-4 mr-1" />
              Search
            </button>
            
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="btn-secondary btn-sm flex items-center"
            >
              <MapPin className="w-4 h-4 mr-1" />
              Map
            </button>
          </div>
        )}
      </div>

      {/* Expanded Location Picker */}
      {isExpanded && (
        <div className="mt-4 border border-neutral-200 rounded-lg bg-white overflow-hidden">
          {/* Search Section */}
          <div className="p-4 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search for places, roads, landmarks..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
              />
              {geocodingLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin w-4 h-4 border-2 border-bangladesh-green border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>

            {/* Geocoding Error */}
            {geocodingError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{geocodingError}</span>
              </div>
            )}

            {/* Search Results - IMPROVED mobile scrolling */}
            {searchResults.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      handleLocationSelect({ lat: result.lat, lng: result.lng }, 'Search')
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="w-full text-left p-3 hover:bg-neutral-50 rounded text-sm border-b border-neutral-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-neutral-800 truncate">{result.name.split(',')[0]}</div>
                    <div className="text-neutral-600 text-xs truncate">{result.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Section */}
          <div className="relative">
            <div 
              ref={mapRef} 
              className="w-full h-64"
              style={{ zIndex: 1 }}
            />
            
            {/* Map Instructions Overlay - IMPROVED mobile positioning */}
            <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-auto sm:max-w-xs bg-white bg-opacity-90 rounded-lg p-2 text-xs text-neutral-600">
              💡 Click anywhere on the map to set location, or drag the red marker
            </div>

            {/* GPS Button on Map - IMPROVED mobile size */}
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={gpsLoading}
              className="absolute bottom-3 right-3 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg p-2 shadow-md transition-colors"
              title="Use my current location"
            >
              {gpsLoading ? (
                <div className="animate-spin w-4 h-4 border-2 border-bangladesh-green border-t-transparent rounded-full"></div>
              ) : (
                <Navigation className="w-4 h-4 text-bangladesh-green" />
              )}
            </button>
            {gpsError && (
              <div className="absolute bottom-3 left-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{gpsError}</span>
              </div>
            )}
          </div>

          {/* Actions - IMPROVED mobile layout */}
          <div className="p-3 bg-neutral-50 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={clearLocation}
              className="btn-secondary btn-sm order-2 sm:order-1"
            >
              Clear Location
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="btn-primary btn-sm flex items-center justify-center order-1 sm:order-2"
            >
              <Check className="w-4 h-4 mr-1" />
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LocationPicker