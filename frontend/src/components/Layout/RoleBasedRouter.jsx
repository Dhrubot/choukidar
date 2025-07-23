// === frontend/src/components/Layout/RoleBasedRouter.jsx ===
// Role-Based Router Component for SafeStreets Bangladesh
// Handles authentication-aware routing and role-based access control
// Integrates with Enhanced AuthContext for unified authentication management

import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  RefreshCw,
  UserX,
  Settings,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // Single import for enhanced context
import AdminLogin from '../Auth/AdminLogin';

/**
 * Route Protection Types
 * Defines different levels of route protection
 */
const PROTECTION_LEVELS = {
  PUBLIC: 'public',                    // Anyone can access
  AUTHENTICATED: 'authenticated',      // Must be logged in (any authenticated user)
  ADMIN: 'admin',                     // Must be admin
  ADMIN_PERMISSION: 'admin_permission', // Must be admin with specific permission
  POLICE: 'police',                   // Must be police officer
  RESEARCHER: 'researcher',           // Must be researcher
  QUARANTINE_BLOCKED: 'quarantine_blocked' // Blocked if quarantined
};

/**
 * Permission Requirements for Admin Routes
 * Maps admin routes to required permissions
 */
const ADMIN_ROUTE_PERMISSIONS = {
  '/admin': null,                              // Basic admin access
  '/admin/dashboard': null,                    // Basic admin access
  '/admin/reports': 'moderation',              // Report moderation
  '/admin/moderation': 'moderation',           // Content moderation
  '/admin/analytics': 'analytics',             // Analytics access
  '/admin/users': 'user_management',           // User management
  '/admin/security': 'security_monitoring',   // Security monitoring
  '/admin/settings': 'super_admin',            // System settings
  '/admin/safezones': 'safe_zones',           // Safe zone management
  '/admin/system': 'super_admin'               // System administration
};

/**
 * Route Configuration
 * Defines protection levels for different routes
 */
const ROUTE_PROTECTION_CONFIG = {
  // Public routes (no authentication required)
  '/': PROTECTION_LEVELS.PUBLIC,
  '/map': PROTECTION_LEVELS.PUBLIC,
  '/report': PROTECTION_LEVELS.PUBLIC,
  '/about': PROTECTION_LEVELS.PUBLIC,
  '/help': PROTECTION_LEVELS.PUBLIC,
  '/privacy': PROTECTION_LEVELS.PUBLIC,
  '/terms': PROTECTION_LEVELS.PUBLIC,
  
  // Admin routes (require admin authentication)
  '/admin': PROTECTION_LEVELS.ADMIN,
  '/admin/*': PROTECTION_LEVELS.ADMIN,
  
  // Future routes (police, researcher)
  '/police': PROTECTION_LEVELS.POLICE,
  '/police/*': PROTECTION_LEVELS.POLICE,
  '/researcher': PROTECTION_LEVELS.RESEARCHER,
  '/researcher/*': PROTECTION_LEVELS.RESEARCHER,
  
  // Authentication routes
  '/login': PROTECTION_LEVELS.PUBLIC,
  '/admin/login': PROTECTION_LEVELS.PUBLIC,
  
  // Special routes
  '/profile': PROTECTION_LEVELS.AUTHENTICATED,
  '/settings': PROTECTION_LEVELS.AUTHENTICATED
};

/**
 * Access Denied Component
 * Shows when user doesn't have permission to access a route
 */
const AccessDenied = ({ 
  reason = 'access_denied',
  requiredRole = null,
  requiredPermission = null,
  userType = 'anonymous',
  onRetry = null,
  onGoBack = null
}) => {
  const navigate = useNavigate();
  
  const getErrorMessage = () => {
    switch (reason) {
      case 'not_authenticated':
        return 'You need to be logged in to access this page.';
      case 'insufficient_role':
        return `This page requires ${requiredRole} access. You are currently logged in as ${userType}.`;
      case 'insufficient_permission':
        return `You don't have the required permission: ${requiredPermission}`;
      case 'account_locked':
        return 'Your account has been temporarily locked. Please try again later.';
      case 'quarantined':
        return 'Your account has been temporarily restricted due to security concerns.';
      case 'session_expired':
        return 'Your session has expired. Please log in again.';
      default:
        return 'You don\'t have permission to access this page.';
    }
  };
  
  const getActionButton = () => {
    switch (reason) {
      case 'not_authenticated':
        return (
          <button 
            onClick={() => navigate('/admin/login')}
            className="btn btn-primary"
          >
            <Shield className="w-4 h-4 mr-2" />
            Login
          </button>
        );
      case 'session_expired':
        return (
          <button 
            onClick={() => navigate('/admin/login')}
            className="btn btn-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Login Again
          </button>
        );
      default:
        return (
          <button 
            onClick={() => navigate('/')}
            className="btn btn-secondary"
          >
            Go to Home
          </button>
        );
    }
  };
  
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 mb-6">
            {getErrorMessage()}
          </p>
        </div>
        
        <div className="space-y-3">
          {getActionButton()}
          
          {onRetry && (
            <button 
              onClick={onRetry}
              className="btn btn-outline w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          )}
          
          <button 
            onClick={() => navigate(-1)}
            className="btn btn-outline w-full"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-6 text-sm text-neutral-500">
          <p>
            Need help? Contact{' '}
            <a href="mailto:support@safestreets.bd" className="text-safe-primary hover:underline">
              support@safestreets.bd
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading Component
 * Shows while authentication status is being determined
 */
const AuthenticationLoading = () => {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-4">
          <Loader2 className="w-12 h-12 text-safe-primary mx-auto animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">
          Checking Authentication
        </h2>
        <p className="text-neutral-600">
          Please wait while we verify your access...
        </p>
      </div>
    </div>
  );
};

/**
 * Admin Login Page Component
 * Embedded admin login for protected routes
 */
const AdminLoginPage = ({ redirectTo = '/admin' }) => {
  const navigate = useNavigate();
  
  const handleLoginSuccess = useCallback((user) => {
    console.log('✅ Admin login successful, redirecting to:', redirectTo);
    navigate(redirectTo);
  }, [navigate, redirectTo]);
  
  const handleLoginError = useCallback((error) => {
    console.error('❌ Admin login error:', error);
    // Error handling is done in the AdminLogin component
  }, []);
  
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AdminLogin
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
          redirectTo={redirectTo}
          showTitle={true}
          embedded={false}
        />
      </div>
    </div>
  );
};

/**
 * Route Protection Hook
 * Determines if user has access to a route
 */
const useRouteProtection = (path) => {
  const { 
    userType, 
    isAuthenticated, 
    isLoading, 
    hasPermission, 
    securityContext,
    authState,
    AUTH_STATES
  } = useAuth(); // Single hook usage for all auth state
  
  // Check if user is quarantined from securityContext
  const isQuarantined = securityContext?.quarantined || false;
  
  // Check if account is locked from securityContext
  const isAccountLocked = securityContext?.accountLocked || false;
  
  // Check if session is expired from authState
  const isSessionExpired = authState === AUTH_STATES.SESSION_EXPIRED;
  
  const checkRouteAccess = useCallback(() => {
    // Find the most specific route configuration
    const getRouteConfig = (path) => {
      // Check exact match first
      if (ROUTE_PROTECTION_CONFIG[path]) {
        return ROUTE_PROTECTION_CONFIG[path];
      }
      
      // Check wildcard matches
      for (const [route, protection] of Object.entries(ROUTE_PROTECTION_CONFIG)) {
        if (route.endsWith('/*') && path.startsWith(route.slice(0, -2))) {
          return protection;
        }
      }
      
      // Default to public if no specific configuration
      return PROTECTION_LEVELS.PUBLIC;
    };
    
    const protectionLevel = getRouteConfig(path);
    
    // Check quarantine status first (applies to all protected routes)
    if (protectionLevel !== PROTECTION_LEVELS.PUBLIC && isQuarantined) {
      return {
        allowed: false,
        reason: 'quarantined',
        userType: userType
      };
    }
    
    // Check account locked status
    if (isAccountLocked) {
      return {
        allowed: false,
        reason: 'account_locked',
        userType: userType
      };
    }
    
    // Check session expired
    if (isSessionExpired) {
      return {
        allowed: false,
        reason: 'session_expired',
        userType: userType
      };
    }
    
    switch (protectionLevel) {
      case PROTECTION_LEVELS.PUBLIC:
        return { allowed: true };
        
      case PROTECTION_LEVELS.AUTHENTICATED:
        if (!isAuthenticated) {
          return {
            allowed: false,
            reason: 'not_authenticated',
            userType: userType
          };
        }
        return { allowed: true };
        
      case PROTECTION_LEVELS.ADMIN:
        if (!isAuthenticated || userType !== 'admin') {
          return {
            allowed: false,
            reason: userType === 'anonymous' ? 'not_authenticated' : 'insufficient_role',
            requiredRole: 'admin',
            userType: userType
          };
        }
        
        // Check specific admin permission for the route
        const requiredPermission = ADMIN_ROUTE_PERMISSIONS[path];
        if (requiredPermission && !hasPermission(requiredPermission)) {
          return {
            allowed: false,
            reason: 'insufficient_permission',
            requiredPermission: requiredPermission,
            userType: userType
          };
        }
        
        return { allowed: true };
        
      case PROTECTION_LEVELS.POLICE:
        if (!isAuthenticated || userType !== 'police') {
          return {
            allowed: false,
            reason: userType === 'anonymous' ? 'not_authenticated' : 'insufficient_role',
            requiredRole: 'police',
            userType: userType
          };
        }
        return { allowed: true };
        
      case PROTECTION_LEVELS.RESEARCHER:
        if (!isAuthenticated || userType !== 'researcher') {
          return {
            allowed: false,
            reason: userType === 'anonymous' ? 'not_authenticated' : 'insufficient_role',
            requiredRole: 'researcher',
            userType: userType
          };
        }
        return { allowed: true };
        
      default:
        return { allowed: false, reason: 'access_denied' };
    }
  }, [
    path, 
    userType, 
    isAuthenticated, 
    isAccountLocked, 
    isSessionExpired,
    isQuarantined, 
    hasPermission
  ]);
  
  return {
    isLoading,
    ...checkRouteAccess()
  };
};

/**
 * Protected Route Component
 * Wraps routes that require authentication or specific roles
 */
const ProtectedRoute = ({ children, path = null }) => {
  const location = useLocation();
  const currentPath = path || location.pathname;
  const { 
    isLoading, 
    allowed, 
    reason, 
    requiredRole, 
    requiredPermission, 
    userType 
  } = useRouteProtection(currentPath);
  
  // Show loading while checking authentication
  if (isLoading) {
    return <AuthenticationLoading />;
  }
  
  // If access is allowed, render the protected content
  if (allowed) {
    return children;
  }
  
  // For admin routes that require authentication, show login page
  if (currentPath.startsWith('/admin') && (reason === 'not_authenticated' || reason === 'session_expired')) {
    return <AdminLoginPage redirectTo={currentPath} />;
  }
  
  // For general login page access, redirect to dedicated login page
  if (reason === 'not_authenticated' && !currentPath.startsWith('/admin')) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // For other cases, show access denied
  return (
    <AccessDenied
      reason={reason}
      requiredRole={requiredRole}
      requiredPermission={requiredPermission}
      userType={userType}
    />
  );
};

/**
 * Role-Based Router Component
 * Main export - wraps the entire routing system with role-based protection
 */
const RoleBasedRouter = ({ children }) => {
  const { userType, isLoading } = useAuth(); // Single hook usage
  const location = useLocation();
  
  // Show loading while contexts are initializing
  if (isLoading) {
    return <AuthenticationLoading />;
  }
  
  // Log route access for security monitoring
  useEffect(() => {
    console.log(`🔍 Route accessed: ${location.pathname} (User: ${userType})`);
  }, [location.pathname, userType]);
  
  return (
    <div className="role-based-router">
      {children}
    </div>
  );
};

/**
 * Route Guard Hook
 * For programmatic route access checking
 */
export const useRouteGuard = () => {
  const { hasPermission, userType, isAuthenticated, securityContext } = useAuth();
  
  // Check if user is quarantined from securityContext
  const isQuarantined = securityContext?.quarantined || false;
  
  const canAccess = useCallback((path, permission = null) => {
    const protectionLevel = ROUTE_PROTECTION_CONFIG[path] || PROTECTION_LEVELS.PUBLIC;
    
    // Check quarantine status
    if (protectionLevel !== PROTECTION_LEVELS.PUBLIC && isQuarantined) {
      return false;
    }
    
    switch (protectionLevel) {
      case PROTECTION_LEVELS.PUBLIC:
        return true;
      case PROTECTION_LEVELS.AUTHENTICATED:
        return isAuthenticated;
      case PROTECTION_LEVELS.ADMIN:
        return isAuthenticated && userType === 'admin' && 
               (!permission || hasPermission(permission));
      case PROTECTION_LEVELS.POLICE:
        return isAuthenticated && userType === 'police';
      case PROTECTION_LEVELS.RESEARCHER:
        return isAuthenticated && userType === 'researcher';
      default:
        return false;
    }
  }, [userType, isAuthenticated, isQuarantined, hasPermission]);
  
  return { canAccess };
};

/**
 * Admin Route Guard Hook
 * Specific helper for admin routes
 */
export const useAdminRouteGuard = () => {
  const { canAccess } = useRouteGuard();
  
  const canAccessAdmin = useCallback((path = '/admin', permission = null) => {
    return canAccess(path, permission);
  }, [canAccess]);
  
  return { canAccessAdmin };
};

export default RoleBasedRouter;
export { 
  ProtectedRoute, 
  AccessDenied, 
  AuthenticationLoading, 
  AdminLoginPage,
  PROTECTION_LEVELS,
  ROUTE_PROTECTION_CONFIG,
  ADMIN_ROUTE_PERMISSIONS
};