// === frontend/src/pages/LoginPage.jsx ===
// Login Page for SafeStreets Bangladesh
// Follows existing page patterns and integrates with the established layout system
// Uses the AdminLogin component within the standard page structure

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, ArrowLeft, Globe, AlertTriangle, Lock } from 'lucide-react';
import AdminLogin from '../components/Auth/AdminLogin';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../contexts/UserTypeContext';

/**
 * LoginPage Component
 * Provides a dedicated login page that follows the existing SafeStreets design patterns
 * Features: Hero section, admin login form, security status, help links
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, adminUser } = useAuth();
  const { userType } = useUserType();
  
  // Get redirect path from location state or default to admin
  const redirectTo = location.state?.from?.pathname || '/admin';
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && userType === 'admin') {
      console.log('✅ Already authenticated, redirecting to:', redirectTo);
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, userType, redirectTo, navigate]);
  
  // Handle successful login
  const handleLoginSuccess = (user) => {
    console.log('✅ Login successful, redirecting to:', redirectTo);
    navigate(redirectTo, { replace: true });
  };
  
  // Handle login error
  const handleLoginError = (error) => {
    console.error('❌ Login error:', error);
    // Error handling is done in the AdminLogin component
  };
  
  // Handle back navigation
  const handleGoBack = () => {
    // Go back to previous page or home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header Section - Following Home page pattern */}
      <div className="bg-gradient-safe text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
        
        <div className="relative container-safe">
          <div className="max-w-2xl mx-auto text-center">
            {/* Back Button */}
            <button
              onClick={handleGoBack}
              className="inline-flex items-center space-x-2 text-white/80 hover:text-white transition-colors mb-6 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to SafeStreets</span>
            </button>
            
            {/* Logo and Title */}
            <div className="flex items-center justify-center mb-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                <Shield className="w-12 h-12 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-4 animate-fade-in">
              Admin Access Portal
            </h1>
            <p className="text-lg mb-2 opacity-95 font-bangla animate-slide-up">
              নিরাপদ প্রশাসনিক অ্যাক্সেস
            </p>
            <p className="text-white/90 max-w-md mx-auto leading-relaxed animate-slide-up">
              Secure access to the SafeStreets Bangladesh administration dashboard
            </p>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="py-16 relative">
        <div className="container-safe">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              
              {/* Left Column - Login Form */}
              <div className="order-2 lg:order-1">
                <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8">
                  <AdminLogin
                    onLoginSuccess={handleLoginSuccess}
                    onLoginError={handleLoginError}
                    redirectTo={redirectTo}
                    showTitle={false}
                    embedded={true}
                    className="w-full"
                  />
                </div>
              </div>
              
              {/* Right Column - Information Panel */}
              <div className="order-1 lg:order-2 space-y-8">
                
                {/* Security Features */}
                <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8">
                  <div className="flex items-center mb-6">
                    <div className="bg-safe-primary/10 rounded-lg p-3 mr-4">
                      <Lock className="w-6 h-6 text-safe-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-800">
                        Enterprise Security
                      </h3>
                      <p className="text-neutral-600">
                        Advanced protection for admin access
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-neutral-800">Device Fingerprinting</h4>
                        <p className="text-sm text-neutral-600">
                          Advanced device identification and tracking for security monitoring
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-neutral-800">Account Protection</h4>
                        <p className="text-sm text-neutral-600">
                          Automatic account locking after failed attempts with time-based recovery
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-neutral-800">Session Management</h4>
                        <p className="text-sm text-neutral-600">
                          Secure session handling with automatic expiry and activity tracking
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-neutral-800">Real-time Monitoring</h4>
                        <p className="text-sm text-neutral-600">
                          Comprehensive logging and security event tracking
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Admin Features */}
                <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8">
                  <div className="flex items-center mb-6">
                    <div className="bg-bangladesh-green/10 rounded-lg p-3 mr-4">
                      <Shield className="w-6 h-6 text-bangladesh-green" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-800">
                        Admin Dashboard
                      </h3>
                      <p className="text-neutral-600">
                        Comprehensive tools for platform management
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <h4 className="font-semibold text-neutral-800 mb-2">Report Moderation</h4>
                      <p className="text-sm text-neutral-600">
                        Review, approve, and manage incident reports
                      </p>
                    </div>
                    
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <h4 className="font-semibold text-neutral-800 mb-2">Analytics</h4>
                      <p className="text-sm text-neutral-600">
                        Comprehensive insights and reporting tools
                      </p>
                    </div>
                    
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <h4 className="font-semibold text-neutral-800 mb-2">User Management</h4>
                      <p className="text-sm text-neutral-600">
                        Manage user accounts and permissions
                      </p>
                    </div>
                    
                    <div className="bg-neutral-50 rounded-lg p-4">
                      <h4 className="font-semibold text-neutral-800 mb-2">Safe Zones</h4>
                      <p className="text-sm text-neutral-600">
                        Create and manage safe zone designations
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* System Status */}
                <div className="bg-white rounded-2xl shadow-soft border border-neutral-200 p-8">
                  <div className="flex items-center mb-6">
                    <div className="bg-blue-500/10 rounded-lg p-3 mr-4">
                      <Globe className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-800">
                        System Status
                      </h3>
                      <p className="text-neutral-600">
                        Real-time platform health monitoring
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-neutral-700">Authentication Service</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-neutral-700">Database Connection</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-neutral-700">Security Monitoring</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Active</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-neutral-700">API Services</span>
                      </div>
                      <span className="text-sm text-green-600 font-medium">Operational</span>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Section */}
      <div className="bg-neutral-800 text-white py-8">
        <div className="container-safe">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 mr-2" />
              <span className="text-lg font-semibold">SafeStreets Bangladesh Admin Portal</span>
            </div>
            
            <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-8 text-sm text-neutral-400">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Emergency: Call 999 directly</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Nationwide coverage</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <span>Enterprise security</span>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-neutral-700">
              <p className="text-neutral-400 text-sm">
                Need help accessing your account?{' '}
                <a href="mailto:admin@safestreets.bd" className="text-safe-primary hover:text-safe-primary/80 transition-colors">
                  Contact technical support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;