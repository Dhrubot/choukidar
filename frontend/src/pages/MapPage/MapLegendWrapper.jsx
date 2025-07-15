// === frontend/src/components/Map/MapLegendWrapper.jsx ===
import React, { memo } from 'react'
import MapLegend from '../../components/Map/MapLegend'

/**
 * MapLegendWrapper Component - Extracted from MapPage.jsx
 * Simple wrapper for MapLegend with calculated report counts
 */
const MapLegendWrapper = memo(({
  filterStats
}) => {
  return (
    <MapLegend 
      reportCounts={{
        total: filterStats.total,
        approved: filterStats.filtered,
        pending: 0
      }} 
    />
  )
})

MapLegendWrapper.displayName = 'MapLegendWrapper'

export default MapLegendWrapper