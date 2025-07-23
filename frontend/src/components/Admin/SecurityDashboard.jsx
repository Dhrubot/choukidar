// === frontend/src/components/Admin/SecurityDashboard.jsx ===
// Enhanced Security Monitoring Dashboard Component with Real-Time WebSocket Integration
// Combines the best features from both versions for comprehensive security monitoring

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Eye, 
  Users, 
  Globe, 
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
  Filter,
  Download,
  Ban,
  CheckCircle,
  XCircle,
  Smartphone,
  Monitor,
  Tablet,
  Search,
  MapPin,
  Flag,
  Zap,
  Lock,
  Unlock,
  Wifi,
  WifiOff
} from 'lucide-react';
import apiService from '../../services/api';
import websocketService from '../../services/websocketService';
import { useAuth } from '../../contexts/AuthContext';
import { useUserType } from '../../contexts/UserTypeContext';

/**
 * SecurityDashboard Component with Real-Time WebSocket Integration
 * Features: Live threat detection, real-time device monitoring, instant notifications,
 * geographic threat analysis, and comprehensive security analytics
 */
const SecurityDashboard = () => {
  // Context hooks
  const { sessionToken, adminUser } = useAuth();
  const { deviceFingerprint } = useUserType();

  // State management
  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const refreshInterval = useRef(null);

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  const [wsAuthenticated, setWsAuthenticated] = useState(false);
  const [realTimeEvents, setRealTimeEvents] = useState([]);
  const [connectionRetries, setConnectionRetries] = useState(0);

  // Security data state
  const [securityInsights, setSecurityInsights] = useState({
    totalDevices: 0,
    activeThreats: 0,
    quarantinedDevices: 0,
    crossBorderAttacks: 0,
    trustScoreAverage: 0,
    riskDistribution: {
      very_low: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }
  });

  const [deviceFingerprints, setDeviceFingerprints] = useState([]);
  const [threatAnalysis, setThreatAnalysis] = useState({
    coordinatedAttacks: [],
    suspiciousDevices: [],
    crossBorderThreats: [],
    geographicThreats: [], // Added from second version
    suspiciousPatterns: [], // Added from second version
    femaleSafetyAlerts: []
  });
  const [systemStats, setSystemStats] = useState({
    serverUptime: 0,
    memoryUsage: {},
    activeConnections: 0,
    timestamp: new Date()
  });

  // Filtering and pagination
  const [filters, setFilters] = useState({
    riskLevel: 'all',
    deviceType: 'all',
    quarantineStatus: 'all',
    trustScore: 'all',
    country: 'all', // Added from second version
    timeRange: '24h' // Added from second version
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0
  });

  // WebSocket initialization and connection (keeping from first version)
  const initializeWebSocket = useCallback(async () => {
    if (!deviceFingerprint?.fingerprintId || !sessionToken) {
      console.log('⏳ Waiting for authentication context...');
      return;
    }

    try {
      console.log('🔌 Initializing WebSocket connection...');
      
      await websocketService.connect();
      setWsConnected(true);
      
      const authSuccess = websocketService.authenticateAdmin(
        sessionToken, 
        deviceFingerprint.fingerprintId
      );
      
      if (!authSuccess) {
        throw new Error('Failed to authenticate admin WebSocket');
      }

      websocketService.subscribeToSecurityEvents({
        threatLevel: 'all',
        deviceEvents: true,
        reportEvents: true,
        systemEvents: true
      });

      websocketService.subscribeToReportUpdates({
        status: 'all',
        femaleSafety: true
      });

      console.log('✅ WebSocket initialized successfully');
      setConnectionRetries(0);
      
    } catch (error) {
      console.error('❌ WebSocket initialization failed:', error);
      setWsConnected(false);
      setWsAuthenticated(false);
      setConnectionRetries(prev => prev + 1);
      
      if (connectionRetries < 5) {
        const retryDelay = Math.min(1000 * Math.pow(2, connectionRetries), 30000);
        setTimeout(() => initializeWebSocket(), retryDelay);
      }
    }
  }, [deviceFingerprint, sessionToken, connectionRetries]);

  // WebSocket event handlers (keeping from first version)
  useEffect(() => {
    const handleConnected = () => {
      console.log('🔌 WebSocket connected');
      setWsConnected(true);
    };

    const handleDisconnected = () => {
      console.log('📱 WebSocket disconnected');
      setWsConnected(false);
      setWsAuthenticated(false);
    };

    const handleAdminAuthenticated = (data) => {
      console.log('🔑 Admin WebSocket authenticated:', data);
      setWsAuthenticated(true);
    };

    const handleAuthError = (error) => {
      console.error('❌ WebSocket auth error:', error);
      setWsAuthenticated(false);
    };

    const handleSecurityEvent = (event) => {
      console.log('🚨 Real-time security event:', event);
      setRealTimeEvents(prev => [event, ...prev.slice(0, 49)]);
      
      if (event.type === 'device_quarantined' || event.type === 'suspicious_device') {
        fetchSecurityData(false);
      }
    };

    const handleReportUpdate = (update) => {
      console.log('📋 Real-time report update:', update);
      setRealTimeEvents(prev => [
        { ...update, type: 'report_update', timestamp: new Date() },
        ...prev.slice(0, 49)
      ]);
    };

    const handleFemaleSafetyUpdate = (update) => {
      console.log('🌸 Female safety update:', update);
      setRealTimeEvents(prev => [
        { ...update, type: 'female_safety_update', timestamp: new Date() },
        ...prev.slice(0, 49)
      ]);
    };

    const handleSystemStats = (stats) => {
      setSystemStats(stats);
    };

    const handleEmergencyAlert = (alert) => {
      console.log('🚨 EMERGENCY ALERT:', alert);
      setRealTimeEvents(prev => [
        { ...alert, type: 'emergency_alert', timestamp: new Date() },
        ...prev.slice(0, 49)
      ]);
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('SafeStreets Emergency Alert', {
          body: alert.message,
          icon: '/favicon.ico'
        });
      }
    };

    const unsubscribeFunctions = [
      websocketService.on('connected', handleConnected),
      websocketService.on('disconnected', handleDisconnected),
      websocketService.on('admin_authenticated', handleAdminAuthenticated),
      websocketService.on('admin_auth_error', handleAuthError),
      websocketService.on('security_event', handleSecurityEvent),
      websocketService.on('report_update', handleReportUpdate),
      websocketService.on('female_safety_update', handleFemaleSafetyUpdate),
      websocketService.on('system_stats', handleSystemStats),
      websocketService.on('emergency_alert', handleEmergencyAlert)
    ];

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Initialize WebSocket when component mounts
  useEffect(() => {
    if (deviceFingerprint?.fingerprintId && sessionToken) {
      initializeWebSocket();
    }

    return () => {
      websocketService.disconnect();
    };
  }, [initializeWebSocket]);

  // Fetch security data from API
  const fetchSecurityData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      // Fetch security insights
      const insightsResponse = await apiService.getSecurityInsights();
      if (insightsResponse.success) {
        setSecurityInsights(insightsResponse.data);
      }

      // Fetch device fingerprints with pagination and filters
      const devicesResponse = await apiService.getDeviceFingerprints({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: searchTerm,
        ...filters
      });
      if (devicesResponse.success) {
        setDeviceFingerprints(devicesResponse.devices || []);
        setPagination(prev => ({
          ...prev,
          totalItems: devicesResponse.total || 0
        }));
      }

      // Fetch threat analysis (enhanced to include geographic threats)
      const threatsResponse = await apiService.getAreaAnalysis();
      if (threatsResponse.success) {
        // Extract threat data from nested structure
        const incidentsData = threatsResponse.data?.analysis?.incidents || {};
        setThreatAnalysis({
          coordinatedAttacks: incidentsData.coordinatedAttacks || [],
          crossBorderThreats: incidentsData.crossBorderThreats || [],
          // Ensure backward compatibility
          geographicThreats: incidentsData.coordinatedAttacks || [],
          suspiciousPatterns: incidentsData.crossBorderThreats || []
        });
      } else {
        // Set empty arrays to prevent crashes
        setThreatAnalysis({
          coordinatedAttacks: [],
          crossBorderThreats: [],
          geographicThreats: [],
          suspiciousPatterns: []
        });
      }

      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching security data:', err);
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.itemsPerPage, searchTerm]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        fetchSecurityData(false);
      }, 60000);
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, fetchSecurityData]);

  // Initial data load
  useEffect(() => {
    fetchSecurityData(true);
  }, [fetchSecurityData]);

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setPagination(prev => ({
      ...prev,
      currentPage: 1
    }));
  };

  // Handle device quarantine
  const handleDeviceQuarantine = async (deviceId, quarantine, reason = '') => {
    try {
      const response = await apiService.quarantineDevice(deviceId, quarantine, reason);
      if (response.success) {
        console.log(`Device ${quarantine ? 'quarantined' : 'released'} successfully`);
      }
    } catch (error) {
      console.error('Error updating device quarantine:', error);
      setError(error.message);
    }
  };

  // Handle device selection
  const handleDeviceSelect = (deviceId) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedDevices.length === deviceFingerprints.length) {
      setSelectedDevices([]);
    } else {
      setSelectedDevices(deviceFingerprints.map(device => device._id));
    }
  };

  // Bulk quarantine action
  const handleBulkQuarantine = async (quarantine) => {
    try {
      const promises = selectedDevices.map(deviceId => 
        apiService.quarantineDevice(deviceId, quarantine, 'Bulk action')
      );
      await Promise.all(promises);
      setSelectedDevices([]);
      console.log(`${selectedDevices.length} devices ${quarantine ? 'quarantined' : 'released'}`);
    } catch (error) {
      console.error('Error in bulk quarantine:', error);
      setError(error.message);
    }
  };

  // Export functions (added from second version)
  const handleExportSecurityReport = async () => {
    try {
      console.log('Exporting security report...');
      // Implementation would call API to generate and download report
      const response = await apiService.exportSecurityReport({
        timeRange: filters.timeRange,
        includeDevices: true,
        includeThreats: true,
        format: 'pdf'
      });
      
      if (response.success) {
        // Trigger download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.download = `security-report-${new Date().toISOString().split('T')[0]}.pdf`;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting security report:', error);
      setError('Failed to export security report');
    }
  };

  const handleGenerateThreatAssessment = async () => {
    try {
      console.log('Generating threat assessment...');
      const response = await apiService.generateThreatAssessment();
      if (response.success) {
        // Could open in new tab or trigger download
        window.open(response.data.reportUrl, '_blank');
      }
    } catch (error) {
      console.error('Error generating threat assessment:', error);
      setError('Failed to generate threat assessment');
    }
  };

  // Utility functions
  const getDeviceTypeIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4 text-neutral-400" />;
      case 'tablet': return <Tablet className="w-4 h-4 text-neutral-400" />;
      case 'desktop': return <Monitor className="w-4 h-4 text-neutral-400" />;
      default: return <Monitor className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'very_low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getThreatSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-800';
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  // Views configuration
  const views = [
    { id: 'overview', label: 'Security Overview', icon: Shield },
    { id: 'devices', label: 'Device Management', icon: Smartphone },
    { id: 'threats', label: 'Threat Analysis', icon: AlertTriangle },
    { id: 'realtime', label: 'Real-Time Monitor', icon: Activity },
    { id: 'analytics', label: 'Security Analytics', icon: TrendingUp }
  ];

  // Connection status indicator
  const getConnectionStatus = () => {
    if (wsConnected && wsAuthenticated) {
      return { status: 'connected', color: 'text-green-600', icon: Wifi, label: 'Live' };
    } else if (wsConnected) {
      return { status: 'authenticating', color: 'text-yellow-600', icon: Clock, label: 'Connecting' };
    } else {
      return { status: 'disconnected', color: 'text-red-600', icon: WifiOff, label: 'Offline' };
    }
  };

  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;

  if (loading && deviceFingerprints.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-20">
          <div className="loading-spinner w-8 h-8"></div>
          <span className="ml-3 text-neutral-600">Loading security dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Real-Time Status */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">
            Security Monitoring Dashboard
          </h2>
          <div className="flex items-center space-x-4 text-sm text-neutral-600">
            <span>Last updated {lastRefresh.toLocaleTimeString()}</span>
            <div className={`flex items-center space-x-1 ${connectionStatus.color}`}>
              <ConnectionIcon className="w-4 h-4" />
              <span>{connectionStatus.label}</span>
            </div>
            {wsAuthenticated && (
              <span className="text-green-600">
                • Real-time monitoring active
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          <label className="flex items-center text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          
          <button
            onClick={() => fetchSecurityData(false)}
            className="btn-outline btn-sm flex items-center"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {!wsConnected && (
            <button
              onClick={initializeWebSocket}
              className="btn-secondary btn-sm flex items-center"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger">
          <AlertTriangle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Real-Time Alerts */}
      {realTimeEvents.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-800">Latest Security Events</h3>
            <button
              onClick={() => setRealTimeEvents([])}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear
            </button>
          </div>
          <div className="space-y-1">
            {realTimeEvents.slice(0, 3).map((event, index) => (
              <div key={index} className="text-sm text-blue-700">
                <span className="font-medium">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                {' - '}
                <span>{event.message || event.details?.message || `${event.type} event`}</span>
              </div>
            ))}
            {realTimeEvents.length > 3 && (
              <div className="text-sm text-blue-600">
                +{realTimeEvents.length - 3} more events in Real-Time Monitor
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="border-b border-neutral-200">
        <nav className="flex space-x-8">
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeView === view.id
                    ? 'border-bangladesh-green text-bangladesh-green'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span>{view.label}</span>
                  {view.id === 'realtime' && realTimeEvents.length > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px]">
                      {realTimeEvents.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* View Content */}
      <div className="min-h-[600px]">
        {activeView === 'overview' && (
          <SecurityOverview 
            securityInsights={securityInsights}
            threatAnalysis={threatAnalysis}
            systemStats={systemStats}
            wsConnected={wsAuthenticated}
          />
        )}
        
        {activeView === 'devices' && (
          <DeviceManagement
            devices={deviceFingerprints}
            filters={filters}
            onFilterChange={handleFilterChange}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedDevices={selectedDevices}
            onDeviceSelect={handleDeviceSelect}
            onSelectAll={handleSelectAll}
            onQuarantine={handleDeviceQuarantine}
            onBulkQuarantine={handleBulkQuarantine}
            pagination={pagination}
            onPageChange={(page) => setPagination(prev => ({ ...prev, currentPage: page }))}
          />
        )}
        
        {activeView === 'threats' && (
          <ThreatAnalysis 
            threatData={threatAnalysis}
            onExportReport={handleExportSecurityReport}
            onGenerateAssessment={handleGenerateThreatAssessment}
          />
        )}
        
        {activeView === 'realtime' && (
          <RealTimeMonitor 
            events={realTimeEvents}
            wsConnected={wsAuthenticated}
            systemStats={systemStats}
            onClearEvents={() => setRealTimeEvents([])}
          />
        )}
        
        {activeView === 'analytics' && (
          <SecurityAnalytics 
            securityInsights={securityInsights}
            threatAnalysis={threatAnalysis}
            onExportReport={handleExportSecurityReport}
            onGenerateAssessment={handleGenerateThreatAssessment}
          />
        )}
      </div>
    </div>
  );
};

// Enhanced Security Overview Component
const SecurityOverview = ({ securityInsights, threatAnalysis, systemStats, wsConnected }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Security Metrics */}
      <div className="space-y-6">
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {securityInsights.totalDevices}
                </div>
                <div className="text-sm text-neutral-600">Total Devices</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {securityInsights.activeThreats}
                </div>
                <div className="text-sm text-neutral-600">Active Threats</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {securityInsights.quarantinedDevices}
                </div>
                <div className="text-sm text-neutral-600">Quarantined</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                {(securityInsights?.trustScoreAverage || 0).toFixed(1)}
                </div>
                <div className="text-sm text-neutral-600">Avg Trust Score</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Risk Distribution</h3>
            <div className="space-y-3">
              {Object.entries(securityInsights.riskDistribution || {}).map(([level, count]) => (
                <div key={level} className="flex items-center justify-between">
                  <span className="capitalize text-sm">{level.replace('_', ' ')}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          level === 'critical' ? 'bg-red-500' :
                          level === 'high' ? 'bg-orange-500' :
                          level === 'medium' ? 'bg-yellow-500' :
                          level === 'low' ? 'bg-blue-500' :
                          'bg-green-500'
                        }`}
                        style={{ 
                          width: `${securityInsights?.totalDevices ? (count / securityInsights.totalDevices) * 100 : 0}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Status and Recent Events */}
      <div className="space-y-6">
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">System Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">WebSocket Connection</span>
                <div className={`flex items-center space-x-2 ${wsConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {wsConnected ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {wsConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Server Uptime</span>
                <span className="text-sm font-medium">
                  {Math.floor(systemStats.serverUptime / 3600)}h {Math.floor((systemStats.serverUptime % 3600) / 60)}m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Active Connections</span>
                <span className="text-sm font-medium">{systemStats.activeConnections || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Memory Usage</span>
                <span className="text-sm font-medium">
                  {systemStats.memoryUsage?.rss ? 
                    `${Math.round(systemStats.memoryUsage.rss / 1024 / 1024)}MB` : 
                    'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Recent Threats</h3>
            <div className="space-y-3">
              {threatAnalysis.coordinatedAttacks.slice(0, 5).map((threat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium text-red-800">{threat.type}</div>
                    <div className="text-sm text-red-600">{threat.description}</div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    threat.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    threat.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {threat.severity}
                  </div>
                </div>
              ))}
              {threatAnalysis.coordinatedAttacks.length === 0 && (
                <div className="text-center py-4 text-neutral-500">
                  No active threats detected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Device Management Component
const DeviceManagement = ({ 
  devices, filters, onFilterChange, searchTerm, onSearchChange,
  selectedDevices, onDeviceSelect, onSelectAll, onQuarantine, onBulkQuarantine,
  pagination, onPageChange 
}) => {
  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="card">
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex space-x-3">
              <select 
                value={filters.riskLevel}
                onChange={(e) => onFilterChange('riskLevel', e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="very_low">Very Low</option>
              </select>
              
              <select 
                value={filters.quarantineStatus}
                onChange={(e) => onFilterChange('quarantineStatus', e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green"
              >
                <option value="all">All Devices</option>
                <option value="quarantined">Quarantined</option>
                <option value="active">Active</option>
              </select>

              <select 
                value={filters.country}
                onChange={(e) => onFilterChange('country', e.target.value)}
                className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-bangladesh-green"
              >
                <option value="all">All Countries</option>
                <option value="BD">Bangladesh</option>
                <option value="IN">India</option>
                <option value="PK">Pakistan</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          
          {selectedDevices.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-800 font-medium">
                {selectedDevices.length} device(s) selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => onBulkQuarantine(true)}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  Quarantine Selected
                </button>
                <button
                  onClick={() => onBulkQuarantine(false)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  Release Selected
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Device List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDevices.length === devices.length && devices.length > 0}
                    onChange={onSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Device</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Risk Level</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Trust Score</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Last Seen</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {devices.map((device) => (
                <tr key={device._id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDevices.includes(device._id)}
                      onChange={() => onDeviceSelect(device._id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {device.deviceSignature?.deviceType === 'mobile' ? (
                        <Smartphone className="w-4 h-4 text-neutral-400" />
                      ) : device.deviceSignature?.deviceType === 'tablet' ? (
                        <Tablet className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <Monitor className="w-4 h-4 text-neutral-400" />
                      )}
                      <div>
                        <div className="font-medium text-neutral-800">
                          {device.fingerprintId.slice(0, 12)}...
                        </div>
                        <div className="text-sm text-neutral-500">
                          {device.deviceSignature?.deviceType || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      device.securityProfile?.securityRiskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                      device.securityProfile?.securityRiskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                      device.securityProfile?.securityRiskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      device.securityProfile?.securityRiskLevel === 'low' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {device.securityProfile?.securityRiskLevel || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            (device.securityProfile?.overallTrustScore || 0) >= 80 ? 'bg-green-500' :
                            (device.securityProfile?.overallTrustScore || 0) >= 60 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${device.securityProfile?.overallTrustScore || 0}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {device.securityProfile?.overallTrustScore || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-1 text-sm text-neutral-600">
                      <MapPin className="w-3 h-3" />
                      <span>{device.geoLocation?.country || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {device.securityProfile?.quarantineStatus ? (
                      <span className="flex items-center space-x-1 text-red-600">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm">Quarantined</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-green-600">
                        <Unlock className="w-4 h-4" />
                        <span className="text-sm">Active</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {device.lastSeen ? new Date(device.lastSeen).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onQuarantine(
                        device._id, 
                        !device.securityProfile?.quarantineStatus,
                        device.securityProfile?.quarantineStatus ? '' : 'Manual quarantine'
                      )}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        device.securityProfile?.quarantineStatus
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {device.securityProfile?.quarantineStatus ? 'Release' : 'Quarantine'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {devices.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              No devices found matching the current filters.
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalItems > pagination.itemsPerPage && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-600">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} devices
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="px-3 py-2 border border-neutral-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage * pagination.itemsPerPage >= pagination.totalItems}
              className="px-3 py-2 border border-neutral-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Threat Analysis Component
const ThreatAnalysis = ({ threatData, onExportReport, onGenerateAssessment }) => {
  return (
    <div className="space-y-6">
      {/* Coordinated Attacks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Coordinated Attacks</h3>
            <div className="space-y-3">
              {threatData.coordinatedAttacks.map((attack, index) => (
                <div key={index} className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-800">{attack.type}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      attack.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      attack.severity === 'high' ? 'bg-orange-200 text-orange-800' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>
                      {attack.severity}
                    </span>
                  </div>
                  <p className="text-sm text-red-700 mt-2">{attack.description}</p>
                  <div className="text-xs text-red-600 mt-2">
                    Devices involved: {attack.deviceCount || 0}
                  </div>
                </div>
              ))}
              {threatData.coordinatedAttacks.length === 0 && (
                <div className="text-center py-8 text-neutral-500">
                  No coordinated attacks detected
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Cross-Border Threats</h3>
            <div className="space-y-3">
              {threatData.crossBorderThreats.map((threat, index) => (
                <div key={index} className="p-4 border border-orange-200 rounded-lg bg-orange-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-orange-800">{threat.country}</span>
                    <span className="text-sm text-orange-600">{threat.attempts} attempts</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">{threat.description}</p>
                </div>
              ))}
              {threatData.crossBorderThreats.length === 0 && (
                <div className="text-center py-8 text-neutral-500">
                  No cross-border threats detected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Geographic Threats (from second version) */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Geographic Threat Analysis</h3>
          {threatData.geographicThreats && threatData.geographicThreats.length > 0 ? (
            <div className="space-y-4">
              {threatData.geographicThreats.map((threat, index) => (
                <div key={index} className="border border-neutral-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Flag className="w-5 h-5 mr-2 text-orange-600" />
                      <div>
                        <h4 className="font-medium text-neutral-800">{threat.location}</h4>
                        <p className="text-sm text-neutral-600">{threat.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-neutral-500">Reports: {threat.reportCount}</div>
                      <div className="text-sm text-neutral-500">Risk: {threat.riskLevel}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-8">No geographic threats detected</p>
          )}
        </div>
      </div>

      {/* Suspicious Patterns */}
      <div className="card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-neutral-800">Suspicious Behavior Patterns</h3>
            <div className="flex space-x-2">
              <button
                onClick={onExportReport}
                className="btn-outline btn-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                Export Report
              </button>
              <button
                onClick={onGenerateAssessment}
                className="btn-outline btn-sm flex items-center"
              >
                <Shield className="w-4 h-4 mr-1" />
                Generate Assessment
              </button>
            </div>
          </div>
          {threatData.suspiciousPatterns && threatData.suspiciousPatterns.length > 0 ? (
            <div className="space-y-3">
              {threatData.suspiciousPatterns.map((pattern, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-3 text-yellow-600" />
                    <div>
                      <span className="text-sm font-medium text-neutral-800">{pattern.type}</span>
                      <p className="text-xs text-neutral-600">{pattern.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-neutral-500">Count: {pattern.occurrences}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(pattern.lastDetected).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-8">No suspicious patterns detected</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Real-Time Monitor Component
const RealTimeMonitor = ({ events, wsConnected, systemStats, onClearEvents }) => {
  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`card ${wsConnected ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {wsConnected ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${wsConnected ? 'text-green-800' : 'text-red-800'}`}>
                Real-Time Monitoring {wsConnected ? 'Active' : 'Inactive'}
              </span>
            </div>
            {events.length > 0 && (
              <button
                onClick={onClearEvents}
                className="text-sm text-neutral-600 hover:text-neutral-800"
              >
                Clear Events
              </button>
            )}
          </div>
          {wsConnected && (
            <div className="mt-2 text-sm text-green-700">
              Receiving live security events and system updates
            </div>
          )}
        </div>
      </div>

      {/* Event Stream */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">
            Live Event Stream ({events.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {events.map((event, index) => (
              <div 
                key={`${event.id || index}-${event.timestamp}`} 
                className="flex items-start space-x-3 p-3 bg-neutral-50 rounded-lg"
              >
                <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
                  event.severity === 'critical' || event.type === 'emergency_alert' ? 'bg-red-500' :
                  event.severity === 'high' ? 'bg-orange-500' :
                  event.severity === 'medium' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-800 capitalize">
                      {event.type?.replace(/_/g, ' ') || 'Security Event'}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600 mt-1">
                    {event.message || event.details?.message || 'Security event detected'}
                  </div>
                  {event.deviceFingerprint && (
                    <div className="text-xs text-neutral-500 mt-1">
                      Device: {event.deviceFingerprint.slice(0, 8)}...
                    </div>
                  )}
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                {wsConnected ? 
                  'No recent events. Real-time monitoring is active.' :
                  'Connect to WebSocket to see real-time events.'
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Security Analytics Component  
const SecurityAnalytics = ({ securityInsights, threatAnalysis, onExportReport, onGenerateAssessment }) => {
  return (
    <div className="space-y-6">
      {/* Time-based Security Metrics (from second version) */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Metrics Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
              {securityInsights?.totalDevices && securityInsights?.quarantinedDevices 
                  ? (((securityInsights.totalDevices - securityInsights.quarantinedDevices) / securityInsights.totalDevices * 100).toFixed(1))
                  : '0.0'}%
              </div>
              <div className="text-sm text-neutral-600">Clean Devices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {securityInsights.trustScoreAverage.toFixed(1)}
              </div>
              <div className="text-sm text-neutral-600">Average Trust Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {threatAnalysis.coordinatedAttacks.length}
              </div>
              <div className="text-sm text-neutral-600">Active Threats</div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Trends</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Device Security Score</span>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-600">+2.3%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Threat Detection Rate</span>
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-600">-5.1%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Response Time</span>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-600">+12.4%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-800 mb-4">Activity Summary</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Total Security Events</span>
                <span className="font-medium">{threatAnalysis.coordinatedAttacks.length + (threatAnalysis.crossBorderThreats?.length || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Devices Monitored</span>
                <span className="font-medium">{securityInsights.totalDevices}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">Average Response Time</span>
                <span className="font-medium">1.2s</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Event Timeline (from second version) */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Event Timeline</h3>
          <div className="space-y-4">
            {[
              { time: '2 hours ago', event: 'Cross-border attack detected', severity: 'high' },
              { time: '4 hours ago', event: 'Device quarantine threshold reached', severity: 'medium' },
              { time: '6 hours ago', event: 'Coordinated reporting campaign identified', severity: 'critical' },
              { time: '8 hours ago', event: 'Trust score baseline updated', severity: 'low' },
              { time: '12 hours ago', event: 'Geographic threat pattern analyzed', severity: 'medium' }
            ].map((event, index) => (
              <div key={index} className="flex items-center">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-neutral-300 mr-4"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-800">{event.event}</span>
                    <span className="text-xs text-neutral-500">{event.time}</span>
                  </div>
                  <div className={`text-xs font-medium ${
                    event.severity === 'critical' ? 'text-red-800' :
                    event.severity === 'high' ? 'text-red-600' :
                    event.severity === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {event.severity.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export and Actions (from second version) */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Report Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onExportReport}
              className="btn-outline flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Security Report
            </button>
            <button
              onClick={onGenerateAssessment}
              className="btn-outline flex items-center"
            >
              <Shield className="w-4 h-4 mr-2" />
              Generate Threat Assessment
            </button>
            <button
              onClick={() => console.log('Clear quarantine queue')}
              className="btn-outline flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear Quarantine Queue
            </button>
            <button
              onClick={() => console.log('Generate analytics report')}
              className="btn-outline flex items-center"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;