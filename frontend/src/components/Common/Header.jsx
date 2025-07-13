// === src/components/Common/Header.jsx ===
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Shield } from 'lucide-react'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-soft sticky top-0 z-50 border-b border-neutral-200">
      <div className="container-safe">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-safe rounded-xl p-2 group-hover:scale-105 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-neutral-800">SafeStreets</span>
              <div className="text-xs text-neutral-500 font-bangla">নিরাপদ রাস্তা</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1">
            <Link 
              to="/" 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/') 
                  ? 'bg-safe-primary text-white shadow-sm' 
                  : 'text-neutral-600 hover:text-safe-primary hover:bg-neutral-100'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/map" 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/map') 
                  ? 'bg-safe-primary text-white shadow-sm' 
                  : 'text-neutral-600 hover:text-safe-primary hover:bg-neutral-100'
              }`}
            >
              Map
            </Link>
            <Link 
              to="/report" 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/report') 
                  ? 'bg-safe-secondary text-white shadow-sm' 
                  : 'text-neutral-600 hover:text-safe-secondary hover:bg-red-50'
              }`}
            >
              Report
            </Link>
            <Link 
              to="/admin" 
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isActive('/admin') 
                  ? 'bg-neutral-800 text-white shadow-sm' 
                  : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              Admin
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden touch-target rounded-lg hover:bg-neutral-100 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-neutral-600" />
            ) : (
              <Menu className="w-6 h-6 text-neutral-600" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 animate-slide-up">
            <nav className="flex flex-col space-y-2">
              <Link 
                to="/" 
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/') 
                    ? 'bg-safe-primary text-white' 
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link 
                to="/map" 
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/map') 
                    ? 'bg-safe-primary text-white' 
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Map
              </Link>
              <Link 
                to="/report" 
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/report') 
                    ? 'bg-safe-secondary text-white' 
                    : 'text-neutral-600 hover:bg-red-50'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Report
              </Link>
              <Link 
                to="/admin" 
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  isActive('/admin') 
                    ? 'bg-neutral-800 text-white' 
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header