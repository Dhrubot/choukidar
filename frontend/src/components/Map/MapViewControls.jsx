// === frontend/src/components/Map/MapViewControls.jsx (OPTIMIZED) ===
import { useState, useCallback, useMemo, memo } from 'react'
import { Map, Flame, Layers, Settings, Info } from 'lucide-react'

// Move static data outside component to prevent recreation
const VIEW_MODES = [
  {
    id: 'markers',
    label: 'Markers',
    icon: Map,
    description: 'Individual incident markers'
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    icon: Flame,
    description: 'Crime density visualization'
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    icon: Layers,
    description: 'Both markers and heatmap'
  }
]

const INTENSITY_LEVELS = [
  { value: 'low', label: 'Low', radius: 15, blur: 8 },
  { value: 'medium', label: 'Medium', radius: 25, blur: 15 },
  { value: 'high', label: 'High', radius: 35, blur: 20 }
]

const MapViewControls = memo(({ 
  viewMode, 
  onViewModeChange, 
  heatmapOptions = {}, // Default value to prevent undefined
  onHeatmapOptionsChange,
  reportCount = 0,
  className = ""
}) => {
  const [showSettings, setShowSettings] = useState(false)

  // Memoize the toggle settings handler
  const handleToggleSettings = useCallback(() => {
    setShowSettings(prev => !prev)
  }, [])

  // Memoize the view mode change handler to prevent recreation
  const handleViewModeClick = useCallback((modeId) => {
    if (onViewModeChange) {
      onViewModeChange(modeId)
    }
  }, [onViewModeChange])

  // Memoize intensity level change handler
  const handleIntensityChange = useCallback((level) => {
    if (onHeatmapOptionsChange) {
      onHeatmapOptionsChange({
        radius: level.radius,
        blur: level.blur
      })
    }
  }, [onHeatmapOptionsChange])

  // Memoize manual control handlers
  const handleRadiusChange = useCallback((e) => {
    if (onHeatmapOptionsChange) {
      onHeatmapOptionsChange({
        ...heatmapOptions,
        radius: parseInt(e.target.value)
      })
    }
  }, [onHeatmapOptionsChange, heatmapOptions])

  const handleBlurChange = useCallback((e) => {
    if (onHeatmapOptionsChange) {
      onHeatmapOptionsChange({
        ...heatmapOptions,
        blur: parseInt(e.target.value)
      })
    }
  }, [onHeatmapOptionsChange, heatmapOptions])

  // Memoize reset handler
  const handleReset = useCallback(() => {
    if (onHeatmapOptionsChange) {
      onHeatmapOptionsChange({
        radius: 25,
        blur: 15
      })
    }
  }, [onHeatmapOptionsChange])

  // Memoize current heatmap values to prevent unnecessary renders
  const currentRadius = useMemo(() => heatmapOptions?.radius || 25, [heatmapOptions?.radius])
  const currentBlur = useMemo(() => heatmapOptions?.blur || 15, [heatmapOptions?.blur])

  // Memoize whether we should show heatmap-related sections
  const showHeatmapSections = useMemo(() => {
    return viewMode === 'heatmap' || viewMode === 'hybrid'
  }, [viewMode])

  // Memoize performance warning condition
  const showPerformanceWarning = useMemo(() => {
    return reportCount > 500 && viewMode === 'hybrid'
  }, [reportCount, viewMode])

  return (
    <div className={`bg-white rounded-lg shadow-medium border border-neutral-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-neutral-800 flex items-center">
            <Layers className="w-4 h-4 mr-2 text-safe-primary" />
            Map Visualization
          </h3>
          <button
            onClick={handleToggleSettings}
            className="p-1 hover:bg-neutral-100 rounded transition-colors"
            title="Heatmap Settings"
          >
            <Settings className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          {reportCount} reports • Choose visualization style
        </p>
      </div>

      {/* View Mode Selection */}
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon
            const isActive = viewMode === mode.id
            
            return (
              <button
                key={mode.id}
                onClick={() => handleViewModeClick(mode.id)}
                className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200 ${
                  isActive 
                    ? 'border-safe-primary bg-safe-primary text-white shadow-md' 
                    : 'border-neutral-200 hover:border-neutral-300 text-neutral-600 hover:text-neutral-800'
                }`}
              >
                <Icon className="w-6 h-6 mb-2" />
                <span className="font-medium text-sm">{mode.label}</span>
                <span className={`text-xs mt-1 text-center ${
                  isActive ? 'text-white/80' : 'text-neutral-500'
                }`}>
                  {mode.description}
                </span>
              </button>
            )
          })}
        </div>

        {/* Heatmap Info */}
        {showHeatmapSections && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium mb-1">
                  Crime Density Heatmap
                </p>
                <p className="text-xs text-blue-700">
                  🟢 Green = Safe areas • 🟡 Yellow = Moderate risk • 🔴 Red = High danger
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Intensity based on incident severity and frequency
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Heatmap Settings */}
      {showSettings && showHeatmapSections && (
        <div className="border-t border-neutral-100 p-4">
          <h4 className="font-medium text-neutral-800 mb-3">Heatmap Settings</h4>
          
          {/* Intensity Level */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Heat Intensity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {INTENSITY_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => handleIntensityChange(level)}
                  className={`px-3 py-2 text-sm rounded border transition-colors ${
                    currentRadius === level.radius
                      ? 'border-safe-primary bg-safe-primary text-white'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Heat Radius: {currentRadius}px
              </label>
              <input
                type="range"
                min="10"
                max="50"
                value={currentRadius}
                onChange={handleRadiusChange}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Blur Factor: {currentBlur}px
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={currentBlur}
                onChange={handleBlurChange}
                className="w-full"
              />
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="mt-4 w-full btn-outline btn-sm"
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Performance Warning */}
      {showPerformanceWarning && (
        <div className="border-t border-neutral-100 p-4">
          <div className="flex items-start p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <Info className="w-4 h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">
                Performance Notice
              </p>
              <p className="text-xs text-yellow-700">
                Large dataset detected. Consider using heatmap-only view for better performance.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// Add display name for debugging
MapViewControls.displayName = 'MapViewControls'

export default MapViewControls