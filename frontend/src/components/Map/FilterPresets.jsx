// === frontend/src/components/Map/FilterPresets.jsx ===
import { useState, useCallback } from 'react'
import { 
  Bookmark, Star, Trash2, Edit, History, Download, 
  Play, Clock, Calendar, MoreVertical, Copy
} from 'lucide-react'

/**
 * Filter Presets Management Component for SafeStreets Bangladesh
 * Features: Quick access to saved filters, preset history, sharing capabilities
 */
const FilterPresets = ({
  filterPresets = [],
  filterHistory = [],
  loadFilterPreset,
  deleteFilterPreset,
  onSharePreset,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState('presets')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [presetToDelete, setPresetToDelete] = useState(null)
  const [expandedPreset, setExpandedPreset] = useState(null)

  // Handle preset loading
  const handleLoadPreset = useCallback((presetId) => {
    if (loadFilterPreset) {
      loadFilterPreset(presetId)
    }
  }, [loadFilterPreset])

  // Handle preset deletion confirmation
  const handleDeleteClick = useCallback((preset, event) => {
    event.stopPropagation()
    setPresetToDelete(preset)
    setShowDeleteModal(true)
  }, [])

  const confirmDelete = useCallback(() => {
    if (presetToDelete && deleteFilterPreset) {
      deleteFilterPreset(presetToDelete.id)
      setShowDeleteModal(false)
      setPresetToDelete(null)
    }
  }, [presetToDelete, deleteFilterPreset])

  // Share preset (copy to clipboard)
  const handleSharePreset = useCallback(async (preset) => {
    try {
      const shareData = {
        name: preset.name,
        filters: preset.filters,
        createdAt: preset.createdAt
      }
      
      const shareUrl = `${window.location.origin}${window.location.pathname}?preset=${encodeURIComponent(JSON.stringify(shareData))}`
      
      await navigator.clipboard.writeText(shareUrl)
      
      // Show success feedback
      const button = document.getElementById(`share-${preset.id}`)
      if (button) {
        const originalText = button.innerHTML
        button.innerHTML = '✅ Copied!'
        setTimeout(() => {
          button.innerHTML = originalText
        }, 2000)
      }
      
      console.log('📋 Preset shared:', preset.name)
    } catch (error) {
      console.error('❌ Failed to share preset:', error)
    }
  }, [])

  // Format filter summary for display
  const formatFilterSummary = useCallback((filters) => {
    const summary = []
    
    if (filters.searchTerm) {
      summary.push(`Search: "${filters.searchTerm}"`)
    }
    
    if (filters.incidentTypes?.length > 0) {
      summary.push(`Types: ${filters.incidentTypes.length} selected`)
    }
    
    if (filters.severityRange && (filters.severityRange[0] > 1 || filters.severityRange[1] < 5)) {
      summary.push(`Severity: ${filters.severityRange[0]}-${filters.severityRange[1]}`)
    }
    
    if (filters.dateRange?.preset && filters.dateRange.preset !== 'all') {
      summary.push(`Date: ${filters.dateRange.preset}`)
    }
    
    if (filters.timeOfDay?.length > 0) {
      summary.push(`Time: ${filters.timeOfDay.length} slots`)
    }
    
    if (filters.daysOfWeek?.length > 0) {
      summary.push(`Days: ${filters.daysOfWeek.length} selected`)
    }
    
    if (filters.statusFilter?.length > 0) {
      summary.push(`Status: ${filters.statusFilter.length} selected`)
    }
    
    if (filters.sortBy && filters.sortBy !== 'newest') {
      summary.push(`Sort: ${filters.sortBy}`)
    }
    
    if (filters.showFlagged) {
      summary.push('Flagged only')
    }
    
    return summary.length > 0 ? summary.join(' • ') : 'No active filters'
  }, [])

  // Get relative time for history items
  const getRelativeTime = useCallback((date) => {
    const now = new Date()
    const past = new Date(date)
    const diffMs = now - past
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return past.toLocaleDateString()
  }, [])

  return (
    <div className={`filter-presets bg-white rounded-lg shadow-md border border-neutral-200 ${className}`}>
      
      {/* Header with Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'presets'
                  ? 'bg-bangladesh-green text-white'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              <Bookmark className="w-4 h-4 mr-2 inline" />
              Presets ({filterPresets.length})
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-bangladesh-green text-white'
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              <History className="w-4 h-4 mr-2 inline" />
              History ({filterHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        
        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            {filterPresets.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <Bookmark className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p className="text-sm">No saved presets yet</p>
                <p className="text-xs mt-1">Apply some filters and save them as presets</p>
              </div>
            ) : (
              filterPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:border-bangladesh-green hover:bg-bangladesh-green/5 transition-all duration-200 cursor-pointer"
                  onClick={() => handleLoadPreset(preset.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-2xl">{preset.icon}</span>
                        <div>
                          <h4 className="font-medium text-neutral-800 truncate">
                            {preset.name}
                          </h4>
                          <div className="flex items-center space-x-2 text-xs text-neutral-500">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {preset.createdAt ? new Date(preset.createdAt).toLocaleDateString() : 'Unknown date'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Filter Summary */}
                      <div className="text-sm text-neutral-600 mb-3">
                        {formatFilterSummary(preset.filters)}
                      </div>
                      
                      {/* Expanded Details */}
                      {expandedPreset === preset.id && (
                        <div className="mt-3 p-3 bg-neutral-50 rounded border">
                          <h5 className="text-xs font-medium text-neutral-700 mb-2">Filter Details:</h5>
                          <div className="space-y-1 text-xs text-neutral-600">
                            {preset.filters.searchTerm && (
                              <div>🔍 Search: "{preset.filters.searchTerm}"</div>
                            )}
                            {preset.filters.incidentTypes?.length > 0 && (
                              <div>📋 Types: {preset.filters.incidentTypes.join(', ')}</div>
                            )}
                            {preset.filters.severityRange && (
                              <div>⚠️ Severity: {preset.filters.severityRange[0]} - {preset.filters.severityRange[1]}</div>
                            )}
                            {preset.filters.dateRange?.preset !== 'all' && (
                              <div>📅 Date: {preset.filters.dateRange.preset}</div>
                            )}
                            {preset.filters.timeOfDay?.length > 0 && (
                              <div>🕐 Time slots: {preset.filters.timeOfDay.join(', ')}</div>
                            )}
                            {preset.filters.daysOfWeek?.length > 0 && (
                              <div>📆 Days: {preset.filters.daysOfWeek.join(', ')}</div>
                            )}
                            {preset.filters.statusFilter?.length > 0 && (
                              <div>✅ Status: {preset.filters.statusFilter.join(', ')}</div>
                            )}
                            {preset.filters.sortBy !== 'newest' && (
                              <div>🔄 Sort: {preset.filters.sortBy}</div>
                            )}
                            {preset.filters.showFlagged && (
                              <div>🚩 Flagged reports only</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedPreset(expandedPreset === preset.id ? null : preset.id)
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-600 rounded"
                        title="View details"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      <button
                        id={`share-${preset.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSharePreset(preset)
                        }}
                        className="p-1 text-neutral-400 hover:text-bangladesh-green rounded"
                        title="Share preset"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={(e) => handleDeleteClick(preset, e)}
                        className="p-1 text-neutral-400 hover:text-red-600 rounded"
                        title="Delete preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Apply Button */}
                  <div className="mt-3 pt-3 border-t border-neutral-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadPreset(preset.id)
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-bangladesh-green text-white rounded-lg hover:bg-bangladesh-green-dark transition-colors text-sm font-medium"
                    >
                      <Play className="w-4 h-4" />
                      <span>Apply Filters</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {filterHistory.length === 0 ? (
              <div className="text-center py-8 text-neutral-500">
                <History className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p className="text-sm">No filter history yet</p>
                <p className="text-xs mt-1">Your recent filter combinations will appear here</p>
              </div>
            ) : (
              filterHistory.map((historyItem, index) => (
                <div
                  key={`${historyItem.id}-${index}`}
                  className="border border-neutral-200 rounded-lg p-3 hover:border-bangladesh-green hover:bg-bangladesh-green/5 transition-all duration-200 cursor-pointer"
                  onClick={() => handleLoadPreset(historyItem.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg">{historyItem.icon}</span>
                        <div>
                          <h4 className="font-medium text-neutral-800 text-sm truncate">
                            {historyItem.name}
                          </h4>
                          <div className="flex items-center space-x-2 text-xs text-neutral-500">
                            <Clock className="w-3 h-3" />
                            <span>{getRelativeTime(historyItem.createdAt || historyItem.usedAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-neutral-600">
                        {formatFilterSummary(historyItem.filters)}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLoadPreset(historyItem.id)
                      }}
                      className="ml-3 p-2 text-bangladesh-green hover:bg-bangladesh-green hover:text-white rounded transition-colors"
                      title="Apply these filters"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
            
            {filterHistory.length > 0 && (
              <div className="pt-3 border-t border-neutral-200">
                <button
                  onClick={() => {
                    // Clear history functionality - you'd implement this in the parent component
                    console.log('Clear history clicked')
                  }}
                  className="text-sm text-neutral-500 hover:text-red-600 transition-colors"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && presetToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-2xl">{presetToDelete.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-neutral-800">Delete Preset</h3>
                <p className="text-sm text-neutral-600">Are you sure you want to delete "{presetToDelete.name}"?</p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">
                This action cannot be undone. The preset and all its filter settings will be permanently removed.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm text-neutral-600 border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FilterPresets