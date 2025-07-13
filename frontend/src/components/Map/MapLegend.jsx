// === src/components/Map/MapLegend.jsx ===
import { Shield, MapPin, AlertTriangle } from 'lucide-react'

const MapLegend = ({ reportCounts = { total: 0, approved: 0, pending: 0 } }) => {
  return (
    <div className="bg-white rounded-lg shadow-medium p-4 border border-neutral-200">
      <h3 className="font-bold text-neutral-800 mb-4 flex items-center">
        <MapPin className="w-5 h-5 mr-2 text-bangladesh-green" />
        Map Legend
      </h3>
      
      {/* Severity Legend */}
      <div className="mb-4">
        <h4 className="font-medium text-neutral-700 mb-2">Severity Levels</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-3"></div>
            <span className="text-sm text-neutral-600">Critical (Level 4-5)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-500 rounded-full mr-3"></div>
            <span className="text-sm text-neutral-600">High (Level 4)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-500 rounded-full mr-3"></div>
            <span className="text-sm text-neutral-600">Medium (Level 3)</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
            <span className="text-sm text-neutral-600">Low (Level 1-2)</span>
          </div>
        </div>
      </div>

      {/* Incident Types */}
      <div className="mb-4">
        <h4 className="font-medium text-neutral-700 mb-2">Incident Types</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            <span className="text-lg mr-3">💰</span>
            <span className="text-sm text-neutral-600">Chadabaji (Extortion)</span>
          </div>
          <div className="flex items-center">
            <span className="text-lg mr-3">👥</span>
            <span className="text-sm text-neutral-600">Teen Gang Activity</span>
          </div>
          <div className="flex items-center">
            <span className="text-lg mr-3">⚠️</span>
            <span className="text-sm text-neutral-600">Chintai (Harassment)</span>
          </div>
          <div className="flex items-center">
            <span className="text-lg mr-3">🚨</span>
            <span className="text-sm text-neutral-600">Other Incidents</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="border-t border-neutral-200 pt-4">
        <h4 className="font-medium text-neutral-700 mb-2">Current Statistics</h4>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Total Reports:</span>
            <span className="font-medium">{reportCounts.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Public:</span>
            <span className="font-medium text-green-600">{reportCounts.approved}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-neutral-600">Under Review:</span>
            <span className="font-medium text-orange-600">{reportCounts.pending}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapLegend