// === src/components/Common/Footer.jsx ===
import { Shield, Mail, Phone, MapPin, Globe, AlertTriangle } from 'lucide-react'

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
                  <div className="text-sm text-neutral-400 font-bangla">নিরাপদ রাস্তার জন্য</div>
                </div>
              </div>
              <p className="text-neutral-300 mb-6 leading-relaxed max-w-md">
                Empowering communities to report street crimes anonymously and create safer neighborhoods across Bangladesh through technology and collective action.
              </p>
              <div className="flex items-center space-x-2 text-sm text-neutral-400">
                <Globe className="w-4 h-4" />
                <span>Available nationwide • নিরাপদ রাস্তার জন্য একসাথে</span>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-bold mb-6 text-white">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <a href="/map" className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group">
                    <MapPin className="w-4 h-4 mr-2 group-hover:text-safe-primary" />
                    Crime Map
                  </a>
                </li>
                <li>
                  <a href="/report" className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group">
                    <Shield className="w-4 h-4 mr-2 group-hover:text-safe-secondary" />
                    Report Incident
                  </a>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">
                    Safety Tips
                  </a>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">
                    Community Guidelines
                  </a>
                </li>
                <li>
                  <a href="#" className="text-neutral-300 hover:text-white transition-colors duration-200">
                    Privacy Policy
                  </a>
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
              
              <div className="mt-6 p-4 bg-neutral-700 rounded-lg">
                <div className="flex items-center space-x-2 text-safe-secondary mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium text-sm">Emergency Alert</span>
                </div>
                <p className="text-xs text-neutral-300">
                  For immediate danger, call 999 directly. SafeStreets is for reporting and mapping, not emergency response.
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
              © 2025 SafeStreets Bangladesh. Made with ❤️ for safer communities.
            </p>
            <div className="flex items-center space-x-6 text-sm text-neutral-400">
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
