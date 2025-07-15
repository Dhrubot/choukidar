// === frontend/src/services/safeZoneService.js ===
/**
 * Safe Zone Intelligence Service for SafeStreets Bangladesh
 * 100% CLIENT-SIDE - No API costs, uses Turf.js for geospatial analysis
 * 
 * Features:
 * - Dynamic safe zones based on crime density
 * - Time-based safety scoring (day/night differences)
 * - Police station proximity analysis
 * - Well-lit area identification
 * - Administrative safe zone management
 */

import * as turf from '@turf/turf'
import { distance, point, buffer, bbox, centroid, area } from '@turf/helpers'

class SafeZoneService {
  constructor() {
    // Configuration for Bangladesh context
    this.config = {
      // Safe zone calculation parameters
      safeZone: {
        minRadius: 100,     // Minimum safe zone radius in meters
        maxRadius: 500,     // Maximum safe zone radius in meters
        gridSize: 50,       // Grid cell size for analysis in meters
        confidenceThreshold: 0.7, // Minimum confidence for safe zone
        timeDecay: 0.1,     // How much older incidents matter less
        densityThreshold: 0.05 // Maximum incident density for safe zone
      },
      
      // Safety scoring weights
      scoring: {
        incidentDensity: 0.4,    // 40% weight to incident density
        policeProximity: 0.25,   // 25% weight to police station distance
        lightingScore: 0.20,     // 20% weight to lighting
        timeOfDay: 0.10,         // 10% weight to time-based factors
        communityScore: 0.05     // 5% weight to community validation
      },
      
      // Time-based safety multipliers
      timeMultipliers: {
        morning: 0.8,      // 6AM-12PM (safer)
        afternoon: 0.6,    // 12PM-6PM (safest)
        evening: 1.2,      // 6PM-10PM (less safe)
        night: 1.8,        // 10PM-6AM (least safe)
        lateNight: 2.2     // 12AM-4AM (dangerous)
      },
      
      // Police station effectiveness radius (meters)
      policeRadius: 1000,
      
      // Well-lit area detection
      lighting: {
        majorRoadBonus: 0.3,     // Bonus for major roads
        commercialAreaBonus: 0.2, // Bonus for commercial areas
        residentialPenalty: 0.1   // Penalty for residential areas
      }
    }

    // Cache for expensive calculations
    this.cache = {
      safeZones: new Map(),
      densityGrids: new Map(),
      lastCalculation: null,
      cacheExpiry: 30 * 60 * 1000 // 30 minutes
    }

    // Predefined safe locations (can be admin-managed)
    this.adminSafeZones = this.loadAdminSafeZones()
    
    // Police station locations (can be updated from admin)
    this.policeStations = this.loadPoliceStations()
  }

  // Load admin-defined safe zones from localStorage
  loadAdminSafeZones() {
    try {
      const stored = localStorage.getItem('admin_safe_zones')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load admin safe zones:', error)
    }

    // Default admin safe zones for Dhaka
    return [
      {
        id: 'dhaka_university',
        name: 'University of Dhaka Campus',
        coordinates: [90.3563, 23.7272],
        radius: 300,
        type: 'educational',
        safetyScore: 8.5,
        timeRestrictions: null,
        verified: true,
        description: 'Well-patrolled university campus with good lighting'
      },
      {
        id: 'ramna_park',
        name: 'Ramna Park',
        coordinates: [90.3944, 23.7461],
        radius: 200,
        type: 'recreational',
        safetyScore: 7.0,
        timeRestrictions: { startHour: 6, endHour: 20 }, // 6AM-8PM only
        verified: true,
        description: 'Public park, safe during daylight hours'
      },
      {
        id: 'shahbagh',
        name: 'Shahbagh Intersection',
        coordinates: [90.3958, 23.7386],
        radius: 150,
        type: 'public',
        safetyScore: 6.5,
        timeRestrictions: null,
        verified: true,
        description: 'Busy intersection with good visibility and police presence'
      }
    ]
  }

  // Load police station locations
  loadPoliceStations() {
    try {
      const stored = localStorage.getItem('police_stations')
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load police stations:', error)
    }

    // Default police stations for Dhaka
    return [
      {
        id: 'ramna_police',
        name: 'Ramna Police Station',
        coordinates: [90.4125, 23.7461],
        type: 'main',
        effectiveness: 0.9,
        responseTime: 8 // minutes
      },
      {
        id: 'dhanmondi_police',
        name: 'Dhanmondi Police Station',
        coordinates: [90.3742, 23.7465],
        type: 'main',
        effectiveness: 0.8,
        responseTime: 10
      },
      {
        id: 'wari_police',
        name: 'Wari Police Station',
        coordinates: [90.4258, 23.7156],
        type: 'main',
        effectiveness: 0.7,
        responseTime: 12
      }
    ]
  }

  // Calculate dynamic safe zones based on incident data
  calculateSafeZones(reports, options = {}) {
    const startTime = performance.now()
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(reports, options)
      if (this.cache.safeZones.has(cacheKey)) {
        const cached = this.cache.safeZones.get(cacheKey)
        if (Date.now() - cached.timestamp < this.config.cacheExpiry) {
          console.log('📊 Using cached safe zones')
          return cached.data
        }
      }

      console.log('🔄 Calculating safe zones for', reports.length, 'reports')

      // Filter recent reports (last 90 days)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)
      
      const recentReports = reports.filter(report => {
        const reportDate = new Date(report.timestamp || report.createdAt)
        return reportDate > cutoffDate
      })

      // Create analysis grid
      const boundingBox = this.calculateBoundingBox(recentReports)
      const analysisGrid = this.createAnalysisGrid(boundingBox)

      // Calculate incident density for each grid cell
      const densityGrid = this.calculateIncidentDensity(recentReports, analysisGrid)

      // Identify safe zones
      const dynamicSafeZones = this.identifySafeZones(densityGrid, options)

      // Combine with admin safe zones
      const allSafeZones = [
        ...this.getValidAdminSafeZones(options),
        ...dynamicSafeZones
      ]

      // Calculate safety scores
      const safeZonesWithScores = allSafeZones.map(zone => 
        this.calculateSafetyScore(zone, recentReports, options)
      )

      // Sort by safety score
      const finalSafeZones = safeZonesWithScores
        .filter(zone => zone.safetyScore >= this.config.safeZone.confidenceThreshold * 10)
        .sort((a, b) => b.safetyScore - a.safetyScore)

      // Cache results
      this.cache.safeZones.set(cacheKey, {
        data: finalSafeZones,
        timestamp: Date.now()
      })

      const calculationTime = performance.now() - startTime
      console.log(`✅ Safe zones calculated in ${calculationTime.toFixed(2)}ms`)

      return finalSafeZones

    } catch (error) {
      console.error('❌ Error calculating safe zones:', error)
      return this.getValidAdminSafeZones(options) // Fallback to admin zones only
    }
  }

  // Create analysis grid for incident density calculation
  createAnalysisGrid(boundingBox) {
    const { gridSize } = this.config.safeZone
    
    try {
      // Create hex grid for better coverage
      const hexGrid = turf.hexGrid(boundingBox, gridSize / 1000) // Convert to km
      
      return hexGrid.features.map((feature, index) => ({
        id: `grid_${index}`,
        geometry: feature.geometry,
        center: turf.centroid(feature).geometry.coordinates,
        incidentCount: 0,
        density: 0,
        safetyScore: 0
      }))
    } catch (error) {
      console.error('❌ Error creating analysis grid:', error)
      return []
    }
  }

  // Calculate incident density for grid cells
  calculateIncidentDensity(reports, grid) {
    const now = Date.now()
    
    // Count incidents in each grid cell
    grid.forEach(cell => {
      cell.incidentCount = 0
      cell.weightedCount = 0

      reports.forEach(report => {
        if (!report.location?.coordinates) return

        const reportPoint = turf.point(report.location.coordinates)
        
        try {
          // Check if report is within this grid cell
          if (turf.booleanPointInPolygon(reportPoint, cell.geometry)) {
            cell.incidentCount++

            // Apply time decay - recent incidents matter more
            const reportTime = new Date(report.timestamp || report.createdAt).getTime()
            const ageInDays = (now - reportTime) / (1000 * 60 * 60 * 24)
            const timeWeight = Math.exp(-ageInDays * this.config.safeZone.timeDecay)

            // Apply severity weight
            const severityWeight = (report.severity || 3) / 5

            cell.weightedCount += timeWeight * severityWeight
          }
        } catch (error) {
          // Skip invalid geometries
        }
      })

      // Calculate density (incidents per square km)
      const cellArea = turf.area(cell.geometry) / 1000000 // Convert to km²
      cell.density = cellArea > 0 ? cell.weightedCount / cellArea : 0
    })

    return grid
  }

  // Identify safe zones from density grid
  identifySafeZones(densityGrid, options = {}) {
    const safeZones = []
    const { densityThreshold, minRadius, maxRadius } = this.config.safeZone

    // Find low-density areas
    const safeCells = densityGrid.filter(cell => 
      cell.density <= densityThreshold
    )

    // Group adjacent safe cells
    const clusters = this.clusterSafeCells(safeCells)

    clusters.forEach((cluster, index) => {
      if (cluster.length < 3) return // Need minimum cluster size

      try {
        // Calculate cluster centroid
        const points = cluster.map(cell => turf.point(cell.center))
        const clusterCenter = turf.centroid(turf.featureCollection(points))

        // Calculate appropriate radius
        const radius = Math.min(
          maxRadius,
          Math.max(minRadius, cluster.length * 25) // 25m per cell
        )

        safeZones.push({
          id: `dynamic_${index}`,
          name: `Safe Area ${index + 1}`,
          coordinates: clusterCenter.geometry.coordinates,
          radius: radius,
          type: 'dynamic',
          safetyScore: 0, // Will be calculated later
          incidentDensity: cluster.reduce((sum, cell) => sum + cell.density, 0) / cluster.length,
          cellCount: cluster.length,
          verified: false,
          description: 'Dynamically identified low-crime area'
        })
      } catch (error) {
        console.warn('⚠️ Error processing safe zone cluster:', error)
      }
    })

    return safeZones
  }

  // Calculate comprehensive safety score for a zone
  calculateSafetyScore(zone, reports, options = {}) {
    const { scoring } = this.config
    const currentTime = options.timeOfDay || this.getCurrentTimeOfDay()
    
    let totalScore = 0

    try {
      // 1. Incident density score (lower density = higher score)
      const densityScore = Math.max(0, 10 - (zone.incidentDensity || 0) * 100)
      totalScore += densityScore * scoring.incidentDensity

      // 2. Police proximity score
      const policeScore = this.calculatePoliceProximityScore(zone.coordinates)
      totalScore += policeScore * scoring.policeProximity

      // 3. Lighting score (estimated)
      const lightingScore = this.estimateLightingScore(zone.coordinates, zone.type)
      totalScore += lightingScore * scoring.lightingScore

      // 4. Time-based adjustment
      const timeMultiplier = this.config.timeMultipliers[currentTime] || 1.0
      const timeScore = Math.max(0, 10 - (timeMultiplier - 1) * 5)
      totalScore += timeScore * scoring.timeOfDay

      // 5. Community validation score (if available)
      const communityScore = zone.communityRating || 5
      totalScore += communityScore * scoring.communityScore

      // Apply time-of-day penalty
      totalScore = totalScore / timeMultiplier

      // Ensure score is between 0-10
      zone.safetyScore = Math.max(0, Math.min(10, totalScore))
      
      // Add breakdown for transparency
      zone.scoreBreakdown = {
        densityScore: densityScore * scoring.incidentDensity,
        policeScore: policeScore * scoring.policeProximity,
        lightingScore: lightingScore * scoring.lightingScore,
        timeScore: timeScore * scoring.timeOfDay,
        communityScore: communityScore * scoring.communityScore,
        timeMultiplier,
        finalScore: zone.safetyScore
      }

    } catch (error) {
      console.warn('⚠️ Error calculating safety score:', error)
      zone.safetyScore = 5 // Default neutral score
    }

    return zone
  }

  // Calculate police proximity score
  calculatePoliceProximityScore(coordinates) {
    if (!coordinates || coordinates.length !== 2) return 0

    const point = turf.point(coordinates)
    let bestScore = 0

    this.policeStations.forEach(station => {
      try {
        const stationPoint = turf.point(station.coordinates)
        const distance = turf.distance(point, stationPoint, { units: 'meters' })
        
        if (distance <= this.config.policeRadius) {
          // Score based on distance and station effectiveness
          const proximityScore = (1 - distance / this.config.policeRadius) * 10
          const adjustedScore = proximityScore * (station.effectiveness || 1.0)
          bestScore = Math.max(bestScore, adjustedScore)
        }
      } catch (error) {
        console.warn('⚠️ Error calculating police proximity:', error)
      }
    })

    return bestScore
  }

  // Estimate lighting score based on location type and characteristics
  estimateLightingScore(coordinates, zoneType) {
    const { lighting } = this.config
    let score = 5 // Base score

    // Adjust based on zone type
    switch (zoneType) {
      case 'commercial':
      case 'educational':
      case 'public':
        score += lighting.commercialAreaBonus * 10
        break
      case 'residential':
        score -= lighting.residentialPenalty * 10
        break
      default:
        // No adjustment for unknown types
        break
    }

    // Could be enhanced with road type data in the future
    // For now, assume major coordinates have better lighting
    const isMainArea = this.isInMainDhakaArea(coordinates)
    if (isMainArea) {
      score += lighting.majorRoadBonus * 10
    }

    return Math.max(0, Math.min(10, score))
  }

  // Check if coordinates are in main Dhaka area (better infrastructure)
  isInMainDhakaArea(coordinates) {
    if (!coordinates || coordinates.length !== 2) return false

    const [lng, lat] = coordinates
    
    // Rough bounding box for central Dhaka (better infrastructure)
    return lng >= 90.3500 && lng <= 90.4500 && 
           lat >= 23.7000 && lat <= 23.8000
  }

  // Get current time of day for safety calculations
  getCurrentTimeOfDay() {
    const hour = new Date().getHours()
    
    if (hour >= 6 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 18) return 'afternoon'
    if (hour >= 18 && hour < 22) return 'evening'
    if (hour >= 22 || hour < 2) return 'night'
    return 'lateNight' // 2AM-6AM
  }

  // Get admin safe zones valid for current time
  getValidAdminSafeZones(options = {}) {
    const currentHour = options.hour || new Date().getHours()
    
    return this.adminSafeZones
      .filter(zone => {
        if (!zone.timeRestrictions) return true
        
        const { startHour, endHour } = zone.timeRestrictions
        return currentHour >= startHour && currentHour < endHour
      })
      .map(zone => ({ ...zone })) // Clone to avoid mutations
  }

  // Utility methods...
  calculateBoundingBox(reports) {
    if (reports.length === 0) {
      // Default to Dhaka area if no reports
      return turf.bbox(turf.buffer(turf.point([90.4125, 23.8103]), 5, { units: 'kilometers' }))
    }

    const coordinates = reports
      .filter(report => report.location?.coordinates)
      .map(report => report.location.coordinates)

    if (coordinates.length === 0) {
      return turf.bbox(turf.buffer(turf.point([90.4125, 23.8103]), 5, { units: 'kilometers' }))
    }

    const points = coordinates.map(coord => turf.point(coord))
    const collection = turf.featureCollection(points)
    return turf.bbox(collection)
  }

  generateCacheKey(reports, options) {
    const reportHash = reports.length > 0 ? 
      `${reports.length}_${reports[0]?.timestamp || 'unknown'}` : 'empty'
    const optionsHash = JSON.stringify(options)
    return `${reportHash}_${optionsHash}`
  }

  // Cluster adjacent safe cells using simple distance-based grouping
  clusterSafeCells(safeCells) {
    const clusters = []
    const visited = new Set()
    const maxDistance = this.config.safeZone.gridSize * 1.5 // 1.5x grid size

    safeCells.forEach((cell, index) => {
      if (visited.has(index)) return

      const cluster = [cell]
      visited.add(index)

      // Find nearby cells
      safeCells.forEach((otherCell, otherIndex) => {
        if (visited.has(otherIndex)) return

        try {
          const distance = turf.distance(
            turf.point(cell.center),
            turf.point(otherCell.center),
            { units: 'meters' }
          )

          if (distance <= maxDistance) {
            cluster.push(otherCell)
            visited.add(otherIndex)
          }
        } catch (error) {
          // Skip invalid calculations
        }
      })

      if (cluster.length >= 2) {
        clusters.push(cluster)
      }
    })

    return clusters
  }

  // Save admin safe zones
  saveAdminSafeZones(safeZones) {
    try {
      localStorage.setItem('admin_safe_zones', JSON.stringify(safeZones))
      this.adminSafeZones = safeZones
      this.clearCache()
      console.log('✅ Admin safe zones saved')
    } catch (error) {
      console.error('❌ Failed to save admin safe zones:', error)
    }
  }

  // Save police stations
  savePoliceStations(stations) {
    try {
      localStorage.setItem('police_stations', JSON.stringify(stations))
      this.policeStations = stations
      this.clearCache()
      console.log('✅ Police stations saved')
    } catch (error) {
      console.error('❌ Failed to save police stations:', error)
    }
  }

  // Clear calculation cache
  clearCache() {
    this.cache.safeZones.clear()
    this.cache.densityGrids.clear()
    console.log('🗑️ Safe zone cache cleared')
  }

  // Get safe zone by ID
  getSafeZoneById(id, reports, options = {}) {
    const safeZones = this.calculateSafeZones(reports, options)
    return safeZones.find(zone => zone.id === id)
  }

  // Check if a point is within any safe zone
  isPointInSafeZone(coordinates, reports, options = {}) {
    if (!coordinates || coordinates.length !== 2) return null

    const safeZones = this.calculateSafeZones(reports, options)
    const point = turf.point(coordinates)

    for (const zone of safeZones) {
      try {
        const zoneCircle = turf.circle(zone.coordinates, zone.radius, { units: 'meters' })
        if (turf.booleanPointInPolygon(point, zoneCircle)) {
          return zone
        }
      } catch (error) {
        console.warn('⚠️ Error checking point in safe zone:', error)
      }
    }

    return null
  }

  // Get nearby safe zones
  getNearbyZafeZones(coordinates, reports, maxDistance = 1000, options = {}) {
    if (!coordinates || coordinates.length !== 2) return []

    const safeZones = this.calculateSafeZones(reports, options)
    const point = turf.point(coordinates)
    
    return safeZones
      .map(zone => {
        try {
          const distance = turf.distance(point, turf.point(zone.coordinates), { units: 'meters' })
          return { ...zone, distance }
        } catch (error) {
          return { ...zone, distance: Infinity }
        }
      })
      .filter(zone => zone.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
  }

  // Get safety statistics for an area
  getAreaSafetyStats(coordinates, radius = 500, reports) {
    if (!coordinates || coordinates.length !== 2 || !reports.length) {
      return {
        safetyScore: 5,
        incidentCount: 0,
        incidentDensity: 0,
        nearestSafeZone: null,
        policeDistance: null
      }
    }

    try {
      const point = turf.point(coordinates)
      const analysisArea = turf.circle(coordinates, radius, { units: 'meters' })
      
      // Count incidents in area
      const incidentsInArea = reports.filter(report => {
        if (!report.location?.coordinates) return false
        
        try {
          const reportPoint = turf.point(report.location.coordinates)
          return turf.booleanPointInPolygon(reportPoint, analysisArea)
        } catch (error) {
          return false
        }
      })

      // Calculate density
      const areaSize = turf.area(analysisArea) / 1000000 // km²
      const incidentDensity = areaSize > 0 ? incidentsInArea.length / areaSize : 0

      // Find nearest safe zone
      const nearbyZones = this.getNearbyZafeZones(coordinates, reports, 2000)
      const nearestSafeZone = nearbyZones.length > 0 ? nearbyZones[0] : null

      // Find nearest police station
      let nearestPoliceDistance = null
      this.policeStations.forEach(station => {
        try {
          const stationPoint = turf.point(station.coordinates)
          const distance = turf.distance(point, stationPoint, { units: 'meters' })
          
          if (nearestPoliceDistance === null || distance < nearestPoliceDistance) {
            nearestPoliceDistance = distance
          }
        } catch (error) {
          // Skip invalid stations
        }
      })

      // Calculate overall safety score
      const densityScore = Math.max(0, 10 - incidentDensity * 50)
      const policeScore = nearestPoliceDistance ? 
        Math.max(0, 10 - nearestPoliceDistance / 100) : 5
      const safeZoneScore = nearestSafeZone ? 
        Math.max(0, 10 - nearestSafeZone.distance / 100) : 5

      const safetyScore = (densityScore * 0.5 + policeScore * 0.3 + safeZoneScore * 0.2)

      return {
        safetyScore: Math.round(safetyScore * 10) / 10,
        incidentCount: incidentsInArea.length,
        incidentDensity: Math.round(incidentDensity * 100) / 100,
        nearestSafeZone,
        policeDistance: nearestPoliceDistance ? Math.round(nearestPoliceDistance) : null,
        analysisRadius: radius
      }

    } catch (error) {
      console.error('❌ Error calculating area safety stats:', error)
      return {
        safetyScore: 5,
        incidentCount: 0,
        incidentDensity: 0,
        nearestSafeZone: null,
        policeDistance: null
      }
    }
  }

  // Export safe zones for sharing/backup
  exportSafeZones(reports) {
    const safeZones = this.calculateSafeZones(reports)
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      adminZones: this.adminSafeZones,
      dynamicZones: safeZones.filter(zone => zone.type === 'dynamic'),
      policeStations: this.policeStations,
      config: this.config
    }

    return exportData
  }

  // Import safe zones from backup
  importSafeZones(importData) {
    try {
      if (importData.adminZones) {
        this.saveAdminSafeZones(importData.adminZones)
      }
      
      if (importData.policeStations) {
        this.savePoliceStations(importData.policeStations)
      }

      if (importData.config) {
        this.config = { ...this.config, ...importData.config }
      }

      console.log('✅ Safe zones imported successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to import safe zones:', error)
      return false
    }
  }
}

// Create singleton instance
const safeZoneService = new SafeZoneService()

export default safeZoneService

// Export utility functions
export const calculateSafeZones = (reports, options) => 
  safeZoneService.calculateSafeZones(reports, options)

export const isPointInSafeZone = (coordinates, reports, options) => 
  safeZoneService.isPointInSafeZone(coordinates, reports, options)

export const getNearbyZafeZones = (coordinates, reports, maxDistance, options) => 
  safeZoneService.getNearbyZafeZones(coordinates, reports, maxDistance, options)

export const getAreaSafetyStats = (coordinates, radius, reports) => 
  safeZoneService.getAreaSafetyStats(coordinates, radius, reports)

export const clearSafeZoneCache = () => safeZoneService.clearCache()