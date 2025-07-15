// === frontend/src/services/requestManager.js ===
/**
 * Cost-Optimized Request Manager for SafeStreets Bangladesh
 * Manages OpenRouteService API quotas and ensures zero overage costs
 * 
 * FREE TIER LIMITS:
 * - Directions: 2,000 requests/day, 40/minute
 * - Isochrones: Limited daily requests
 * - Matrix: Limited daily requests
 * - Geocoding: Available
 */

class RequestManager {
  constructor() {
    this.limits = {
      directions: {
        daily: 2000,
        minute: 40,
        priority: 1 // High priority
      },
      isochrones: {
        daily: 1000, // Conservative estimate
        minute: 20,
        priority: 2
      },
      matrix: {
        daily: 500, // Conservative estimate
        minute: 10,
        priority: 3
      },
      geocoding: {
        daily: 5000, // Usually generous
        minute: 60,
        priority: 4 // Low priority
      }
    }

    this.usage = this.loadUsageFromStorage()
    this.requestQueue = []
    this.isProcessing = false
    
    // Reset daily counters if needed
    this.checkDailyReset()
    
    // Start minute counter reset interval
    this.startMinuteResetInterval()
  }

  // Load usage data from localStorage
  loadUsageFromStorage() {
    try {
      const stored = localStorage.getItem('ors_usage_tracking')
      if (stored) {
        const data = JSON.parse(stored)
        
        // Check if data is from today
        const today = new Date().toDateString()
        if (data.date === today) {
          return data.usage
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load usage data:', error)
    }

    // Return fresh usage data
    return {
      directions: { daily: 0, minute: [] },
      isochrones: { daily: 0, minute: [] },
      matrix: { daily: 0, minute: [] },
      geocoding: { daily: 0, minute: [] }
    }
  }

  // Save usage data to localStorage
  saveUsageToStorage() {
    try {
      const data = {
        date: new Date().toDateString(),
        usage: this.usage,
        timestamp: Date.now()
      }
      localStorage.setItem('ors_usage_tracking', JSON.stringify(data))
    } catch (error) {
      console.warn('⚠️ Failed to save usage data:', error)
    }
  }

  // Check if daily limits need reset
  checkDailyReset() {
    const stored = localStorage.getItem('ors_usage_tracking')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        const today = new Date().toDateString()
        
        if (data.date !== today) {
          console.log('📅 New day detected - resetting daily quotas')
          this.resetDailyCounters()
        }
      } catch (error) {
        console.warn('⚠️ Error checking daily reset:', error)
        this.resetDailyCounters()
      }
    }
  }

  // Reset daily counters
  resetDailyCounters() {
    for (const service in this.usage) {
      this.usage[service].daily = 0
    }
    this.saveUsageToStorage()
  }

  // Start minute reset interval (sliding window)
  startMinuteResetInterval() {
    setInterval(() => {
      const cutoff = Date.now() - 60000 // 1 minute ago
      
      for (const service in this.usage) {
        this.usage[service].minute = this.usage[service].minute.filter(
          timestamp => timestamp > cutoff
        )
      }
      
      this.saveUsageToStorage()
    }, 10000) // Check every 10 seconds
  }

  // Check if request can be made
  canMakeRequest(service) {
    const limits = this.limits[service]
    const usage = this.usage[service]

    if (!limits || !usage) {
      console.warn(`⚠️ Unknown service: ${service}`)
      return false
    }

    // Check daily limit
    if (usage.daily >= limits.daily) {
      console.warn(`🚫 Daily limit reached for ${service}: ${usage.daily}/${limits.daily}`)
      return false
    }

    // Check minute limit (sliding window)
    const cutoff = Date.now() - 60000
    const recentRequests = usage.minute.filter(timestamp => timestamp > cutoff).length
    
    if (recentRequests >= limits.minute) {
      console.warn(`🚫 Minute limit reached for ${service}: ${recentRequests}/${limits.minute}`)
      return false
    }

    return true
  }

  // Record a request
  recordRequest(service) {
    if (!this.usage[service]) {
      this.usage[service] = { daily: 0, minute: [] }
    }

    const now = Date.now()
    this.usage[service].daily += 1
    this.usage[service].minute.push(now)
    
    this.saveUsageToStorage()

    console.log(`📊 ${service} usage: ${this.usage[service].daily}/${this.limits[service].daily} daily, ${this.usage[service].minute.length} in last minute`)
  }

  // Get remaining quota
  getRemainingQuota(service) {
    const limits = this.limits[service]
    const usage = this.usage[service]

    if (!limits || !usage) return null

    const cutoff = Date.now() - 60000
    const recentRequests = usage.minute.filter(timestamp => timestamp > cutoff).length

    return {
      daily: {
        remaining: limits.daily - usage.daily,
        total: limits.daily,
        percentage: ((limits.daily - usage.daily) / limits.daily) * 100
      },
      minute: {
        remaining: limits.minute - recentRequests,
        total: limits.minute,
        percentage: ((limits.minute - recentRequests) / limits.minute) * 100
      }
    }
  }

  // Queue request with priority
  async queueRequest(service, requestFn, priority = null) {
    const requestPriority = priority || this.limits[service]?.priority || 999

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        service,
        requestFn,
        priority: requestPriority,
        resolve,
        reject,
        timestamp: Date.now()
      })

      // Sort queue by priority (lower number = higher priority)
      this.requestQueue.sort((a, b) => a.priority - b.priority)

      // Process queue
      this.processQueue()
    })
  }

  // Process request queue
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return

    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0]

      // Check if request can be made
      if (this.canMakeRequest(request.service)) {
        // Remove from queue
        this.requestQueue.shift()

        try {
          // Record the request
          this.recordRequest(request.service)

          // Execute the request
          const result = await request.requestFn()
          request.resolve(result)

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          console.error(`❌ Request failed for ${request.service}:`, error)
          request.reject(error)
        }
      } else {
        // Can't make request now, wait and try again
        console.log(`⏳ Waiting for quota availability for ${request.service}`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    this.isProcessing = false
  }

  // Get overall quota status
  getQuotaStatus() {
    const status = {}
    
    for (const service in this.limits) {
      status[service] = this.getRemainingQuota(service)
    }

    return status
  }

  // Emergency quota check (for UI warnings)
  isQuotaLow(service, threshold = 0.1) {
    const quota = this.getRemainingQuota(service)
    if (!quota) return false

    return quota.daily.percentage < (threshold * 100) || 
           quota.minute.percentage < (threshold * 100)
  }

  // Clear all usage data (for testing)
  clearUsageData() {
    localStorage.removeItem('ors_usage_tracking')
    this.usage = this.loadUsageFromStorage()
    console.log('🗑️ Usage data cleared')
  }
}

// Create singleton instance
const requestManager = new RequestManager()

export default requestManager

// Export quota monitoring utilities
export const getQuotaStatus = () => requestManager.getQuotaStatus()
export const isQuotaLow = (service, threshold) => requestManager.isQuotaLow(service, threshold)
export const clearUsageData = () => requestManager.clearUsageData()