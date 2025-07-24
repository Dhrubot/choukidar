// === frontend/src/hooks/useVirtualizedClustering.js ===
// Virtualized Clustering System for SafeStreets Bangladesh
// Solves 1000+ marker performance issues with hybrid rendering

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import L from 'leaflet';

/**
 * Advanced Virtualized Clustering Hook
 * Handles: Large datasets (10000+ markers), viewport culling, progressive loading
 */
export const useVirtualizedClustering = (reports = [], options = {}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [visibleClusters, setVisibleClusters] = useState([]);
  const [renderStats, setRenderStats] = useState({
    totalReports: 0,
    visibleReports: 0,
    totalClusters: 0,
    visibleClusters: 0,
    renderTime: 0,
    memoryUsage: 0
  });

  const clusterCacheRef = useRef(new Map());
  const viewportCacheRef = useRef(new Map());
  const workerRef = useRef(null);
  const frameRef = useRef(null);

  // Configuration with performance optimizations
  const config = useMemo(() => ({
    // Viewport-based rendering
    viewportPadding: 0.2, // 20% padding around viewport
    maxVisibleClusters: 200, // Maximum clusters to render
    maxVisibleMarkers: 500, // Maximum individual markers
    
    // Progressive loading
    enableProgressiveLoading: true,
    progressiveChunkSize: 100,
    progressiveDelay: 16, // ~60fps
    
    // Clustering thresholds
    clusteringThresholds: {
      6: { radius: 100, minPoints: 10 },   // Country level
      8: { radius: 80, minPoints: 8 },     // Regional level  
      10: { radius: 60, minPoints: 5 },    // City level
      12: { radius: 40, minPoints: 3 },    // District level
      14: { radius: 25, minPoints: 2 },    // Neighborhood level
      16: { radius: 15, minPoints: 1 }     // Street level
    },
    
    // Performance settings
    enableWebWorkers: typeof Worker !== 'undefined',
    enableViewportCulling: true,
    enableMemoryOptimization: true,
    debounceDelay: 150,
    
    // Rendering optimizations
    useCanvas: reports.length > 1000,
    enableAnimations: reports.length < 500,
    simplifyGeometry: reports.length > 2000,
    
    ...options
  }), [reports.length, options]);

  /**
   * Initialize Web Worker for heavy clustering operations
   */
  const initializeWorker = useCallback(() => {
    if (!config.enableWebWorkers || workerRef.current) return;

    try {
      // Create inline worker for clustering calculations
      const workerCode = `
        // Web Worker for clustering calculations
        let clusters = new Map();
        let spatialIndex = new Map();
        
        // Spatial hashing for fast neighbor lookup
        function getSpatialHash(lat, lng, precision = 6) {
          const latHash = Math.floor(lat * Math.pow(10, precision));
          const lngHash = Math.floor(lng * Math.pow(10, precision));
          return \`\${latHash}_\${lngHash}\`;
        }
        
        // Distance calculation
        function getDistance(lat1, lng1, lat2, lng2) {
          const R = 6371e3; // Earth's radius in meters
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
        
        // Hierarchical clustering algorithm
        function clusterReports(reports, config) {
          const { radius, minPoints, bounds } = config;
          const clusters = [];
          const processed = new Set();
          
          // Build spatial index
          const spatialIndex = new Map();
          reports.forEach((report, index) => {
            if (!bounds || isInBounds(report, bounds)) {
              const hash = getSpatialHash(report.location.coordinates[1], report.location.coordinates[0]);
              if (!spatialIndex.has(hash)) spatialIndex.set(hash, []);
              spatialIndex.get(hash).push({ ...report, originalIndex: index });
            }
          });
          
          // Cluster algorithm
          spatialIndex.forEach(points => {
            points.forEach(point => {
              if (processed.has(point.originalIndex)) return;
              
              const cluster = [point];
              processed.add(point.originalIndex);
              
              // Find nearby points
              const neighbors = findNeighbors(point, spatialIndex, radius, processed);
              cluster.push(...neighbors);
              neighbors.forEach(n => processed.add(n.originalIndex));
              
              if (cluster.length >= minPoints) {
                // Create cluster
                const center = calculateClusterCenter(cluster);
                clusters.push({
                  id: \`cluster_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
                  center,
                  count: cluster.length,
                  reports: cluster,
                  bounds: calculateClusterBounds(cluster),
                  dominantType: getDominantType(cluster),
                  averageSeverity: getAverageSeverity(cluster)
                });
              } else {
                // Individual markers
                cluster.forEach(report => {
                  clusters.push({
                    id: \`marker_\${report.originalIndex}\`,
                    center: {
                      lat: report.location.coordinates[1],
                      lng: report.location.coordinates[0]
                    },
                    count: 1,
                    reports: [report],
                    isIndividual: true
                  });
                });
              }
            });
          });
          
          return clusters;
        }
        
        function isInBounds(report, bounds) {
          const lat = report.location.coordinates[1];
          const lng = report.location.coordinates[0];
          return lat >= bounds.south && lat <= bounds.north && 
                 lng >= bounds.west && lng <= bounds.east;
        }
        
        function findNeighbors(point, spatialIndex, radius, processed) {
          const neighbors = [];
          const centerLat = point.location.coordinates[1];
          const centerLng = point.location.coordinates[0];
          
          // Search in nearby spatial cells
          for (let latOffset = -1; latOffset <= 1; latOffset++) {
            for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
              const hash = getSpatialHash(centerLat + latOffset * 0.001, centerLng + lngOffset * 0.001);
              const cellPoints = spatialIndex.get(hash) || [];
              
              cellPoints.forEach(candidate => {
                if (processed.has(candidate.originalIndex) || candidate.originalIndex === point.originalIndex) return;
                
                const distance = getDistance(
                  centerLat, centerLng,
                  candidate.location.coordinates[1], candidate.location.coordinates[0]
                );
                
                if (distance <= radius) {
                  neighbors.push(candidate);
                }
              });
            }
          }
          
          return neighbors;
        }
        
        function calculateClusterCenter(cluster) {
          const totalLat = cluster.reduce((sum, p) => sum + p.location.coordinates[1], 0);
          const totalLng = cluster.reduce((sum, p) => sum + p.location.coordinates[0], 0);
          return {
            lat: totalLat / cluster.length,
            lng: totalLng / cluster.length
          };
        }
        
        function calculateClusterBounds(cluster) {
          const lats = cluster.map(p => p.location.coordinates[1]);
          const lngs = cluster.map(p => p.location.coordinates[0]);
          return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs)
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
        
        // Message handler
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          try {
            switch (type) {
              case 'cluster':
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
                break;
                
              case 'viewport_filter':
                const filtered = data.reports.filter(report => 
                  isInBounds(report, data.bounds)
                );
                self.postMessage({
                  type: 'viewport_result',
                  data: filtered
                });
                break;
                
              default:
                self.postMessage({ type: 'error', message: 'Unknown message type' });
            }
          } catch (error) {
            self.postMessage({ 
              type: 'error', 
              message: error.message,
              stack: error.stack 
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));

      workerRef.current.onmessage = (e) => {
        const { type, data, stats } = e.data;
        
        switch (type) {
          case 'cluster_result':
            setVisibleClusters(data);
            setRenderStats(prev => ({ ...prev, ...stats }));
            setIsProcessing(false);
            break;
            
          case 'viewport_result':
            // Handle viewport filtering result
            break;
            
          case 'error':
            console.error('❌ Clustering worker error:', data);
            setIsProcessing(false);
            break;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('❌ Clustering worker error:', error);
        setIsProcessing(false);
      };

      console.log('✅ Clustering web worker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize clustering worker:', error);
    }
  }, [config.enableWebWorkers]);

  /**
   * Viewport-aware clustering
   */
  const clusterInViewport = useCallback(async (map, zoomLevel) => {
    if (!map || !reports.length) return;

    const startTime = Date.now();
    setIsProcessing(true);

    try {
      // Get current viewport bounds
      const bounds = map.getBounds();
      const viewport = {
        north: bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * config.viewportPadding,
        south: bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * config.viewportPadding,
        east: bounds.getEast() + (bounds.getEast() - bounds.getWest()) * config.viewportPadding,
        west: bounds.getWest() - (bounds.getEast() - bounds.getWest()) * config.viewportPadding
      };

      setViewportBounds(viewport);

      // Check cache first
      const cacheKey = `${zoomLevel}_${JSON.stringify(viewport)}_${reports.length}`;
      if (clusterCacheRef.current.has(cacheKey)) {
        const cached = clusterCacheRef.current.get(cacheKey);
        setVisibleClusters(cached.clusters);
        setRenderStats(cached.stats);
        setIsProcessing(false);
        return;
      }

      // Get clustering configuration for current zoom level
      const thresholds = Object.keys(config.clusteringThresholds)
        .map(Number)
        .sort((a, b) => b - a);
      
      const currentThreshold = thresholds.find(t => zoomLevel <= t) || thresholds[thresholds.length - 1];
      const clusterConfig = config.clusteringThresholds[currentThreshold];

      // Filter reports to viewport (with padding)
      const viewportReports = reports.filter(report => {
        if (!report.location?.coordinates) return false;
        const lat = report.location.coordinates[1];
        const lng = report.location.coordinates[0];
        return lat >= viewport.south && lat <= viewport.north && 
               lng >= viewport.west && lng <= viewport.east;
      });

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
        // Fallback to main thread clustering
        const clusters = await clusterReportsMainThread(viewportReports, clusterConfig, viewport);
        
        const stats = {
          totalReports: reports.length,
          visibleReports: viewportReports.length,
          totalClusters: clusters.length,
          visibleClusters: clusters.length,
          renderTime: Date.now() - startTime,
          memoryUsage: estimateMemoryUsage(clusters)
        };

        // Cache result
        clusterCacheRef.current.set(cacheKey, { clusters, stats });
        
        // Limit cache size
        if (clusterCacheRef.current.size > 50) {
          const firstKey = clusterCacheRef.current.keys().next().value;
          clusterCacheRef.current.delete(firstKey);
        }

        setVisibleClusters(clusters);
        setRenderStats(stats);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('❌ Clustering error:', error);
      setIsProcessing(false);
    }
  }, [reports, config]);

  /**
   * Main thread clustering fallback
   */
  const clusterReportsMainThread = useCallback(async (reportsToCluster, clusterConfig, bounds) => {
    const { radius, minPoints } = clusterConfig;
    const clusters = [];
    const processed = new Set();

    // Progressive clustering to avoid blocking UI
    const chunkSize = config.progressiveChunkSize;
    const chunks = Math.ceil(reportsToCluster.length / chunkSize);

    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
      const startIndex = chunkIndex * chunkSize;
      const endIndex = Math.min(startIndex + chunkSize, reportsToCluster.length);
      const chunk = reportsToCluster.slice(startIndex, endIndex);

      chunk.forEach((report, index) => {
        const globalIndex = startIndex + index;
        if (processed.has(globalIndex)) return;

        const cluster = [{ ...report, originalIndex: globalIndex }];
        processed.add(globalIndex);

        // Find nearby reports
        const neighbors = findNearbyReports(report, reportsToCluster, radius, processed, startIndex);
        cluster.push(...neighbors);
        neighbors.forEach(n => processed.add(n.originalIndex));

        if (cluster.length >= minPoints) {
          // Create cluster
          clusters.push(createCluster(cluster));
        } else {
          // Individual markers
          cluster.forEach(r => {
            clusters.push(createIndividualMarker(r));
          });
        }
      });

      // Yield control to UI between chunks
      if (chunkIndex < chunks - 1) {
        await new Promise(resolve => setTimeout(resolve, config.progressiveDelay));
      }
    }

    return clusters;
  }, [config.progressiveChunkSize, config.progressiveDelay]);

  /**
   * Find nearby reports for clustering
   */
  const findNearbyReports = useCallback((centerReport, allReports, radius, processed, offset = 0) => {
    const neighbors = [];
    const centerLat = centerReport.location.coordinates[1];
    const centerLng = centerReport.location.coordinates[0];

    allReports.forEach((report, index) => {
      const globalIndex = offset + index;
      if (processed.has(globalIndex)) return;

      const distance = calculateDistance(
        centerLat, centerLng,
        report.location.coordinates[1], report.location.coordinates[0]
      );

      if (distance <= radius) {
        neighbors.push({ ...report, originalIndex: globalIndex });
      }
    });

    return neighbors;
  }, []);

  /**
   * Calculate distance between two points
   */
  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Earth's radius in meters
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

  /**
   * Create cluster object
   */
  const createCluster = useCallback((reports) => {
    const center = calculateClusterCenter(reports);
    const bounds = calculateClusterBounds(reports);
    
    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      center,
      count: reports.length,
      reports,
      bounds,
      dominantType: getDominantType(reports),
      averageSeverity: getAverageSeverity(reports),
      riskLevel: calculateClusterRisk(reports),
      isCluster: true
    };
  }, []);

  /**
   * Create individual marker object
   */
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
      riskLevel: report.severity >= 4 ? 'high' : report.severity >= 3 ? 'medium' : 'low',
      isIndividual: true
    };
  }, []);

  /**
   * Calculate cluster center
   */
  const calculateClusterCenter = useCallback((reports) => {
    const totalLat = reports.reduce((sum, r) => sum + r.location.coordinates[1], 0);
    const totalLng = reports.reduce((sum, r) => sum + r.location.coordinates[0], 0);
    return {
      lat: totalLat / reports.length,
      lng: totalLng / reports.length
    };
  }, []);

  /**
   * Calculate cluster bounds
   */
  const calculateClusterBounds = useCallback((reports) => {
    const lats = reports.map(r => r.location.coordinates[1]);
    const lngs = reports.map(r => r.location.coordinates[0]);
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };
  }, []);

  /**
   * Get dominant incident type in cluster
   */
  const getDominantType = useCallback((reports) => {
    const types = {};
    reports.forEach(report => {
      types[report.type] = (types[report.type] || 0) + 1;
    });
    return Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b);
  }, []);

  /**
   * Calculate average severity
   */
  const getAverageSeverity = useCallback((reports) => {
    const total = reports.reduce((sum, report) => sum + (report.severity || 3), 0);
    return Math.round(total / reports.length);
  }, []);

  /**
   * Calculate cluster risk level
   */
  const calculateClusterRisk = useCallback((reports) => {
    const avgSeverity = getAverageSeverity(reports);
    const recentReports = reports.filter(r => {
      const reportDate = new Date(r.timestamp || r.createdAt);
      const daysSince = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length;

    if (avgSeverity >= 4 && recentReports >= 3) return 'critical';
    if (avgSeverity >= 4 || recentReports >= 5) return 'high';
    if (avgSeverity >= 3 || recentReports >= 2) return 'medium';
    return 'low';
  }, [getAverageSeverity]);

  /**
   * Estimate memory usage
   */
  const estimateMemoryUsage = useCallback((clusters) => {
    // Rough estimation in KB
    const clusterSize = clusters.reduce((total, cluster) => {
      return total + (cluster.reports.length * 0.5); // ~0.5KB per report
    }, 0);
    return Math.round(clusterSize);
  }, []);

  /**
   * Debounced clustering trigger
   */
  const debouncedCluster = useMemo(() => {
    let timeoutId;
    return (map, zoomLevel) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        clusterInViewport(map, zoomLevel);
      }, config.debounceDelay);
    };
  }, [clusterInViewport, config.debounceDelay]);

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
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [initializeWorker]);

  /**
   * Clear caches when reports change significantly
   */
  useEffect(() => {
    if (clusterCacheRef.current.size > 0) {
      clusterCacheRef.current.clear();
      viewportCacheRef.current.clear();
    }
  }, [reports.length]);

  return {
    // Core clustering functions
    clusterInViewport: debouncedCluster,
    
    // State
    isProcessing,
    visibleClusters,
    viewportBounds,
    renderStats,
    
    // Configuration
    config,
    
    // Utilities
    estimateMemoryUsage: () => estimateMemoryUsage(visibleClusters),
    clearCache: () => {
      clusterCacheRef.current.clear();
      viewportCacheRef.current.clear();
    },
    
    // Performance metrics
    getPerformanceMetrics: () => ({
      ...renderStats,
      cacheSize: clusterCacheRef.current.size,
      workerAvailable: !!workerRef.current,
      recommendedMode: reports.length > 1000 ? 'clusters' : 
                      reports.length > 500 ? 'hybrid' : 'markers'
    })
  };
};