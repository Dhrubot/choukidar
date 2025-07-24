// === frontend/src/hooks/useMapClustering.js (ENHANCED VERSION) ===
// Enhanced Map Clustering Hook - Replaces existing useMapClustering.js
// Combines existing functionality with virtualized performance optimizations

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';

/**
 * Enhanced Map Clustering Hook with Virtualized Performance
 * Handles: 10,000+ markers, Web Workers, viewport culling, progressive loading
 */
export const useMapClustering = (reports = [], options = {}) => {
  // Core state management
  const [isProcessing, setIsProcessing] = useState(false);
  const [clusterStats, setClusterStats] = useState({
    totalClusters: 0,
    totalMarkers: 0,
    averageClusterSize: 0,
    performanceLevel: 'light',
    renderTime: 0
  });
  
  // Enhanced state for virtualization
  const [viewportBounds, setViewportBounds] = useState(null);
  const [visibleClusters, setVisibleClusters] = useState([]);
  
  // Refs for performance tracking
  const clusterGroupRef = useRef(null);
  const lastZoomLevel = useRef(11);
  const clusterCacheRef = useRef(new Map());
  const workerRef = useRef(null);

  // Enhanced configuration with virtualization
  const config = useMemo(() => ({
    // Original zoom thresholds (preserved for compatibility)
    zoomThresholds: {
      6: { radius: 80, maxZoom: 8 },   
      8: { radius: 60, maxZoom: 10 },  
      10: { radius: 40, maxZoom: 12 }, 
      12: { radius: 25, maxZoom: 14 }, 
      14: { radius: 15, maxZoom: 16 }  
    },
    
    // Performance optimizations
    animate: reports.length < 500,  // Disable animations for large datasets
    animateAddingMarkers: reports.length < 500,
    disableClusteringAtZoom: 16,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyDistanceMultiplier: 1.5,
    
    // NEW: Virtualization settings
    enableVirtualization: reports.length > 1000,
    viewportPadding: 0.2,
    maxVisibleClusters: 200,
    maxVisibleMarkers: 500,
    enableWebWorkers: typeof Worker !== 'undefined' && reports.length > 200,
    progressiveChunkSize: 100,
    debounceDelay: 150,
    
    // Dynamic performance settings
    useCanvas: reports.length > 1000,
    simplifyGeometry: reports.length > 2000,
    enableMemoryOptimization: true,
    
    ...options
  }), [reports.length, options]);

  // Dynamic clustering configuration based on dataset size
  const dynamicConfig = useMemo(() => {
    const datasetSize = reports.length;
    let adjustedConfig = { ...config };
    
    if (datasetSize < 50) {
      // Small dataset - minimal clustering
      adjustedConfig.maxClusterRadius = 30;
      adjustedConfig.disableClusteringAtZoom = 14;
    } else if (datasetSize < 200) {
      // Medium dataset - moderate clustering
      adjustedConfig.maxClusterRadius = 50;
      adjustedConfig.disableClusteringAtZoom = 15;
    } else if (datasetSize < 1000) {
      // Large dataset - standard clustering
      adjustedConfig.maxClusterRadius = 80;
      adjustedConfig.disableClusteringAtZoom = 16;
    } else {
      // Very large dataset - aggressive clustering + virtualization
      adjustedConfig.maxClusterRadius = 120;
      adjustedConfig.disableClusteringAtZoom = 17;
      adjustedConfig.animate = false;
      adjustedConfig.animateAddingMarkers = false;
      adjustedConfig.enableVirtualization = true;
    }
    
    return adjustedConfig;
  }, [reports.length, config]);

  /**
   * Initialize Web Worker for heavy clustering (NEW)
   */
  const initializeWorker = useCallback(() => {
    if (!config.enableWebWorkers || workerRef.current) return;

    try {
      const workerCode = `
        // Web Worker for clustering calculations
        function clusterReports(reports, config) {
          const { radius, minPoints = 2, bounds } = config;
          const clusters = [];
          const processed = new Set();
          
          // Simple spatial clustering algorithm
          reports.forEach((report, index) => {
            if (processed.has(index)) return;
            
            const cluster = [{ ...report, originalIndex: index }];
            processed.add(index);
            
            // Find nearby reports
            const centerLat = report.location.coordinates[1];
            const centerLng = report.location.coordinates[0];
            
            reports.forEach((other, otherIndex) => {
              if (processed.has(otherIndex) || index === otherIndex) return;
              
              const distance = calculateDistance(
                centerLat, centerLng,
                other.location.coordinates[1], other.location.coordinates[0]
              );
              
              if (distance <= radius) {
                cluster.push({ ...other, originalIndex: otherIndex });
                processed.add(otherIndex);
              }
            });
            
            if (cluster.length >= minPoints) {
              // Create cluster
              const center = calculateClusterCenter(cluster);
              clusters.push({
                id: \`cluster_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
                center,
                count: cluster.length,
                reports: cluster,
                dominantType: getDominantType(cluster),
                averageSeverity: getAverageSeverity(cluster),
                isCluster: true
              });
            } else {
              // Individual markers
              cluster.forEach(r => {
                clusters.push({
                  id: \`marker_\${r._id || r.originalIndex}\`,
                  center: {
                    lat: r.location.coordinates[1],
                    lng: r.location.coordinates[0]
                  },
                  count: 1,
                  reports: [r],
                  dominantType: r.type,
                  averageSeverity: r.severity || 3,
                  isIndividual: true
                });
              });
            }
          });
          
          return clusters;
        }
        
        function calculateDistance(lat1, lng1, lat2, lng2) {
          const R = 6371e3;
          const φ1 = lat1 * Math.PI/180;
          const φ2 = lat2 * Math.PI/180;
          const Δφ = (lat2-lat1) * Math.PI/180;
          const Δλ = (lng2-lng1) * Math.PI/180;
          
          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          
          return R * c;
        }
        
        function calculateClusterCenter(cluster) {
          const totalLat = cluster.reduce((sum, r) => sum + r.location.coordinates[1], 0);
          const totalLng = cluster.reduce((sum, r) => sum + r.location.coordinates[0], 0);
          return {
            lat: totalLat / cluster.length,
            lng: totalLng / cluster.length
          };
        }
        
        function getDominantType(cluster) {
          const types = {};
          cluster.forEach(report => {
            types[report.type] = (types[report.type] || 0) + 1;
          });
          return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
        }
        
        function getAverageSeverity(cluster) {
          const total = cluster.reduce((sum, report) => sum + (report.severity || 3), 0);
          return Math.round(total / cluster.length);
        }
        
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          try {
            if (type === 'cluster') {
              const clusters = clusterReports(data.reports, data.config);
              self.postMessage({
                type: 'cluster_result',
                data: clusters,
                stats: {
                  totalReports: data.reports.length,
                  totalClusters: clusters.length,
                  processingTime: Date.now() - data.startTime
                }
              });
            }
          } catch (error) {
            self.postMessage({ 
              type: 'error', 
              message: error.message 
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));

      workerRef.current.onmessage = (e) => {
        const { type, data, stats } = e.data;
        
        if (type === 'cluster_result') {
          setVisibleClusters(data);
          setClusterStats(prev => ({ 
            ...prev, 
            ...stats,
            performanceLevel: reports.length > 1000 ? 'heavy' : 
                             reports.length > 500 ? 'moderate' : 'light'
          }));
          setIsProcessing(false);
        } else if (type === 'error') {
          console.error('❌ Clustering worker error:', data);
          setIsProcessing(false);
        }
      };

      console.log('✅ Clustering web worker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize clustering worker:', error);
    }
  }, [config.enableWebWorkers, reports.length]);

  /**
   * Enhanced cluster icon creation (preserved from original)
   */
  const createClusterIcon = useCallback((cluster) => {
    const count = cluster.getChildCount();
    const markers = cluster.getAllChildMarkers();
    
    // Calculate cluster characteristics
    const dominantType = getDominantIncidentType(markers);
    const avgSeverity = getAverageClusterSeverity(markers);
    const hasHighRisk = markers.some(m => (m.options?.reportData?.severity || 3) >= 4);
    
    // Size based on count
    let size = 30;
    if (count > 100) size = 60;
    else if (count > 50) size = 50;
    else if (count > 10) size = 40;
    
    // Color based on dominant type and severity
    const baseColors = {
      'chadabaji': '#F59E0B',    
      'teen_gang': '#EF4444',    
      'chintai': '#F97316',      
      'eve_teasing': '#EC4899',  
      'stalking': '#DC2626',     
      'other': '#6B7280'         
    };
    
    let color = baseColors[dominantType] || baseColors.other;
    
    // Darken color for high severity
    if (avgSeverity >= 4) {
      color = adjustColorBrightness(color, -40);
    }
    
    return L.divIcon({
      html: `
        <div style="
          background: ${color};
          color: white;
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: ${size > 40 ? '14px' : '12px'};
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">
          ${count}
          ${hasHighRisk ? `
            <div style="
              position: absolute;
              top: -2px;
              right: -2px;
              width: 12px;
              height: 12px;
              background: #EF4444;
              border: 2px solid white;
              border-radius: 50%;
              z-index: 1001;
            "></div>
          ` : ''}
        </div>
      `,
      className: 'custom-cluster-icon',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }, []);

  /**
   * Viewport-aware clustering for virtualization (NEW)
   */
  const clusterInViewport = useCallback(async (map, zoomLevel) => {
    if (!map || !reports.length) return;

    const startTime = Date.now();
    setIsProcessing(true);

    try {
      // Get viewport bounds with padding
      const bounds = map.getBounds();
      const viewport = {
        north: bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * config.viewportPadding,
        south: bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * config.viewportPadding,
        east: bounds.getEast() + (bounds.getEast() - bounds.getWest()) * config.viewportPadding,
        west: bounds.getWest() - (bounds.getEast() - bounds.getWest()) * config.viewportPadding
      };

      setViewportBounds(viewport);

      // Check cache
      const cacheKey = `${zoomLevel}_${JSON.stringify(viewport)}_${reports.length}`;
      if (clusterCacheRef.current.has(cacheKey)) {
        const cached = clusterCacheRef.current.get(cacheKey);
        setVisibleClusters(cached.clusters);
        setClusterStats(cached.stats);
        setIsProcessing(false);
        return;
      }

      // Filter to viewport
      const viewportReports = reports.filter(report => {
        if (!report.location?.coordinates) return false;
        const lat = report.location.coordinates[1];
        const lng = report.location.coordinates[0];
        return lat >= viewport.south && lat <= viewport.north && 
               lng >= viewport.west && lng <= viewport.east;
      });

      // Get clustering config for zoom level
      const thresholds = Object.keys(dynamicConfig.zoomThresholds)
        .map(Number)
        .sort((a, b) => b - a);
      
      const currentThreshold = thresholds.find(t => zoomLevel <= t) || thresholds[thresholds.length - 1];
      const clusterConfig = dynamicConfig.zoomThresholds[currentThreshold];

      // Use web worker for large datasets
      if (config.enableWebWorkers && workerRef.current && viewportReports.length > 200) {
        workerRef.current.postMessage({
          type: 'cluster',
          data: {
            reports: viewportReports,
            config: { ...clusterConfig, bounds: viewport },
            startTime
          }
        });
      } else {
        // Fallback to main thread
        const clusters = await clusterReportsMainThread(viewportReports, clusterConfig);
        
        const stats = {
          totalReports: reports.length,
          visibleReports: viewportReports.length,
          totalClusters: clusters.length,
          renderTime: Date.now() - startTime,
          performanceLevel: reports.length > 1000 ? 'heavy' : 
                           reports.length > 500 ? 'moderate' : 'light'
        };

        // Cache result
        clusterCacheRef.current.set(cacheKey, { clusters, stats });
        if (clusterCacheRef.current.size > 50) {
          const firstKey = clusterCacheRef.current.keys().next().value;
          clusterCacheRef.current.delete(firstKey);
        }

        setVisibleClusters(clusters);
        setClusterStats(stats);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('❌ Clustering error:', error);
      setIsProcessing(false);
    }
  }, [reports, config, dynamicConfig]);

  /**
   * Main thread clustering fallback
   */
  const clusterReportsMainThread = useCallback(async (reportsToCluster, clusterConfig) => {
    // Simple clustering implementation for main thread
    const clusters = [];
    const processed = new Set();
    const { radius } = clusterConfig;

    reportsToCluster.forEach((report, index) => {
      if (processed.has(index)) return;

      const cluster = [{ ...report, originalIndex: index }];
      processed.add(index);

      // Find nearby reports (simplified)
      reportsToCluster.forEach((other, otherIndex) => {
        if (processed.has(otherIndex) || index === otherIndex) return;
        
        const distance = calculateDistance(
          report.location.coordinates[1], report.location.coordinates[0],
          other.location.coordinates[1], other.location.coordinates[0]
        );
        
        if (distance <= radius) {
          cluster.push({ ...other, originalIndex: otherIndex });
          processed.add(otherIndex);
        }
      });

      if (cluster.length >= 2) {
        clusters.push(createClusterObject(cluster));
      } else {
        clusters.push(createIndividualMarker(cluster[0]));
      }
    });

    return clusters;
  }, []);

  /**
   * Enhanced processing with original compatibility (PRESERVED)
   */
  const processReports = useCallback(async (reports, map) => {
    if (!map || !reports || reports.length === 0) return null;

    const startTime = Date.now();
    setIsProcessing(true);
    
    try {
      // Clear existing cluster group
      if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
        map.removeLayer(clusterGroupRef.current);
      }

      // Use virtualized clustering for large datasets
      if (dynamicConfig.enableVirtualization) {
        await clusterInViewport(map, map.getZoom());
        return;
      }

      // Original clustering logic for smaller datasets
      const clusterGroup = initializeClusterGroup(map);
      if (!clusterGroup) return null;

      // Process in chunks for performance
      const chunkSize = config.progressiveChunkSize;
      const totalChunks = Math.ceil(reports.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = reports.slice(i * chunkSize, (i + 1) * chunkSize);
        
        const markers = chunk
          .filter(report => report.location?.coordinates)
          .map(report => createReportMarker(report));
        
        clusterGroup.addLayers(markers);
        
        // Yield control between chunks
        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 16));
        }
      }

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      // Update stats
      setClusterStats({
        totalClusters: clusterGroup.getLayers().length,
        totalMarkers: reports.length,
        averageClusterSize: reports.length / Math.max(clusterGroup.getLayers().length, 1),
        performanceLevel: reports.length > 1000 ? 'heavy' : 
                         reports.length > 500 ? 'moderate' : 'light',
        renderTime: Date.now() - startTime
      });

      setIsProcessing(false);
      return clusterGroup;
      
    } catch (error) {
      console.error('❌ Error processing reports:', error);
      setIsProcessing(false);
      return null;
    }
  }, [dynamicConfig, config, clusterInViewport]);

  /**
   * Initialize cluster group (PRESERVED)
   */
  const initializeClusterGroup = useCallback((map) => {
    if (!map) return null;

    const currentZoom = map.getZoom();
    lastZoomLevel.current = currentZoom;
    
    const zoomConfig = Object.keys(dynamicConfig.zoomThresholds)
      .reverse()
      .find(zoom => currentZoom >= parseInt(zoom));
    
    const activeConfig = dynamicConfig.zoomThresholds[zoomConfig] || 
                        dynamicConfig.zoomThresholds[14];

    const clusterGroup = L.markerClusterGroup({
      ...dynamicConfig,
      maxClusterRadius: activeConfig.radius,
      disableClusteringAtZoom: activeConfig.maxZoom,
      iconCreateFunction: createClusterIcon,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50
    });

    clusterGroupRef.current = clusterGroup;
    return clusterGroup;
  }, [dynamicConfig, createClusterIcon]);

  /**
   * Utility functions
   */
  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  const createClusterObject = useCallback((reports) => {
    const center = {
      lat: reports.reduce((sum, r) => sum + r.location.coordinates[1], 0) / reports.length,
      lng: reports.reduce((sum, r) => sum + r.location.coordinates[0], 0) / reports.length
    };
    
    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      center,
      count: reports.length,
      reports,
      dominantType: getDominantIncidentType(reports),
      averageSeverity: getAverageClusterSeverity(reports),
      isCluster: true
    };
  }, []);

  const createIndividualMarker = useCallback((report) => {
    return {
      id: `marker_${report._id || report.originalIndex}`,
      center: {
        lat: report.location.coordinates[1],
        lng: report.location.coordinates[0]
      },
      count: 1,
      reports: [report],
      dominantType: report.type,
      averageSeverity: report.severity || 3,
      isIndividual: true
    };
  }, []);

  const getDominantIncidentType = useCallback((markers) => {
    const types = {};
    markers.forEach(marker => {
      const type = marker.options?.reportData?.type || marker.type || 'other';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
  }, []);

  const getAverageClusterSeverity = useCallback((markers) => {
    const total = markers.reduce((sum, marker) => {
      return sum + (marker.options?.reportData?.severity || marker.severity || 3);
    }, 0);
    return Math.round(total / markers.length);
  }, []);

  const adjustColorBrightness = useCallback((hex, percent) => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }, []);

  const createReportMarker = useCallback((report) => {
    if (!report.location?.coordinates) return null;
    
    const [lng, lat] = report.location.coordinates;
    return L.marker([lat, lng], {
      reportData: report,
      icon: createIndividualMarkerIcon(report)
    });
  }, []);

  const createIndividualMarkerIcon = useCallback((report) => {
    const severity = report.severity || 3;
    const type = report.type || 'other';
    
    const colors = {
      'chadabaji': '#F59E0B',
      'teen_gang': '#EF4444',
      'chintai': '#F97316',
      'eve_teasing': '#EC4899',
      'stalking': '#DC2626',
      'other': '#6B7280'
    };
    
    const color = colors[type] || colors.other;
    const size = severity >= 4 ? 16 : 12;
    
    return L.divIcon({
      html: `<div style="
        background: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      className: 'individual-marker-icon',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  }, []);

  /**
   * Initialize and cleanup
   */
  useEffect(() => {
    initializeWorker();
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [initializeWorker]);

  // Clear cache when reports change significantly
  useEffect(() => {
    if (clusterCacheRef.current.size > 0) {
      clusterCacheRef.current.clear();
    }
  }, [reports.length]);

  /**
   * Debounced clustering for performance
   */
  const debouncedCluster = useMemo(() => {
    let timeoutId;
    return (map, zoomLevel) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (dynamicConfig.enableVirtualization) {
          clusterInViewport(map, zoomLevel);
        } else {
          processReports(reports, map);
        }
      }, config.debounceDelay);
    };
  }, [clusterInViewport, processReports, reports, dynamicConfig, config.debounceDelay]);

  /**
   * Handle zoom changes
   */
  const handleZoomChange = useCallback((map) => {
    const currentZoom = map.getZoom();
    if (Math.abs(currentZoom - lastZoomLevel.current) >= 1) {
      lastZoomLevel.current = currentZoom;
      debouncedCluster(map, currentZoom);
    }
  }, [debouncedCluster]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback((map) => {
    if (clusterGroupRef.current && map && map.hasLayer(clusterGroupRef.current)) {
      map.removeLayer(clusterGroupRef.current);
    }
    clusterCacheRef.current.clear();
  }, []);

  // Return enhanced API with backward compatibility
  return {
    // Core clustering functions (PRESERVED for compatibility)
    processReports,
    initializeClusterGroup,
    createClusterIcon,
    handleZoomChange,
    cleanup,
    
    // Enhanced virtualized functions (NEW)
    clusterInViewport: debouncedCluster,
    
    // State (ENHANCED)
    isProcessing,
    clusterStats, // Enhanced with performance metrics
    clusterGroup: clusterGroupRef.current,
    
    // NEW: Virtualization state
    viewportBounds,
    visibleClusters,
    
    // Configuration (ENHANCED)
    config: dynamicConfig,
    
    // Utilities (NEW)
    clearCache: () => clusterCacheRef.current.clear(),
    
    // Performance metrics (NEW)
    getPerformanceMetrics: () => ({
      ...clusterStats,
      cacheSize: clusterCacheRef.current.size,
      workerAvailable: !!workerRef.current,
      virtualizationEnabled: dynamicConfig.enableVirtualization,
      recommendedMode: reports.length > 1000 ? 'virtualized' : 
                      reports.length > 500 ? 'clustered' : 'standard',
      memoryEstimate: `${Math.round(reports.length * 0.5)}KB`
    }),
    
    // Debug utilities (NEW)
    debugInfo: process.env.NODE_ENV === 'development' ? {
      reportsCount: reports.length,
      configUsed: dynamicConfig,
      cacheEntries: clusterCacheRef.current.size,
      lastZoom: lastZoomLevel.current,
      workerActive: !!workerRef.current
    } : null
  };
};