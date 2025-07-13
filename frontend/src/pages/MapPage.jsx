// === src/pages/MapPage.jsx ===
import { useState } from 'react'
import { Filter, Search, MapPin } from 'lucide-react'

function MapPage() {
  const [activeFilter, setActiveFilter] = useState('all')

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="container-safe py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
                Crime Map
              </h1>
              <p className="text-neutral-600">
                Interactive map showing reported incidents across Bangladesh
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button className="btn-outline btn-sm">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
              <button className="btn-ghost btn-sm">
                <Search className="w-4 h-4 mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-96 md:h-[600px] bg-neutral-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-600 mb-2">
              Interactive Map Coming Soon
            </h3>
            <p className="text-neutral-500">
              Leaflet.js integration will be added in the next phase
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border-t border-neutral-200">
        <div className="container-safe py-6">
          <h3 className="font-medium text-neutral-800 mb-4">Incident Types</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-safe-secondary rounded-full"></div>
              <span className="text-sm text-neutral-600">Chadabaji</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-safe-warning rounded-full"></div>
              <span className="text-sm text-neutral-600">Teen Gangs</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-safe-info rounded-full"></div>
              <span className="text-sm text-neutral-600">Chintai</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-neutral-400 rounded-full"></div>
              <span className="text-sm text-neutral-600">Other</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapPage