// === Updated src/pages/MapPage.jsx ===
import { useState, useEffect } from 'react'
import { Filter, Search, MapPin, RefreshCw } from 'lucide-react'
import MapView from '../components/Map/MapView'
import MapLegend from '../components/Map/MapLegend'
import { useReports } from '../hooks/useReports'

function MapPage() {
  const { reports, loading, error, refetch } = useReports()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  // Filter reports based on search and filter
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === '' || 
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.location.address?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = activeFilter === 'all' || report.type === activeFilter
    
    return matchesSearch && matchesFilter
  })

  const reportCounts = {
    total: reports.length,
    approved: reports.filter(r => r.status === 'approved').length,
    pending: reports.filter(r => r.status === 'pending').length
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="alert-danger">
            <h4 className="font-medium mb-2">Error Loading Map</h4>
            <p>{error}</p>
            <button onClick={refetch} className="btn-primary btn-sm mt-3">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="container-safe py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
                Crime Map
              </h1>
              <p className="text-neutral-600">
                Interactive map showing verified incidents across Bangladesh
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search reports..."
                  className="form-input pl-10 pr-4 w-full sm:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              </div>

              {/* Filter Dropdown */}
              <select
                className="form-select w-full sm:w-auto"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="chadabaji">Chadabaji</option>
                <option value="teen_gang">Teen Gangs</option>
                <option value="chintai">Chintai</option>
                <option value="other">Other</option>
              </select>

              {/* Refresh Button */}
              <button 
                onClick={refetch}
                className="btn-outline btn-sm flex items-center"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-safe py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <div className="card">
              <div className="card-body p-0">
                {loading ? (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="loading-spinner w-8 h-8"></div>
                    <span className="ml-3 text-neutral-600">Loading map...</span>
                  </div>
                ) : (
                  <div className="h-[500px] lg:h-[600px]">
                    <MapView reports={filteredReports} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Legend */}
            <MapLegend reportCounts={reportCounts} />

            {/* Quick Stats */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-bold text-neutral-800">Quick Stats</h3>
              </div>
              <div className="card-body">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-neutral-600">Showing:</span>
                    <span className="font-medium">{filteredReports.length} reports</span>
                  </div>
                  {searchTerm && (
                    <div className="text-sm text-neutral-500">
                      Filtered by: "{searchTerm}"
                    </div>
                  )}
                  {activeFilter !== 'all' && (
                    <div className="text-sm text-neutral-500">
                      Type: {activeFilter.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Report Button */}
            <div className="card">
              <div className="card-body text-center">
                <MapPin className="w-8 h-8 text-bangladesh-green mx-auto mb-3" />
                <h4 className="font-medium text-neutral-800 mb-2">
                  See an incident?
                </h4>
                <p className="text-sm text-neutral-600 mb-4">
                  Help your community by reporting it anonymously
                </p>
                <a href="/report" className="btn-secondary w-full">
                  Report Incident
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapPage