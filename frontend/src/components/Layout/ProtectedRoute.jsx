// === frontend/src/components/Layout/ProtectedRoute.jsx ===
// Route Protection Component for SafeStreets Bangladesh
// Handles authentication-based route protection with role verification
// Integrates with AuthContext and UserTypeContext for complete security

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserType } from '../../contexts/UserTypeContext';

/**
 * ProtectedRoute Component
 * Protects routes based on authentication status and user roles
 * Features: Loading states, error handling, role-based access control
 */
const ProtectedRoute = ({ 
  children, 
  requiredRole = null,
  requiredPermission = null,
  redirectTo = '/admin/login',
  fallbackComponent = null,
  showLoading = true
}) => {
  const { isAuthenticated, isLoading: authLoading, adminUser, hasAdminPermission } = useAuth();
  const { userType, loading: userTypeLoading, isQuarantined } = useUserType();
  const location = useLocation();

  // Show loading while authentication is being determined
  if ((authLoading || userTypeLoading) && showLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Shield className="w-12 h-12 text-safe-primary animate-pulse" />
              <Loader2 className="w-6 h-6 text-safe-secondary animate-spin absolute top-3 left-3" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Verifying Access
          </h2>
          <p className="text-neutral-600">
            Checking authentication status...
          </p>
        </div>
      </div>
    );
  }

  // Check if user is quarantined (security feature)
  if (isQuarantined && isQuarantined()) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 p-3 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Account Restricted
          </h2>
          <p className="text-neutral-600 mb-4">
            Your account has been temporarily restricted due to security concerns.
          </p>
          <p className="text-sm text-neutral-500">
            Contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  // Check authentication for protected routes
  if (!isAuthenticated && requiredRole) {
    console.log(`🔒 Access denied - Not authenticated. Redirecting to: ${redirectTo}`);
    return (
      <Navigate 
        to={redirectTo} 
        state={{ 
          from: location,
          reason: 'authentication_required',
          requiredRole: requiredRole 
        }} 
        replace 
      />
    );
  }

  // Check role-based access
  if (isAuthenticated && requiredRole && userType !== requiredRole) {
    console.log(`🔒 Access denied - Role mismatch. Required: ${requiredRole}, Current: ${userType}`);
    
    // For admin routes, redirect to admin login if not admin
    if (requiredRole === 'admin' && userType !== 'admin') {
      return (
        <Navigate 
          to="/admin/login" 
          state={{ 
            from: location,
            reason: 'insufficient_role',
            requiredRole: requiredRole,
            currentRole: userType
          }} 
          replace 
        />
      );
    }

    // For other role mismatches, show access denied
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="flex justify-center mb-4">
            <div className="bg-orange-100 p-3 rounded-full">
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 mb-2">
            Access Denied
          </h2>
          <p className="text-neutral-600 mb-4">
            You don't have permission to access this area.
          </p>
          <div className="text-sm text-neutral-500 space-y-1">
            <p>Required role: <span className="font-medium">{requiredRole}</span></p>
            <p>Your role: <span className="font-medium">{userType}</span></p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-safe-primary text-white rounded-lg hover:bg-safe-primary/90 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check permission-based access for admin users
  if (isAuthenticated && requiredRole === 'admin' && requiredPermission) {
    if (!hasAdminPermission || !hasAdminPermission(requiredPermission)) {
      console.log(`🔒 Access denied - Missing permission: ${requiredPermission}`);
      
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="flex justify-center mb-4">
              <div className="bg-yellow-100 p-3 rounded-full">
                <Shield className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-neutral-800 mb-2">
              Insufficient Permissions
            </h2>
            <p className="text-neutral-600 mb-4">
              You don't have the required permissions to access this feature.
            </p>
            <div className="text-sm text-neutral-500 space-y-1">
              <p>Required permission: <span className="font-medium">{requiredPermission}</span></p>
              <p>Admin level: <span className="font-medium">{adminUser?.adminLevel || 'Unknown'}</span></p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="mt-4 px-4 py-2 bg-safe-primary text-white rounded-lg hover:bg-safe-primary/90 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  // If we have a fallback component and don't meet requirements, show it
  if (fallbackComponent && (!isAuthenticated || (requiredRole && userType !== requiredRole))) {
    return fallbackComponent;
  }

  // All checks passed - render the protected content
  console.log(`✅ Access granted to protected route: ${location.pathname}`);
  return children;
};

/**
 * AdminProtectedRoute - Specialized component for admin routes
 * Convenience wrapper for admin-specific protection
 */
export const AdminProtectedRoute = ({ 
  children, 
  requiredPermission = null,
  ...props 
}) => {
  return (
    <ProtectedRoute 
      requiredRole="admin" 
      requiredPermission={requiredPermission}
      redirectTo="/admin/login"
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
};

/**
 * AuthenticatedRoute - For any authenticated user
 * Convenience wrapper for general authentication protection
 */
export const AuthenticatedRoute = ({ children, ...props }) => {
  return (
    <ProtectedRoute 
      requiredRole="authenticated"
      redirectTo="/login"
      {...props}
    >
      {children}
    </ProtectedRoute>
  );
};

/**
 * ConditionalRoute - Renders different content based on authentication
 * Useful for pages that show different content to authenticated vs anonymous users
 */
export const ConditionalRoute = ({ 
  authenticatedComponent, 
  anonymousComponent, 
  loadingComponent = null 
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading && loadingComponent) {
    return loadingComponent;
  }
  
  return isAuthenticated ? authenticatedComponent : anonymousComponent;
};

export default ProtectedRoute;