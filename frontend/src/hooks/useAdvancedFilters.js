// === frontend/src/hooks/useAdvancedFilters.js ===
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subHours } from 'date-fns'
import queryString from 'query-string'

/**
 * Advanced filtering hook for SafeStreets Bangladesh
 * Handles multi-dimensional filtering with URL persistence and performance optimization
 */
export const useAdvancedFilters = (reports = [], options = {}) => {
  // Configuration with Bangladesh-optimized defaults
  const config = {
    debounceMs: 300,
    enableUrlPersistence: true,
    maxFilterHistory: 10,
    ...options
  }

  // Core filter state
  const [filters, setFilters] = useState({
    // Text search
    searchTerm: '',
    
    // Incident type multi-select
    incidentTypes: [], // ['chadabaji', 'teen_gang', 'chintai', 'other']
    
    // Severity range
    severityRange: [1, 5], // [min, max]
    
    // Date range filtering
    dateRange: {
      startDate: null,
      endDate: null,
      preset: 'all' // 'all', '24h', '7d', '30d', '3m', 'custom'
    },
    
    // Time of day filtering
    timeOfDay: [], // ['morning', 'afternoon', 'evening', 'night']
    
    // Day of week filtering  
    daysOfWeek: [], // ['monday', 'tuesday', ..., 'sunday']
    
    // Status filtering (for admin users)
    statusFilter: [], // ['approved', 'pending', 'rejected']
    
    // Location-based filtering (future enhancement)
    locationFilter: {
      districts: [],
      withinBangladesh: null // null, true, false
    },
    
    // Advanced options
    sortBy: 'newest', // 'newest', 'oldest', 'severity', 'type'
    limit: null, // null for no limit
    showFlagged: false // Show security-flagged reports
  })

  // Filter presets for quick access
  const [filterPresets, setFilterPresets] = useState([
    {
      id: 'high-risk',
      name: 'High Risk Areas',
      icon: '🚨',
      filters: {
        severityRange: [4, 5],
        incidentTypes: ['teen_gang', 'chadabaji'],
        dateRange: { preset: '30d' },
        sortBy: 'severity'
      }
    },
    {
      id: 'recent-activity',
      name: 'Recent Activity',
      icon: '🕐',
      filters: {
        dateRange: { preset: '7d' },
        sortBy: 'newest'
      }
    },
    {
      id: 'gang-activity',
      name: 'Gang Activity',
      icon: '👥',
      filters: {
        incidentTypes: ['teen_gang'],
        severityRange: [3, 5],
        timeOfDay: ['evening', 'night'],
        sortBy: 'severity'
      }
    },
    {
      id: 'extortion-reports',
      name: 'Extortion Reports',
      icon: '💰',
      filters: {
        incidentTypes: ['chadabaji'],
        dateRange: { preset: '30d' },
        sortBy: 'newest'
      }
    }
  ])

  // Filter history for quick re-access
  const [filterHistory, setFilterHistory] = useState([])

  // Processing state
  const [isFiltering, setIsFiltering] = useState(false)
  const [lastFilterTime, setLastFilterTime] = useState(Date.now())

  // Debounced search term for performance
  const [debouncedSearchTerm] = useDebounce(filters.searchTerm, config.debounceMs)

  // Date preset configurations
  const datePresets = useMemo(() => ({
    'all': { label: 'All Time', getValue: () => ({ startDate: null, endDate: null }) },
    '24h': { 
      label: 'Last 24 Hours', 
      getValue: () => ({ 
        startDate: subHours(new Date(), 24), 
        endDate: new Date() 
      })
    },
    '7d': { 
      label: 'Last 7 Days', 
      getValue: () => ({ 
        startDate: subDays(new Date(), 7), 
        endDate: new Date() 
      })
    },
    '30d': { 
      label: 'Last 30 Days', 
      getValue: () => ({ 
        startDate: subDays(new Date(), 30), 
        endDate: new Date() 
      })
    },
    '3m': { 
      label: 'Last 3 Months', 
      getValue: () => ({ 
        startDate: subDays(new Date(), 90), 
        endDate: new Date() 
      })
    },
    'custom': { label: 'Custom Range', getValue: () => null }
  }), [])

  // Apply date preset
  const applyDatePreset = useCallback((preset) => {
    const presetConfig = datePresets[preset]
    if (!presetConfig) return

    const dateRange = { preset }
    
    if (preset !== 'custom' && preset !== 'all') {
      const { startDate, endDate } = presetConfig.getValue()
      dateRange.startDate = startDate
      dateRange.endDate = endDate
    }

    setFilters(prev => ({
      ...prev,
      dateRange
    }))
  }, [datePresets])

  // Core filtering logic with performance optimization
  const applyFilters = useCallback((inputReports = reports) => {
    setIsFiltering(true)
    const startTime = performance.now()

    try {
      let filtered = [...inputReports]

      // Text search (debounced)
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase()
        filtered = filtered.filter(report => 
          report.description?.toLowerCase().includes(searchLower) ||
          report.location?.address?.toLowerCase().includes(searchLower) ||
          report.type?.toLowerCase().includes(searchLower)
        )
      }

      // Incident type filtering
      if (filters.incidentTypes.length > 0) {
        filtered = filtered.filter(report => 
          filters.incidentTypes.includes(report.type)
        )
      }

      // Severity range filtering
      if (filters.severityRange[0] > 1 || filters.severityRange[1] < 5) {
        filtered = filtered.filter(report => 
          report.severity >= filters.severityRange[0] && 
          report.severity <= filters.severityRange[1]
        )
      }

      // Date range filtering
      if (filters.dateRange.startDate && filters.dateRange.endDate) {
        const startDate = startOfDay(filters.dateRange.startDate)
        const endDate = endOfDay(filters.dateRange.endDate)
        
        filtered = filtered.filter(report => {
          const reportDate = new Date(report.createdAt || report.timestamp)
          return isWithinInterval(reportDate, { start: startDate, end: endDate })
        })
      }

      // Time of day filtering
      if (filters.timeOfDay.length > 0) {
        filtered = filtered.filter(report => {
          const reportDate = new Date(report.createdAt || report.timestamp)
          const hour = reportDate.getHours()
          
          return filters.timeOfDay.some(timeSlot => {
            switch (timeSlot) {
              case 'morning': return hour >= 6 && hour < 12
              case 'afternoon': return hour >= 12 && hour < 18
              case 'evening': return hour >= 18 && hour < 24
              case 'night': return hour >= 0 && hour < 6
              default: return false
            }
          })
        })
      }

      // Day of week filtering
      if (filters.daysOfWeek.length > 0) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        filtered = filtered.filter(report => {
          const reportDate = new Date(report.createdAt || report.timestamp)
          const dayName = dayNames[reportDate.getDay()]
          return filters.daysOfWeek.includes(dayName)
        })
      }

      // Status filtering (for admin users)
      if (filters.statusFilter.length > 0) {
        filtered = filtered.filter(report => 
          filters.statusFilter.includes(report.status)
        )
      }

      // Location filtering
      if (filters.locationFilter.withinBangladesh !== null) {
        filtered = filtered.filter(report => 
          report.location?.withinBangladesh === filters.locationFilter.withinBangladesh
        )
      }

      // Security flag filtering
      if (filters.showFlagged) {
        filtered = filtered.filter(report => 
          report.securityFlags?.crossBorderReport ||
          report.securityFlags?.potentialSpam ||
          report.securityFlags?.suspiciousLocation
        )
      }

      // Sorting
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'newest':
            return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp)
          case 'oldest':
            return new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp)
          case 'severity':
            return b.severity - a.severity
          case 'type':
            return a.type.localeCompare(b.type)
          default:
            return 0
        }
      })

      // Apply limit if specified
      if (filters.limit && filters.limit > 0) {
        filtered = filtered.slice(0, filters.limit)
      }

      const endTime = performance.now()
      console.log(`🔍 Filter applied in ${(endTime - startTime).toFixed(2)}ms - ${filtered.length}/${inputReports.length} reports`)

      return filtered

    } catch (error) {
      console.error('❌ Error applying filters:', error)
      return inputReports
    } finally {
      setIsFiltering(false)
      setLastFilterTime(Date.now())
    }
  }, [filters, debouncedSearchTerm])

    // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return (
      filters.searchTerm ||
      filters.incidentTypes.length > 0 ||
      filters.severityRange[0] > 1 || filters.severityRange[1] < 5 ||
      filters.dateRange.preset !== 'all' ||
      filters.timeOfDay.length > 0 ||
      filters.daysOfWeek.length > 0 ||
      filters.statusFilter.length > 0 ||
      filters.locationFilter.withinBangladesh !== null ||
      filters.showFlagged ||
      filters.sortBy !== 'newest'
    )
  }, [filters])

  // Get filtered reports with memoization
  const filteredReports = useMemo(() => {
    return applyFilters(reports)
  }, [applyFilters, reports])

  // Filter statistics
  const filterStats = useMemo(() => {
    const total = reports.length
    const filtered = filteredReports.length
    const filteredPercentage = total > 0 ? ((filtered / total) * 100).toFixed(1) : 0

    // Type distribution in filtered results
    const typeDistribution = filteredReports.reduce((acc, report) => {
      acc[report.type] = (acc[report.type] || 0) + 1
      return acc
    }, {})

    // Severity distribution
    const severityDistribution = filteredReports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1
      return acc
    }, {})

    // Recent reports (last 24 hours)
    const recentCount = filteredReports.filter(report => {
      const reportDate = new Date(report.createdAt || report.timestamp)
      const dayAgo = subHours(new Date(), 24)
      return reportDate > dayAgo
    }).length

    return {
      total,
      filtered,
      filteredPercentage,
      recentCount,
      typeDistribution,
      severityDistribution,
      hasActiveFilters: hasActiveFilters()
    }
  }, [reports, filteredReports])

  // Update individual filter
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  // Update nested filter (e.g., dateRange.startDate)
  const updateNestedFilter = useCallback((path, value) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      const keys = path.split('.')
      let current = newFilters
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] }
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newFilters
    })
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      incidentTypes: [],
      severityRange: [1, 5],
      dateRange: { startDate: null, endDate: null, preset: 'all' },
      timeOfDay: [],
      daysOfWeek: [],
      statusFilter: [],
      locationFilter: { districts: [], withinBangladesh: null },
      sortBy: 'newest',
      limit: null,
      showFlagged: false
    })
  }, [])

  // Save filter preset
  const saveFilterPreset = useCallback((name, icon = '🔍') => {
    const newPreset = {
      id: Date.now().toString(),
      name,
      icon,
      filters: { ...filters },
      createdAt: new Date()
    }

    setFilterPresets(prev => [...prev, newPreset])
    
    // Add to history
    setFilterHistory(prev => {
      const newHistory = [newPreset, ...prev.slice(0, config.maxFilterHistory - 1)]
      return newHistory
    })

    return newPreset
  }, [filters, config.maxFilterHistory])

  // Load filter preset
  const loadFilterPreset = useCallback((presetId) => {
    const preset = filterPresets.find(p => p.id === presetId)
    if (preset) {
      setFilters(preset.filters)
      
      // Add to history
      setFilterHistory(prev => {
        const filtered = prev.filter(h => h.id !== presetId)
        return [preset, ...filtered.slice(0, config.maxFilterHistory - 1)]
      })
    }
  }, [filterPresets, config.maxFilterHistory])

  // Delete filter preset
  const deleteFilterPreset = useCallback((presetId) => {
    setFilterPresets(prev => prev.filter(p => p.id !== presetId))
    setFilterHistory(prev => prev.filter(h => h.id !== presetId))
  }, [])

  // URL persistence (optional)
  useEffect(() => {
    if (!config.enableUrlPersistence) return

    // Parse URL parameters on mount
    const urlParams = queryString.parse(window.location.search)
    
    if (Object.keys(urlParams).length > 0) {
      const filtersFromUrl = {}
      
      if (urlParams.search) filtersFromUrl.searchTerm = urlParams.search
      if (urlParams.types) filtersFromUrl.incidentTypes = urlParams.types.split(',')
      if (urlParams.severity) {
        const [min, max] = urlParams.severity.split('-').map(Number)
        filtersFromUrl.severityRange = [min, max]
      }
      if (urlParams.datePreset) {
        filtersFromUrl.dateRange = { preset: urlParams.datePreset }
        applyDatePreset(urlParams.datePreset)
      }
      
      setFilters(prev => ({ ...prev, ...filtersFromUrl }))
    }
  }, [config.enableUrlPersistence])

  // Update URL when filters change
  useEffect(() => {
    if (!config.enableUrlPersistence || !hasActiveFilters()) return

    const urlParams = {}
    
    if (filters.searchTerm) urlParams.search = filters.searchTerm
    if (filters.incidentTypes.length > 0) urlParams.types = filters.incidentTypes.join(',')
    if (filters.severityRange[0] > 1 || filters.severityRange[1] < 5) {
      urlParams.severity = `${filters.severityRange[0]}-${filters.severityRange[1]}`
    }
    if (filters.dateRange.preset !== 'all') urlParams.datePreset = filters.dateRange.preset

    const newUrl = `${window.location.pathname}?${queryString.stringify(urlParams)}`
    window.history.replaceState({}, '', newUrl)
  }, [filters, hasActiveFilters, config.enableUrlPersistence])

  return {
    // State
    filters,
    filteredReports,
    filterStats,
    filterPresets,
    filterHistory,
    isFiltering,
    lastFilterTime,
    
    // Filter management
    updateFilter,
    updateNestedFilter,
    clearFilters,
    hasActiveFilters,
    applyFilters,
    
    // Date utilities
    datePresets,
    applyDatePreset,
    
    // Preset management
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    
    // Utilities
    config
  }
}