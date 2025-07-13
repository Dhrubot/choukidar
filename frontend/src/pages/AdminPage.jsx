// === src/pages/AdminPage.jsx ===
import { useState } from 'react'
import { Shield, Users, TrendingUp, Clock } from 'lucide-react'

function AdminPage() {
  const [stats] = useState({
    total: 45,
    pending: 12,
    approved: 28,
    rejected: 5
  })

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container-safe">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-4">
            Admin Dashboard
          </h1>
          <p className="text-neutral-600">
            Manage and moderate community reports
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="card-body text-center">
              <div className="bg-neutral-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-neutral-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.total}</h3>
              <p className="text-neutral-600 text-sm">Total Reports</p>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="bg-orange-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.pending}</h3>
              <p className="text-neutral-600 text-sm">Pending</p>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.approved}</h3>
              <p className="text-neutral-600 text-sm">Approved</p>
            </div>
          </div>
          
          <div className="card">
            <div className="card-body text-center">
              <div className="bg-red-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-800">{stats.rejected}</h3>
              <p className="text-neutral-600 text-sm">Rejected</p>
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-neutral-800">Recent Reports</h2>
          </div>
          <div className="card-body">
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-600 mb-2">
                Admin Panel Coming Soon
              </h3>
              <p className="text-neutral-500">
                Full moderation interface will be added in the next phase
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPage