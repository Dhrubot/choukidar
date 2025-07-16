import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import safeZoneService, { SafeZoneService } from './safeZoneService.js'
import apiClient from '../core/apiClient.js'

// Mock the API client
vi.mock('../core/apiClient.js', () => ({
  default: {
    setDeviceFingerprint: vi.fn(),
    request: vi.fn(),
    deviceFingerprint: null
  }
}))

// Mock geoUtils
vi.mock('../utils/geoUtils.js', () => ({
  calculateDistance: vi.fn(),
  calculateRouteSafetyScore: vi.fn()
}))

describe('SafeZoneService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with null device fingerprint', () => {
      expect(safeZoneService.deviceFingerprint).toBeNull()
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'safezone-fingerprint-123'
      safeZoneService.setDeviceFingerprint(fingerprint)
      
      expect(safeZoneService.deviceFingerprint).toBe(fingerprint)
    })
  })

  describe('Safe Zone Queries', () => {
    it('should get safe zones with no options', async () => {
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await safeZoneService.getSafeZones()
      
      expect(apiClient.request).toHaveBeenCalledWith('/safezones')
      expect(result).toEqual(mockResponse)
    })

    it('should get safe zones with location options', async () => {
      const options = {
        lat: 23.8103,
        lng: 90.4125,
        radius: 1000,
        minSafety: 7
      }
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await safeZoneService.getSafeZones(options)
      
      expect(apiClient.request).toHaveBeenCalledWith('/safezones?lat=23.8103&lng=90.4125&radius=1000&minSafety=7')
      expect(result).toEqual(mockResponse)
    })

    it('should get safe zones with all options', async () => {
      const options = {
        lat: 23.8103,
        lng: 90.4125,
        radius: 1000,
        minSafety: 7,
        zoneType: 'public',
        category: 'transport',
        district: 'dhaka',
        limit: 50,
        includeFemaleCategories: true
      }
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await safeZoneService.getSafeZones(options)
      
      const expectedUrl = '/safezones?lat=23.8103&lng=90.4125&radius=1000&minSafety=7&zoneType=public&category=transport&district=dhaka&limit=50&includeFemaleCategories=true'
      expect(apiClient.request).toHaveBeenCalledWith(expectedUrl)
      expect(result).toEqual(mockResponse)
    })

    it('should get nearby safe zones with default parameters', async () => {
      const lat = 23.8103
      const lng = 90.4125
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await safeZoneService.getNearbySafeZones(lat, lng)
      
      expect(apiClient.request).toHaveBeenCalledWith('/safezones?lat=23.8103&lng=90.4125&radius=2000&minSafety=6')
      expect(result).toEqual(mockResponse)
    })

    it('should get nearby safe zones with custom parameters', async () => {
      const lat = 23.8103
      const lng = 90.4125
      const radius = 5000
      const minSafety = 8
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await safeZoneService.getNearbySafeZones(lat, lng, radius, minSafety)
      
      expect(apiClient.request).toHaveBeenCalledWith('/safezones?lat=23.8103&lng=90.4125&radius=5000&minSafety=8')
      expect(result).toEqual(mockResponse)
    })

    it('should handle safe zone query errors', async () => {
      const mockError = { success: false, message: 'Location not found' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await safeZoneService.getSafeZones()
      
      expect(result).toEqual(mockError)
    })
  })

  describe('Service Integration', () => {
    it('should work with API client correctly', async () => {
      const fingerprint = 'safezone-integration-test'
      const mockResponse = { success: true, safeZones: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      safeZoneService.setDeviceFingerprint(fingerprint)
      const result = await safeZoneService.getSafeZones()
      
      expect(safeZoneService.deviceFingerprint).toBe(fingerprint)
      expect(apiClient.request).toHaveBeenCalledWith('/safezones')
      expect(result).toEqual(mockResponse)
    })
  })
})