// === frontend/src/hooks/useMapPageUI.js ===
import { useState, useEffect } from 'react'

/**
 * Custom hook for MapPage UI state management
 * Extracted from MapPage.jsx Lines 60-80
 * Handles: Advanced filters toggle, Filter presets toggle, Mobile detection
 */
export const useMapPageUI = () => {
  // ✅ EXTRACTED: UI state from MapPage Lines 61-63
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showFilterPresets, setShowFilterPresets] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // ✅ EXTRACTED: Mobile detection logic from MapPage Lines 66-78
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return {
    // UI state
    showAdvancedFilters,
    showFilterPresets,
    isMobile,
    
    // UI state setters
    setShowAdvancedFilters,
    setShowFilterPresets
  }
}