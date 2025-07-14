// === frontend/src/components/Common/MultiSelect.jsx ===
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, X, Check, Search } from 'lucide-react'

/**
 * Custom MultiSelect Component for SafeStreets Bangladesh - React 19 Compatible
 * Features: Checkbox selection, search filtering, select all, mobile optimization
 */
const MultiSelect = ({
  options = [],
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  className = "",
  disabled = false,
  hasSelectAll = false,
  selectAllLabel = "Select All",
  allItemsAreSelected = "All items selected",
  disableSearch = false,
  maxDisplayItems = 3,
  showCount = true
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && !disableSearch && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, disableSearch])

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options
    
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [options, searchTerm])

  // Check if all filtered options are selected
  const allFilteredSelected = useMemo(() => {
    return filteredOptions.length > 0 && 
           filteredOptions.every(option => value.some(v => v.value === option.value))
  }, [filteredOptions, value])

  // Get selected options for display
  const selectedOptions = useMemo(() => {
    return options.filter(option => value.some(v => v.value === option.value))
  }, [options, value])

  // Format display text
  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder
    
    if (selectedOptions.length === options.length && hasSelectAll) {
      return allItemsAreSelected
    }
    
    if (selectedOptions.length <= maxDisplayItems) {
      return selectedOptions.map(opt => opt.label).join(', ')
    }
    
    const displayed = selectedOptions.slice(0, maxDisplayItems).map(opt => opt.label).join(', ')
    const remaining = selectedOptions.length - maxDisplayItems
    return `${displayed} (+${remaining} more)`
  }, [selectedOptions, options.length, hasSelectAll, allItemsAreSelected, placeholder, maxDisplayItems])

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchTerm('')
      }
    }
  }, [disabled, isOpen])

  // Handle option selection
  const handleOptionSelect = useCallback((option) => {
    const isSelected = value.some(v => v.value === option.value)
    
    let newValue
    if (isSelected) {
      newValue = value.filter(v => v.value !== option.value)
    } else {
      newValue = [...value, option]
    }
    
    if (onChange) {
      onChange(newValue)
    }
  }, [value, onChange])

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      // Deselect all filtered options
      const newValue = value.filter(v => 
        !filteredOptions.some(opt => opt.value === v.value)
      )
      if (onChange) {
        onChange(newValue)
      }
    } else {
      // Select all filtered options
      const newSelections = filteredOptions.filter(opt => 
        !value.some(v => v.value === opt.value)
      )
      if (onChange) {
        onChange([...value, ...newSelections])
      }
    }
  }, [allFilteredSelected, value, filteredOptions, onChange])

  // Clear all selections
  const clearAll = useCallback((e) => {
    e.stopPropagation()
    if (onChange) {
      onChange([])
    }
  }, [onChange])

  // Handle search change
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value)
  }, [])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main Select Button */}
      <button
        onClick={toggleDropdown}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-3 bg-white border rounded-lg transition-all duration-200 text-left ${
          disabled 
            ? 'border-neutral-200 text-neutral-400 cursor-not-allowed bg-neutral-50' 
            : isOpen
            ? 'border-bangladesh-green ring-2 ring-bangladesh-green/20'
            : selectedOptions.length > 0
            ? 'border-blue-500 bg-blue-50'
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <div className="flex-1 min-w-0">
          <span className={`block truncate ${
            selectedOptions.length > 0 ? 'text-neutral-800' : 'text-neutral-500'
          }`}>
            {displayText}
          </span>
          {showCount && selectedOptions.length > 0 && (
            <span className="text-xs text-neutral-500 mt-1">
              {selectedOptions.length} of {options.length} selected
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-3">
          {selectedOptions.length > 0 && (
            <button
              onClick={clearAll}
              className="p-1 hover:bg-neutral-200 rounded transition-colors"
              title="Clear all"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`} />
        </div>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-64 overflow-hidden">
          
          {/* Search Input */}
          {!disableSearch && (
            <div className="p-3 border-b border-neutral-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-bangladesh-green focus:border-transparent text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Select All Option */}
          {hasSelectAll && filteredOptions.length > 1 && (
            <div className="border-b border-neutral-200">
              <button
                onClick={handleSelectAll}
                className="w-full flex items-center p-3 hover:bg-neutral-50 transition-colors"
              >
                <div className={`flex items-center justify-center w-4 h-4 border-2 rounded mr-3 transition-colors ${
                  allFilteredSelected
                    ? 'bg-bangladesh-green border-bangladesh-green'
                    : 'border-neutral-300'
                }`}>
                  {allFilteredSelected && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="font-medium text-neutral-800">{selectAllLabel}</span>
                <span className="text-sm text-neutral-500 ml-auto">
                  ({filteredOptions.length} items)
                </span>
              </button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-neutral-500">
                {searchTerm ? 'No options found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.some(v => v.value === option.value)
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(option)}
                    className="w-full flex items-start p-3 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className={`flex items-center justify-center w-4 h-4 border-2 rounded mr-3 mt-0.5 flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-bangladesh-green border-bangladesh-green'
                        : 'border-neutral-300'
                    }`}>
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-neutral-800">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-sm text-neutral-500 mt-1">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer with selection count */}
          {filteredOptions.length > 0 && selectedOptions.length > 0 && (
            <div className="border-t border-neutral-200 p-3 bg-neutral-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">
                  {selectedOptions.length} selected
                </span>
                {selectedOptions.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onChange) {
                        onChange([])
                      }
                    }}
                    className="text-bangladesh-green hover:text-bangladesh-green-dark font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile: Bottom Sheet Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}

export default MultiSelect