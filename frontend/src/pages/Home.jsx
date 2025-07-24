// === src/pages/Home.jsx ===
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Shield, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import apiService from '../services/api'
import logger, { logError } from '../services/utils/logger'

function Home() {
  const [stats, setStats] = useState({
    totalReports: 0,
    approvedReports: 0,
    activeUsers: 500,
    safeZones: 0
  })
  
  const [recentReports, setRecentReports] = useState([])
  const [loading, setLoading] = useState(true)

  // Helper function to format time ago
  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const reportTime = new Date(timestamp)
    const diffInMs = now - reportTime
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInHours < 1) return 'Less than 1 hour ago'
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
    return reportTime.toLocaleDateString()
  }

  // Helper function to get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'badge-success'
      case 'pending':
        return 'badge-pending'
      case 'under_review':
        return 'badge-warning'
      case 'flagged':
        return 'badge-error'
      default:
        return 'badge-info'
    }
  }

  // Helper function to get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return 'Verified'
      case 'pending':
        return 'Pending'
      case 'under_review':
        return 'Under Review'
      case 'flagged':
        return 'Flagged'
      default:
        return status
    }
  }

  // Helper function to get incident type display name
  const getIncidentTypeDisplay = (type) => {
    const typeMap = {
      'chadabaji': 'Chadabaji (Extortion)',
      'harassment': 'Harassment',
      'theft': 'Theft',
      'assault': 'Assault',
      'vandalism': 'Vandalism',
      'drug_activity': 'Drug Activity',
      'gang_activity': 'Gang Activity',
      'other': 'Other Incident'
    }
    return typeMap[type] || type
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch reports - backend already filters for approved/verified reports for public users
        const data = await apiService.getReports()
        
        if (data.success) {
          // Reports are already filtered to approved/verified by backend
          const reports = data.data || []
          const totalApprovedReports = reports.length
          const activeUsers = new Set(reports.map(r => r.userId)).size
          
          setStats({
            totalReports: totalApprovedReports,
            approvedReports: totalApprovedReports,
            activeUsers,
            safeZones: 0
          })

          // Get the 3 most recent reports for activity section
          const sortedReports = reports
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 3)
          
          setRecentReports(sortedReports)
        }
      } catch (err) {
        logError('Error fetching data', 'HomePage', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-safe text-white py-20 lg:py-32">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative container-safe">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fade-in">
              SafeStreets Bangladesh
            </h1>
            <p className="text-xl md:text-2xl mb-4 opacity-95 font-bangla animate-slide-up">
              নিরাপদ দেশের জন্য আপনার কণ্ঠস্বর
            </p>
            <p className="text-lg mb-12 opacity-90 max-w-2xl mx-auto leading-relaxed animate-slide-up">
              Report street crimes anonymously. Help make your community safer through transparent, crowd-sourced incident mapping.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
              <Link to="/report" className="btn-secondary btn-lg group">
                <AlertTriangle className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                Report Incident
              </Link>
              <Link to="/map" className="btn bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-white/20 hover:border-white/40 btn-lg group">
                <MapPin className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                View Map
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container-safe">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="bg-gradient-to-br from-safe-success to-green-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform shadow-medium">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-4xl font-bold text-neutral-800 mb-3">{stats.approvedReports}</h3>
              <p className="text-neutral-600 font-medium">Reports Verified</p>
              <div className="w-16 h-1 bg-safe-success rounded-full mx-auto mt-3"></div>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-to-br from-safe-primary to-bangladesh-green-dark rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform shadow-medium">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-4xl font-bold text-neutral-800 mb-3">{stats.activeUsers.toLocaleString()}+</h3>
              <p className="text-neutral-600 font-medium">Community Members</p>
              <div className="w-16 h-1 bg-safe-primary rounded-full mx-auto mt-3"></div>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-to-br from-safe-accent to-green-600 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6 group-hover:scale-105 transition-transform shadow-medium">
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-4xl font-bold text-neutral-800 mb-3">12</h3>
              <p className="text-neutral-600 font-medium">Areas Improved</p>
              <div className="w-16 h-1 bg-safe-accent rounded-full mx-auto mt-3"></div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-neutral-50">
        <div className="container-safe">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-800 mb-4">
              How SafeStreets Works
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Three simple steps to make your community safer
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center group">
              <div className="bg-gradient-danger rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl group-hover:scale-105 transition-transform shadow-medium">
                1
              </div>
              <h3 className="text-xl font-bold mb-4 text-neutral-800">Report Anonymously</h3>
              <p className="text-neutral-600 leading-relaxed">
                Submit incidents like chadabaji, teen gangs, or harassment safely and anonymously through our secure platform
              </p>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-danger rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl group-hover:scale-105 transition-transform shadow-medium">
                2
              </div>
              <h3 className="text-xl font-bold mb-4 text-neutral-800">Community Verification</h3>
              <p className="text-neutral-600 leading-relaxed">
                Reports are carefully reviewed and verified by our moderation team and trusted community members
              </p>
            </div>
            
            <div className="text-center group">
              <div className="bg-gradient-danger rounded-2xl w-16 h-16 flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl group-hover:scale-105 transition-transform shadow-medium">
                3
              </div>
              <h3 className="text-xl font-bold mb-4 text-neutral-800">Create Impact</h3>
              <p className="text-neutral-600 leading-relaxed">
                Verified reports help authorities and communities take targeted action for safer streets
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="py-20 bg-white">
        <div className="container-safe">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-800 mb-4">
              Recent Activity
            </h2>
            <p className="text-lg text-neutral-600">
              Latest verified reports from the community
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="card animate-pulse">
                  <div className="card-body">
                    <div className="flex items-center mb-4">
                      <div className="w-5 h-5 bg-gray-200 rounded mr-2"></div>
                      <div className="w-24 h-4 bg-gray-200 rounded"></div>
                      <div className="w-16 h-6 bg-gray-200 rounded ml-auto"></div>
                    </div>
                    <div className="w-32 h-6 bg-gray-200 rounded mb-3"></div>
                    <div className="space-y-2 mb-4">
                      <div className="w-full h-4 bg-gray-200 rounded"></div>
                      <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                    </div>
                    <div className="w-20 h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))
            ) : recentReports.length > 0 ? (
              recentReports.map((report, index) => (
                <div key={report._id || index} className="card group hover:shadow-medium transition-all duration-300">
                  <div className="card-body">
                    <div className="flex items-center mb-4">
                      <MapPin className="w-5 h-5 text-safe-primary mr-2" />
                      <span className="text-sm font-medium text-neutral-600">
                        {report.location?.address || 
                         report.location?.district || 
                         `${report.location?.coordinates?.[1]?.toFixed(4)}, ${report.location?.coordinates?.[0]?.toFixed(4)}` ||
                         'Location not specified'}
                      </span>
                      <span className={`${getStatusBadge(report.status)} ml-auto`}>
                        {getStatusText(report.status)}
                      </span>
                    </div>
                    <h4 className="font-bold mb-3 text-neutral-800">
                      {getIncidentTypeDisplay(report.type)}
                    </h4>
                    <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                      {report.description?.length > 100 
                        ? `${report.description.substring(0, 100)}...` 
                        : report.description || 'No description provided'}
                    </p>
                    <div className="text-xs text-neutral-400">
                      {formatTimeAgo(report.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // No reports state
              <div className="col-span-full text-center py-12">
                <AlertTriangle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-neutral-600 mb-2">No Recent Activity</h3>
                <p className="text-neutral-500">Be the first to report an incident in your area.</p>
              </div>
            )}
          </div>
          
          <div className="text-center mt-12">
            <Link 
              to="/map" 
              className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-safe-primary to-safe-accent text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border border-safe-primary/20 hover:border-safe-primary/40"
            >
              <MapPin className="w-5 h-5 mr-3 group-hover:animate-bounce" />
              <span className="text-lg">Explore Interactive Map</span>
              <TrendingUp className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
            <p className="text-sm text-neutral-500 mt-3 max-w-md mx-auto">
              Discover safety patterns, view verified incidents, and explore community insights on our interactive map
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-safe text-white">
        <div className="container-safe text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Make Your Community Safer?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join thousands of citizens working together to create safer streets across Bangladesh
          </p>
          <Link to="/report" className="btn bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white border-white/20 hover:border-white/40 btn-lg">
            Report Your First Incident
          </Link>
        </div>
      </section>
    </div>
  )
}

export default Home