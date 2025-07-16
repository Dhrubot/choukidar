import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import reportService, { ReportService } from './reportService.js'
import apiClient from '../core/apiClient.js'

// Mock the API client
vi.mock('../core/apiClient.js', () => ({
  default: {
    setDeviceFingerprint: vi.fn(),
    request: vi.fn(),
    deviceFingerprint: 'mock-fingerprint'
  }
}))

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with null device fingerprint', () => {
      expect(reportService.deviceFingerprint).toBeNull()
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'test-fingerprint-123'
      reportService.setDeviceFingerprint(fingerprint)
      
      expect(reportService.deviceFingerprint).toBe(fingerprint)
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
    })
  })

  describe('Report Submission', () => {
    it('should submit report with enhanced data', async () => {
      const reportData = {
        type: 'harassment',
        description: 'Test report description',
        location: { coordinates: [90.4125, 23.8103] },
        severity: 3
      }
      const behaviorData = {
        submissionTime: 5000,
        interactionPattern: 'normal',
        humanBehaviorScore: 85
      }
      const mockResponse = { success: true, id: 1 }
      
      apiClient.request.mockResolvedValue(mockResponse)
      reportService.setDeviceFingerprint('test-fingerprint')
      
      const result = await reportService.submitReport(reportData, behaviorData)
      
      expect(apiClient.request).toHaveBeenCalledWith('/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...reportData,
          submittedBy: {
            deviceFingerprint: 'test-fingerprint',
            userType: 'anonymous'
          },
          behaviorSignature: {
            submissionSpeed: 5000,
            deviceType: expect.any(String),
            interactionPattern: 'normal',
            humanBehaviorScore: 85
          }
        })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should submit report with default behavior data', async () => {
      const reportData = {
        type: 'harassment',
        description: 'Test report description',
        location: { coordinates: [90.4125, 23.8103] },
        severity: 3
      }
      const mockResponse = { success: true, id: 1 }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await reportService.submitReport(reportData)
      
      expect(apiClient.request).toHaveBeenCalledWith('/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...reportData,
          submittedBy: {
            deviceFingerprint: 'mock-fingerprint',
            userType: 'anonymous'
          },
          behaviorSignature: {
            submissionSpeed: 0,
            deviceType: expect.any(String),
            interactionPattern: 'normal',
            humanBehaviorScore: 75
          }
        })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle report submission errors', async () => {
      const reportData = { type: 'harassment', description: 'Test' }
      const mockError = { success: false, message: 'Validation error' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await reportService.submitReport(reportData)
      
      expect(result).toEqual(mockError)
    })
  })

  describe('Report Retrieval', () => {
    it('should get reports with default filters', async () => {
      const mockResponse = { success: true, reports: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await reportService.getReports()
      
      expect(apiClient.request).toHaveBeenCalledWith('/reports?includeGenderSensitive=true')
      expect(result).toEqual(mockResponse)
    })

    it('should get reports with custom filters', async () => {
      const filters = { type: 'harassment', severity: 3 }
      const mockResponse = { success: true, reports: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await reportService.getReports(filters)
      
      expect(apiClient.request).toHaveBeenCalledWith('/reports?includeGenderSensitive=true&type=harassment&severity=3')
      expect(result).toEqual(mockResponse)
    })

    it('should handle report retrieval errors', async () => {
      const mockError = { success: false, message: 'Access denied' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await reportService.getReports()
      
      expect(result).toEqual(mockError)
    })
  })

  describe('Device Detection', () => {
    it('should detect device type', () => {
      // Mock user agent for mobile
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      })
      
      const deviceType = reportService.detectDeviceType()
      expect(typeof deviceType).toBe('string')
      expect(deviceType.length).toBeGreaterThan(0)
    })
  })

  describe('Service Integration', () => {
    it('should work with API client correctly', async () => {
      const fingerprint = 'integration-test'
      const mockResponse = { success: true, reports: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      reportService.setDeviceFingerprint(fingerprint)
      const result = await reportService.getReports()
      
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
      expect(apiClient.request).toHaveBeenCalledWith('/reports?includeGenderSensitive=true')
      expect(result).toEqual(mockResponse)
    })
  })
})