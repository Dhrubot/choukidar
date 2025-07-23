// === frontend/src/pages/MapPage/PerformanceWarnings.jsx ===
import React, { memo, useMemo } from 'react'
import { Zap, Smartphone, Monitor, AlertTriangle } from 'lucide-react'

/**
 * PerformanceWarnings Component - Enhanced with dynamic thresholds
 * Shows performance warnings with device-aware thresholds
 */
const PerformanceWarnings = memo(({
  // Performance data
  performanceStats,
  
  // Current state
  viewMode,
  reportCount,
  
  // NEW: Device and context information
  isMobile,
  deviceCapabilities,
  mapZoom,
  
  // Handlers
  onViewModeChange
}) => {
  // NEW: Dynamic performance thresholds based on device capabilities
  const performanceThresholds = useMemo(() => {
    const baseThresholds = {
      mobile: {
        warning: 200,    // Show warning at 200+ reports on mobile
        critical: 500,   // Critical performance impact at 500+
        heatmapOnly: 1000 // Force heatmap only at 1000+
      },
      desktop: {
        warning: 500,    // Show warning at 500+ reports on desktop
        critical: 1500,  // Critical performance impact at 1500+
        heatmapOnly: 3000 // Force heatmap only at 3000+
      }
    }

    // Adjust thresholds based on device capabilities
    const deviceType = isMobile ? 'mobile' : 'desktop'
    let thresholds = { ...baseThresholds[deviceType] }

    // Further adjust based on device performance indicators
    if (deviceCapabilities?.lowMemory) {
      thresholds.warning *= 0.5
      thresholds.critical *= 0.5
      thresholds.heatmapOnly *= 0.5
    } else if (deviceCapabilities?.highPerformance) {
      thresholds.warning *= 1.5
      thresholds.critical *= 1.5
      thresholds.heatmapOnly *= 1.5
    }

    // Adjust based on zoom level (higher zoom = more detail needed)
    if (mapZoom > 14) {
      thresholds.warning *= 0.7 // More conservative at high zoom
      thresholds.critical *= 0.7
    } else if (mapZoom < 10) {
      thresholds.warning *= 1.3 // More lenient at low zoom
      thresholds.critical *= 1.3
    }

    return thresholds
  }, [isMobile, deviceCapabilities, mapZoom])

  // NEW: Determine warning level based on dynamic thresholds
  const warningLevel = useMemo(() => {
    if (reportCount >= performanceThresholds.heatmapOnly) {
      return 'critical'
    } else if (reportCount >= performanceThresholds.critical) {
      return 'high'
    } else if (reportCount >= performanceThresholds.warning) {
      return 'medium'
    }
    return 'none'
  }, [reportCount, performanceThresholds])

  // NEW: Enhanced warning logic
  const shouldShowWarning = useMemo(() => {
    if (warningLevel === 'none') return false
    
    // Critical level: always show warning
    if (warningLevel === 'critical') return true
    
    // High level: show if not using optimal view modes
    if (warningLevel === 'high') {
      return viewMode !== 'clusters' && viewMode !== 'heatmap'
    }
    
    // Medium level: show if using individual markers
    if (warningLevel === 'medium') {
      return viewMode === 'markers'
    }
    
    return false
  }, [warningLevel, viewMode])

  // NEW: Dynamic warning messages
  const warningContent = useMemo(() => {
    const deviceIcon = isMobile ? Smartphone : Monitor
    
    switch (warningLevel) {
      case 'critical':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50 border-red-200',
          textColor: 'text-red-900',
          accentColor: 'text-red-600',
          title: 'Critical Performance Impact',
          message: `${reportCount} reports detected on ${isMobile ? 'mobile' : 'desktop'}. Heatmap view recommended for optimal performance.`,
          buttonColor: 'text-red-600 hover:text-red-800 hover:bg-red-100',
          recommendations: ['heatmap']
        }
      case 'high':
        return {
          icon: Zap,
          bgColor: 'bg-amber-50 border-amber-200',
          textColor: 'text-amber-900',
          accentColor: 'text-amber-600',
          title: 'High Dataset Performance Notice',
          message: `${reportCount} reports detected. Consider clustering or heatmap view for better performance.`,
          buttonColor: 'text-amber-600 hover:text-amber-800 hover:bg-amber-100',
          recommendations: ['clusters', 'heatmap']
        }
      case 'medium':
        return {
          icon: deviceIcon,
          bgColor: 'bg-blue-50 border-blue-200',
          textColor: 'text-blue-900',
          accentColor: 'text-blue-600',
          title: 'Performance Optimization Available',
          message: `${reportCount} reports loaded. Clustering can improve map responsiveness.`,
          buttonColor: 'text-blue-600 hover:text-blue-800 hover:bg-blue-100',
          recommendations: ['clusters']
        }
      default:
        return null
    }
  }, [warningLevel, reportCount, isMobile])

  if (!shouldShowWarning || !warningContent) return null

  const { icon: WarningIcon, bgColor, textColor, accentColor, title, message, buttonColor, recommendations } = warningContent

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pb-6">
        <div className={`${bgColor} border rounded-xl p-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <WarningIcon className={`w-5 h-5 ${accentColor} flex-shrink-0`} />
              <div>
                <span className={`${textColor} font-medium`}>
                  {title}
                </span>
                <p className={`${textColor.replace('900', '700')} text-sm`}>
                  {message}
                </p>
                {/* NEW: Show current thresholds for debugging (can be removed in production) */}
                {process.env.NODE_ENV === 'development' && (
                  <p className={`${textColor.replace('900', '600')} text-xs mt-1`}>
                    Thresholds: Warning {performanceThresholds.warning}, Critical {performanceThresholds.critical}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {recommendations.includes('clusters') && (
                <button
                  onClick={() => onViewModeChange('clusters')}
                  className={`${buttonColor} font-medium px-3 py-2 rounded-lg transition-colors text-sm`}
                >
                  Use Clusters
                </button>
              )}
              {recommendations.includes('heatmap') && (
                <button
                  onClick={() => onViewModeChange('heatmap')}
                  className={`${buttonColor} font-medium px-3 py-2 rounded-lg transition-colors text-sm`}
                >
                  Use Heatmap
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

PerformanceWarnings.displayName = 'PerformanceWarnings'

export default PerformanceWarnings