// === frontend/src/components/Map/PerformanceWarnings.jsx ===
import React, { memo } from 'react'
import { Zap } from 'lucide-react'

/**
 * PerformanceWarnings Component - Extracted from MapPage.jsx
 * Shows performance warnings for large datasets
 */
const PerformanceWarnings = memo(({
  // Performance data
  performanceStats,
  
  // Current state
  viewMode,
  reportCount,
  
  // Handlers
  onViewModeChange
}) => {
  // Only show warning for high impact datasets not using optimal view modes
  const shouldShowWarning = performanceStats.performanceImpact === 'high' && 
                           viewMode !== 'clusters' && 
                           viewMode !== 'heatmap'

  if (!shouldShowWarning) return null

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="pb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Zap className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <span className="text-amber-900 font-medium">
                  Large Dataset Performance Notice
                </span>
                <p className="text-amber-700 text-sm">
                  {reportCount} reports detected. Consider clustering or heatmap view for optimal performance.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onViewModeChange('clusters')}
                className="text-amber-600 hover:text-amber-800 font-medium px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm"
              >
                Use Clusters
              </button>
              <button
                onClick={() => onViewModeChange('heatmap')}
                className="text-amber-600 hover:text-amber-800 font-medium px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors text-sm"
              >
                Use Heatmap
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

PerformanceWarnings.displayName = 'PerformanceWarnings'

export default PerformanceWarnings