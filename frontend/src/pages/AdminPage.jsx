
// === src/pages/AdminPage.jsx ===
import { useState, useEffect } from 'react'
import { Shield, Users, TrendingUp, Clock } from 'lucide-react'
import apiService from '../services/api'

function AdminPage() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await apiService.getAdminDashboard()
        if (response.success) {
          setStats(response.data)
        }
      } catch (err) {
        setError(err.message)
        console.error('Error fetching admin stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="flex items-center justify-center py-20">
            <div className="loading-spinner w-8 h-8"></div>
            <span className="ml-3 text-neutral-600">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="container-safe">
          <div className="alert-danger">
            <h4 className="font-medium mb-2">Error Loading Dashboard</h4>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

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

        {/* Current Stats Summary */}
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="text-lg font-bold text-neutral-800">Real-Time Statistics</h2>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-neutral-700 mb-2">Report Status Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Pending Review:</span>
                    <span className="font-medium text-orange-600">{stats.pending} reports</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Approved & Public:</span>
                    <span className="font-medium text-green-600">{stats.approved} reports</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-600">Rejected/Spam:</span>
                    <span className="font-medium text-red-600">{stats.rejected} reports</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-neutral-700 mb-2">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="btn-primary btn-sm w-full">
                    Review Pending Reports ({stats.pending})
                  </button>
                  <button className="btn-outline btn-sm w-full">
                    View All Reports ({stats.total})
                  </button>
                  <button className="btn-ghost btn-sm w-full">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-bold text-neutral-800">Moderation Interface</h2>
          </div>
          <div className="card-body">
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-neutral-600 mb-2">
                Full Moderation Panel Coming Soon
              </h3>
              <p className="text-neutral-500 mb-4">
                Individual report review, approve/reject buttons, and detailed moderation tools will be added in the next phase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPage