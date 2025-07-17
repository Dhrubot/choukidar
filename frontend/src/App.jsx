// === frontend/src/App.jsx ===
// Main Application Component for SafeStreets Bangladesh
// Now includes proper context providers and route protection
// Fixed: Authentication context, protected routes, admin login access

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { UserTypeProvider } from './contexts/UserTypeContext'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import MapPage from './pages/MapPage'
import ReportPage from './pages/ReportPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import InviteRegisterPage from './pages/InviteRegisterPage'
import Header from './components/Common/Header'
import Footer from './components/Common/Footer'
import ProtectedRoute, { AdminProtectedRoute } from './components/Layout/ProtectedRoute'

function App() {
  return (
    // Corrected nesting order: AuthProvider wraps UserTypeProvider
    <AuthProvider>
      <UserTypeProvider>
        <Router>
          <div className="min-h-screen bg-neutral-50 flex flex-col">
            <Header />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/report" element={<ReportPage />} />
                {/* Invite-based Registration Route (Publicly accessible with token) */}
                <Route path="/register" element={<InviteRegisterPage />} />

                {/* Admin Authentication Route */}
                <Route path="/admin/login" element={<LoginPage />} />

                {/* Protected Admin Route */}
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminPage />
                    </AdminProtectedRoute>
                  }
                />

                {/* Future Protected Routes - Ready for expansion */}
                {/* <Route 
                  path="/admin/security" 
                  element={
                    <AdminProtectedRoute requiredPermission="security_monitoring">
                      <AdminSecurityPage />
                    </AdminProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin/settings" 
                  element={
                    <AdminProtectedRoute requiredPermission="super_admin">
                      <AdminSettingsPage />
                    </AdminProtectedRoute>
                  } 
                />
                */}
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </UserTypeProvider>
    </AuthProvider>
  )
}

export default App;