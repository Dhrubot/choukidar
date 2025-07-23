// === frontend/src/components/Map/SeveritySlider.jsx ===
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AlertTriangle, Shield, TrendingUp, Info, Eye } from 'lucide-react'

/**
 * Custom Severity Range Slider for SafeStreets Bangladesh - React 19 Compatible
 * Features: Visual risk indicators, crime severity mapping, mobile optimization, visual feedback
 */
const SeveritySlider = ({ 
  severityRange = [1, 5],
  onSeverityChange,
  reportCounts = {},
  className = "",
  disabled = false,
  showStats = true,
  showLabels = true,
  onVisualFeedback = null // NEW: Callback for visual feedback on map
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [activeThumb, setActiveThumb] = useState(null) // 'min' or 'max'
  const [showFeedback, setShowFeedback] = useState(false) // NEW: Visual feedback state
  const sliderRef = useRef(null)
  const minThumbRef = useRef(null)
  const maxThumbRef = useRef(null)
  const feedbackTimeoutRef = useRef(null) // NEW: Timeout for feedback

  // Severity level configuration with Bangladesh crime context
  const severityLevels = useMemo(() => [
    {
      level: 1,
      label: 'Very Low',
      color: '#10B981',
      bgColor: 'bg-green-500',
      description: 'Minor incidents, low community impact',
      icon: '🟢',
      examples: ['Minor disputes', 'Petty theft attempts']
    },
    {
      level: 2,
      label: 'Low',
      color: '#84CC16',
      bgColor: 'bg-lime-500',
      description: 'Manageable incidents requiring attention',
      icon: '🟡',
      examples: ['Small-scale harassment', 'Minor extortion']
    },
    {
      level: 3,
      label: 'Moderate',
      color: '#F59E0B',
      bgColor: 'bg-yellow-500',
      description: 'Significant incidents affecting community safety',
      icon: '🟠',
      examples: ['Organized harassment', 'Teen gang presence']
    },
    {
      level: 4,
      label: 'High',
      color: '#F97316',
      bgColor: 'bg-orange-500',
      description: 'Serious incidents requiring immediate attention',
      icon: '🔴',
      examples: ['Large-scale extortion', 'Violent gang activity']
    },
    {
      level: 5,
      label: 'Critical',
      color: '#EF4444',
      bgColor: 'bg-red-500',
      description: 'Extreme incidents posing severe community threat',
      icon: '🚨',
      examples: ['Armed violence', 'Major organized crime']
    }
  ], [])

  // Get severity level config by level number
  const getSeverityConfig = useCallback((level) => {
    return severityLevels.find(s => s.level === level) || severityLevels[2]
  }, [severityLevels])

  // Calculate statistics for current range
  const rangeStats = useMemo(() => {
    const [min, max] = severityRange
    const totalInRange = severityLevels
      .filter(level => level.level >= min && level.level <= max)
      .reduce((sum, level) => sum + (reportCounts[level.level] || 0), 0)
    
    const totalReports = Object.values(reportCounts).reduce((sum, count) => sum + count, 0)
    const percentage = totalReports > 0 ? ((totalInRange / totalReports) * 100).toFixed(1) : 0

    return {
      totalInRange,
      totalReports,
      percentage,
      dominantLevel: severityLevels
        .filter(level => level.level >= min && level.level <= max)
        .reduce((prev, current) => 
          (reportCounts[current.level] || 0) > (reportCounts[prev.level] || 0) ? current : prev,
          severityLevels[0]
        )
    }
  }, [severityRange, reportCounts, severityLevels])

  // Convert value to percentage position
  const valueToPercent = useCallback((value) => {
    return ((value - 1) / 4) * 100
  }, [])

  // Convert percentage to value
  const percentToValue = useCallback((percent) => {
    return Math.round((percent / 100) * 4 + 1)
  }, [])

  // Enhanced change handler with visual feedback
  const handleSeverityChange = useCallback((newRange) => {
    if (onSeverityChange) {
      onSeverityChange(newRange)
    }
    
    // NEW: Trigger visual feedback
    if (onVisualFeedback) {
      setShowFeedback(true)
      onVisualFeedback({
        type: 'severity_change',
        severityRange: newRange,
        affectedReports: Object.entries(reportCounts)
          .filter(([level]) => level >= newRange[0] && level <= newRange[1])
          .reduce((sum, [, count]) => sum + count, 0)
      })
      
      // Clear previous timeout
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current)
      }
      
      // Hide feedback after 2 seconds
      feedbackTimeoutRef.current = setTimeout(() => {
        setShowFeedback(false)
      }, 2000)
    }
  }, [onSeverityChange, onVisualFeedback, reportCounts])

  // Handle mouse/touch events
  const handlePointerDown = useCallback((event, thumb) => {
    event.preventDefault()
    setIsDragging(true)
    setActiveThumb(thumb)
    
    const handlePointerMove = (e) => {
      if (!sliderRef.current) return
      
      const rect = sliderRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const newValue = percentToValue(percent)
      
      const [currentMin, currentMax] = severityRange
      let newRange
      
      if (thumb === 'min') {
        newRange = [Math.min(newValue, currentMax), currentMax]
      } else {
        newRange = [currentMin, Math.max(newValue, currentMin)]
      }
      
      handleSeverityChange(newRange)
    }
    
    const handlePointerUp = () => {
      setIsDragging(false)
      setActiveThumb(null)
      document.removeEventListener('mousemove', handlePointerMove)
      document.removeEventListener('mouseup', handlePointerUp)
      document.removeEventListener('touchmove', handlePointerMove)
      document.removeEventListener('touchend', handlePointerUp)
    }
    
    document.addEventListener('mousemove', handlePointerMove)
    document.addEventListener('mouseup', handlePointerUp)
    document.addEventListener('touchmove', handlePointerMove)
    document.addEventListener('touchend', handlePointerUp)
  }, [severityRange, handleSeverityChange, percentToValue])

  // Handle slider track click
  const handleTrackClick = useCallback((event) => {
    if (!sliderRef.current || isDragging) return
    
    const rect = sliderRef.current.getBoundingClientRect()
    const percent = ((event.clientX - rect.left) / rect.width) * 100
    const newValue = percentToValue(percent)
    const [currentMin, currentMax] = severityRange
    
    // Determine which thumb to move based on proximity
    const distToMin = Math.abs(newValue - currentMin)
    const distToMax = Math.abs(newValue - currentMax)
    
    let newRange
    if (distToMin < distToMax) {
      newRange = [newValue, currentMax]
    } else {
      newRange = [currentMin, newValue]
    }
    
    handleSeverityChange(newRange)
  }, [severityRange, handleSeverityChange, percentToValue, isDragging])

  // Handle preset selection
  const handlePresetClick = useCallback((preset) => {
    const presets = {
      'low-risk': [1, 2],
      'medium-risk': [2, 4],
      'high-risk': [4, 5],
      'all': [1, 5]
    }
    
    if (presets[preset] && onSeverityChange) {
      handleSeverityChange(presets[preset])
    }
  }, [onSeverityChange, handleSeverityChange])

  // Calculate thumb positions
  const minPercent = valueToPercent(severityRange[0])
  const maxPercent = valueToPercent(severityRange[1])

  return (
    <div className={`severity-slider ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-bangladesh-green" />
          <h4 className="font-medium text-neutral-800">Severity Range</h4>
        </div>
        
        {showStats && rangeStats.totalInRange > 0 && (
          <div className="text-sm text-neutral-600">
            {rangeStats.totalInRange} reports ({rangeStats.percentage}%)
          </div>
        )}
      </div>

      {/* Current Range Display */}
      <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getSeverityConfig(severityRange[0]).icon}</span>
              <div>
                <div className="font-medium text-neutral-800">
                  Level {severityRange[0]} - {getSeverityConfig(severityRange[0]).label}
                </div>
                <div className="text-xs text-neutral-500">Minimum</div>
              </div>
            </div>
            
            <div className="text-neutral-400 mx-2">to</div>
            
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{getSeverityConfig(severityRange[1]).icon}</span>
              <div>
                <div className="font-medium text-neutral-800">
                  Level {severityRange[1]} - {getSeverityConfig(severityRange[1]).label}
                </div>
                <div className="text-xs text-neutral-500">Maximum</div>
              </div>
            </div>
          </div>
        </div>
        
        {severityRange[0] === severityRange[1] ? (
          <p className="text-sm text-neutral-600">
            {getSeverityConfig(severityRange[0]).description}
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            Showing incidents from {getSeverityConfig(severityRange[0]).label.toLowerCase()} 
            to {getSeverityConfig(severityRange[1]).label.toLowerCase()} severity
          </p>
        )}
      </div>

      {/* Quick Preset Buttons */}
      <div className="mb-6">
        <div className="text-sm font-medium text-neutral-700 mb-3">Quick Selections</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={() => handlePresetClick('low-risk')}
            disabled={disabled}
            className={`p-3 text-left border rounded-lg transition-all duration-200 ${
              severityRange[0] === 1 && severityRange[1] === 2
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="font-medium text-sm">Low Risk</span>
            </div>
            <div className="text-xs text-neutral-500">Levels 1-2</div>
          </button>
          
          <button
            onClick={() => handlePresetClick('medium-risk')}
            disabled={disabled}
            className={`p-3 text-left border rounded-lg transition-all duration-200 ${
              severityRange[0] === 2 && severityRange[1] === 4
                ? 'border-yellow-500 bg-yellow-50 text-yellow-800'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-sm">Medium Risk</span>
            </div>
            <div className="text-xs text-neutral-500">Levels 2-4</div>
          </button>
          
          <button
            onClick={() => handlePresetClick('high-risk')}
            disabled={disabled}
            className={`p-3 text-left border rounded-lg transition-all duration-200 ${
              severityRange[0] === 4 && severityRange[1] === 5
                ? 'border-red-500 bg-red-50 text-red-800'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="font-medium text-sm">High Risk</span>
            </div>
            <div className="text-xs text-neutral-500">Levels 4-5</div>
          </button>
          
          <button
            onClick={() => handlePresetClick('all')}
            disabled={disabled}
            className={`p-3 text-left border rounded-lg transition-all duration-200 ${
              severityRange[0] === 1 && severityRange[1] === 5
                ? 'border-bangladesh-green bg-bangladesh-green/10 text-bangladesh-green'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
            }`}
          >
            <div className="flex items-center space-x-2 mb-1">
              <Info className="w-4 h-4 text-bangladesh-green" />
              <span className="font-medium text-sm">All Levels</span>
            </div>
            <div className="text-xs text-neutral-500">Levels 1-5</div>
          </button>
        </div>
      </div>

      {/* Custom Slider */}
      <div className="mb-6 relative">
        {/* NEW: Visual Feedback Indicator */}
        {showFeedback && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg animate-pulse">
            <Eye className="w-3 h-3 inline mr-1" />
            Highlighting {Object.entries(reportCounts)
              .filter(([level]) => level >= severityRange[0] && level <= severityRange[1])
              .reduce((sum, [, count]) => sum + count, 0)} reports
          </div>
        )}
        
        <div className="px-2">
          {/* Slider Track */}
          <div
            ref={sliderRef}
            className="relative h-2 bg-neutral-200 rounded-full cursor-pointer"
            onClick={handleTrackClick}
          >
            {/* Active Range Track */}
            <div
              className="absolute h-2 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
              style={{
                left: `${minPercent}%`,
                width: `${maxPercent - minPercent}%`
              }}
            />
            
            {/* Min Thumb */}
            <div
              ref={minThumbRef}
              className={`absolute w-6 h-6 bg-white border-3 border-solid rounded-full cursor-grab transform -translate-x-1/2 -translate-y-1/2 top-1/2 shadow-lg transition-all duration-200 ${
                activeThumb === 'min' ? 'scale-110' : ''
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105'}`}
              style={{
                left: `${minPercent}%`,
                borderColor: getSeverityConfig(severityRange[0]).color,
                zIndex: activeThumb === 'min' ? 20 : 10
              }}
              onMouseDown={(e) => !disabled && handlePointerDown(e, 'min')}
              onTouchStart={(e) => !disabled && handlePointerDown(e, 'min')}
            >
              {/* Tooltip */}
              {activeThumb === 'min' && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {severityRange[0]} - {getSeverityConfig(severityRange[0]).label}
                </div>
              )}
            </div>
            
            {/* Max Thumb */}
            <div
              ref={maxThumbRef}
              className={`absolute w-6 h-6 bg-white border-3 border-solid rounded-full cursor-grab transform -translate-x-1/2 -translate-y-1/2 top-1/2 shadow-lg transition-all duration-200 ${
                activeThumb === 'max' ? 'scale-110' : ''
              } ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:scale-105'}`}
              style={{
                left: `${maxPercent}%`,
                borderColor: getSeverityConfig(severityRange[1]).color,
                zIndex: activeThumb === 'max' ? 20 : 10
              }}
              onMouseDown={(e) => !disabled && handlePointerDown(e, 'max')}
              onTouchStart={(e) => !disabled && handlePointerDown(e, 'max')}
            >
              {/* Tooltip */}
              {activeThumb === 'max' && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {severityRange[1]} - {getSeverityConfig(severityRange[1]).label}
                </div>
              )}
            </div>
          </div>
          
          {/* Severity Level Markers */}
          {showLabels && (
            <div className="flex justify-between mt-4 px-1">
              {severityLevels.map((level) => (
                <div key={level.level} className="text-center">
                  <div 
                    className={`w-3 h-3 rounded-full border-2 border-white mx-auto mb-1 transition-all duration-200 ${
                      level.level >= severityRange[0] && level.level <= severityRange[1]
                        ? level.bgColor + ' shadow-md'
                        : 'bg-neutral-300'
                    }`}
                    style={{ 
                      backgroundColor: level.level >= severityRange[0] && level.level <= severityRange[1] 
                        ? level.color 
                        : undefined 
                    }}
                  />
                  <div className="text-xs font-medium text-neutral-700">{level.level}</div>
                  <div className="text-xs text-neutral-500 hidden sm:block">{level.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Distribution */}
      {showStats && Object.keys(reportCounts).length > 0 && (
        <div className="p-4 bg-white border border-neutral-200 rounded-lg">
          <h5 className="font-medium text-neutral-800 mb-3">Report Distribution</h5>
          <div className="space-y-2">
            {severityLevels.map((level) => {
              const count = reportCounts[level.level] || 0
              const total = Object.values(reportCounts).reduce((sum, c) => sum + c, 0)
              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0
              const isInRange = level.level >= severityRange[0] && level.level <= severityRange[1]
              
              return (
                <div
                  key={level.level}
                  className={`flex items-center justify-between p-2 rounded transition-all duration-200 ${
                    isInRange ? 'bg-blue-50 border border-blue-200' : 'bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{level.icon}</span>
                    <div>
                      <span className="font-medium text-sm">Level {level.level}</span>
                      <span className="text-neutral-600 text-sm ml-2">{level.label}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-sm">{count}</div>
                    <div className="text-xs text-neutral-500">{percentage}%</div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {rangeStats.totalInRange !== rangeStats.totalReports && (
            <div className="mt-3 pt-3 border-t border-neutral-200 text-center">
              <p className="text-sm text-bangladesh-green font-medium">
                {rangeStats.totalInRange} of {rangeStats.totalReports} reports in selected range 
                ({rangeStats.percentage}%)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SeveritySlider