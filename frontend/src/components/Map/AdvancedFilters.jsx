// === frontend/src/components/Map/AdvancedFilters.jsx (FIXED + ENHANCED with Dynamic filterSections) ===
import { useState, useCallback, useMemo } from 'react'
import { 
  Filter, Search, X, ChevronDown, ChevronUp, Save, Upload, 
  Download, BarChart3, Clock, MapPin, Shield, Settings,
  AlertTriangle, Eye, EyeOff, Bookmark, History
} from 'lucide-react'
import DateRangePicker from './DateRangePicker'
import SeveritySlider from './SeveritySlider'
import MultiSelect from '../Common/MultiSelect'

/**
 * Advanced Multi-Dimensional Filtering System for SafeStreets Bangladesh
 * Features: Real-time filtering, preset management, URL persistence, export functionality
 * ✅ FIXED: Now uses dynamic filterSections rendering
 */
const AdvancedFilters = ({
  filters,
  filteredReports,
  filterStats,
  filterPresets,
  filterHistory,
  updateFilter,
  updateNestedFilter,
  clearFilters,
  hasActiveFilters,
  applyDatePreset,
  datePresets,
  saveFilterPreset,
  loadFilterPreset,
  deleteFilterPreset,
  isFiltering,
  className = "",
  isMobile = false
}) => {
  const [isExpanded, setIsExpanded] = useState(!isMobile)
  const [activeSection, setActiveSection] = useState('search')
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetIcon, setPresetIcon] = useState('🔍')

  // Incident type options with Bangladesh context - PRESERVED
  const incidentTypeOptions = useMemo(() => [
    { 
      label: '💰 Chadabaji (Extortion)', 
      value: 'chadabaji',
      description: 'Illegal extortion by gangs or groups'
    },
    { 
      label: '👥 Teen Gang Activity', 
      value: 'teen_gang',
      description: 'Youth gangs involved in violence'
    },
    { 
      label: '⚠️ Chintai (Harassment)', 
      value: 'chintai',
      description: 'Political harassment or forced donations'
    },
    { 
      label: '🚨 Other Criminal Activity', 
      value: 'other',
      description: 'Other street crimes and incidents'
    }
  ], [])

  // Status filter options (for admin users) - PRESERVED
  const statusOptions = useMemo(() => [
    { label: '✅ Approved', value: 'approved', description: 'Public on map' },
    { label: '⏳ Pending Review', value: 'pending', description: 'Awaiting moderation' },
    { label: '❌ Rejected', value: 'rejected', description: 'Not approved for display' }
  ], [])

  // Sort options - PRESERVED
  const sortOptions = useMemo(() => [
    { label: '🕐 Newest First', value: 'newest' },
    { label: '📅 Oldest First', value: 'oldest' },
    { label: '🚨 High Severity', value: 'severity' },
    { label: '📝 By Type', value: 'type' }
  ], [])

  // ✅ ENHANCED: Filter sections configuration with dynamic counting - NOW USED!
  const filterSections = useMemo(() => [
    {
      id: 'search',
      label: 'Search & Text',
      icon: Search,
      count: filters.searchTerm ? 1 : 0,
      description: 'Search through incident descriptions and locations'
    },
    {
      id: 'types',
      label: 'Incident Types',
      icon: AlertTriangle,
      count: filters.incidentTypes?.length || 0,
      description: 'Filter by crime categories'
    },
    {
      id: 'severity',
      label: 'Severity Range',
      icon: Shield,
      count: (filters.severityRange?.[0] > 1 || filters.severityRange?.[1] < 5) ? 1 : 0,
      description: 'Filter by incident severity level'
    },
    {
      id: 'dates',
      label: 'Date & Time',
      icon: Clock,
      count: filters.dateRange?.preset !== 'all' ? 1 : 0,
      description: 'Filter by time periods and schedules'
    },
    {
      id: 'location',
      label: 'Location',
      icon: MapPin,
      count: filters.locationFilter?.withinBangladesh !== null ? 1 : 0,
      description: 'Geographic and boundary filtering'
    },
    {
      id: 'advanced',
      label: 'Advanced Options',
      icon: Settings,
      count: (filters.showFlagged || filters.sortBy !== 'newest' || filters.statusFilter?.length > 0) ? 1 : 0,
      description: 'Sorting, flags, and admin options'
    }
  ], [filters])

  // Calculate severity distribution for slider - PRESERVED
  const severityDistribution = useMemo(() => {
    return filteredReports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1
      return acc
    }, {})
  }, [filteredReports])

  // Convert incident types to MultiSelect format - PRESERVED
  const selectedIncidentTypes = useMemo(() => {
    return incidentTypeOptions.filter(option => 
      filters.incidentTypes?.includes(option.value)
    )
  }, [filters.incidentTypes, incidentTypeOptions])

  // Convert status filter to MultiSelect format - PRESERVED
  const selectedStatusFilters = useMemo(() => {
    return statusOptions.filter(option => 
      filters.statusFilter?.includes(option.value)
    )
  }, [filters.statusFilter, statusOptions])

  // Handle multi-select changes - PRESERVED
  const handleIncidentTypesChange = useCallback((selected) => {
    updateFilter('incidentTypes', selected.map(item => item.value))
  }, [updateFilter])

  const handleStatusFilterChange = useCallback((selected) => {
    updateFilter('statusFilter', selected.map(item => item.value))
  }, [updateFilter])

  // ✅ FIXED: Handle search with proper parameter interface
  const handleSearchChange = useCallback((value) => {
    updateFilter('searchTerm', value)
  }, [updateFilter])

  // Handle severity range change - PRESERVED
  const handleSeverityChange = useCallback((range) => {
    updateFilter('severityRange', range)
  }, [updateFilter])

  // Handle date range change - PRESERVED
  const handleDateRangeChange = useCallback((dateRange) => {
    updateFilter('dateRange', dateRange)
    
    // Update time and day filters if provided
    if (dateRange.timeOfDay) {
      updateFilter('timeOfDay', dateRange.timeOfDay)
    }
    if (dateRange.daysOfWeek) {
      updateFilter('daysOfWeek', dateRange.daysOfWeek)
    }
  }, [updateFilter])

  // Handle sort change - PRESERVED
  const handleSortChange = useCallback((value) => {
    updateFilter('sortBy', value)
  }, [updateFilter])

  // Save new preset - PRESERVED
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return
    
    const newPreset = saveFilterPreset(presetName.trim(), presetIcon)
    setShowPresetModal(false)
    setPresetName('')
    setPresetIcon('🔍')
    
    console.log('✅ Filter preset saved:', newPreset.name)
  }, [presetName, presetIcon, saveFilterPreset])

  // Export filtered data - PRESERVED
  const handleExport = useCallback((format = 'csv') => {
    try {
      if (format === 'csv') {
        const csvHeaders = ['ID', 'Type', 'Severity', 'Description', 'Location', 'Date', 'Status']
        const csvRows = filteredReports.map(report => [
          report._id?.slice(-8) || 'N/A',
          report.type,
          report.severity,
          `"${report.description.replace(/"/g, '""')}"`, // Escape quotes
          `"${report.location.address || 'Location provided'}"`,
          new Date(report.createdAt || report.timestamp).toLocaleDateString(),
          report.status
        ])
        
        const csvContent = [csvHeaders, ...csvRows]
          .map(row => row.join(','))
          .join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `safestreets-filtered-${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(url)
        
        console.log(`📊 Exported ${filteredReports.length} reports as CSV`)
      } else if (format === 'json') {
        const jsonData = {
          exportDate: new Date().toISOString(),
          filters: filters,
          stats: filterStats,
          reports: filteredReports.map(report => ({
            id: report._id,
            type: report.type,
            severity: report.severity,
            description: report.description,
            location: report.location.address,
            coordinates: report.location.coordinates,
            date: report.createdAt || report.timestamp,
            status: report.status
          }))
        }
        
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `safestreets-filtered-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        URL.revokeObjectURL(url)
        
        console.log(`📊 Exported ${filteredReports.length} reports as JSON`)
      }
    } catch (error) {
      console.error('❌ Export failed:', error)
    }
  }, [filteredReports, filters, filterStats])

  // Toggle section expansion - PRESERVED
  const toggleSection = useCallback((sectionId) => {
    setActiveSection(activeSection === sectionId ? null : sectionId)
  }, [activeSection])

  // ✅ ENHANCED: Render individual filter section content
  const renderSectionContent = useCallback((section) => {
    switch (section.id) {
      case 'search':
        return (
          <div className="p-4 border-t border-neutral-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search descriptions, locations, or incident types..."
                value={filters.searchTerm || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
              />
              {filters.searchTerm && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )

      case 'types':
        return (
          <div className="p-4 border-t border-neutral-200">
            <MultiSelect
              options={incidentTypeOptions}
              value={selectedIncidentTypes}
              onChange={handleIncidentTypesChange}
              placeholder="Select incident types..."
              hasSelectAll={true}
              selectAllLabel="All Types"
              allItemsAreSelected="All incident types"
            />
          </div>
        )

      case 'severity':
        return (
          <div className="p-4 border-t border-neutral-200">
            <SeveritySlider
              severityRange={filters.severityRange || [1, 5]}
              onSeverityChange={handleSeverityChange}
              reportCounts={severityDistribution}
              showStats={true}
              showLabels={true}
            />
          </div>
        )

      case 'dates':
        return (
          <div className="p-4 border-t border-neutral-200">
            <DateRangePicker
              dateRange={filters.dateRange || { startDate: null, endDate: null, preset: 'all' }}
              onDateRangeChange={handleDateRangeChange}
              datePresets={datePresets}
              showTimeFilter={true}
              showDayFilter={true}
            />
          </div>
        )

      case 'location':
        return (
          <div className="p-4 border-t border-neutral-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Geographic Scope</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bangladeshScope"
                      value="all"
                      checked={filters.locationFilter?.withinBangladesh === null}
                      onChange={() => updateNestedFilter('locationFilter.withinBangladesh', null)}
                      className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 focus:ring-bangladesh-green"
                    />
                    <span className="text-sm">All locations</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bangladeshScope"
                      value="within"
                      checked={filters.locationFilter?.withinBangladesh === true}
                      onChange={() => updateNestedFilter('locationFilter.withinBangladesh', true)}
                      className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 focus:ring-bangladesh-green"
                    />
                    <span className="text-sm">Within Bangladesh only</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bangladeshScope"
                      value="outside"
                      checked={filters.locationFilter?.withinBangladesh === false}
                      onChange={() => updateNestedFilter('locationFilter.withinBangladesh', false)}
                      className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 focus:ring-bangladesh-green"
                    />
                    <span className="text-sm">Outside Bangladesh</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )

      case 'advanced':
        return (
          <div className="p-4 border-t border-neutral-200 space-y-4">
            
            {/* Sort Options */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Sort Order</label>
              <select
                value={filters.sortBy || 'newest'}
                onChange={(e) => handleSortChange(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (for admin users) */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Report Status</label>
              <MultiSelect
                options={statusOptions}
                value={selectedStatusFilters}
                onChange={handleStatusFilterChange}
                placeholder="Filter by status..."
                hasSelectAll={true}
                selectAllLabel="All Statuses"
              />
            </div>

            {/* Security Flags */}
            <div className="flex items-center space-x-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showFlagged || false}
                  onChange={(e) => updateFilter('showFlagged', e.target.checked)}
                  className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                />
                <span className="text-sm text-neutral-700">Show flagged reports only</span>
              </label>
            </div>

            {/* Export Options */}
            <div className="pt-4 border-t border-neutral-200">
              <label className="block text-sm font-medium text-neutral-700 mb-2">Export Filtered Data</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4 mr-1 inline" />
                  CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4 mr-1 inline" />
                  JSON
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }, [
    filters,
    handleSearchChange,
    incidentTypeOptions,
    selectedIncidentTypes,
    handleIncidentTypesChange,
    severityDistribution,
    handleSeverityChange,
    datePresets,
    handleDateRangeChange,
    updateNestedFilter,
    updateFilter,
    sortOptions,
    handleSortChange,
    statusOptions,
    selectedStatusFilters,
    handleStatusFilterChange,
    handleExport
  ])

  return (
    <div className={`advanced-filters bg-white rounded-lg shadow-md border border-neutral-200 ${className}`}>
      
      {/* Header with Stats - PRESERVED */}
      <div className="p-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Filter className="w-5 h-5 text-bangladesh-green" />
            <h3 className="font-bold text-neutral-800">Advanced Filters</h3>
            {hasActiveFilters() && (
              <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                Active
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {!isMobile && hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="text-sm text-neutral-500 hover:text-red-600 flex items-center space-x-1"
                title="Clear all filters"
              >
                <X className="w-4 h-4" />
                <span>Clear</span>
              </button>
            )}
            
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-neutral-100 rounded transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Filter Stats - PRESERVED */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-bangladesh-green">{filterStats.filtered}</div>
            <div className="text-xs text-neutral-600">Filtered Reports</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-neutral-700">{filterStats.total}</div>
            <div className="text-xs text-neutral-600">Total Reports</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{filterStats.filteredPercentage}%</div>
            <div className="text-xs text-neutral-600">Match Rate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{filterStats.recentCount}</div>
            <div className="text-xs text-neutral-600">Recent (24h)</div>
          </div>
        </div>

        {/* Performance Indicator - PRESERVED */}
        {isFiltering && (
          <div className="mt-3 flex items-center justify-center p-2 bg-blue-50 rounded-lg">
            <div className="animate-spin w-4 h-4 border-2 border-bangladesh-green border-t-transparent rounded-full mr-2"></div>
            <span className="text-sm text-bangladesh-green">Applying filters...</span>
          </div>
        )}
      </div>

      {/* Filter Content - ENHANCED */}
      {isExpanded && (
        <div className="p-4">
          
          {/* Filter Presets - PRESERVED */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-neutral-800 flex items-center">
                <Bookmark className="w-4 h-4 mr-2 text-bangladesh-green" />
                Quick Presets
              </h4>
              <button
                onClick={() => setShowPresetModal(true)}
                className="text-sm text-bangladesh-green hover:text-bangladesh-green-dark flex items-center space-x-1"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {filterPresets.slice(0, 4).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => loadFilterPreset(preset.id)}
                  className="p-3 text-left border border-neutral-200 rounded-lg hover:border-bangladesh-green hover:bg-bangladesh-green/5 transition-all duration-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-lg">{preset.icon}</span>
                    <span className="font-medium text-sm truncate">{preset.name}</span>
                  </div>
                  <div className="text-xs text-neutral-500">Tap to apply</div>
                </button>
              ))}
            </div>
          </div>

          {/* ✅ ENHANCED: Dynamic Filter Sections - NOW USING filterSections ARRAY! */}
          <div className="space-y-4">
            {filterSections.map((section) => {
              const Icon = section.icon
              return (
                <div key={section.id} className="border border-neutral-200 rounded-lg">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full p-3 flex items-center justify-between hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4 text-bangladesh-green" />
                      <div className="text-left">
                        <span className="font-medium">{section.label}</span>
                        <div className="text-xs text-neutral-500">{section.description}</div>
                      </div>
                      {section.count > 0 && (
                        <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                          {section.count === 1 ? 'Active' : `${section.count} active`}
                        </div>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${
                      activeSection === section.id ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {activeSection === section.id && renderSectionContent(section)}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save Preset Modal - PRESERVED */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">Save Filter Preset</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Enter preset name..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {['🔍', '🚨', '📊', '⚠️', '🎯', '📅', '🗺️', '💰', '👥', '🛡️', '🔥', '⭐'].map(icon => (
                    <button
                      key={icon}
                      onClick={() => setPresetIcon(icon)}
                      className={`p-2 text-xl rounded border transition-colors ${
                        presetIcon === icon 
                          ? 'border-bangladesh-green bg-bangladesh-green/10' 
                          : 'border-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPresetModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 rounded hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="px-4 py-2 text-sm bg-bangladesh-green text-white rounded hover:bg-bangladesh-green-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdvancedFilters