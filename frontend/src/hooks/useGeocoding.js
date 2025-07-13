// === src/hooks/useGeocoding.js ===
import { useState, useCallback } from 'react'
import { 
  geocodingOptions, 
  isWithinBangladesh, 
  formatBangladeshAddress 
} from '../config/locationConfig'

const useGeocoding = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const searchPlaces = useCallback(async (query, options = {}) => {
    if (!query.trim() || query.length < geocodingOptions.searchBehavior.minQueryLength) {
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const config = { ...geocodingOptions.nominatim.searchParams, ...options }

      const params = new URLSearchParams({
        format: config.format,
        q: query,
        limit: config.limit.toString(),
        addressdetails: config.addressdetails.toString(),
        extratags: config.extratags.toString(),
        'accept-language': config['accept-language']
      })

      if (config.countrycodes) {
        params.append('countrycodes', config.countrycodes)
      }

      if (config.bounded) {
        params.append('bounded', '1')
        params.append('viewbox', geocodingOptions.nominatim.bangladeshViewbox)
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), geocodingOptions.searchBehavior.timeoutMs)

      const response = await fetch(
        `${geocodingOptions.nominatim.baseUrl}/search?${params.toString()}`,
        {
          headers: {
            'User-Agent': geocodingOptions.nominatim.userAgent
          },
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const results = await response.json()

      const formattedResults = results.map(result => {
        const lat = parseFloat(result.lat)
        const lng = parseFloat(result.lon)
        const boundingBox = result.boundingbox ? {
          north: parseFloat(result.boundingbox[1]),
          south: parseFloat(result.boundingbox[0]),
          east: parseFloat(result.boundingbox[3]),
          west: parseFloat(result.boundingbox[2])
        } : null

        const suspicious = geocodingOptions.security.suspiciousLocationDetection.enabled &&
          geocodingOptions.security.suspiciousLocationDetection.flagOutsideBangladesh &&
          !isWithinBangladesh(lat, lng)

        return {
          id: result.place_id,
          name: result.display_name,
          lat,
          lng,
          type: result.type,
          category: result.class,
          importance: result.importance || 0,
          address: result.address || {},
          boundingBox,
          suspicious
        }
      })

      formattedResults.sort((a, b) => (b.importance || 0) - (a.importance || 0))

      return formattedResults.slice(0, geocodingOptions.searchBehavior.maxResults)
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('Search request timed out')
        setError('Search request timed out')
      } else {
        console.error('Geocoding search error:', err)
        setError('Failed to search locations')
      }
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reverseGeocode = useCallback(async (lat, lng, options = {}) => {
    setIsLoading(true)
    setError(null)

    try {
      const config = { ...geocodingOptions.nominatim.reverseParams, ...options }

      const params = new URLSearchParams({
        format: config.format,
        lat: lat.toString(),
        lon: lng.toString(),
        zoom: config.zoom.toString(),
        addressdetails: config.addressdetails.toString(),
        extratags: config.extratags.toString()
      })

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), geocodingOptions.searchBehavior.timeoutMs)

      const response = await fetch(
        `${geocodingOptions.nominatim.baseUrl}/reverse?${params.toString()}`,
        {
          headers: {
            'User-Agent': geocodingOptions.nominatim.userAgent
          },
          signal: controller.signal
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (!result || result.error) {
        throw new Error(result?.error || 'No address found')
      }

      const boundingBox = result.boundingbox ? {
        north: parseFloat(result.boundingbox[1]),
        south: parseFloat(result.boundingbox[0]),
        east: parseFloat(result.boundingbox[3]),
        west: parseFloat(result.boundingbox[2])
      } : null

      const suspicious = geocodingOptions.security.suspiciousLocationDetection.enabled &&
        geocodingOptions.security.suspiciousLocationDetection.flagOutsideBangladesh &&
        !isWithinBangladesh(parseFloat(result.lat), parseFloat(result.lon))

      return {
        formattedAddress: formatBangladeshAddress(result.address),
        fullAddress: result.display_name,
        address: result.address,
        category: result.category,
        type: result.type,
        placeId: result.place_id,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        boundingBox,
        suspicious
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('Reverse geocoding request timed out')
        setError('Request timed out')
      } else {
        console.error('Reverse geocoding error:', err)
        setError('Failed to get address')
      }
      return {
        formattedAddress: 'Selected Location',
        fullAddress: 'Selected Location',
        address: {},
        lat,
        lng
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getCurrentPosition = useCallback((options = {}) => {
    const gpsConfig = { ...geocodingOptions.gpsOptions, ...options }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'))
        return
      }

      const attempt = (triesLeft) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            })
          },
          (error) => {
            if (triesLeft > 0) {
              setTimeout(() => attempt(triesLeft - 1), gpsConfig.retryDelay)
            } else {
              let errorMessage = 'Unable to get location'
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'Location access denied by user'
                  break
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information unavailable'
                  break
                case error.TIMEOUT:
                  errorMessage = 'Location request timed out'
                  break
              }
              reject(new Error(errorMessage))
            }
          },
          gpsConfig
        )
      }

      attempt(gpsConfig.retryAttempts)
    })
  }, [])

  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }, [])

  return {
    searchPlaces,
    reverseGeocode,
    getCurrentPosition,
    calculateDistance,
    isWithinBangladesh,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}

export default useGeocoding