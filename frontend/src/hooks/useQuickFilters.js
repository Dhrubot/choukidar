// === frontend/src/hooks/useQuickFilters.js ===
import { useCallback } from 'react'

/**
 * Custom hook for MapPage quick filter handlers
 * Extracted from MapPage.jsx Lines 240-260
 * Handles: Quick search, Quick type filtering
 */
export const useQuickFilters = (updateFilter, filters) => {
  // ✅ EXTRACTED: Quick search handler from MapPage Lines 242-244
  const handleQuickSearch = useCallback((searchTerm) => {
    updateFilter('searchTerm', searchTerm)
  }, [updateFilter])

  // ✅ EXTRACTED: Quick type filter handler from MapPage Lines 246-253
  const handleQuickTypeFilter = useCallback((type) => {
    const currentTypes = filters.incidentTypes || []
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type]
    updateFilter('incidentTypes', newTypes)
  }, [filters.incidentTypes, updateFilter])

  return {
    handleQuickSearch,
    handleQuickTypeFilter
  }
}