// === frontend/src/components/Map/DateRangePicker.jsx ===
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { format, isValid, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, getDaysInMonth, getDay } from 'date-fns'
import { Calendar, Clock, X, ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

/**
 * Custom Date Range Picker for SafeStreets Bangladesh - React 19 Compatible
 * Features: Bengali calendar support, preset ranges, time filtering, mobile optimization
 */
const DateRangePicker = ({ 
  dateRange = { startDate: null, endDate: null, preset: 'all' },
  onDateRangeChange,
  datePresets = {},
  className = "",
  disabled = false,
  showTimeFilter = true,
  showDayFilter = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [tempDateRange, setTempDateRange] = useState(dateRange)
  const [selectedTimeSlots, setSelectedTimeSlots] = useState([])
  const [selectedDays, setSelectedDays] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarMode, setCalendarMode] = useState('start') // 'start' or 'end'
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Time of day options for Bangladesh context
  const timeSlots = useMemo(() => [
    { id: 'morning', label: 'Morning', icon: '🌅', hours: '6AM - 12PM', color: 'bg-orange-100 text-orange-800' },
    { id: 'afternoon', label: 'Afternoon', icon: '☀️', hours: '12PM - 6PM', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'evening', label: 'Evening', icon: '🌇', hours: '6PM - 12AM', color: 'bg-purple-100 text-purple-800' },
    { id: 'night', label: 'Night', icon: '🌙', hours: '12AM - 6AM', color: 'bg-blue-100 text-blue-800' }
  ], [])

  // Day of week options with Bengali names
  const dayOptions = useMemo(() => [
    { id: 'sunday', label: 'Sunday', bengali: 'রবিবার', short: 'Sun' },
    { id: 'monday', label: 'Monday', bengali: 'সোমবার', short: 'Mon' },
    { id: 'tuesday', label: 'Tuesday', bengali: 'মঙ্গলবার', short: 'Tue' },
    { id: 'wednesday', label: 'Wednesday', bengali: 'বুধবার', short: 'Wed' },
    { id: 'thursday', label: 'Thursday', bengali: 'বৃহস্পতিবার', short: 'Thu' },
    { id: 'friday', label: 'Friday', bengali: 'শুক্রবার', short: 'Fri' },
    { id: 'saturday', label: 'Saturday', bengali: 'শনিবার', short: 'Sat' }
  ], [])

  // Quick preset options optimized for crime data analysis
  const quickPresets = useMemo(() => [
    { id: 'all', label: 'All Time', icon: '📅', description: 'Show all reports' },
    { id: '24h', label: 'Last 24 Hours', icon: '🕐', description: 'Recent activity' },
    { id: '7d', label: 'Last 7 Days', icon: '📊', description: 'Weekly patterns' },
    { id: '30d', label: 'Last 30 Days', icon: '📈', description: 'Monthly trends' },
    { id: '3m', label: 'Last 3 Months', icon: '📋', description: 'Quarterly analysis' },
    { id: 'custom', label: 'Custom Range', icon: '🎯', description: 'Pick specific dates' }
  ], [])

  // Format date range for display
  const formatDateRange = useCallback((range) => {
    if (!range.startDate && !range.endDate) {
      const preset = quickPresets.find(p => p.id === range.preset)
      return preset?.label || 'All Time'
    }

    if (range.startDate && range.endDate) {
      const start = format(range.startDate, 'MMM dd')
      const end = format(range.endDate, 'MMM dd, yyyy')
      return `${start} - ${end}`
    }

    if (range.startDate) {
      return `From ${format(range.startDate, 'MMM dd, yyyy')}`
    }

    if (range.endDate) {
      return `Until ${format(range.endDate, 'MMM dd, yyyy')}`
    }

    return 'Select dates'
  }, [quickPresets])

  // Generate calendar days for a month
  const generateCalendarDays = useCallback((date) => {
    const startOfMonthDate = startOfMonth(date)
    const endOfMonthDate = endOfMonth(date)
    const daysInMonth = getDaysInMonth(date)
    const startDay = getDay(startOfMonthDate) // 0 = Sunday
    
    const days = []
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(date.getFullYear(), date.getMonth(), day))
    }
    
    return days
  }, [])

  // Handle preset selection
  const handlePresetChange = useCallback((presetId) => {
    const preset = quickPresets.find(p => p.id === presetId)
    if (!preset) return

    let newRange = { preset: presetId }

    if (presetId !== 'custom' && presetId !== 'all' && datePresets[presetId]) {
      const presetDates = datePresets[presetId].getValue()
      if (presetDates) {
        newRange = {
          ...newRange,
          startDate: presetDates.startDate,
          endDate: presetDates.endDate
        }
      }
    }

    setTempDateRange(newRange)
    
    if (presetId !== 'custom') {
      // Auto-apply non-custom presets
      if (onDateRangeChange) {
        onDateRangeChange(newRange)
      }
      setIsOpen(false)
    }
  }, [quickPresets, datePresets, onDateRangeChange])

  // Handle date click in calendar
  const handleDateClick = useCallback((date) => {
    if (calendarMode === 'start') {
      setTempDateRange(prev => ({
        ...prev,
        startDate: startOfDay(date),
        endDate: prev.endDate && date > prev.endDate ? null : prev.endDate,
        preset: 'custom'
      }))
      setCalendarMode('end')
    } else {
      if (tempDateRange.startDate && date < tempDateRange.startDate) {
        // If end date is before start date, swap them
        setTempDateRange(prev => ({
          ...prev,
          startDate: startOfDay(date),
          endDate: prev.startDate,
          preset: 'custom'
        }))
      } else {
        setTempDateRange(prev => ({
          ...prev,
          endDate: endOfDay(date),
          preset: 'custom'
        }))
      }
      setCalendarMode('start')
    }
  }, [calendarMode, tempDateRange.startDate])

  // Check if date is in selected range
  const isDateInRange = useCallback((date) => {
    if (!tempDateRange.startDate || !tempDateRange.endDate) return false
    return date >= tempDateRange.startDate && date <= tempDateRange.endDate
  }, [tempDateRange.startDate, tempDateRange.endDate])

  // Check if date is selected start or end
  const isDateSelected = useCallback((date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const startStr = tempDateRange.startDate ? format(tempDateRange.startDate, 'yyyy-MM-dd') : null
    const endStr = tempDateRange.endDate ? format(tempDateRange.endDate, 'yyyy-MM-dd') : null
    return dateStr === startStr || dateStr === endStr
  }, [tempDateRange.startDate, tempDateRange.endDate])

  // Handle time slot toggle
  const handleTimeSlotToggle = useCallback((timeSlotId) => {
    setSelectedTimeSlots(prev => {
      const newSlots = prev.includes(timeSlotId)
        ? prev.filter(id => id !== timeSlotId)
        : [...prev, timeSlotId]
      return newSlots
    })
  }, [])

  // Handle day toggle
  const handleDayToggle = useCallback((dayId) => {
    setSelectedDays(prev => {
      const newDays = prev.includes(dayId)
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
      return newDays
    })
  }, [])

  // Apply filters and close
  const handleApply = useCallback(() => {
    const finalRange = {
      ...tempDateRange,
      timeOfDay: selectedTimeSlots,
      daysOfWeek: selectedDays
    }

    if (onDateRangeChange) {
      onDateRangeChange(finalRange)
    }
    
    setIsOpen(false)
  }, [tempDateRange, selectedTimeSlots, selectedDays, onDateRangeChange])

  // Reset to current values
  const handleCancel = useCallback(() => {
    setTempDateRange(dateRange)
    setSelectedTimeSlots([])
    setSelectedDays([])
    setIsOpen(false)
  }, [dateRange])

  // Clear all date filters
  const handleClear = useCallback(() => {
    const clearedRange = {
      startDate: null,
      endDate: null,
      preset: 'all',
      timeOfDay: [],
      daysOfWeek: []
    }
    
    setTempDateRange(clearedRange)
    setSelectedTimeSlots([])
    setSelectedDays([])
    
    if (onDateRangeChange) {
      onDateRangeChange(clearedRange)
    }
  }, [onDateRangeChange])

  // Check if filter has active selections
  const hasActiveFilters = useMemo(() => {
    return dateRange.preset !== 'all' || 
           selectedTimeSlots.length > 0 || 
           selectedDays.length > 0
  }, [dateRange.preset, selectedTimeSlots.length, selectedDays.length])

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))
  }

  const today = new Date()
  const calendarDays = generateCalendarDays(currentMonth)

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-3 bg-white border rounded-lg transition-all duration-200 ${
          disabled 
            ? 'border-neutral-200 text-neutral-400 cursor-not-allowed' 
            : isOpen
            ? 'border-bangladesh-green ring-2 ring-bangladesh-green/20'
            : hasActiveFilters
            ? 'border-blue-500 bg-blue-50'
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <div className="flex items-center space-x-3">
          <Calendar className={`w-5 h-5 ${hasActiveFilters ? 'text-blue-600' : 'text-neutral-500'}`} />
          <div className="text-left">
            <div className={`font-medium ${hasActiveFilters ? 'text-blue-800' : 'text-neutral-800'}`}>
              {formatDateRange(dateRange)}
            </div>
            {(selectedTimeSlots.length > 0 || selectedDays.length > 0) && (
              <div className="text-xs text-neutral-500 mt-1">
                {selectedTimeSlots.length > 0 && `${selectedTimeSlots.length} time slots`}
                {selectedTimeSlots.length > 0 && selectedDays.length > 0 && ' • '}
                {selectedDays.length > 0 && `${selectedDays.length} days`}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-neutral-200 rounded transition-colors"
              title="Clear filters"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 p-6 max-h-96 overflow-y-auto">
          
          {/* Quick Presets */}
          <div className="mb-6">
            <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
              <Filter className="w-4 h-4 mr-2 text-bangladesh-green" />
              Quick Filters
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {quickPresets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  className={`p-3 text-left border rounded-lg transition-all duration-200 hover:scale-105 ${
                    tempDateRange.preset === preset.id
                      ? 'border-bangladesh-green bg-bangladesh-green/10 text-bangladesh-green'
                      : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{preset.icon}</span>
                    <span className="font-medium text-sm">{preset.label}</span>
                  </div>
                  <div className="text-xs text-neutral-500">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Calendar */}
          {tempDateRange.preset === 'custom' && (
            <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
              <h4 className="font-medium text-neutral-800 mb-3">Custom Date Range</h4>
              
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 hover:bg-neutral-200 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <h3 className="font-medium text-neutral-800">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                
                <button
                  onClick={goToNextMonth}
                  className="p-2 hover:bg-neutral-200 rounded transition-colors"
                  disabled={currentMonth >= today}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Calendar Mode Indicator */}
              <div className="mb-3 text-center">
                <div className="inline-flex bg-neutral-200 rounded-lg p-1">
                  <button
                    onClick={() => setCalendarMode('start')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      calendarMode === 'start' 
                        ? 'bg-bangladesh-green text-white' 
                        : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    Start Date
                  </button>
                  <button
                    onClick={() => setCalendarMode('end')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      calendarMode === 'end' 
                        ? 'bg-bangladesh-green text-white' 
                        : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    End Date
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-neutral-500">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={index} className="p-2"></div>
                  }

                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                  const isSelected = isDateSelected(date)
                  const isInRange = isDateInRange(date)
                  const isFuture = date > today
                  const isPast = date < today

                  return (
                    <button
                      key={index}
                      onClick={() => !isFuture && handleDateClick(date)}
                      disabled={isFuture}
                      className={`p-2 text-sm rounded transition-colors ${
                        isFuture 
                          ? 'text-neutral-300 cursor-not-allowed'
                          : isSelected 
                          ? 'bg-bangladesh-green text-white'
                          : isInRange
                          ? 'bg-bangladesh-green/20 text-bangladesh-green'
                          : isToday
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'hover:bg-neutral-100'
                      }`}
                    >
                      {format(date, 'd')}
                    </button>
                  )
                })}
              </div>

              {/* Selected Range Display */}
              {tempDateRange.startDate && (
                <div className="mt-3 p-2 bg-bangladesh-green/10 rounded text-sm">
                  <strong>Selected:</strong> {format(tempDateRange.startDate, 'MMM dd, yyyy')}
                  {tempDateRange.endDate && (
                    <span> - {format(tempDateRange.endDate, 'MMM dd, yyyy')}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Time of Day Filter */}
          {showTimeFilter && (
            <div className="mb-6">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-bangladesh-green" />
                Time of Day
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {timeSlots.map(slot => (
                  <button
                    key={slot.id}
                    onClick={() => handleTimeSlotToggle(slot.id)}
                    className={`p-3 text-left border rounded-lg transition-all duration-200 ${
                      selectedTimeSlots.includes(slot.id)
                        ? `border-transparent ${slot.color}`
                        : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{slot.icon}</span>
                      <span className="font-medium text-sm">{slot.label}</span>
                    </div>
                    <div className="text-xs opacity-75">{slot.hours}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Day of Week Filter */}
          {showDayFilter && (
            <div className="mb-6">
              <h4 className="font-medium text-neutral-800 mb-3">Days of Week</h4>
              <div className="flex flex-wrap gap-2">
                {dayOptions.map(day => (
                  <button
                    key={day.id}
                    onClick={() => handleDayToggle(day.id)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                      selectedDays.includes(day.id)
                        ? 'border-bangladesh-green bg-bangladesh-green text-white'
                        : 'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="text-center">
                      <div>{day.short}</div>
                      <div className="text-xs opacity-75 font-bangla">{day.bengali}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded transition-colors"
            >
              Clear All
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-6 py-2 text-sm bg-bangladesh-green text-white rounded hover:bg-bangladesh-green-dark transition-colors font-medium"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DateRangePicker