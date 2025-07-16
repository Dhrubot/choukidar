// === frontend/src/components/Admin/SecurityDashboard.jsx ===
// Security Monitoring Dashboard Component for SafeStreets Bangladesh
// Provides real-time security monitoring, threat analysis, and device management
// Integrates with existing security backend infrastructure

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
  Unlock
} from 'lucide-react';
import apiService from '../../services/api';

/**
 * SecurityDashboard Component
 * Main security monitoring interface for administrators
 * Features: Real-time threat detection, device management, security analytics
 */
const SecurityDashboard = () => {
  // State management
  const [activeView, setActiveView] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const refreshInterval = useRef(null);

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
    suspiciousPatterns: [],
    geographicThreats: []
  });

  // Filters and pagination
  const [filters, setFilters] = useState({
    riskLevel: 'all',
    deviceType: 'all',
    quarantined: 'all',
    country: 'all',
    timeRange: '24h'
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0
  });

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevices, setSelectedDevices] = useState([]);

  // Data fetching functions
  const fetchSecurityData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      
      // Fetch security insights
      const insightsResponse = await apiService.getSecurityInsights();
      if (insightsResponse.success) {
        setSecurityInsights(insightsResponse.data);
      }

      // Fetch device fingerprints with filters
      const devicesResponse = await apiService.getDeviceFingerprints({
        ...filters,
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        search: searchTerm
      });
      
      if (devicesResponse.success) {
        setDeviceFingerprints(devicesResponse.data.devices);
        setPagination(prev => ({
          ...prev,
          totalItems: devicesResponse.data.total
        }));
      }

      // Fetch threat analysis
      const threatsResponse = await apiService.detectCoordinatedAttacks();
      if (threatsResponse.success) {
        setThreatAnalysis(threatsResponse.data);
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
      }, 30000); // Refresh every 30 seconds
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
        // Refresh data
        fetchSecurityData(false);
        // Show success notification
        console.log(`Device ${quarantine ? 'quarantined' : 'released'} successfully`);
      }
    } catch (err) {
      console.error('Error updating device quarantine:', err);
      setError(err.message);
    }
  };

  // Handle bulk quarantine
  const handleBulkQuarantine = async (quarantine, reason = '') => {
    try {
      const response = await apiService.bulkQuarantine(selectedDevices, quarantine, reason);
      if (response.success) {
        setSelectedDevices([]);
        fetchSecurityData(false);
        console.log(`${selectedDevices.length} devices processed successfully`);
      }
    } catch (err) {
      console.error('Error bulk quarantining devices:', err);
      setError(err.message);
    }
  };

  // Get device type icon
  const getDeviceTypeIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-4 h-4" />;
      case 'tablet': return <Tablet className="w-4 h-4" />;
      case 'desktop': return <Monitor className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  // Get risk level color
  const getRiskLevelColor = (riskLevel) => {
    switch (riskLevel) {
      case 'very_low': return 'text-green-600 bg-green-100';
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      case 'critical': return 'text-red-800 bg-red-200';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Get threat severity color
  const getThreatSeverityColor = (severity) => {
    switch (severity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      case 'critical': return 'text-red-800';
      default: return 'text-gray-600';
    }
  };

  // Handle checkbox selection
  const handleDeviceSelection = (deviceId) => {
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

  // Views configuration
  const views = [
    { id: 'overview', label: 'Security Overview', icon: Shield },
    { id: 'devices', label: 'Device Management', icon: Smartphone },
    { id: 'threats', label: 'Threat Analysis', icon: AlertTriangle },
    { id: 'analytics', label: 'Security Analytics', icon: TrendingUp }
  ];

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
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 mb-2">
            Security Monitoring Dashboard
          </h2>
          <p className="text-neutral-600">
            Real-time security monitoring and threat analysis • Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 lg:mt-0">
          <label className="flex items-center text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh (30s)
          </label>
          
          <button
            onClick={() => fetchSecurityData(false)}
            className="btn-outline btn-sm flex items-center"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-danger">
          <AlertTriangle className="w-5 h-5" />
          <span>Error: {error}</span>
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
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeView === view.id
                    ? 'border-bangladesh-green text-bangladesh-green'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <div className="flex items-center">
                  <Icon className="w-4 h-4 mr-2" />
                  {view.label}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Security Overview */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Security Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-neutral-600">Total Devices</p>
                  <p className="text-2xl font-bold text-neutral-800">{securityInsights.totalDevices}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-neutral-600">Active Threats</p>
                  <p className="text-2xl font-bold text-red-600">{securityInsights.activeThreats}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-neutral-600">Quarantined</p>
                  <p className="text-2xl font-bold text-yellow-600">{securityInsights.quarantinedDevices}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Ban className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-neutral-600">Cross-Border</p>
                  <p className="text-2xl font-bold text-orange-600">{securityInsights.crossBorderAttacks}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Globe className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Risk Distribution Chart */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Risk Level Distribution</h3>
              <div className="space-y-3">
                {Object.entries(securityInsights.riskDistribution).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`inline-block w-3 h-3 rounded-full mr-3 ${getRiskLevelColor(level).replace('text-', 'bg-').replace('bg-', 'bg-')}`}></span>
                      <span className="text-sm font-medium text-neutral-700 capitalize">{level.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-neutral-600 mr-2">{count}</span>
                      <div className="w-24 bg-neutral-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getRiskLevelColor(level).replace('text-', 'bg-').replace('bg-', 'bg-')}`}
                          style={{ width: `${(count / securityInsights.totalDevices) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Security Events */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Recent Security Events</h3>
              <div className="space-y-3">
                {threatAnalysis.suspiciousPatterns.slice(0, 5).map((pattern, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                    <div className="flex items-center">
                      <AlertTriangle className={`w-4 h-4 mr-3 ${getThreatSeverityColor(pattern.severity)}`} />
                      <span className="text-sm text-neutral-700">{pattern.description}</span>
                    </div>
                    <span className="text-xs text-neutral-500">{new Date(pattern.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Management */}
      {activeView === 'devices' && (
        <div className="space-y-6">
          {/* Filters and Search */}
          <div className="card">
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search devices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-input pl-10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <select
                    value={filters.riskLevel}
                    onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                    className="form-select"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  
                  <select
                    value={filters.deviceType}
                    onChange={(e) => handleFilterChange('deviceType', e.target.value)}
                    className="form-select"
                  >
                    <option value="all">All Device Types</option>
                    <option value="mobile">Mobile</option>
                    <option value="desktop">Desktop</option>
                    <option value="tablet">Tablet</option>
                  </select>
                  
                  <select
                    value={filters.quarantined}
                    onChange={(e) => handleFilterChange('quarantined', e.target.value)}
                    className="form-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="true">Quarantined</option>
                    <option value="false">Active</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedDevices.length > 0 && (
            <div className="card">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-600">
                    {selectedDevices.length} devices selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkQuarantine(true, 'Bulk quarantine action')}
                      className="btn-sm bg-yellow-600 text-white hover:bg-yellow-700"
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Quarantine Selected
                    </button>
                    <button
                      onClick={() => handleBulkQuarantine(false, 'Bulk release action')}
                      className="btn-sm bg-green-600 text-white hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Release Selected
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Device List */}
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left p-4">
                      <input
                        type="checkbox"
                        checked={selectedDevices.length === deviceFingerprints.length}
                        onChange={handleSelectAll}
                        className="form-checkbox"
                      />
                    </th>
                    <th className="text-left p-4 font-medium text-neutral-700">Device</th>
                    <th className="text-left p-4 font-medium text-neutral-700">Trust Score</th>
                    <th className="text-left p-4 font-medium text-neutral-700">Risk Level</th>
                    <th className="text-left p-4 font-medium text-neutral-700">Location</th>
                    <th className="text-left p-4 font-medium text-neutral-700">Status</th>
                    <th className="text-left p-4 font-medium text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceFingerprints.map((device) => (
                    <tr key={device._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedDevices.includes(device._id)}
                          onChange={() => handleDeviceSelection(device._id)}
                          className="form-checkbox"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          {getDeviceTypeIcon(device.deviceSignature?.deviceType)}
                          <div className="ml-3">
                            <div className="font-medium text-neutral-800 text-sm">
                              {device.fingerprintId.substring(0, 8)}...
                            </div>
                            <div className="text-xs text-neutral-500">
                              {device.deviceSignature?.deviceType || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center">
                          <div className="w-12 bg-neutral-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                device.securityProfile?.trustScore > 70 ? 'bg-green-500' :
                                device.securityProfile?.trustScore > 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${device.securityProfile?.trustScore || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-neutral-700">
                            {device.securityProfile?.trustScore || 0}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          getRiskLevelColor(device.securityProfile?.riskLevel || 'medium')
                        }`}>
                          {device.securityProfile?.riskLevel || 'Medium'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-sm text-neutral-600">
                          <MapPin className="w-3 h-3 mr-1" />
                          {device.geoLocation?.country || 'Unknown'}
                        </div>
                      </td>
                      <td className="p-4">
                        {device.securityProfile?.quarantineStatus ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Ban className="w-3 h-3 mr-1" />
                            Quarantined
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeviceQuarantine(
                              device._id,
                              !device.securityProfile?.quarantineStatus,
                              device.securityProfile?.quarantineStatus ? 'Manual release' : 'Manual quarantine'
                            )}
                            className={`btn-sm ${
                              device.securityProfile?.quarantineStatus 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'bg-yellow-600 hover:bg-yellow-700'
                            } text-white`}
                          >
                            {device.securityProfile?.quarantineStatus ? (
                              <Unlock className="w-3 h-3" />
                            ) : (
                              <Lock className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} devices
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                disabled={pagination.currentPage === 1}
                className="btn-outline btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                disabled={pagination.currentPage * pagination.itemsPerPage >= pagination.totalItems}
                className="btn-outline btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threat Analysis */}
      {activeView === 'threats' && (
        <div className="space-y-6">
          {/* Coordinated Attacks */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Coordinated Attack Detection</h3>
              {threatAnalysis.coordinatedAttacks.length > 0 ? (
                <div className="space-y-4">
                  {threatAnalysis.coordinatedAttacks.map((attack, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-red-800">{attack.type}</h4>
                        <span className="text-sm text-neutral-500">{new Date(attack.detectedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-neutral-600 mt-1">{attack.description}</p>
                      <div className="flex items-center mt-2 text-sm text-neutral-500">
                        <span className="mr-4">Devices: {attack.deviceCount}</span>
                        <span className="mr-4">Severity: {attack.severity}</span>
                        <span>Pattern: {attack.pattern}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-neutral-500 text-center py-8">No coordinated attacks detected</p>
              )}
            </div>
          </div>

          {/* Geographic Threats */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Geographic Threat Analysis</h3>
              {threatAnalysis.geographicThreats.length > 0 ? (
                <div className="space-y-4">
                  {threatAnalysis.geographicThreats.map((threat, index) => (
                    <div key={index} className="border border-neutral-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Flag className={`w-5 h-5 mr-2 ${getThreatSeverityColor(threat.severity)}`} />
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
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Suspicious Behavior Patterns</h3>
              {threatAnalysis.suspiciousPatterns.length > 0 ? (
                <div className="space-y-3">
                  {threatAnalysis.suspiciousPatterns.map((pattern, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-neutral-100 last:border-0">
                      <div className="flex items-center">
                        <AlertTriangle className={`w-4 h-4 mr-3 ${getThreatSeverityColor(pattern.severity)}`} />
                        <div>
                          <span className="text-sm font-medium text-neutral-800">{pattern.type}</span>
                          <p className="text-xs text-neutral-600">{pattern.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-neutral-500">Count: {pattern.occurrences}</div>
                        <div className="text-xs text-neutral-500">{new Date(pattern.lastDetected).toLocaleString()}</div>
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
      )}

      {/* Security Analytics */}
      {activeView === 'analytics' && (
        <div className="space-y-6">
          {/* Time-based Security Metrics */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Metrics Over Time</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {((securityInsights.totalDevices - securityInsights.quarantinedDevices) / securityInsights.totalDevices * 100).toFixed(1)}%
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

          {/* Security Event Timeline */}
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
                      <div className={`text-xs font-medium ${getThreatSeverityColor(event.severity)}`}>
                        {event.severity.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export and Actions */}
          <div className="card">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-800 mb-4">Security Report Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => console.log('Export security report')}
                  className="btn-outline flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Security Report
                </button>
                <button
                  onClick={() => console.log('Generate threat assessment')}
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
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;