// === frontend/src/hooks/useMapPerformance.js ===
import { useMemo, useEffect } from 'react'

/**
 * Custom hook for MapPage performance analysis and recommendations
 * Extracted from MapPage.jsx Lines 80-120
 * Handles: Performance calculations, dataset analysis, recommendations
 */
export const useMapPerformance = (filteredReports, reports, viewMode) => {
  // ✅ EXTRACTED: Performance stats calculation from MapPage Lines 84-108
  const performanceStats = useMemo(() => {
    const count = filteredReports.length

    return {
      datasetSize: count > 1000 ? 'large' : count > 500 ? 'medium' : 'small',
      isLargeDataset: count > 200,
      shouldRecommendClustering: count > 100 && viewMode === 'markers',
      shouldWarnHybrid: count > 500 && viewMode === 'hybrid',
      recommendedViewMode: count > 1000 ? 'clusters' :
        count > 500 ? 'clusters' :
          count > 100 ? 'hybrid' : 'markers',
      estimatedClusters: Math.ceil(count / 15),
      performanceImpact: count > 1000 ? 'high' : count > 500 ? 'medium' : 'low',
      filterEfficiency: reports.length > 0 ? ((count / reports.length) * 100).toFixed(1) : 100
    }
  }, [filteredReports.length, viewMode, reports.length])

  // ✅ EXTRACTED: Smart view mode recommendation system from MapPage Lines 111-118
  useEffect(() => {
    const { datasetSize } = performanceStats

    if (datasetSize === 'large' && viewMode === 'markers') {
      console.log(`💡 Large dataset detected (${filteredReports.length} reports) - clustering recommended`)
    }
  }, [performanceStats, viewMode, filteredReports.length])

  // Enhanced recommendations based on performance analysis
  const recommendations = useMemo(() => {
    const { datasetSize, shouldRecommendClustering, shouldWarnHybrid } = performanceStats
    
    return {
      shouldShowClusteringTip: shouldRecommendClustering,
      shouldShowHybridWarning: shouldWarnHybrid,
      optimalViewMode: performanceStats.recommendedViewMode,
      severity: datasetSize === 'large' ? 'high' : datasetSize === 'medium' ? 'medium' : 'low'
    }
  }, [performanceStats])

  return {
    performanceStats,
    recommendations
  }
}