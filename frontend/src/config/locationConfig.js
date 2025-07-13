// === src/config/locationConfig.js ===
// Configuration for map and geocoding services

export const mapOptions = {
  // Default map center (Dhaka, Bangladesh)
  defaultCenter: [23.8103, 90.4125],
  
  // Map zoom settings
  defaultZoom: 13,
  minZoom: 8,
  maxZoom: 19,
  
  // Bangladesh bounds for map restriction
  bangladeshBounds: {
    north: 26.0,
    south: 20.0,
    east: 93.0,
    west: 88.0
  },
  
  // Leaflet map options
  leafletOptions: {
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true,
    touchZoom: true,
    boxZoom: true,
    keyboard: true,
    attributionControl: true
  },
  
  // Tile layer options
  tileLayer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    // Optional: Use Bangladesh-focused tile server
    // url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  },
  
  // Location obfuscation settings
  obfuscation: {
    enabled: true,
    radiusMeters: 100, // Random offset within 100 meters
    coordinateDecimalPlaces: 6 // Precision for displayed coordinates
  }
}

export const geocodingOptions = {
  // Nominatim API settings
  nominatim: {
    baseUrl: 'https://nominatim.openstreetmap.org',
    userAgent: 'SafeStreets-BD/1.0',
    
    // Search parameters
    searchParams: {
      limit: 5, // Maximum number of search results
      countrycodes: 'bd', // Focus on Bangladesh
      bounded: true, // Restrict search to viewbox
      addressdetails: true, // Include address breakdown
      extratags: true, // Include extra place information
      format: 'json',
      'accept-language': 'en,bn' // English and Bengali
    },
    
    // Bangladesh viewbox for bounded searches
    bangladeshViewbox: '88.0,20.0,93.0,26.0', // west,south,east,north
    
    // Reverse geocoding parameters
    reverseParams: {
      zoom: 16, // Detail level for reverse geocoding
      addressdetails: true,
      extratags: true,
      format: 'json'
    }
  },
  
  // Search behavior settings
  searchBehavior: {
    minQueryLength: 3, // Minimum characters before search
    debounceMs: 500, // Delay before executing search
    maxResults: 5, // Maximum results to display
    timeoutMs: 10000 // Request timeout
  },
  
  // GPS location settings
  gpsOptions: {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 300000, // 5 minutes cache
    
    // Error handling
    retryAttempts: 2,
    retryDelay: 2000 // 2 seconds between retries
  },
  
  // Address formatting for Bangladesh
  addressFormatting: {
    // Priority order for address components
    componentPriority: [
      'house_number',
      'road',
      'neighbourhood',
      'suburb',
      'quarter',
      'city',
      'town',
      'municipality',
      'district',
      'state_district'
    ],
    
    // Maximum components to include in formatted address
    maxComponents: 4,
    
    // Separator for address components
    separator: ', '
  },
  
  // Security and validation
  security: {
    // Validate coordinates are within reasonable bounds
    coordinateValidation: {
      minLatitude: -90,
      maxLatitude: 90,
      minLongitude: -180,
      maxLongitude: 180
    },
    
    // Flag suspicious locations
    suspiciousLocationDetection: {
      enabled: true,
      flagOutsideBangladesh: true,
      flagExactDuplicates: true
    }
  }
}

// Utility functions using the configuration
export const isWithinBangladesh = (lat, lng) => {
  const bounds = mapOptions.bangladeshBounds
  return lat >= bounds.south && 
         lat <= bounds.north && 
         lng >= bounds.west && 
         lng <= bounds.east
}

export const obfuscateCoordinates = (lat, lng) => {
  if (!mapOptions.obfuscation.enabled) return [lat, lng]
  
  const radiusInDegrees = mapOptions.obfuscation.radiusMeters / 111320 // ~meters to degrees
  const offsetLat = (Math.random() - 0.5) * 2 * radiusInDegrees
  const offsetLng = (Math.random() - 0.5) * 2 * radiusInDegrees
  
  return [
    parseFloat((lat + offsetLat).toFixed(mapOptions.obfuscation.coordinateDecimalPlaces)),
    parseFloat((lng + offsetLng).toFixed(mapOptions.obfuscation.coordinateDecimalPlaces))
  ]
}

export const formatBangladeshAddress = (addressComponents) => {
  if (!addressComponents) return 'Unknown Location'
  
  const { componentPriority, maxComponents, separator } = geocodingOptions.addressFormatting
  const parts = []
  
  // Build address based on priority
  for (const component of componentPriority) {
    if (addressComponents[component] && parts.length < maxComponents) {
      parts.push(addressComponents[component])
    }
  }
  
  return parts.length > 0 ? parts.join(separator) : 'Location in Bangladesh'
}

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
  // Disable obfuscation in development for easier testing
  mapOptions.obfuscation.enabled = false
  
  // Shorter timeouts for faster development
  geocodingOptions.searchBehavior.debounceMs = 300
  geocodingOptions.gpsOptions.timeout = 5000
}

if (process.env.NODE_ENV === 'production') {
  // Enhanced security in production
  geocodingOptions.security.suspiciousLocationDetection.enabled = true
  
  // Longer cache times for better performance
  geocodingOptions.gpsOptions.maximumAge = 600000 // 10 minutes
}