// === src/pages/Home.jsx ===
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Shield, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

function Home() {
  const [stats, setStats] = useState({
    totalReports: 0,
    approvedReports: 0,
    activeUsers: 500
  })

  useEffect(() => {
    // Fetch stats from API
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(prev => ({
            ...prev,
            approvedReports: data.count,
            totalReports: data.count + 15 // Simulate total including pending
          }))
        }
      })
      .catch(err => console.log('Error fetching stats:', err))
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
              Latest reports and community updates
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Activity Card 1 */}
            <div className="card group hover:shadow-medium transition-all duration-300">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <MapPin className="w-5 h-5 text-safe-primary mr-2" />
                  <span className="text-sm font-medium text-neutral-600">Dhanmondi Area</span>
                  <span className="badge-success ml-auto">Verified</span>
                </div>
                <h4 className="font-bold mb-3 text-neutral-800">Chadabaji Incident Reported</h4>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                  Community member reported extortion attempt near shopping area. Local authorities have been notified.
                </p>
                <div className="text-xs text-neutral-400">2 hours ago</div>
              </div>
            </div>
            
            {/* Activity Card 2 */}
            <div className="card group hover:shadow-medium transition-all duration-300">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <MapPin className="w-5 h-5 text-safe-primary mr-2" />
                  <span className="text-sm font-medium text-neutral-600">Gulshan Circle</span>
                  <span className="badge-info ml-auto">Positive Change</span>
                </div>
                <h4 className="font-bold mb-3 text-neutral-800">Safety Improvement</h4>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                  Increased police presence after community reports. Crime rate decreased by 40% in this area.
                </p>
                <div className="text-xs text-neutral-400">1 day ago</div>
              </div>
            </div>
            
            {/* Activity Card 3 */}
            <div className="card group hover:shadow-medium transition-all duration-300">
              <div className="card-body">
                <div className="flex items-center mb-4">
                  <MapPin className="w-5 h-5 text-safe-primary mr-2" />
                  <span className="text-sm font-medium text-neutral-600">Uttara Sector 7</span>
                  <span className="badge-pending ml-auto">Under Review</span>
                </div>
                <h4 className="font-bold mb-3 text-neutral-800">Teen Gang Activity</h4>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                  Multiple reports of harassment near school area. Investigation team deployed for verification.
                </p>
                <div className="text-xs text-neutral-400">3 days ago</div>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link to="/map" className="btn-outline">
              View All Reports on Map
            </Link>
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