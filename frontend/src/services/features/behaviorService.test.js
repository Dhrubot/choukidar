import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import behaviorService, { BehaviorService } from './behaviorService.js'

describe('BehaviorService', () => {
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

    // Mock navigator
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true
    })

    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor and Configuration', () => {
    it('should initialize with null device fingerprint', () => {
      expect(behaviorService.deviceFingerprint).toBeNull()
    })
  })

  describe('Device Fingerprint Management', () => {
    it('should set device fingerprint correctly', () => {
      const fingerprint = 'behavior-fingerprint-123'
      behaviorService.setDeviceFingerprint(fingerprint)
      
      expect(behaviorService.deviceFingerprint).toBe(fingerprint)
    })
  })

  describe('Device Type Detection', () => {
    it('should detect mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      })
      
      const deviceType = behaviorService.detectDeviceType()
      expect(deviceType).toBe('mobile')
    })

    it('should detect Android mobile device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        configurable: true
      })
      
      const deviceType = behaviorService.detectDeviceType()
      expect(deviceType).toBe('mobile')
    })

    it('should detect tablet device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true
      })
      
      const deviceType = behaviorService.detectDeviceType()
      expect(deviceType).toBe('tablet')
    })

    it('should detect desktop device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      
      const deviceType = behaviorService.detectDeviceType()
      expect(deviceType).toBe('desktop')
    })
  })

  describe('Behavior Tracking', () => {
    beforeEach(() => {
      // Mock Date.now for consistent timestamps
      vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    })

    it('should track behavior with action only', () => {
      window.localStorage.getItem.mockReturnValue('[]')
      behaviorService.setDeviceFingerprint('test-fingerprint')
      
      behaviorService.trackBehavior('report_submit')
      
      expect(console.log).toHaveBeenCalledWith('📊 Behavior tracked:', 'report_submit', {})
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'safestreets_behavior',
        JSON.stringify([{
          action: 'report_submit',
          details: {},
          timestamp: 1234567890,
          deviceFingerprint: 'test-fingerprint'
        }])
      )
    })

    it('should track behavior with action and details', () => {
      window.localStorage.getItem.mockReturnValue('[]')
      behaviorService.setDeviceFingerprint('test-fingerprint')
      
      const details = { formTime: 5000, clicks: 3 }
      behaviorService.trackBehavior('form_interaction', details)
      
      expect(console.log).toHaveBeenCalledWith('📊 Behavior tracked:', 'form_interaction', details)
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'safestreets_behavior',
        JSON.stringify([{
          action: 'form_interaction',
          details,
          timestamp: 1234567890,
          deviceFingerprint: 'test-fingerprint'
        }])
      )
    })

    it('should append to existing behavior data', () => {
      const existingData = [{
        action: 'previous_action',
        details: {},
        timestamp: 1234567800,
        deviceFingerprint: 'test-fingerprint'
      }]
      window.localStorage.getItem.mockReturnValue(JSON.stringify(existingData))
      behaviorService.setDeviceFingerprint('test-fingerprint')
      
      behaviorService.trackBehavior('new_action')
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'safestreets_behavior',
        JSON.stringify([
          ...existingData,
          {
            action: 'new_action',
            details: {},
            timestamp: 1234567890,
            deviceFingerprint: 'test-fingerprint'
          }
        ])
      )
    })

    it('should limit behavior data to 10 entries', () => {
      // Create 10 existing entries
      const existingData = Array.from({ length: 10 }, (_, i) => ({
        action: `action_${i}`,
        details: {},
        timestamp: 1234567800 + i,
        deviceFingerprint: 'test-fingerprint'
      }))
      window.localStorage.getItem.mockReturnValue(JSON.stringify(existingData))
      behaviorService.setDeviceFingerprint('test-fingerprint')
      
      behaviorService.trackBehavior('new_action')
      
      const expectedData = [
        ...existingData.slice(1), // Remove first entry
        {
          action: 'new_action',
          details: {},
          timestamp: 1234567890,
          deviceFingerprint: 'test-fingerprint'
        }
      ]
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'safestreets_behavior',
        JSON.stringify(expectedData)
      )
      expect(expectedData).toHaveLength(10)
    })

    it('should handle invalid localStorage data', () => {
      window.localStorage.getItem.mockReturnValue('invalid-json')
      behaviorService.setDeviceFingerprint('test-fingerprint')
      
      behaviorService.trackBehavior('test_action')
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'safestreets_behavior',
        JSON.stringify([{
          action: 'test_action',
          details: {},
          timestamp: 1234567890,
          deviceFingerprint: 'test-fingerprint'
        }])
      )
    })
  })

  describe('Service Integration', () => {
    it('should work independently without API client', () => {
      const fingerprint = 'behavior-integration-test'
      
      behaviorService.setDeviceFingerprint(fingerprint)
      const deviceType = behaviorService.detectDeviceType()
      
      expect(behaviorService.deviceFingerprint).toBe(fingerprint)
      expect(typeof deviceType).toBe('string')
      expect(['mobile', 'tablet', 'desktop']).toContain(deviceType)
    })
  })
})