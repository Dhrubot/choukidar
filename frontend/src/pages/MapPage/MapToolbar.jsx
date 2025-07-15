// === frontend/src/pages/MapPage/MapToolbar.jsx ===
/**
 * MapToolbar - Top Controls Bar
 * Provides quick access to view modes, filters, and map functions
 * Mobile-optimized with collapsible sections
 */

import React, { useState, useCallback, useMemo, memo } from 'react'
import {
  Filter, Shield, Navigation, RefreshCw, Settings, Info, 
  ChevronDown, AlertTriangle, CheckCircle, Zap, Eye, EyeOff,
  Map, Flame, Layers, Target, BarChart3, Clock
} from 'lucide-react'

// View mode configurations
const VIEW_MODES = {
  markers: { 
    id: 'markers', 
    label: 'Markers', 
    icon: Map, 
    color: 'bangladesh-green',
    description: 'Individual markers'
  },
  clusters: { 
    id: 'clusters', 
    label: 'Clusters', 
    icon: Target, 
    color: 'purple-600',
    description: 'Grouped markers'
  },
  heatmap: { 
    id: 'heatmap', 
    label: 'Heatmap', 
    icon: Flame, 
    color: 'orange-600',
    description: 'Density visualization'
  },
  hybrid: { 
    id: 'hybrid', 
    label: 'Hybrid', 
    icon: Layers, 
    color: 'red-600',
    description: 'Combined view'
  }
}

const MapToolbar = memo(({
  viewMode,
  onViewModeChange,
  heatmapOptions,
  onHeatmapOptionsChange,
  clusteringOptions,
  onClusteringOptionsChange,
  reportCount,
  hasActiveFilters,
  onOpenFilters,
  onOpenSafeZones,
  onOpenRoutes,
  onRefresh,
  quotaStatus,
  safeZoneCount,
  hasRoutes,
  routingAvailable,
  className = ""
}) => {
  // UI state
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [showQuotaDetails, setShowQuotaDetails] = useState(false)

  // Toggle advanced controls
  const handleToggleAdvanced = useCallback(() => {
    setShowAdvancedControls(prev => !prev)
  }, [])

  // Handle refresh with loading state
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setTimeout(() => setRefreshing(false), 1000)
    }
  }, [onRefresh, refreshing])

  // Quota status indicator
  const quotaIndicator = useMemo(() => {
    if (!quotaStatus) return null

    const isLow = quotaStatus.remainingRequests < 100
    const isVeryLow = quotaStatus.remainingRequests < 20

    return {
      status: isVeryLow ? 'critical' : isLow ? 'warning' : 'good',
      color: isVeryLow ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600',
      bgColor: isVeryLow ? 'bg-red-50' : isLow ? 'bg-yellow-50' : 'bg-green-50',
      borderColor: isVeryLow ? 'border-red-200' : isLow ? 'border-yellow-200' : 'border-green-200',
      remaining: quotaStatus.remainingRequests
    }
  }, [quotaStatus])

  // Performance warning
  const performanceWarning = useMemo(() => {
    return viewMode === 'hybrid' && reportCount > 500
  }, [viewMode, reportCount])

  return (
    <div className={`bg-white border-b border-neutral-200 shadow-sm ${className}`}>
      {/* Main Toolbar */}
      <div className="px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between">
          {/* Left Side - View Controls */}
          <div className="flex items-center space-x-3">
            {/* View Mode Selector */}
            <div className="flex items-center bg-neutral-100 rounded-lg p-1">
              {Object.values(VIEW_MODES).map((mode) => {
                const Icon = mode.icon
                const isActive = viewMode === mode.id
                
                return (
                  <button
                    key={mode.id}
                    onClick={() => onViewModeChange(mode.id)}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? `bg-${mode.color} text-white shadow-md`
                        : 'text-neutral-600 hover:text-neutral-800 hover:bg-white'
                    }`}
                    title={mode.description}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{mode.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Performance Warning */}
            {performanceWarning && (
              <div className="hidden lg:flex items-center space-x-1 text-yellow-600 bg-yellow-50 px-2 py-1 rounded text-xs">
                <AlertTriangle className="w-3 h-3" />
                <span>High load mode</span>
              </div>
            )}
          </div>

          {/* Center - Status Info */}
          <div className="hidden md:flex items-center space-x-4 text-sm text-neutral-600">
            <div className="flex items-center space-x-1">
              <BarChart3 className="w-4 h-4" />
              <span>
                {reportCount.toLocaleString()} report{reportCount !== 1 ? 's' : ''}
                {hasActiveFilters && <span className="text-bangladesh-green ml-1">(filtered)</span>}
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <Shield className="w-4 h-4" />
              <span>{safeZoneCount} safe zones</span>
            </div>

            {routingAvailable && (
              <div className="flex items-center space-x-1">
                <Navigation className="w-4 h-4" />
                <span className={hasRoutes ? 'text-blue-600' : ''}>
                  {hasRoutes ? 'Route planned' : 'Routes available'}
                </span>
              </div>
            )}
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Quick Actions */}
            <div className="flex items-center space-x-1">
              <button
                onClick={onOpenFilters}
                className={`p-2 rounded-lg transition-colors ${
                  hasActiveFilters
                    ? 'bg-bangladesh-green text-white'
                    : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
                }`}
                title="Open Filters"
              >
                <Filter className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenSafeZones}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
                title="Open Safe Zones"
              >
                <Shield className="w-4 h-4" />
              </button>

              {routingAvailable && (
                <button
                  onClick={onOpenRoutes}
                  className={`p-2 rounded-lg transition-colors ${
                    hasRoutes
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
                  }`}
                  title="Open Route Planner"
                >
                  <Navigation className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Advanced Controls Toggle */}
            <div className="hidden lg:block h-6 w-px bg-neutral-200"></div>
            
            <button
              onClick={handleToggleAdvanced}
              className="hidden lg:flex items-center space-x-1 p-2 rounded-lg text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
              title="Advanced Controls"
            >
              <Settings className="w-4 h-4" />
              <ChevronDown 
                className={`w-3 h-3 transition-transform ${
                  showAdvancedControls ? 'rotate-180' : ''
                }`} 
              />
            </button>

            {/* Quota Status */}
            {quotaIndicator && (
              <div className="relative">
                <button
                  onClick={() => setShowQuotaDetails(!showQuotaDetails)}
                  className={`p-2 rounded-lg border transition-colors ${quotaIndicator.bgColor} ${quotaIndicator.borderColor} ${quotaIndicator.color}`}
                  title="API Quota Status"
                >
                  <Zap className="w-4 h-4" />
                </button>

                {/* Quota Details Popup */}
                {showQuotaDetails && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-neutral-200 p-3 z-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-neutral-800">API Usage</h4>
                      <button
                        onClick={() => setShowQuotaDetails(false)}
                        className="text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Remaining:</span>
                        <span className={`font-medium ${quotaIndicator.color}`}>
                          {quotaIndicator.remaining}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-600">Resets:</span>
                        <span className="text-neutral-800">
                          {quotaStatus.resetTime ? new Date(quotaStatus.resetTime).toLocaleTimeString() : 'Unknown'}
                        </span>
                      </div>
                      {quotaIndicator.status !== 'good' && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
                          Route planning may be limited when quota is low
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Controls Panel */}
      {showAdvancedControls && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Heatmap Controls */}
            {(viewMode === 'heatmap' || viewMode === 'hybrid') && (
              <div className="bg-white rounded-lg p-3 border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                  <Flame className="w-4 h-4 mr-2 text-orange-600" />
                  Heatmap Settings
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">
                      Radius: {heatmapOptions.radius}px
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={heatmapOptions.radius}
                      onChange={(e) => onHeatmapOptionsChange({ 
                        ...heatmapOptions, 
                        radius: parseInt(e.target.value) 
                      })}
                      className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-600 mb-1">
                      Blur: {heatmapOptions.blur}px
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={heatmapOptions.blur}
                      onChange={(e) => onHeatmapOptionsChange({ 
                        ...heatmapOptions, 
                        blur: parseInt(e.target.value) 
                      })}
                      className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Clustering Controls */}
            {(viewMode === 'clusters' || viewMode === 'hybrid') && (
              <div className="bg-white rounded-lg p-3 border border-neutral-200">
                <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2 text-purple-600" />
                  Clustering Settings
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Show type indicators</span>
                    <button
                      onClick={() => onClusteringOptionsChange({
                        ...clusteringOptions,
                        showTypeIndicator: !clusteringOptions.showTypeIndicator
                      })}
                      className={`p-1 rounded ${
                        clusteringOptions.showTypeIndicator 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {clusteringOptions.showTypeIndicator ? 
                        <Eye className="w-4 h-4" /> : 
                        <EyeOff className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Risk badges</span>
                    <button
                      onClick={() => onClusteringOptionsChange({
                        ...clusteringOptions,
                        showRiskBadge: !clusteringOptions.showRiskBadge
                      })}
                      className={`p-1 rounded ${
                        clusteringOptions.showRiskBadge 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {clusteringOptions.showRiskBadge ? 
                        <Eye className="w-4 h-4" /> : 
                        <EyeOff className="w-4 h-4" />
                      }
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-600">Animations</span>
                    <button
                      onClick={() => onClusteringOptionsChange({
                        ...clusteringOptions,
                        enableAnimations: !clusteringOptions.enableAnimations
                      })}
                      className={`p-1 rounded ${
                        clusteringOptions.enableAnimations 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {clusteringOptions.enableAnimations ? 
                        <Eye className="w-4 h-4" /> : 
                        <EyeOff className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Info */}
            <div className="bg-white rounded-lg p-3 border border-neutral-200 lg:col-span-2">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
                Performance Info
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {reportCount.toLocaleString()}
                  </div>
                  <div className="text-neutral-600">Reports</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {safeZoneCount}
                  </div>
                  <div className="text-neutral-600">Safe Zones</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    performanceWarning ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {performanceWarning ? 'High' : 'Normal'}
                  </div>
                  <div className="text-neutral-600">Load</div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    quotaIndicator 
                      ? quotaIndicator.status === 'good' ? 'text-green-600' : 'text-yellow-600'
                      : 'text-neutral-600'
                  }`}>
                    {quotaIndicator ? quotaIndicator.remaining : 'N/A'}
                  </div>
                  <div className="text-neutral-600">API Quota</div>
                </div>
              </div>

              {/* Performance Tips */}
              {performanceWarning && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  <strong>Performance Tip:</strong> Consider using "Heatmap" or "Clusters" view for better performance with large datasets.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Status Bar */}
      <div className="md:hidden border-t border-neutral-100 bg-neutral-50 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span>
            {reportCount.toLocaleString()} reports
            {hasActiveFilters && <span className="text-bangladesh-green ml-1">(filtered)</span>}
          </span>
          <div className="flex items-center space-x-3">
            <span>{safeZoneCount} safe zones</span>
            {routingAvailable && hasRoutes && (
              <span className="text-blue-600">Route planned</span>
            )}
            {quotaIndicator && (
              <span className={quotaIndicator.color}>
                {quotaIndicator.remaining} API
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

// Add display name for debugging
MapToolbar.displayName = 'MapToolbar'

export default MapToolbar