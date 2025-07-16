// === frontend/src/components/Common/Footer.jsx ===
import { Shield, Mail, Phone, MapPin, Globe, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="bg-neutral-800 text-white">
      {/* Main Footer */}
      <div className="py-16">
        <div className="container-safe">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Logo and Description */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="bg-gradient-safe rounded-xl p-2">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div>
                  <span className="text-2xl font-bold">SafeStreets Bangladesh</span>
                  <div className="text-sm text-neutral-400 font-bangla">নিরাপদ দেশের জন্য</div>
                </div>
              </div>
              <p className="text-neutral-300 mb-6 leading-relaxed max-w-md">
                Empowering communities to report street crimes anonymously and create safer neighborhoods across Bangladesh through technology and collective action.
              </p>
              <div className="flex items-center space-x-2 text-sm text-neutral-400">
                <Globe className="w-4 h-4" />
                <span>Available nationwide • নিরাপদ দেশের জন্য একসাথে</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/map" className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group">
                    <MapPin className="w-4 h-4 mr-2 group-hover:text-safe-primary" />
                    Crime Map
                  </Link>
                </li>
                <li>
                  <Link to="/report" className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group">
                    <Shield className="w-4 h-4 mr-2 group-hover:text-safe-secondary" />
                    Report Incident
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Safety Tips</a>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Community Guidelines</a>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">Help & Support</a>
                </li>
              </ul>
            </div>

            {/* Emergency Contacts */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Emergency Contacts</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-safe-secondary rounded-lg p-2">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Police</div>
                    <div className="text-neutral-300 text-sm">999</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="bg-safe-warning rounded-lg p-2">
                    <Phone className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Fire Service</div>
                    <div className="text-neutral-300 text-sm">199</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="bg-safe-primary rounded-lg p-2">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Support</div>
                    <div className="text-neutral-300 text-sm">help@safestreets.bd</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Support Info Below Grid */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4 text-white">Contact & Support</h3>
              <ul className="space-y-3">
                <li className="flex items-center text-neutral-300">
                  <Mail className="w-4 h-4 mr-2 text-safe-primary" />
                  <a href="mailto:support@safestreetsbd.org" className="hover:text-white transition-colors">
                    support@safestreetsbd.org
                  </a>
                </li>
                <li className="flex items-center text-neutral-300">
                  <Phone className="w-4 h-4 mr-2 text-safe-primary" />
                  <a href="tel:+8801234567890" className="hover:text-white transition-colors">
                    +880 123 456 7890
                  </a>
                </li>
                <li className="flex items-start text-neutral-300 mt-4">
                  <MapPin className="w-4 h-4 mr-2 text-safe-primary mt-1 flex-shrink-0" />
                  <span>
                    Dhaka, Bangladesh<br />
                    <span className="text-sm">Serving all districts nationwide</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Emergency Notice */}
          <div className="mt-12 p-6 bg-red-900/30 border border-red-700/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-red-200 font-bold mb-2">⚠️ Emergency Situations</h4>
                <p className="text-red-300 text-sm leading-relaxed">
                  For immediate emergencies, contact local police (999) or emergency services (911). 
                  SafeStreets is for reporting and mapping, not emergency response.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-700 py-6">
        <div className="container-safe">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-neutral-400 text-sm">
              © 2025 Choukidar Bangladesh. Made for a safer Bangladesh.
            </p>
            <div className="flex items-center space-x-6 text-sm text-neutral-400">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
              <Link
                to="/admin/login"
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                title="System Administration"
              >
                System Administration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
