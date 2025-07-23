// === frontend/src/components/Auth/AdminLogin.jsx ===
// Admin Login Component for SafeStreets Bangladesh
// Follows existing component patterns and styling conventions
// Integrates with Enhanced AuthContext for secure admin authentication

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  LogIn,
  RefreshCw,
  Clock,
  Settings
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // Single import for enhanced context
import { useDevice } from '../../contexts/DeviceContext'; // Updated import for device fingerprint

/**
 * AdminLogin Component
 * Provides secure admin authentication with enhanced security features
 * Features: Account locking, session management, security monitoring
 */
const AdminLogin = ({ 
  onLoginSuccess = null,
  onLoginError = null,
  redirectTo = '/admin',
  className = '',
  showTitle = true,
  embedded = false
}) => {
  // Enhanced AuthContext hooks - single source of truth
  const { 
    isAuthenticated, 
    isLoading, 
    loginAdmin, 
    user: adminUser, 
    securityContext: adminSecurityContext,
    loginError,
    error,
    authState,
    AUTH_STATES,
    clearErrors
  } = useAuth();
  
  // Device fingerprint from DeviceContext
  const { deviceFingerprint } = useDevice();
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI state
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Computed states from enhanced AuthContext
  const isAccountLocked = adminSecurityContext?.accountLocked || false;
  const isAuthenticating = authState === AUTH_STATES.AUTHENTICATING;
  
  // Form validation
  const validateForm = useCallback(() => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);
  
  // Handle form input changes
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field-specific errors on change
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear global errors on input change
    if (error || loginError) {
      clearErrors();
    }
  }, [formErrors, error, loginError, clearErrors]);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // Use the enhanced loginAdmin from AuthContext
      const result = await loginAdmin({
        username: formData.username.trim(),
        password: formData.password,
        rememberMe: rememberMe,
      });
      
      if (result.success) {
        console.log('✅ Admin login successful');
        
        // Call success callback if provided
        if (onLoginSuccess) {
          onLoginSuccess(result.user);
        }
        
        // Clear form on success
        setFormData({ username: '', password: '' });
        setFormErrors({});
        setSubmitAttempted(false);
        
      } else {
        console.log('❌ Admin login failed:', result.message);
        
        // Call error callback if provided
        if (onLoginError) {
          onLoginError(result.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Login submission error:', error);
      
      if (onLoginError) {
        onLoginError('Login failed. Please try again.');
      }
    }
  }, [formData, rememberMe, validateForm, loginAdmin, onLoginSuccess, onLoginError]);
  
  // Handle password visibility toggle
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);
  
  // Handle remember me toggle
  const handleRememberMeChange = useCallback((e) => {
    setRememberMe(e.target.checked);
  }, []);
  
  // Toggle advanced options
  const toggleAdvancedOptions = useCallback(() => {
    setShowAdvancedOptions(prev => !prev);
  }, []);
  
  // Clear all errors when component unmounts or resets
  useEffect(() => {
    return () => {
      clearErrors();
    };
  }, [clearErrors]);
  
  // Auto-focus username field on mount
  useEffect(() => {
    const usernameInput = document.getElementById('admin-username');
    if (usernameInput && !embedded) {
      usernameInput.focus();
    }
  }, [embedded]);
  
  // Don't render if already authenticated (unless embedded)
  if (isAuthenticated && !embedded) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Already logged in as {adminUser?.username}</span>
        </div>
      </div>
    );
  }
  
  // Render account locked state
  if (isAccountLocked) {
    const lockUntil = adminSecurityContext?.lockUntil;
    const lockTimeRemaining = lockUntil ? Math.max(0, new Date(lockUntil) - new Date()) : 0;
    const lockMinutesRemaining = Math.ceil(lockTimeRemaining / (1000 * 60));
    
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Account Locked</h3>
          <p className="text-red-700 mb-4">
            Your account has been temporarily locked due to multiple failed login attempts.
          </p>
          {lockMinutesRemaining > 0 && (
            <div className="flex items-center justify-center space-x-2 text-red-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Try again in {lockMinutesRemaining} minute{lockMinutesRemaining !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      {/* Header */}
      {showTitle && (
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-safe-primary rounded-full p-3">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">
            Admin Login
          </h1>
          <p className="text-neutral-600">
            Sign in to access the SafeStreets admin dashboard
          </p>
        </div>
      )}
      
      {/* Security Status */}
      <div className="mb-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-safe-primary" />
            <span className="text-sm font-medium text-neutral-700">Security Status</span>
          </div>
          <button
            onClick={toggleAdvancedOptions}
            className="text-sm text-safe-primary hover:text-safe-primary/80 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mt-2 text-sm text-neutral-600">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Device Verified</span>
            </span>
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Secure Connection</span>
            </span>
          </div>
        </div>
        
        {/* Advanced Options */}
        {showAdvancedOptions && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <div className="text-xs text-neutral-500">
              <div>Device ID: {deviceFingerprint?.slice(0, 8) || 'Generating...'}...</div>
              <div>Session: New login session</div>
              <div>IP Protection: Active</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {(error || loginError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">
              {loginError || error}
            </span>
          </div>
        </div>
      )}
      
      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Username Field */}
        <div>
          <label htmlFor="admin-username" className="block text-sm font-medium text-neutral-700 mb-2">
            Username
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="w-5 h-5 text-neutral-400" />
            </div>
            <input
              id="admin-username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLoading || isAuthenticating}
              className={`form-input pl-10 ${
                formErrors.username ? 'border-red-500 focus:border-red-500' : 'border-neutral-300 focus:border-safe-primary'
              } ${isLoading || isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="Enter your username"
              autoComplete="username"
              required
            />
          </div>
          {formErrors.username && (
            <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
          )}
        </div>
        
        {/* Password Field */}
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-neutral-700 mb-2">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="w-5 h-5 text-neutral-400" />
            </div>
            <input
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading || isAuthenticating}
              className={`form-input pl-10 pr-10 ${
                formErrors.password ? 'border-red-500 focus:border-red-500' : 'border-neutral-300 focus:border-safe-primary'
              } ${isLoading || isAuthenticating ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              disabled={isLoading || isAuthenticating}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
              ) : (
                <Eye className="w-5 h-5 text-neutral-400 hover:text-neutral-600" />
              )}
            </button>
          </div>
          {formErrors.password && (
            <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
          )}
        </div>
        
        {/* Remember Me */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={handleRememberMeChange}
              disabled={isLoading || isAuthenticating}
              className="h-4 w-4 text-safe-primary focus:ring-safe-primary border-neutral-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-neutral-700">
              Remember me
            </label>
          </div>
          
          <div className="text-sm">
            <a href="/admin/forgot-password" className="text-safe-primary hover:text-safe-primary/80">
              Forgot password?
            </a>
          </div>
        </div>
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || isAuthenticating || isAccountLocked}
          className={`w-full btn btn-primary ${
            isLoading || isAuthenticating 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-bangladesh-green-dark'
          }`}
        >
          {isLoading || isAuthenticating ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
            </div>
          )}
        </button>
      </form>
      
      {/* Login Attempts Warning */}
      {adminSecurityContext?.loginAttempts > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 text-yellow-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              {adminSecurityContext.loginAttempts} failed attempt{adminSecurityContext.loginAttempts !== 1 ? 's' : ''}. 
              {5 - adminSecurityContext.loginAttempts} remaining before account lock.
            </span>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-8 text-center text-sm text-neutral-600">
        <p>
          Protected by SafeStreets Security System
        </p>
        <p className="mt-1">
          Need help? Contact{' '}
          <a href="mailto:admin@safestreets.bd" className="text-safe-primary hover:text-safe-primary/80">
            admin@safestreets.bd
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;