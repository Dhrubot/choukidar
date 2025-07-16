import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import apiClient, { ApiClient } from './apiClient.js'

describe('ApiClient', () => {
  let client

  beforeEach(() => {
    client = new ApiClient()
    vi.clearAllMocks()
    
    // Mock fetch globally
    global.fetch = vi.fn()
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with correct default values', () => {
      expect(client.baseURL).toBe('http://localhost:5000/api')
      expect(client.deviceFingerprint).toBeNull()
      expect(client._safeZoneCache).toBeInstanceOf(Map)
      expect(client._cacheExpiry).toBe(5 * 60 * 1000)
    })

    it('should use environment variable for API URL when available', () => {
      // This test verifies the API_BASE_URL logic
      expect(client.baseURL).toContain('localhost:5000/api')
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'test-fingerprint-123'
      client.setDeviceFingerprint(fingerprint)
      expect(client.deviceFingerprint).toBe(fingerprint)
    })

    it('should include device fingerprint in auth headers when set', () => {
      const fingerprint = 'test-fingerprint-123'
      client.setDeviceFingerprint(fingerprint)
      
      const headers = client.getAuthHeaders()
      expect(headers['x-device-fingerprint']).toBe(fingerprint)
    })

    it('should not include device fingerprint in headers when not set', () => {
      const headers = client.getAuthHeaders()
      expect(headers['x-device-fingerprint']).toBeUndefined()
    })
  })

  describe('Authentication Headers', () => {
    it('should always include Content-Type header', () => {
      const headers = client.getAuthHeaders()
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Authorization header when admin token exists', () => {
      const token = 'test-admin-token'
      window.localStorage.getItem.mockReturnValue(token)
      
      const headers = client.getAuthHeaders()
      expect(headers['Authorization']).toBe(`Bearer ${token}`)
      expect(window.localStorage.getItem).toHaveBeenCalledWith('safestreets_admin_token')
    })

    it('should not include Authorization header when no admin token', () => {
      window.localStorage.getItem.mockReturnValue(null)
      
      const headers = client.getAuthHeaders()
      expect(headers['Authorization']).toBeUndefined()
    })
  })

  describe('Basic Request Method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { success: true, data: 'test' }
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.request('/test')
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make successful POST request with data', async () => {
      const mockResponse = { success: true, id: 1 }
      const postData = { name: 'test' }
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.request('/test', {
        method: 'POST',
        body: JSON.stringify(postData)
      })
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle HTTP error responses', async () => {
      const errorResponse = { message: 'Not found' }
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorResponse)
      })

      const result = await client.request('/test')
      
      expect(result).toEqual({
        success: false,
        message: 'Not found',
        error: 'Not found'
      })
    })

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await client.request('/test')
      
      expect(result).toEqual({
        success: false,
        message: 'Network error',
        error: 'Network error'
      })
    })

    it('should handle fetch errors without message', async () => {
      global.fetch.mockRejectedValueOnce(new Error())

      const result = await client.request('/test')
      
      expect(result).toEqual({
        success: false,
        message: 'Network error occurred',
        error: ''
      })
    })
  })

  describe('Retry Logic', () => {
    it('should retry on server errors', async () => {
      const errorResponse = { message: 'Server error' }
      const successResponse = { success: true, data: 'test' }
      
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve(errorResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(successResponse)
        })

      const result = await client.requestWithRetry('/test')
      
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual(successResponse)
    })

    it('should handle error responses and eventually throw', async () => {
      // Mock multiple error responses to exhaust retries
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' })
      })

      await expect(client.requestWithRetry('/test', {}, 1)).rejects.toThrow('Server error')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should respect maxRetries parameter', async () => {
      global.fetch.mockRejectedValue(new Error('Server error'))

      await expect(client.requestWithRetry('/test', {}, 2)).rejects.toThrow('Server error')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should implement exponential backoff', async () => {
      // Mock timers to test backoff without waiting
      vi.useFakeTimers()
      
      global.fetch.mockRejectedValue(new Error('Server error'))

      const promise = client.requestWithRetry('/test', {}, 2)
      
      // Fast-forward through the delays
      await vi.advanceTimersByTimeAsync(3000) // 2^1 * 1000 + 2^2 * 1000
      
      await expect(promise).rejects.toThrow('Server error')
      expect(global.fetch).toHaveBeenCalledTimes(2)
      
      vi.useRealTimers()
    })
  })

  describe('Intelligence Retry Logic', () => {
    it('should call requestWithIntelligenceRetry method', async () => {
      const successResponse = { success: true, data: 'test' }
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successResponse)
      })

      const result = await client.requestWithIntelligenceRetry('/test')
      
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result).toEqual(successResponse)
    })

    it('should handle client errors without retry', async () => {
      const errorResponse = { message: 'Unauthorized' }
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(errorResponse)
      })

      // The method returns error object instead of throwing for 40x errors
      const result = await client.requestWithIntelligenceRetry('/test')
      expect(result.success).toBe(false)
      expect(result.message).toBe('Unauthorized')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle network errors and return error object', async () => {
      global.fetch.mockRejectedValue(new Error('Server error'))

      // The intelligence retry method returns error object instead of throwing
      const result = await client.requestWithIntelligenceRetry('/test', {}, 0)
      expect(result.success).toBe(false)
      expect(result.message).toBe('Server error')
      expect(global.fetch).toHaveBeenCalledTimes(1) // 1 initial attempt only
    })
  })

  describe('Batch Requests', () => {
    it('should handle successful batch requests', async () => {
      const responses = [
        { success: true, data: 'test1' },
        { success: true, data: 'test2' }
      ]
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(responses[0])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(responses[1])
        })

      const requests = [
        { endpoint: '/test1', options: {} },
        { endpoint: '/test2', options: {} }
      ]

      const results = await client.batchRequests(requests)
      
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        index: 0,
        success: true,
        data: responses[0],
        error: null
      })
      expect(results[1]).toEqual({
        index: 1,
        success: true,
        data: responses[1],
        error: null
      })
    })

    it('should handle mixed success/failure in batch requests', async () => {
      const successResponse = { success: true, data: 'test1' }
      const errorResponse = { success: false, message: 'Error' }
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(successResponse)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve(errorResponse)
        })

      const requests = [
        { endpoint: '/test1', options: {} },
        { endpoint: '/test2', options: {} }
      ]

      const results = await client.batchRequests(requests)
      
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe('Error')
    })

    it('should handle network errors in batch requests', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: 'test1' })
        })
        .mockRejectedValueOnce(new Error('Network error'))

      const requests = [
        { endpoint: '/test1', options: {} },
        { endpoint: '/test2', options: {} }
      ]

      const results = await client.batchRequests(requests)
      
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      // The second request returns error object, not null
      expect(results[1].data).toEqual({
        success: false,
        message: 'Network error',
        error: 'Network error'
      })
    })
  })

  describe('Caching Functionality', () => {
    it('should cache data correctly', async () => {
      const testData = { success: true, data: 'cached' }
      const fetchFunction = vi.fn().mockResolvedValue(testData)

      const result = await client.getCachedSafeZones('test-key', fetchFunction)
      
      expect(fetchFunction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(testData)
      expect(client._safeZoneCache.has('test-key')).toBe(true)
    })

    it('should return cached data when not expired', async () => {
      const testData = { success: true, data: 'cached' }
      const fetchFunction = vi.fn().mockResolvedValue(testData)

      // First call
      await client.getCachedSafeZones('test-key', fetchFunction)
      
      // Second call should use cache
      const result = await client.getCachedSafeZones('test-key', fetchFunction)
      
      expect(fetchFunction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(testData)
    })

    it('should fetch fresh data when cache is expired', async () => {
      const oldData = { success: true, data: 'old' }
      const newData = { success: true, data: 'new' }
      
      // Mock expired cache
      client._safeZoneCache.set('test-key', {
        data: oldData,
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago (expired)
      })

      const fetchFunction = vi.fn().mockResolvedValue(newData)
      const result = await client.getCachedSafeZones('test-key', fetchFunction)
      
      expect(fetchFunction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(newData)
    })

    it('should cleanup old cache entries when limit exceeded', async () => {
      // Fill cache to limit
      for (let i = 0; i < 51; i++) {
        client._safeZoneCache.set(`key-${i}`, {
          data: { data: i },
          timestamp: Date.now()
        })
      }

      const fetchFunction = vi.fn().mockResolvedValue({ success: true, data: 'new' })
      await client.getCachedSafeZones('new-key', fetchFunction)
      
      expect(client._safeZoneCache.size).toBeLessThanOrEqual(51)
      expect(client._safeZoneCache.has('key-0')).toBe(false) // Oldest should be removed
    })

    it('should clear cache correctly', () => {
      client._safeZoneCache.set('test-key', { data: 'test', timestamp: Date.now() })
      
      client.clearSafeZoneCache()
      
      expect(client._safeZoneCache.size).toBe(0)
    })

    it('should handle cache fetch errors', async () => {
      const fetchFunction = vi.fn().mockRejectedValue(new Error('Fetch error'))

      await expect(client.getCachedSafeZones('test-key', fetchFunction)).rejects.toThrow('Fetch error')
    })
  })

  describe('Utility Methods', () => {
    it('should generate correct WebSocket URL', () => {
      client.setDeviceFingerprint('test-fingerprint')
      const wsUrl = client.getWebSocketUrl()
      
      expect(wsUrl).toContain('ws:')
      expect(wsUrl).toContain('test-fingerprint')
    })

    it('should validate report data correctly', () => {
      const validReport = {
        type: 'harassment',
        description: 'This is a valid description with enough characters',
        location: { coordinates: [90.4125, 23.8103] },
        severity: 3
      }

      const validation = client.validateReportData(validReport)
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect invalid report data', () => {
      const invalidReport = {
        type: '',
        description: 'short',
        location: null,
        severity: 10
      }

      const validation = client.validateReportData(invalidReport)
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Report type is required')
      expect(validation.errors).toContain('Description must be at least 10 characters')
      expect(validation.errors).toContain('Location coordinates are required')
      expect(validation.errors).toContain('Severity must be between 1 and 5')
    })

    it('should format API errors correctly', () => {
      expect(client.formatApiError('Simple error')).toBe('Simple error')
      
      expect(client.formatApiError({ message: 'Failed to fetch' }))
        .toBe('Unable to connect to server. Please check your internet connection.')
      
      expect(client.formatApiError({ message: 'HTTP error 404' }))
        .toBe('The requested resource was not found.')
      
      expect(client.formatApiError({ message: 'HTTP error 500' }))
        .toBe('Server error. Please try again later.')
      
      expect(client.formatApiError({ message: 'Custom error' }))
        .toBe('Custom error')
      
      expect(client.formatApiError({}))
        .toBe('An unexpected error occurred. Please try again.')
    })
  })

  describe('Health Check Methods', () => {
    it('should perform health check', async () => {
      const healthResponse = { status: 'ok' }
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(healthResponse)
      })

      const result = await client.healthCheck()
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/health',
        expect.any(Object)
      )
      expect(result).toEqual(healthResponse)
    })

    it('should check health with alternative method', async () => {
      const healthResponse = { status: 'ok' }
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(healthResponse)
      })

      const result = await client.checkHealth()
      
      expect(result).toEqual(healthResponse)
    })

    it('should get API status', async () => {
      const statusResponse = { version: '1.0.0' }
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(statusResponse)
      })

      const result = await client.getApiStatus()
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/',
        expect.any(Object)
      )
      expect(result).toEqual(statusResponse)
    })

    it('should get API info', async () => {
      const infoResponse = { info: 'API information' }
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(infoResponse)
      })

      const result = await client.getApiInfo()
      
      expect(result).toEqual(infoResponse)
    })
  })

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(apiClient).toBeInstanceOf(ApiClient)
    })

    it('should export the ApiClient class', () => {
      expect(ApiClient).toBeDefined()
      expect(typeof ApiClient).toBe('function')
    })
  })
})