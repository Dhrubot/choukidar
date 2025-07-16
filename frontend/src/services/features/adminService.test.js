import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import adminService, { AdminService } from './adminService.js'
import apiClient from '../core/apiClient.js'

// Mock the API client
vi.mock('../core/apiClient.js', () => ({
  default: {
    setDeviceFingerprint: vi.fn(),
    request: vi.fn(),
    deviceFingerprint: null
  }
}))

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with null device fingerprint', () => {
      expect(adminService.deviceFingerprint).toBeNull()
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'admin-fingerprint-123'
      adminService.setDeviceFingerprint(fingerprint)
      
      expect(adminService.deviceFingerprint).toBe(fingerprint)
    })
  })

  describe('User Management', () => {
    it('should get users with no filters', async () => {
      const mockResponse = { success: true, users: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.getUsers()
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/users?')
      expect(result).toEqual(mockResponse)
    })

    it('should get users with filters', async () => {
      const filters = { status: 'active', type: 'user' }
      const mockResponse = { success: true, users: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.getUsers(filters)
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/users?status=active&type=user')
      expect(result).toEqual(mockResponse)
    })

    it('should get user details by ID', async () => {
      const userId = 123
      const mockResponse = { success: true, user: { id: 123, name: 'Test User' } }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.getUserDetails(userId)
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/user/123')
      expect(result).toEqual(mockResponse)
    })

    it('should quarantine user with default duration', async () => {
      const userId = 123
      const quarantine = true
      const reason = 'Violation of terms'
      const mockResponse = { success: true, message: 'User quarantined' }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.quarantineUser(userId, quarantine, reason)
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/user/123/quarantine', {
        method: 'PUT',
        body: JSON.stringify({ quarantine, reason, duration: 24 })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should quarantine user with custom duration', async () => {
      const userId = 123
      const quarantine = true
      const reason = 'Severe violation'
      const duration = 72
      const mockResponse = { success: true, message: 'User quarantined' }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.quarantineUser(userId, quarantine, reason, duration)
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/user/123/quarantine', {
        method: 'PUT',
        body: JSON.stringify({ quarantine, reason, duration })
      })
      expect(result).toEqual(mockResponse)
    })

    it('should create admin user', async () => {
      const adminData = { username: 'newadmin', email: 'admin@test.com', permissions: ['read', 'write'] }
      const mockResponse = { success: true, admin: { id: 1, username: 'newadmin' } }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      const result = await adminService.createAdmin(adminData)
      
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/create', {
        method: 'POST',
        body: JSON.stringify(adminData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should handle user management errors', async () => {
      const mockError = { success: false, message: 'Access denied' }
      
      apiClient.request.mockResolvedValue(mockError)
      
      const result = await adminService.getUsers()
      
      expect(result).toEqual(mockError)
    })
  })

  describe('Service Integration', () => {
    it('should work with API client correctly', async () => {
      const fingerprint = 'admin-integration-test'
      const mockResponse = { success: true, users: [] }
      
      apiClient.request.mockResolvedValue(mockResponse)
      
      adminService.setDeviceFingerprint(fingerprint)
      const result = await adminService.getUsers()
      
      expect(adminService.deviceFingerprint).toBe(fingerprint)
      expect(apiClient.request).toHaveBeenCalledWith('/user-types/admin/users?')
      expect(result).toEqual(mockResponse)
    })
  })
})