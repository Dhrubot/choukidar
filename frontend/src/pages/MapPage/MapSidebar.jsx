// === frontend/src/pages/MapPage/MapSidebar.jsx (COMPLETE FIXED VERSION) ===
import React, { memo, useState, useCallback } from 'react'
import { 
  Target, MapPin, Shield, Navigation, Settings, 
  Zap, ChevronDown, ChevronRight, Info, Users
} from 'lucide-react'
import AdvancedFilters from '../../components/Map/AdvancedFilters'
import FilterPresets from '../../components/Map/FilterPresets'
import MapViewControls from '../../components/Map/MapViewControls'

/**
 * MapSidebar Component - Enhanced with Phase 3B Safe Zones & Route Intelligence Controls
 * Handles sidebar panels: Advanced Filters, Filter Presets, Map Controls + NEW Intelligence Controls
 * FIXED: Restored all original clustering options and styling while preserving intelligence features
 */
const MapSidebar = memo(({
  // ✅ EXISTING UI STATE PRESERVED
  showAdvancedFilters,
  showFilterPresets,
  isMobile,
  
  // ✅ EXISTING FILTER DATA AND HANDLERS PRESERVED
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
  
  // ✅ EXISTING MAP STATE AND HANDLERS PRESERVED
  mapState,
  onViewModeChange,
  onHeatmapOptionsChange,
  onClusteringOptionsChange,
  
  // ✅ EXISTING USER LOCATION PRESERVED
  hasUserLocation,
  onCenterOnUser,
  userLocation,
  isUserInBangladesh,
  
  // 🆕 PHASE 3B: INTELLIGENCE PROPS
  intelligenceFeatures = {},
  intelligenceStatus = {},
  onToggleIntelligenceFeature = () => {}
}) => {
  // 🆕 PHASE 3B: LOCAL UI STATE FOR INTELLIGENCE CONTROLS
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(false)
  const [expandedIntelligenceSection, setExpandedIntelligenceSection] = useState(null)

  // 🆕 PHASE 3B: INTELLIGENCE PANEL HANDLERS
  const handleToggleIntelligencePanel = useCallback(() => {
    setShowIntelligencePanel(prev => !prev)
  }, [])

  const handleExpandIntelligenceSection = useCallback((section) => {
    setExpandedIntelligenceSection(prev => prev === section ? null : section)
  }, [])

  // 🆕 PHASE 3B: SAFE ZONE TOGGLE HANDLER
  const handleToggleSafeZones = useCallback(() => {
    const newEnabled = !intelligenceFeatures.safeZones?.enabled
    onToggleIntelligenceFeature('safeZones', newEnabled)
    
    if (newEnabled && !showIntelligencePanel) {
      setShowIntelligencePanel(true)
      setExpandedIntelligenceSection('safeZones')
    }
  }, [intelligenceFeatures.safeZones?.enabled, onToggleIntelligenceFeature, showIntelligencePanel])

  // 🆕 PHASE 3B: ROUTE PLANNER TOGGLE HANDLER
  const handleToggleRoutePlanner = useCallback(() => {
    const newEnabled = !intelligenceFeatures.routePlanner?.enabled
    onToggleIntelligenceFeature('routePlanner', newEnabled)
    
    if (newEnabled && !showIntelligencePanel) {
      setShowIntelligencePanel(true)
      setExpandedIntelligenceSection('routePlanner')
    }
  }, [intelligenceFeatures.routePlanner?.enabled, onToggleIntelligenceFeature, showIntelligencePanel])

  return (
    <div className="space-y-6">

      {/* ✅ EXISTING ADVANCED FILTERS PANEL PRESERVED */}
      {showAdvancedFilters && (
        <AdvancedFilters
          filters={filters}
          filteredReports={filteredReports}
          filterStats={filterStats}
          filterPresets={filterPresets}
          filterHistory={filterHistory}
          updateFilter={updateFilter}
          updateNestedFilter={updateNestedFilter}
          clearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          applyDatePreset={applyDatePreset}
          datePresets={datePresets}
          saveFilterPreset={saveFilterPreset}
          loadFilterPreset={loadFilterPreset}
          deleteFilterPreset={deleteFilterPreset}
          isFiltering={isFiltering}
          isMobile={isMobile}
        />
      )}

      {/* ✅ EXISTING FILTER PRESETS PANEL PRESERVED */}
      {showFilterPresets && (
        <FilterPresets
          filterPresets={filterPresets}
          filterHistory={filterHistory}
          loadFilterPreset={loadFilterPreset}
          deleteFilterPreset={deleteFilterPreset}
        />
      )}

      {/* 🆕 PHASE 3B: INTELLIGENCE CONTROLS PANEL */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200">
        <div 
          className="bg-gradient-to-r from-green-600 to-blue-600 p-4 rounded-t-xl cursor-pointer"
          onClick={handleToggleIntelligencePanel}
        >
          <h3 className="font-bold text-white flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Safety Intelligence
              {intelligenceStatus.hasActiveFeatures && (
                <div className="w-2 h-2 bg-white rounded-full ml-2 animate-pulse"></div>
              )}
            </div>
            {showIntelligencePanel ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </h3>
        </div>
        
        {showIntelligencePanel && (
          <div className="p-4">
            {/* Intelligence Status Overview */}
            <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
              <div className="text-sm font-medium text-neutral-800 mb-2">
                Intelligence Status
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Location Services:</span>
                  <span className={hasUserLocation ? 'text-green-600' : 'text-amber-600'}>
                    {hasUserLocation ? '🟢 Active' : '🟡 Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Coverage Area:</span>
                  <span className={isUserInBangladesh ? 'text-green-600' : 'text-amber-600'}>
                    {isUserInBangladesh ? '🟢 Bangladesh' : '🟡 Outside BD'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600">Features Active:</span>
                  <span className={intelligenceStatus.hasActiveFeatures ? 'text-green-600' : 'text-neutral-500'}>
                    {intelligenceStatus.hasActiveFeatures ? '🟢 Yes' : '⚪ None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Location Enable Button */}
            {!hasUserLocation && (
              <div className="mb-4">
                <button
                  onClick={onCenterOnUser}
                  className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-2 px-4 rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 text-sm font-medium"
                >
                  📍 Enable Location for Full Features
                </button>
              </div>
            )}

            {/* Safe Zones Control */}
            <div className="mb-4">
              <div 
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                onClick={() => handleExpandIntelligenceSection('safeZones')}
              >
                <div className="flex items-center">
                  <Shield className="w-4 h-4 text-green-600 mr-2" />
                  <span className="font-medium text-green-800">Safe Zones</span>
                  {intelligenceFeatures.safeZones?.enabled && (
                    <div className="w-2 h-2 bg-green-500 rounded-full ml-2"></div>
                  )}
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={intelligenceFeatures.safeZones?.enabled || false}
                      onChange={handleToggleSafeZones}
                      className="sr-only peer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                  {expandedIntelligenceSection === 'safeZones' ? (
                    <ChevronDown className="w-4 h-4 text-green-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-green-600" />
                  )}
                </div>
              </div>

              {/* Safe Zones Expanded Options */}
              {expandedIntelligenceSection === 'safeZones' && (
                <div className="mt-2 p-3 bg-white border border-green-200 rounded-lg">
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-medium text-green-800 mb-2">Zone Types</div>
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="w-3 h-3 mr-2 text-green-600" />
                          Dynamic Safe Zones (Crime-based)
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="w-3 h-3 mr-2 text-green-600" />
                          Police Station Areas
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="w-3 h-3 mr-2 text-green-600" />
                          Well-lit Public Areas
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-green-800 mb-2">Safety Threshold</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-600">Low</span>
                        <input 
                          type="range" 
                          min="4" 
                          max="10" 
                          defaultValue="6" 
                          className="flex-1 h-1 bg-green-200 rounded-lg appearance-none"
                        />
                        <span className="text-xs text-neutral-600">High</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">Minimum safety score: 6.0/10</div>
                    </div>

                    {intelligenceFeatures.safeZones?.selectedZone && (
                      <div className="p-2 bg-green-100 rounded border">
                        <div className="text-xs font-medium text-green-800">Selected Zone</div>
                        <div className="text-xs text-green-700">
                          Safety Score: {intelligenceFeatures.safeZones.selectedZone.safetyScore}/10
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Route Planner Control */}
            <div className="mb-4">
              <div 
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => handleExpandIntelligenceSection('routePlanner')}
              >
                <div className="flex items-center">
                  <Navigation className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="font-medium text-blue-800">Smart Routes</span>
                  {intelligenceFeatures.routePlanner?.enabled && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                  )}
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer mr-2">
                    <input
                      type="checkbox"
                      checked={intelligenceFeatures.routePlanner?.enabled || false}
                      onChange={handleToggleRoutePlanner}
                      className="sr-only peer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  {expandedIntelligenceSection === 'routePlanner' ? (
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                </div>
              </div>

              {/* Route Planner Expanded Options */}
              {expandedIntelligenceSection === 'routePlanner' && (
                <div className="mt-2 p-3 bg-white border border-blue-200 rounded-lg">
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-medium text-blue-800 mb-2">Transport Mode</div>
                      <select className="w-full p-2 border border-blue-200 rounded text-xs">
                        <option value="walking">🚶 Walking</option>
                        <option value="rickshaw">🛺 Rickshaw</option>
                        <option value="bus">🚌 Bus</option>
                      </select>
                    </div>
                    
                    <div>
                      <div className="font-medium text-blue-800 mb-2">Route Preferences</div>
                      <div className="space-y-2 text-xs">
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="w-3 h-3 mr-2 text-blue-600" />
                          Prioritize Safety over Speed
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" defaultChecked className="w-3 h-3 mr-2 text-blue-600" />
                          Avoid Recent Incidents (24h)
                        </label>
                        <label className="flex items-center">
                          <input type="checkbox" className="w-3 h-3 mr-2 text-blue-600" />
                          Time-based Routing (Day/Night)
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="font-medium text-blue-800 mb-2">Max Safety Detour</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-600">0%</span>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          defaultValue="30" 
                          className="flex-1 h-1 bg-blue-200 rounded-lg appearance-none"
                        />
                        <span className="text-xs text-neutral-600">100%</span>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">Allow 30% longer routes for safety</div>
                    </div>

                    {intelligenceFeatures.routePlanner?.selectedRoute && (
                      <div className="p-2 bg-blue-100 rounded border">
                        <div className="text-xs font-medium text-blue-800">Active Route</div>
                        <div className="text-xs text-blue-700">
                          Safety Score: {intelligenceFeatures.routePlanner.selectedRoute.safetyScore}/10
                        </div>
                        <div className="text-xs text-blue-700">
                          Distance: {intelligenceFeatures.routePlanner.selectedRoute.distance}m
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Intelligence Help */}
            <div className="p-3 bg-neutral-50 rounded-lg">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-neutral-400 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-neutral-600">
                  <div className="font-medium mb-1">About Safety Intelligence</div>
                  <div className="space-y-1">
                    <div>• Safe Zones highlight areas with low crime activity</div>
                    <div>• Smart Routes suggest safer paths to your destination</div>
                    <div>• All analysis uses local crime data and community input</div>
                    <div>• Location data stays on your device for privacy</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🔧 FIXED: RESTORED COMPLETE MAP CONTROLS WITH ALL ORIGINAL CLUSTERING OPTIONS */}
      <div className="bg-white rounded-xl shadow-md border border-neutral-200">
        <div className="bg-purple-600 p-4 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Intelligent Controls
            {intelligenceStatus.hasActiveFeatures && (
              <div className="w-2 h-2 bg-white rounded-full ml-2 animate-pulse"></div>
            )}
          </h3>
        </div>
        <div className="p-4">
          <MapViewControls
            viewMode={mapState.viewMode}
            onViewModeChange={onViewModeChange}
            heatmapOptions={mapState.heatmapOptions}
            onHeatmapOptionsChange={onHeatmapOptionsChange}
            reportCount={filteredReports.length}
          />

          {/* 🔧 FIXED: RESTORED ALL ORIGINAL CLUSTERING OPTIONS */}
          {(mapState.viewMode === 'clusters' || mapState.viewMode === 'hybrid') && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                Clustering Options
                {intelligenceStatus.hasActiveFeatures && (
                  <span className="ml-2 text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                    AI Enhanced
                  </span>
                )}
              </h4>

              <div className="space-y-3">
                {/* 🔧 RESTORED: Show incident type badges */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions?.showTypeIndicator || false}
                    onChange={(e) => onClusteringOptionsChange({
                      showTypeIndicator: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Show incident type badges</span>
                </label>

                {/* 🔧 RESTORED: Highlight high-risk clusters */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions?.showRiskBadge || false}
                    onChange={(e) => onClusteringOptionsChange({
                      showRiskBadge: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Highlight high-risk clusters</span>
                  {intelligenceStatus.hasActiveFeatures && (
                    <span className="ml-2 text-xs text-green-600">🧠 AI-powered</span>
                  )}
                </label>

                {/* 🔧 RESTORED: Enable animations */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions?.enableAnimations || false}
                    onChange={(e) => onClusteringOptionsChange({
                      enableAnimations: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Enable animations</span>
                </label>

                {/* 🔧 RESTORED: Bengali numerals */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={mapState.clusteringOptions?.enableBengaliNumerals || false}
                    onChange={(e) => onClusteringOptionsChange({
                      enableBengaliNumerals: e.target.checked
                    })}
                    className="mr-2 w-4 h-4 text-bangladesh-green border-neutral-300 rounded focus:ring-bangladesh-green"
                  />
                  <span className="text-sm">Bengali numerals (বাংলা সংখ্যা)</span>
                </label>
              </div>
            </div>
          )}

          {/* 🔧 FIXED: RESTORED ORIGINAL USER LOCATION CONTROLS WITH PROPER STYLING */}
          {hasUserLocation && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <h4 className="font-medium text-neutral-800 mb-3 flex items-center">
                Location Controls
                {intelligenceStatus.hasActiveFeatures && (
                  <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                    Enhanced
                  </span>
                )}
              </h4>
              <div className="space-y-3">
                {/* 🔧 RESTORED: Original button styling */}
                <button
                  onClick={onCenterOnUser}
                  className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-bangladesh-green text-white rounded-lg hover:bg-bangladesh-green-dark transition-colors text-sm font-medium"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Center on My Location</span>
                </button>
                
                {/* 🔧 RESTORED: Original location information display */}
                <div className="text-xs text-neutral-500 space-y-1">
                  <div>📍 Location: {isUserInBangladesh ? 'Bangladesh' : 'International'}</div>
                  {userLocation && (
                    <div>🎯 Accuracy: ±{userLocation.accuracy ? Math.round(userLocation.accuracy) : 'Unknown'}m</div>
                  )}
                  {intelligenceStatus.hasActiveFeatures && (
                    <div className="text-green-600">🧠 AI features active for your location</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔧 ENHANCED: Location panel now shows intelligence integration */}
      {!hasUserLocation && (
        <div className="bg-white rounded-xl shadow-md border border-neutral-200">
          <div className="bg-amber-600 p-4 rounded-t-xl">
            <h3 className="font-bold text-white flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Location Services
              {intelligenceStatus.hasActiveFeatures && (
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded">
                  Required for AI
                </span>
              )}
            </h3>
          </div>
          <div className="p-4">
            <div className="text-center">
              <div className="text-amber-600 text-3xl mb-3">📍</div>
              <h4 className="font-medium text-neutral-800 mb-2">
                Enable Location for Better Experience
              </h4>
              <p className="text-sm text-neutral-600 mb-4">
                Get personalized safety insights, nearby safe zones, and smart route recommendations{intelligenceStatus.hasActiveFeatures ? ' with AI-powered intelligence' : ''}.
              </p>
              <button
                onClick={onCenterOnUser}
                className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Enable Location Services
              </button>
              <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                <div className="text-xs text-amber-700">
                  <div className="font-medium mb-1">🔒 Privacy Protected</div>
                  <div>• Location data stays on your device</div>
                  <div>• No tracking or data collection</div>
                  <div>• Used only for safety features</div>
                  {intelligenceStatus.hasActiveFeatures && (
                    <div>• AI processing happens locally</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// Add display name for debugging
MapSidebar.displayName = 'MapSidebar'

export default MapSidebar