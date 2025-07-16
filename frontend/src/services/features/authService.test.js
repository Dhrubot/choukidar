import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import authService, { AuthService } from './authService.js'
import apiClient from '../core/apiClient.js'

// Mock the API client
vi.mock('../core/apiClient.js', () => ({
  default: {
    setDeviceFingerprint: vi.fn(),
    request: vi.fn(),
    deviceFingerprint: null
  }
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
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
    it('should initialize with null device fingerprint', () => {
      expect(authService.deviceFingerprint).toBeNull()
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'test-fingerprint-123'
      authService.setDeviceFingerprint(fingerprint)
      
      expect(authService.deviceFingerprint).toBe(fingerprint)
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
    })

    it('should propagate device fingerprint to API client', () => {
      const fingerprint = 'test-fingerprint-456'
      authService.setDeviceFingerprint(fingerprint)
      
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
    })
  })

  describe('User Context', () => {
    it('should get user context and set device fingerprint', async () => {
      const fingerprint = 'context-fingerprint'
      const mockResponse = { success: true, user: { id: 1, type: 'user' } }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await authService.getUserContext(fingerprint)
      
      expect(authService.deviceFingerprint).toBe(fingerprint)
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
      expect(apiClient.request).toHaveBeenCalledWith('/auth/user/context')
      expect(result).toEqual(mockResponse)
    })

    it('should handle user context errors', async () => {
      const fingerprint = 'error-fingerprint'
      const mockError = { success: false, message: 'Context error' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await authService.getUserContext(fingerprint)
      
      expect(result).toEqual(mockError)
    })
  })

  describe('Admin Authentication', () => {
    it('should perform admin login with credentials', async () => {
      const credentials = { username: 'admin', password: 'password123' }
      const mockResponse = { success: true, token: 'admin-token-123' }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await authService.adminLogin(credentials)
      
      expect(apiClient.request).toHaveBeenCalledWith('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle admin login errors', async () => {
      const credentials = { username: 'admin', password: 'wrong' }
      const mockError = { success: false, message: 'Invalid credentials' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await authService.adminLogin(credentials)
      
      expect(result).toEqual(mockError)
    })

    it('should perform admin logout and clear token', async () => {
      const mockResponse = { success: true, message: 'Logged out' }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await authService.adminLogout()
      
      expect(apiClient.request).toHaveBeenCalledWith('/auth/admin/logout', {
        method: 'POST'
      })
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('safestreets_admin_token')
      expect(result).toEqual(mockResponse)
    })

    it('should clear token even if logout request fails', async () => {
      const mockError = { success: false, message: 'Logout failed' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await authService.adminLogout()
      
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('safestreets_admin_token')
      expect(result).toEqual(mockError)
    })
  })

  describe('Service Integration', () => {
    it('should work with API client correctly', async () => {
      const fingerprint = 'integration-test'
      const mockResponse = { success: true, data: 'test' }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      authService.setDeviceFingerprint(fingerprint)
      const result = await authService.getUserContext(fingerprint)
      
      expect(apiClient.setDeviceFingerprint).toHaveBeenCalledWith(fingerprint)
      expect(apiClient.request).toHaveBeenCalledWith('/auth/user/context')
      expect(result).toEqual(mockResponse)
    })
  })
})