// === src/components/Map/ClusterIcon.jsx ===
import { useMemo } from 'react'

/**
 * Custom cluster icon utilities for SafeStreets Bangladesh
 * Optimized for mobile-first design with clear visual hierarchy
 */

// Enhanced cluster statistics calculation
export const calculateClusterStats = (markers) => {
  if (!markers || markers.length === 0) {
    return {
      count: 0,
      dominantType: 'other',
      averageSeverity: 3,
      typeDistribution: {},
      hasHighRisk: false,
      isRecent: false
    }
  }

  // Type distribution analysis
  const typeDistribution = markers.reduce((acc, marker) => {
    const type = marker.options?.reportData?.type || 'other'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  // Find dominant incident type
  const dominantType = Object.keys(typeDistribution).reduce((a, b) => 
    typeDistribution[a] > typeDistribution[b] ? a : b
  )

  // Calculate average severity
  const severities = markers.map(marker => marker.options?.reportData?.severity || 3)
  const averageSeverity = severities.reduce((sum, severity) => sum + severity, 0) / severities.length

  // Check for high-risk incidents (severity 4-5)
  const hasHighRisk = severities.some(severity => severity >= 4)

  // Check for recent incidents (last 7 days)
  const now = Date.now()
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
  const isRecent = markers.some(marker => {
    const reportDate = new Date(marker.options?.reportData?.createdAt || marker.options?.reportData?.timestamp)
    return reportDate.getTime() > sevenDaysAgo
  })

  return {
    count: markers.length,
    dominantType,
    averageSeverity,
    typeDistribution,
    hasHighRisk,
    isRecent
  }
}

// Color scheme optimized for Bangladesh context
export const getClusterColorScheme = (stats) => {
  const { dominantType, averageSeverity, hasHighRisk } = stats

  // Base colors by incident type - consistent with SafeStreets brand
  const typeColors = {
    'chadabaji': {
      primary: '#F59E0B',    // Amber - organized extortion
      secondary: '#FCD34D',   // Light amber
      accent: '#92400E'       // Dark amber
    },
    'teen_gang': {
      primary: '#EF4444',    // Red - dangerous gangs
      secondary: '#FCA5A5',   // Light red
      accent: '#991B1B'       // Dark red
    },
    'chintai': {
      primary: '#F97316',    // Orange - harassment
      secondary: '#FED7AA',   // Light orange
      accent: '#C2410C'       // Dark orange
    },
    'other': {
      primary: '#6B7280',    // Gray - general incidents
      secondary: '#D1D5DB',   // Light gray
      accent: '#374151'       // Dark gray
    }
  }

  const baseScheme = typeColors[dominantType] || typeColors.other

  // Intensity modifications based on severity and risk
  if (hasHighRisk || averageSeverity >= 4) {
    return {
      ...baseScheme,
      primary: baseScheme.accent, // Use darker color for high risk
      intensity: 'high'
    }
  } else if (averageSeverity <= 2) {
    return {
      ...baseScheme,
      primary: baseScheme.secondary, // Use lighter color for low risk
      intensity: 'low'
    }
  }

  return {
    ...baseScheme,
    intensity: 'medium'
  }
}

// Mobile-optimized size calculations
export const getClusterSizeConfig = (count) => {
  // Larger touch targets for mobile
  if (count >= 500) return { 
    size: 68, textSize: '16px', ringSize: 5, 
    touchTarget: 80, iconClass: 'cluster-mega' 
  }
  if (count >= 200) return { 
    size: 58, textSize: '15px', ringSize: 4, 
    touchTarget: 70, iconClass: 'cluster-large' 
  }
  if (count >= 100) return { 
    size: 50, textSize: '14px', ringSize: 4, 
    touchTarget: 62, iconClass: 'cluster-large' 
  }
  if (count >= 50) return { 
    size: 44, textSize: '13px', ringSize: 3, 
    touchTarget: 56, iconClass: 'cluster-medium' 
  }
  if (count >= 20) return { 
    size: 38, textSize: '12px', ringSize: 3, 
    touchTarget: 50, iconClass: 'cluster-medium' 
  }
  if (count >= 10) return { 
    size: 34, textSize: '11px', ringSize: 2, 
    touchTarget: 46, iconClass: 'cluster-small' 
  }
  if (count >= 5) return { 
    size: 30, textSize: '10px', ringSize: 2, 
    touchTarget: 42, iconClass: 'cluster-small' 
  }
  
  return { 
    size: 26, textSize: '9px', ringSize: 2, 
    touchTarget: 38, iconClass: 'cluster-tiny' 
  }
}

// Format count for display with Bengali numerals option
export const formatClusterCount = (count, useBengaliNumerals = false) => {
  if (useBengaliNumerals) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
    const convertToBengali = (num) => {
      return num.toString().split('').map(digit => bengaliDigits[parseInt(digit)]).join('')
    }
    
    if (count >= 1000) {
      const thousands = Math.floor(count / 1000)
      return convertToBengali(thousands) + 'k+'
    }
    return convertToBengali(count)
  }

  // English numerals
  if (count >= 10000) return `${Math.floor(count/1000)}k+`
  if (count >= 1000) return `${(count/1000).toFixed(1)}k`
  return count.toString()
}

// Generate cluster popup content
export const generateClusterPopup = (stats, markers) => {
  const { count, dominantType, averageSeverity, typeDistribution, hasHighRisk, isRecent } = stats

  const typeLabels = {
    'chadabaji': 'Chadabaji (Extortion)',
    'teen_gang': 'Teen Gang Activity',
    'chintai': 'Chintai (Harassment)',
    'other': 'Other Criminal Activity'
  }

  const typeIcons = {
    'chadabaji': '💰',
    'teen_gang': '👥',
    'chintai': '⚠️',
    'other': '🚨'
  }

  // Create breakdown chart
  const breakdownItems = Object.entries(typeDistribution)
    .sort(([,a], [,b]) => b - a)
    .map(([type, count]) => {
      const percentage = Math.round((count / markers.length) * 100)
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px;">
            ${typeIcons[type]} ${typeLabels[type]}
          </span>
          <span style="font-weight: bold; color: #374151;">${count} (${percentage}%)</span>
        </div>
      `
    }).join('')

  const riskLevel = averageSeverity >= 4 ? 'High Risk' : 
                   averageSeverity >= 3 ? 'Medium Risk' : 'Low Risk'
  const riskColor = averageSeverity >= 4 ? '#EF4444' : 
                    averageSeverity >= 3 ? '#F59E0B' : '#10B981'

  return `
    <div style="font-family: Inter, sans-serif; max-width: 300px;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #006A4E, #00A86B); color: white; padding: 12px; margin: -8px -8px 12px -8px; border-radius: 8px 8px 0 0;">
        <div style="display: flex; align-items: center; justify-content: between;">
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: bold;">
              📍 ${count} Incident${count > 1 ? 's' : ''} in Area
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">
              ${typeLabels[dominantType]} dominant
            </p>
          </div>
          ${hasHighRisk ? `
            <div style="background: #EF4444; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
              ⚠️ HIGH RISK
            </div>
          ` : ''}
          ${isRecent ? `
            <div style="background: #F59E0B; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-left: 4px;">
              🕐 RECENT
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Risk Assessment -->
      <div style="background: #F9FAFB; padding: 10px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${riskColor};">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #374151; font-size: 13px;">Risk Level:</span>
          <span style="color: ${riskColor}; font-weight: bold; font-size: 13px;">${riskLevel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
          <span style="font-size: 12px; color: #6B7280;">Average Severity:</span>
          <span style="font-weight: bold; color: #374151;">${averageSeverity.toFixed(1)}/5</span>
        </div>
      </div>

      <!-- Incident Breakdown -->
      <div style="margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">
          Incident Breakdown
        </h4>
        <div style="background: white; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px;">
          ${breakdownItems}
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button onclick="this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button').click(); window.dispatchEvent(new CustomEvent('clusterZoomIn', {detail: {bounds: arguments[0]}}))" 
                style="flex: 1; background: #006A4E; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
          🔍 Zoom In
        </button>
        <button onclick="window.dispatchEvent(new CustomEvent('clusterViewDetails', {detail: {count: ${count}, type: '${dominantType}'}}))"
                style="flex: 1; background: #F59E0B; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
          📊 Details
        </button>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #E5E7EB; text-align: center;">
        <p style="margin: 0; font-size: 10px; color: #9CA3AF;">
          🛡️ SafeStreets Bangladesh • Click to explore individual incidents
        </p>
      </div>
    </div>
  `
}

// Create enhanced cluster icon with animations and indicators
export const createEnhancedClusterIcon = (cluster, options = {}) => {
  const markers = cluster.getAllChildMarkers()
  const stats = calculateClusterStats(markers)
  const colorScheme = getClusterColorScheme(stats)
  const sizeConfig = getClusterSizeConfig(stats.count)
  
  const {
    useBengaliNumerals = false,
    showTypeIndicator = true,
    showRiskBadge = true,
    enableAnimations = true,
    ...customOptions
  } = options

  const displayCount = formatClusterCount(stats.count, useBengaliNumerals)
  
  // Animation classes based on risk and recency
  const animationClasses = []
  if (enableAnimations) {
    if (stats.hasHighRisk) animationClasses.push('animate-pulse')
    if (stats.isRecent) animationClasses.push('cluster-glow')
  }

  // Type indicator emoji
  const typeIndicators = {
    'chadabaji': '💰',
    'teen_gang': '👥', 
    'chintai': '⚠️',
    'other': '🚨'
  }

  // Generate cluster icon HTML
  const iconHTML = `
    <div class="cluster-container ${animationClasses.join(' ')}" style="
      position: relative;
      width: ${sizeConfig.touchTarget}px;
      height: ${sizeConfig.touchTarget}px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      <!-- Main cluster circle -->
      <div class="cluster-main ${sizeConfig.iconClass}" style="
        width: ${sizeConfig.size}px;
        height: ${sizeConfig.size}px;
        background: ${colorScheme.primary};
        border: ${sizeConfig.ringSize}px solid ${colorScheme.accent};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        position: relative;
        z-index: 1000;
        transition: all 0.2s ease;
      ">
        <!-- Count display -->
        <span class="cluster-count" style="
          color: white;
          font-weight: bold;
          font-size: ${sizeConfig.textSize};
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          user-select: none;
          line-height: 1;
        ">${displayCount}</span>
      </div>

      <!-- Type indicator badge -->
      ${showTypeIndicator ? `
        <div class="cluster-type-badge" style="
          position: absolute;
          top: -2px;
          left: -2px;
          width: 18px;
          height: 18px;
          background: white;
          border: 2px solid ${colorScheme.accent};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          z-index: 1001;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        ">
          ${typeIndicators[stats.dominantType]}
        </div>
      ` : ''}

      <!-- High risk warning badge -->
      ${showRiskBadge && stats.hasHighRisk ? `
        <div class="cluster-risk-badge" style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          background: #EF4444;
          border: 2px solid white;
          border-radius: 50%;
          z-index: 1002;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
          animation: ${enableAnimations ? 'cluster-pulse 2s infinite' : 'none'};
        ">
          <div style="
            width: 6px;
            height: 6px;
            background: white;
            border-radius: 50%;
            margin: 3px auto;
          "></div>
        </div>
      ` : ''}

      <!-- Recent activity indicator -->
      ${stats.isRecent ? `
        <div class="cluster-recent-badge" style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          background: #F59E0B;
          border: 2px solid white;
          border-radius: 50%;
          z-index: 1001;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
        ">
          <div style="
            width: 4px;
            height: 4px;
            background: white;
            border-radius: 50%;
            margin: 3px auto;
          "></div>
        </div>
      ` : ''}

      <!-- Hover ring effect -->
      <div class="cluster-hover-ring" style="
        position: absolute;
        width: ${sizeConfig.size + 8}px;
        height: ${sizeConfig.size + 8}px;
        border: 2px solid ${colorScheme.primary};
        border-radius: 50%;
        opacity: 0;
        transform: scale(0.9);
        transition: all 0.2s ease;
        pointer-events: none;
        z-index: 999;
      "></div>
    </div>
  `

  // Create Leaflet DivIcon
  const icon = L.divIcon({
    html: iconHTML,
    className: `custom-cluster-icon cluster-${stats.dominantType} cluster-${colorScheme.intensity}`,
    iconSize: [sizeConfig.touchTarget, sizeConfig.touchTarget],
    iconAnchor: [sizeConfig.touchTarget/2, sizeConfig.touchTarget/2]
  })

  // Enhanced popup content
  const popupContent = generateClusterPopup(stats, markers)
  
  return {
    icon,
    popupContent,
    stats,
    colorScheme,
    sizeConfig
  }
}

// CSS animations for cluster icons (to be added to global CSS)
export const clusterAnimationCSS = `
  /* Cluster animation keyframes */
  @keyframes cluster-pulse {
    0%, 100% { 
      transform: scale(1); 
      opacity: 1; 
    }
    50% { 
      transform: scale(1.1); 
      opacity: 0.8; 
    }
  }

  @keyframes cluster-glow {
    0%, 100% { 
      box-shadow: 0 4px 16px rgba(0,0,0,0.3); 
    }
    50% { 
      box-shadow: 0 4px 20px rgba(245, 158, 11, 0.6); 
    }
  }

  /* Cluster hover effects */
  .cluster-container:hover .cluster-main {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  }

  .cluster-container:hover .cluster-hover-ring {
    opacity: 0.6;
    transform: scale(1);
  }

  /* Cluster size classes for responsive behavior */
  .cluster-mega { 
    border-width: 5px !important; 
  }
  
  .cluster-large { 
    border-width: 4px !important; 
  }
  
  .cluster-medium { 
    border-width: 3px !important; 
  }
  
  .cluster-small { 
    border-width: 2px !important; 
  }
  
  .cluster-tiny { 
    border-width: 2px !important; 
  }

  /* Mobile-specific optimizations */
  @media (max-width: 768px) {
    .cluster-main {
      border-width: 3px !important;
    }
    
    .cluster-type-badge {
      width: 16px !important;
      height: 16px !important;
      font-size: 9px !important;
    }
    
    .cluster-risk-badge,
    .cluster-recent-badge {
      width: 12px !important;
      height: 12px !important;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .cluster-main {
      border-width: 4px !important;
    }
    
    .cluster-count {
      text-shadow: 0 2px 4px rgba(0,0,0,1) !important;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .cluster-container * {
      animation: none !important;
      transition: none !important;
    }
  }
`

// Utility function to inject CSS into document
export const injectClusterCSS = () => {
  const styleId = 'safestreets-cluster-styles'
  
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = clusterAnimationCSS
    document.head.appendChild(style)
  }
}

// Custom hook for cluster icon management
export const useClusterIcons = (options = {}) => {
  const memoizedCreateIcon = useMemo(() => {
    return (cluster) => createEnhancedClusterIcon(cluster, options)
  }, [options])

  // Inject CSS on first use
  useMemo(() => {
    injectClusterCSS()
  }, [])

  return {
    createIcon: memoizedCreateIcon,
    calculateStats: calculateClusterStats,
    getColorScheme: getClusterColorScheme,
    getSizeConfig: getClusterSizeConfig,
    formatCount: formatClusterCount
  }
}