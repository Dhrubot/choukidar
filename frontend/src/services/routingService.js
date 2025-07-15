// === frontend/src/services/routingService.js ===
/**
 * Route Safety Intelligence Service for SafeStreets Bangladesh
 * DECOUPLED from Safe Zone Service - can be enabled/disabled independently
 * Cost-optimized with caching and quota management
 * 
 * Features:
 * - Safety-first routing (prioritize safer routes over shortest)
 * - Real-time route adjustment based on recent incidents
 * - Transport mode optimization (walking, rickshaw, bus)
 * - Time-aware routing (different routes for day/night)
 * - Alternative route suggestions with safety scores
 */

import * as turf from '@turf/turf'
import requestManager from './requestManager'
import safeZoneService from './safeZoneService'

class RoutingService {
  constructor() {
    // Configuration
    this.config = {
      // API configuration
      apiKey: import.meta.env.VITE_OPENROUTE_API_KEY || null,
      baseUrl: 'https://api.openrouteservice.org',
      
      // Caching configuration
      cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
      maxCacheSize: 1000, // Maximum cached routes
      
      // Safety scoring weights
      safetyWeights: {
        incidentDensity: 0.35,    // 35% weight to incident avoidance
        safeZoneProximity: 0.25,  // 25% weight to safe zone proximity
        policePresence: 0.20,     // 20% weight to police station proximity
        lightingScore: 0.15,      // 15% weight to lighting
        communityRating: 0.05     // 5% weight to community feedback
      },
      
      // Route analysis parameters
      analysis: {
        bufferDistance: 200,      // meters around route to analyze
        segmentLength: 100,       // meters per route segment for analysis
        timeDecay: 0.1,           // How much older incidents matter less
        maxDetour: 1.5,           // Maximum detour ratio for safety (1.5x = 50% longer)
        minSafetyImprovement: 0.2 // Minimum safety score improvement to suggest alternative
      },
      
      // Transport profiles for Bangladesh context
      profiles: {
        walking: {
          profile: 'foot-walking',
          maxDistance: 5000,       // 5km max walking
          safetyPriority: 'high',
          preferWellLit: true
        },
        rickshaw: {
          profile: 'cycling-regular', // Similar to rickshaw routes
          maxDistance: 15000,      // 15km max rickshaw
          safetyPriority: 'medium',
          preferMainRoads: true
        },
        bus: {
          profile: 'driving-car',  // Bus routes similar to car
          maxDistance: 50000,      // 50km max bus route
          safetyPriority: 'low',   // Buses are generally safer
          preferBusRoutes: true
        },
        emergency: {
          profile: 'foot-walking',
          maxDistance: 2000,       // 2km max for emergency
          safetyPriority: 'maximum',
          avoidAllIncidents: true
        }
      }
    }

    // Route cache
    this.routeCache = new Map()
    this.safetyCache = new Map()
    
    // Service status
    this.isEnabled = true
    this.lastError = null
    
    // Load cache from localStorage
    this.loadCacheFromStorage()
    
    console.log('🗺️ Routing Service initialized (decoupled mode)')
  }

  // Check if routing service is available
  isAvailable() {
    return this.isEnabled && 
           this.config.apiKey && 
           !requestManager.isQuotaLow('directions', 0.1)
  }

  // Enable/disable routing service
  setEnabled(enabled) {
    this.isEnabled = enabled
    console.log(`🗺️ Routing service ${enabled ? 'enabled' : 'disabled'}`)
  }

  // Calculate safe route between points
  async calculateSafeRoute(startCoords, endCoords, options = {}) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Routing service not available')
      }

      console.log('🗺️ Calculating safe route...')
      
      const {
        transportMode = 'walking',
        timeOfDay = 'current',
        reports = [],
        avoidRecentIncidents = true,
        maxAlternatives = 2
      } = options

      // Check cache first
      const cacheKey = this.generateRouteCacheKey(startCoords, endCoords, options)
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        console.log('📊 Using cached route')
        return cached
      }

      // Get primary route
      const primaryRoute = await this.getDirectionsFromAPI(
        startCoords, 
        endCoords, 
        transportMode
      )

      if (!primaryRoute) {
        throw new Error('Failed to get primary route')
      }

      // Analyze route safety
      const safetyAnalysis = await this.analyzeRouteSafety(
        primaryRoute, 
        reports, 
        { timeOfDay, transportMode }
      )

      // Get alternative routes if safety is low
      const alternatives = []
      if (safetyAnalysis.overallScore < 7 && maxAlternatives > 0) {
        console.log('⚠️ Primary route has low safety score, finding alternatives...')
        
        for (let i = 0; i < maxAlternatives; i++) {
          try {
            const altRoute = await this.getAlternativeRoute(
              startCoords, 
              endCoords, 
              transportMode, 
              [...alternatives, primaryRoute]
            )
            
            if (altRoute) {
              const altSafety = await this.analyzeRouteSafety(
                altRoute, 
                reports, 
                { timeOfDay, transportMode }
              )
              
              alternatives.push({
                ...altRoute,
                safetyAnalysis: altSafety
              })
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get alternative ${i + 1}:`, error)
          }
        }
      }

      // Build final result
      const result = {
        primary: {
          ...primaryRoute,
          safetyAnalysis
        },
        alternatives,
        metadata: {
          timestamp: Date.now(),
          transportMode,
          timeOfDay: timeOfDay === 'current' ? this.getCurrentTimeOfDay() : timeOfDay,
          quotaUsed: {
            directions: 1 + alternatives.length,
            remaining: requestManager.getRemainingQuota('directions')
          }
        }
      }

      // Cache result
      this.saveToCache(cacheKey, result)

      console.log(`✅ Route calculated with ${alternatives.length} alternatives`)
      return result

    } catch (error) {
      console.error('❌ Error calculating safe route:', error)
      this.lastError = error.message
      
      // Return fallback route if possible
      return this.getFallbackRoute(startCoords, endCoords, options)
    }
  }

  // Get directions from OpenRouteService API
  async getDirectionsFromAPI(startCoords, endCoords, transportMode) {
    const profile = this.config.profiles[transportMode] || this.config.profiles.walking
    
    const requestFn = async () => {
      const url = `${this.config.baseUrl}/v2/directions/${profile.profile}/geojson`
      
      const requestBody = {
        coordinates: [startCoords, endCoords],
        radiuses: [200, 200], // 200m tolerance for start/end points
        instructions: true,
        elevation: false,
        extra_info: ['steepness', 'surface']
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.config.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/geo+json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      
      if (!data.features || data.features.length === 0) {
        throw new Error('No route found')
      }

      const route = data.features[0]
      return {
        id: `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        geometry: route.geometry,
        properties: route.properties,
        distance: route.properties.summary?.distance || 0,
        duration: route.properties.summary?.duration || 0,
        instructions: route.properties.segments?.[0]?.steps || []
      }
    }

    return await requestManager.queueRequest('directions', requestFn, 1)
  }

  // Get alternative route using avoid areas
  async getAlternativeRoute(startCoords, endCoords, transportMode, existingRoutes) {
    if (existingRoutes.length === 0) return null

    try {
      // Create avoid areas around existing routes
      const avoidAreas = existingRoutes.map(route => {
        try {
          return turf.buffer(route.geometry, 0.1, { units: 'kilometers' })
        } catch (error) {
          return null
        }
      }).filter(area => area !== null)

      if (avoidAreas.length === 0) return null

      const profile = this.config.profiles[transportMode] || this.config.profiles.walking
      
      const requestFn = async () => {
        const url = `${this.config.baseUrl}/v2/directions/${profile.profile}/geojson`
        
        const requestBody = {
          coordinates: [startCoords, endCoords],
          radiuses: [200, 200],
          instructions: true,
          options: {
            avoid_polygons: avoidAreas.map(area => area.geometry)
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': this.config.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/geo+json'
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          throw new Error(`Alternative route API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (!data.features || data.features.length === 0) {
          return null
        }

        const route = data.features[0]
        return {
          id: `alt_route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          geometry: route.geometry,
          properties: route.properties,
          distance: route.properties.summary?.distance || 0,
          duration: route.properties.summary?.duration || 0,
          instructions: route.properties.segments?.[0]?.steps || []
        }
      }

      return await requestManager.queueRequest('directions', requestFn, 2)

    } catch (error) {
      console.warn('⚠️ Failed to get alternative route:', error)
      return null
    }
  }

  // Analyze route safety comprehensively
  async analyzeRouteSafety(route, reports = [], options = {}) {
    try {
      const { timeOfDay = 'current', transportMode = 'walking' } = options
      const currentTime = timeOfDay === 'current' ? this.getCurrentTimeOfDay() : timeOfDay
      
      // Create analysis buffer around route
      const routeBuffer = turf.buffer(
        route.geometry, 
        this.config.analysis.bufferDistance, 
        { units: 'meters' }
      )

      // Analyze incidents along route
      const incidentAnalysis = this.analyzeIncidentsAlongRoute(
        route, 
        reports, 
        routeBuffer
      )

      // Analyze safe zone proximity
      const safeZoneAnalysis = this.analyzeSafeZoneProximity(route, reports)

      // Analyze lighting and infrastructure
      const infrastructureAnalysis = this.analyzeInfrastructure(route, transportMode)

      // Calculate time-based safety adjustments
      const timeAdjustments = this.calculateTimeAdjustments(currentTime)

      // Combine all scores
      const { safetyWeights } = this.config
      let overallScore = 0

      overallScore += incidentAnalysis.score * safetyWeights.incidentDensity
      overallScore += safeZoneAnalysis.score * safetyWeights.safeZoneProximity
      overallScore += infrastructureAnalysis.policeScore * safetyWeights.policePresence
      overallScore += infrastructureAnalysis.lightingScore * safetyWeights.lightingScore
      overallScore += (infrastructureAnalysis.communityScore || 5) * safetyWeights.communityRating

      // Apply time adjustments
      overallScore = overallScore * timeAdjustments.multiplier

      return {
        overallScore: Math.max(0, Math.min(10, overallScore)),
        breakdown: {
          incidents: incidentAnalysis,
          safeZones: safeZoneAnalysis,
          infrastructure: infrastructureAnalysis,
          timeAdjustments
        },
        recommendations: this.generateSafetyRecommendations(
          overallScore,
          incidentAnalysis,
          safeZoneAnalysis,
          currentTime
        )
      }

    } catch (error) {
      console.error('❌ Error analyzing route safety:', error)
      return {
        overallScore: 5,
        breakdown: null,
        recommendations: ['Unable to analyze route safety - proceed with caution'],
        error: error.message
      }
    }
  }

  // Analyze incidents along route
  analyzeIncidentsAlongRoute(route, reports, routeBuffer) {
    const relevantIncidents = reports.filter(report => {
      if (!report.location?.coordinates) return false
      
      try {
        const reportPoint = turf.point(report.location.coordinates)
        return turf.booleanPointInPolygon(reportPoint, routeBuffer)
      } catch (error) {
        return false
      }
    })

    // Apply time decay and severity weights
    const now = Date.now()
    let weightedScore = 0
    const maxPossibleScore = 10

    relevantIncidents.forEach(incident => {
      const incidentTime = new Date(incident.timestamp || incident.createdAt).getTime()
      const ageInDays = (now - incidentTime) / (1000 * 60 * 60 * 24)
      
      // Time decay
      const timeWeight = Math.exp(-ageInDays * this.config.analysis.timeDecay)
      
      // Severity weight (1-5 scale)
      const severityWeight = (incident.severity || 3) / 5
      
      // Impact on score (negative)
      weightedScore += timeWeight * severityWeight * 2 // Each incident can impact up to 2 points
    })

    const finalScore = Math.max(0, maxPossibleScore - weightedScore)

    return {
      score: finalScore,
      incidentCount: relevantIncidents.length,
      recentIncidents: relevantIncidents.filter(incident => {
        const ageInDays = (now - new Date(incident.timestamp || incident.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        return ageInDays <= 7 // Last 7 days
      }).length,
      severityBreakdown: this.categorizeIncidentsBySeverity(relevantIncidents)
    }
  }

  // Analyze safe zone proximity along route
  analyzeSafeZoneProximity(route, reports) {
    try {
      const safeZones = safeZoneService.calculateSafeZones(reports)
      
      if (safeZones.length === 0) {
        return { score: 5, nearbyZones: [], averageDistance: null }
      }

      // Sample points along route for analysis
      const routeLength = turf.length(route.geometry, { units: 'meters' })
      const sampleCount = Math.max(5, Math.floor(routeLength / this.config.analysis.segmentLength))
      
      let totalProximityScore = 0
      const nearbyZones = []

      for (let i = 0; i <= sampleCount; i++) {
        const distance = (i / sampleCount) * routeLength
        const point = turf.along(route.geometry, distance, { units: 'meters' })
        
        // Find nearest safe zone to this point
        let nearestDistance = Infinity
        let nearestZone = null

        safeZones.forEach(zone => {
          try {
            const zonePoint = turf.point(zone.coordinates)
            const dist = turf.distance(point, zonePoint, { units: 'meters' })
            
            if (dist < nearestDistance) {
              nearestDistance = dist
              nearestZone = zone
            }
          } catch (error) {
            // Skip invalid zones
          }
        })

        if (nearestZone && nearestDistance <= 1000) { // Within 1km
          const proximityScore = Math.max(0, 10 - nearestDistance / 100)
          totalProximityScore += proximityScore
          
          if (!nearbyZones.find(z => z.id === nearestZone.id)) {
            nearbyZones.push({
              ...nearestZone,
              distanceFromRoute: nearestDistance
            })
          }
        }
      }

      const averageScore = sampleCount > 0 ? totalProximityScore / (sampleCount + 1) : 0
      
      return {
        score: Math.min(10, averageScore),
        nearbyZones,
        averageDistance: nearbyZones.length > 0 ? 
          nearbyZones.reduce((sum, zone) => sum + zone.distanceFromRoute, 0) / nearbyZones.length : 
          null
      }

    } catch (error) {
      console.warn('⚠️ Error analyzing safe zone proximity:', error)
      return { score: 5, nearbyZones: [], averageDistance: null }
    }
  }

  // Analyze infrastructure (lighting, police presence, etc.)
  analyzeInfrastructure(route, transportMode) {
    // This is a simplified analysis - could be enhanced with real infrastructure data
    
    const routeLength = turf.length(route.geometry, { units: 'kilometers' })
    const startPoint = turf.point(route.geometry.coordinates[0])
    const endPoint = turf.point(route.geometry.coordinates[route.geometry.coordinates.length - 1])
    
    // Estimate lighting based on route characteristics
    let lightingScore = 5 // Base score
    
    // Better lighting in central Dhaka
    const isInCentralDhaka = this.isRouteInCentralDhaka(route)
    if (isInCentralDhaka) {
      lightingScore += 2
    }
    
    // Adjust for transport mode
    switch (transportMode) {
      case 'walking':
        lightingScore += isInCentralDhaka ? 1 : -1
        break
      case 'rickshaw':
        lightingScore += 0.5
        break
      case 'bus':
        lightingScore += 1 // Bus routes generally well-lit
        break
    }

    // Police presence analysis
    const policeStations = safeZoneService.policeStations
    let policeScore = 0
    
    if (policeStations.length > 0) {
      const routePoints = [startPoint, endPoint]
      let minDistanceToPolice = Infinity

      routePoints.forEach(point => {
        policeStations.forEach(station => {
          try {
            const stationPoint = turf.point(station.coordinates)
            const distance = turf.distance(point, stationPoint, { units: 'meters' })
            minDistanceToPolice = Math.min(minDistanceToPolice, distance)
          } catch (error) {
            // Skip invalid stations
          }
        })
      })

      if (minDistanceToPolice < Infinity) {
        policeScore = Math.max(0, 10 - minDistanceToPolice / 200) // Score decreases with distance
      }
    }

    return {
      lightingScore: Math.max(0, Math.min(10, lightingScore)),
      policeScore: Math.max(0, Math.min(10, policeScore)),
      communityScore: 5, // Placeholder - could be enhanced with community data
      routeLength,
      estimatedTravelTime: this.estimateTravelTime(routeLength, transportMode)
    }
  }

  // Estimate travel time based on transport mode
  estimateTravelTime(distanceKm, transportMode) {
    const speeds = {
      walking: 4,    // 4 km/h
      rickshaw: 12,  // 12 km/h
      bus: 20,       // 20 km/h (including stops)
      emergency: 6   // 6 km/h (faster walking)
    }

    const speed = speeds[transportMode] || speeds.walking
    return (distanceKm / speed) * 60 // Return minutes
  }

  // Check if route is in central Dhaka (better infrastructure)
  isRouteInCentralDhaka(route) {
    try {
      const routeBounds = turf.bbox(route.geometry)
      const centralDhakaBounds = [90.3500, 23.7000, 90.4500, 23.8000] // [minLng, minLat, maxLng, maxLat]
      
      // Check if route overlaps with central Dhaka
      return !(routeBounds[0] > centralDhakaBounds[2] || 
               routeBounds[2] < centralDhakaBounds[0] ||
               routeBounds[1] > centralDhakaBounds[3] || 
               routeBounds[3] < centralDhakaBounds[1])
    } catch (error) {
      return false
    }
  }

  // Calculate time-based safety adjustments
  calculateTimeAdjustments(timeOfDay) {
    const multipliers = {
      morning: 0.9,    // 10% safer
      afternoon: 0.8,  // 20% safer
      evening: 1.1,    // 10% less safe
      night: 1.3,      // 30% less safe
      lateNight: 1.5   // 50% less safe
    }

    const multiplier = multipliers[timeOfDay] || 1.0

    return {
      timeOfDay,
      multiplier,
      safetyLevel: multiplier <= 0.9 ? 'high' : 
                   multiplier <= 1.1 ? 'medium' : 'low',
      recommendations: this.getTimeBasedRecommendations(timeOfDay)
    }
  }

  // Get time-based safety recommendations
  getTimeBasedRecommendations(timeOfDay) {
    const recommendations = {
      morning: ['Great time to travel', 'Good visibility and activity'],
      afternoon: ['Safest travel time', 'High visibility and people around'],
      evening: ['Stay in well-lit areas', 'Avoid isolated routes'],
      night: ['Consider alternative transport', 'Stay on main roads', 'Travel with others if possible'],
      lateNight: ['Avoid walking alone', 'Use rickshaw or car', 'Stick to main roads only']
    }

    return recommendations[timeOfDay] || ['Exercise normal caution']
  }

  // Generate comprehensive safety recommendations
  generateSafetyRecommendations(overallScore, incidentAnalysis, safeZoneAnalysis, timeOfDay) {
    const recommendations = []

    // Overall safety level
    if (overallScore >= 8) {
      recommendations.push('✅ This route appears to be safe')
    } else if (overallScore >= 6) {
      recommendations.push('⚠️ This route has moderate safety concerns')
    } else {
      recommendations.push('🚨 This route has significant safety concerns')
    }

    // Incident-based recommendations
    if (incidentAnalysis.recentIncidents > 0) {
      recommendations.push(`⚠️ ${incidentAnalysis.recentIncidents} recent incident(s) reported along this route`)
    }

    if (incidentAnalysis.incidentCount > 3) {
      recommendations.push('🚨 High incident density - consider alternative route')
    }

    // Safe zone recommendations
    if (safeZoneAnalysis.nearbyZones.length > 0) {
      recommendations.push(`✅ ${safeZoneAnalysis.nearbyZones.length} safe zone(s) nearby`)
    } else {
      recommendations.push('⚠️ No safe zones identified along this route')
    }

    // Time-based recommendations
    const timeRecs = this.getTimeBasedRecommendations(timeOfDay)
    recommendations.push(...timeRecs)

    return recommendations
  }

  // Categorize incidents by severity
  categorizeIncidentsBySeverity(incidents) {
    const categories = { low: 0, medium: 0, high: 0 }
    
    incidents.forEach(incident => {
      const severity = incident.severity || 3
      if (severity <= 2) categories.low++
      else if (severity <= 4) categories.medium++
      else categories.high++
    })

    return categories
  }

  // Get current time of day
  getCurrentTimeOfDay() {
    const hour = new Date().getHours()
    
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 18) return 'afternoon'
    if (hour >= 18 && hour < 22) return 'evening'
    if (hour >= 22 || hour < 2) return 'night'
    return 'lateNight'
  }

  // Fallback route calculation (when API is unavailable)
  async getFallbackRoute(startCoords, endCoords, options = {}) {
    console.log('📍 Providing fallback route analysis')
    
    try {
      // Calculate straight-line distance
      const start = turf.point(startCoords)
      const end = turf.point(endCoords)
      const distance = turf.distance(start, end, { units: 'meters' })
      const bearing = turf.bearing(start, end)

      // Create a simple straight-line geometry
      const straightLine = turf.lineString([startCoords, endCoords])

      // Basic safety analysis using available data
      const { reports = [] } = options
      const safetyAnalysis = this.analyzeRouteSafety(
        { geometry: straightLine },
        reports,
        options
      )

      return {
        primary: {
          id: `fallback_${Date.now()}`,
          geometry: straightLine,
          distance,
          duration: this.estimateTravelTime(distance / 1000, options.transportMode || 'walking') * 60,
          instructions: [
            {
              instruction: `Head ${this.bearingToDirection(bearing)} for ${Math.round(distance)}m`,
              distance,
              duration: this.estimateTravelTime(distance / 1000, options.transportMode || 'walking') * 60
            }
          ],
          safetyAnalysis: await safetyAnalysis,
          isFallback: true
        },
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          transportMode: options.transportMode || 'walking',
          timeOfDay: options.timeOfDay || this.getCurrentTimeOfDay(),
          isFallback: true,
          reason: 'API unavailable or quota exceeded'
        }
      }

    } catch (error) {
      console.error('❌ Error creating fallback route:', error)
      return null
    }
  }

  // Convert bearing to direction
  bearingToDirection(bearing) {
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
    const index = Math.round(((bearing + 360) % 360) / 45) % 8
    return directions[index]
  }

  // Cache management
  generateRouteCacheKey(startCoords, endCoords, options) {
    const coordKey = `${startCoords.join(',')}_${endCoords.join(',')}`
    const optionsKey = JSON.stringify({
      transportMode: options.transportMode,
      timeOfDay: options.timeOfDay,
      avoidRecentIncidents: options.avoidRecentIncidents
    })
    return `${coordKey}_${optionsKey}`
  }

  getFromCache(key) {
    const cached = this.routeCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.config.cacheExpiry) {
      return cached.data
    }
    return null
  }

  saveToCache(key, data) {
    // Implement LRU cache
    if (this.routeCache.size >= this.config.maxCacheSize) {
      const firstKey = this.routeCache.keys().next().value
      this.routeCache.delete(firstKey)
    }

    this.routeCache.set(key, {
      data,
      timestamp: Date.now()
    })

    this.saveCacheToStorage()
  }

  loadCacheFromStorage() {
    try {
      const stored = localStorage.getItem('routing_cache')
      if (stored) {
        const data = JSON.parse(stored)
        this.routeCache = new Map(data.routes || [])
        console.log(`📊 Loaded ${this.routeCache.size} cached routes`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load routing cache:', error)
    }
  }

  saveCacheToStorage() {
    try {
      const data = {
        routes: Array.from(this.routeCache.entries()),
        timestamp: Date.now()
      }
      localStorage.setItem('routing_cache', JSON.stringify(data))
    } catch (error) {
      console.warn('⚠️ Failed to save routing cache:', error)
    }
  }

  clearCache() {
    this.routeCache.clear()
    this.safetyCache.clear()
    localStorage.removeItem('routing_cache')
    console.log('🗑️ Routing cache cleared')
  }

  // Get service status
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      isAvailable: this.isAvailable(),
      quotaStatus: requestManager.getRemainingQuota('directions'),
      cacheSize: this.routeCache.size,
      lastError: this.lastError,
      apiKey: this.config.apiKey ? 'configured' : 'missing'
    }
  }

  // Set API key
  setApiKey(apiKey) {
    this.config.apiKey = apiKey
    console.log('🔑 API key updated')
  }

  // Get route by ID from cache
  getRouteById(routeId) {
    for (const [key, cached] of this.routeCache.entries()) {
      if (cached.data.primary?.id === routeId) {
        return cached.data
      }
      
      const alternative = cached.data.alternatives?.find(alt => alt.id === routeId)
      if (alternative) {
        return { primary: alternative, alternatives: [], metadata: cached.data.metadata }
      }
    }
    return null
  }

  // Export route for sharing
  exportRoute(routeId) {
    const route = this.getRouteById(routeId)
    if (!route) return null

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      route,
      source: 'SafeStreets Bangladesh'
    }
  }

  // Batch route calculation (for efficiency)
  async calculateMultipleRoutes(routeRequests) {
    const results = []
    
    for (const request of routeRequests) {
      try {
        const result = await this.calculateSafeRoute(
          request.startCoords,
          request.endCoords,
          request.options
        )
        results.push({ ...result, requestId: request.id })
      } catch (error) {
        results.push({ 
          requestId: request.id, 
          error: error.message,
          fallback: this.getFallbackRoute(request.startCoords, request.endCoords, request.options)
        })
      }
    }

    return results
  }
}

// Create singleton instance
const routingService = new RoutingService()

export default routingService

// Export utility functions
export const calculateSafeRoute = (startCoords, endCoords, options) => 
  routingService.calculateSafeRoute(startCoords, endCoords, options)

export const isRoutingAvailable = () => routingService.isAvailable()

export const setRoutingEnabled = (enabled) => routingService.setEnabled(enabled)

export const getRoutingStatus = () => routingService.getStatus()

export const clearRoutingCache = () => routingService.clearCache()

export const setRoutingApiKey = (apiKey) => routingService.setApiKey(apiKey)