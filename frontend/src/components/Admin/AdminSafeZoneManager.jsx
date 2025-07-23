// === src/components/Admin/AdminSafeZoneManager.jsx ===
import { useState, useEffect, useCallback } from 'react'
import { 
  Shield, Plus, Search, Filter, MapPin, Eye, Edit, Trash2, 
  Download, Upload, RefreshCw, AlertTriangle, CheckCircle, 
  XCircle, Clock, MoreVertical, Map, Users, Star, Activity
} from 'lucide-react'
import SafeZoneEditor from './SafeZoneEditor'
import SafeZoneImporter from './SafeZoneImporter'
import apiService from '../../services/api'
import { handleApiError } from '../../services/utils/errorHandler'

const AdminSafeZoneManager = () => {
  const [safeZones, setSafeZones] = useState([])
  const [filteredZones, setFilteredZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Modal states
  const [showEditor, setShowEditor] = useState(false)
  const [showImporter, setShowImporter] = useState(false)
  const [editingZone, setEditingZone] = useState(null)
  const [selectedZones, setSelectedZones] = useState([])
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    pending: 0,
    avgSafetyScore: 0
  })

  // Fetch safe zones from admin API
  const fetchSafeZones = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiService.request('/safezones/admin/all')
      
      if (response.success) {
        setSafeZones(response.data)
        calculateStats(response.data)
      } else {
        const errorResponse = handleApiError(new Error(response.message), 'AdminSafeZoneManager')
        setError(errorResponse.userMessage || 'Failed to fetch safe zones')
      }
    } catch (err) {
      const errorResponse = handleApiError(err, 'AdminSafeZoneManager')
      setError(errorResponse.userMessage || 'Error fetching safe zones')
      console.error('Error fetching safe zones:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Calculate statistics
  const calculateStats = (zones) => {
    const total = zones.length
    const active = zones.filter(z => z.status === 'active').length
    const inactive = zones.filter(z => z.status === 'inactive').length
    const pending = zones.filter(z => z.status === 'pending').length
    const avgSafetyScore = zones.length > 0 
      ? zones.reduce((sum, z) => sum + (z.safetyScore || 0), 0) / zones.length 
      : 0

    setStats({ total, active, inactive, pending, avgSafetyScore })
  }

  // Filter and search zones
  useEffect(() => {
    let filtered = [...safeZones]

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(zone => 
        zone.name?.toLowerCase().includes(search) ||
        zone.description?.toLowerCase().includes(search) ||
        zone.address?.district?.toLowerCase().includes(search) ||
        zone.address?.upazila?.toLowerCase().includes(search) ||
        zone.category?.toLowerCase().includes(search)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(zone => zone.status === statusFilter)
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(zone => zone.zoneType === typeFilter)
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(zone => zone.category === categoryFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aVal = new Date(aVal)
        bVal = new Date(bVal)
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredZones(filtered)
  }, [safeZones, searchTerm, statusFilter, typeFilter, categoryFilter, sortBy, sortOrder])

  // Handle zone actions
  const handleEdit = (zone) => {
    setEditingZone(zone)
    setShowEditor(true)
  }

  const handleDelete = async (zoneId) => {
    if (!window.confirm('Are you sure you want to delete this safe zone?')) return

    try {
      const response = await apiService.request(`/safezones/admin/${zoneId}`, {
        method: 'DELETE'
      })

      if (response.success) {
        setSafeZones(prev => prev.filter(z => z._id !== zoneId))
      } else {
        const errorResponse = handleApiError(new Error(response.message), 'AdminSafeZoneManager')
        setError(errorResponse.userMessage || 'Failed to delete safe zone')
      }
    } catch (err) {
      const errorResponse = handleApiError(err, 'AdminSafeZoneManager')
      setError(errorResponse.userMessage || 'Error deleting safe zone')
    }
  }

  const handleStatusChange = async (zoneId, newStatus) => {
    try {
      const response = await apiService.request(`/safezones/admin/${zoneId}/status`, {
        method: 'PUT',
        body: { status: newStatus }
      })

      if (response.success) {
        setSafeZones(prev => prev.map(z => 
          z._id === zoneId ? { ...z, status: newStatus } : z
        ))
      } else {
        const errorResponse = handleApiError(new Error(response.message), 'AdminSafeZoneManager')
        setError(errorResponse.userMessage || 'Failed to update status')
      }
    } catch (err) {
      const errorResponse = handleApiError(err, 'AdminSafeZoneManager')
      setError(errorResponse.userMessage || 'Error updating status')
    }
  }

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedZones.length === 0) return

    try {
      const response = await apiService.request('/safezones/admin/bulk/status', {
        method: 'PUT',
        body: { 
          zoneIds: selectedZones,
          status: newStatus 
        }
      })

      if (response.success) {
        setSafeZones(prev => prev.map(z => 
          selectedZones.includes(z._id) ? { ...z, status: newStatus } : z
        ))
        setSelectedZones([])
      } else {
        const errorResponse = handleApiError(new Error(response.message), 'AdminSafeZoneManager')
        setError(errorResponse.userMessage || 'Failed to update zones')
      }
    } catch (err) {
      const errorResponse = handleApiError(err, 'AdminSafeZoneManager')
      setError(errorResponse.userMessage || 'Error updating zones')
    }
  }

  // Initial load
  useEffect(() => {
    fetchSafeZones()
  }, [fetchSafeZones])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-safe-success" />
      case 'inactive': return <XCircle className="w-4 h-4 text-safe-danger" />
      case 'pending': return <Clock className="w-4 h-4 text-safe-warning" />
      default: return <AlertTriangle className="w-4 h-4 text-neutral-400" />
    }
  }

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium"
    switch (status) {
      case 'active':
        return `${baseClasses} bg-safe-success/10 text-safe-success border border-safe-success/20`
      case 'inactive':
        return `${baseClasses} bg-safe-danger/10 text-safe-danger border border-safe-danger/20`
      case 'pending':
        return `${baseClasses} bg-safe-warning/10 text-safe-warning border border-safe-warning/20`
      default:
        return `${baseClasses} bg-neutral-100 text-neutral-600 border border-neutral-200`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
        <span className="ml-3 text-neutral-600">Loading safe zones...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-safe-primary" />
            Safe Zone Management
          </h2>
          <p className="text-neutral-600 mt-1">
            Manage and monitor safe zones across Bangladesh
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImporter(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={() => setShowEditor(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Safe Zone
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Total Zones</p>
              <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
            </div>
            <Shield className="w-8 h-8 text-safe-primary" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Active</p>
              <p className="text-2xl font-bold text-safe-success">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-safe-success" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Inactive</p>
              <p className="text-2xl font-bold text-safe-danger">{stats.inactive}</p>
            </div>
            <XCircle className="w-8 h-8 text-safe-danger" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Pending</p>
              <p className="text-2xl font-bold text-safe-warning">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-safe-warning" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Avg Safety</p>
              <p className="text-2xl font-bold text-safe-primary">{stats.avgSafetyScore.toFixed(1)}</p>
            </div>
            <Star className="w-8 h-8 text-safe-primary" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search zones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
          >
            <option value="all">All Types</option>
            <option value="government">Government</option>
            <option value="educational">Educational</option>
            <option value="healthcare">Healthcare</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
            <option value="transport">Transport</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
          >
            <option value="all">All Categories</option>
            <option value="police_station">Police Station</option>
            <option value="hospital">Hospital</option>
            <option value="school">School</option>
            <option value="mosque">Mosque</option>
            <option value="market">Market</option>
            <option value="park">Park</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchSafeZones}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedZones.length > 0 && (
          <div className="mt-4 p-3 bg-safe-primary/5 border border-safe-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-safe-primary font-medium">
                {selectedZones.length} zones selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkStatusChange('active')}
                  className="px-3 py-1 bg-safe-success text-white rounded text-sm hover:bg-safe-success/90"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulkStatusChange('inactive')}
                  className="px-3 py-1 bg-safe-danger text-white rounded text-sm hover:bg-safe-danger/90"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => setSelectedZones([])}
                  className="px-3 py-1 bg-neutral-500 text-white rounded text-sm hover:bg-neutral-600"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-safe-danger/10 border border-safe-danger/20 text-safe-danger px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Safe Zones Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedZones.length === filteredZones.length && filteredZones.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedZones(filteredZones.map(z => z._id))
                      } else {
                        setSelectedZones([])
                      }
                    }}
                    className="rounded border-neutral-300 text-safe-primary focus:ring-safe-primary/20"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Zone</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Safety Score</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-700">Created</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredZones.map((zone) => (
                <tr key={zone._id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedZones.includes(zone._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedZones(prev => [...prev, zone._id])
                        } else {
                          setSelectedZones(prev => prev.filter(id => id !== zone._id))
                        }
                      }}
                      className="rounded border-neutral-300 text-safe-primary focus:ring-safe-primary/20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-neutral-900">{zone.name}</div>
                      <div className="text-sm text-neutral-500 truncate max-w-xs">
                        {zone.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-neutral-900">{zone.address?.district}</div>
                      <div className="text-neutral-500">{zone.address?.upazila}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="text-neutral-900 capitalize">{zone.zoneType}</div>
                      <div className="text-neutral-500 capitalize">{zone.category}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={getStatusBadge(zone.status)}>
                      {zone.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-safe-warning" />
                      <span className="text-sm font-medium">{zone.safetyScore?.toFixed(1) || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {new Date(zone.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(zone)}
                        className="p-1 text-neutral-400 hover:text-safe-primary"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(zone._id)}
                        className="p-1 text-neutral-400 hover:text-safe-danger"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="relative group">
                        <button className="p-1 text-neutral-400 hover:text-neutral-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-8 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-32 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => handleStatusChange(zone._id, zone.status === 'active' ? 'inactive' : 'active')}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50"
                          >
                            {zone.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredZones.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No safe zones found</h3>
            <p className="text-neutral-500">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by adding your first safe zone'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditor && (
        <SafeZoneEditor
          zone={editingZone}
          onClose={() => {
            setShowEditor(false)
            setEditingZone(null)
          }}
          onSave={() => {
            fetchSafeZones()
            setShowEditor(false)
            setEditingZone(null)
          }}
        />
      )}

      {showImporter && (
        <SafeZoneImporter
          onClose={() => setShowImporter(false)}
          onImport={() => {
            fetchSafeZones()
            setShowImporter(false)
          }}
        />
      )}
    </div>
  )
}

export default AdminSafeZoneManager
