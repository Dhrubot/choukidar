// === frontend/src/contexts/AuthContext.jsx ===
// Admin Authentication Context for SafeStreets Bangladesh
// Handles admin-specific authentication state and session management
// Works in conjunction with UserTypeContext for complete user management

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { useUserType } from './UserTypeContext';

// Admin authentication states
const AUTH_STATES = {
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  SESSION_EXPIRED: 'session_expired',
  LOCKED: 'locked',
  ERROR: 'error'
};

// Initial state for admin authentication
const initialState = {
  // Authentication status
  authState: AUTH_STATES.UNAUTHENTICATED,
  isAuthenticated: false,
  isLoading: false,
  
  // Admin user data
  adminUser: null,
  adminProfile: null,
  
  // Session management
  sessionToken: null,
  sessionExpiry: null,
  lastActivity: null,
  
  // Admin permissions and role
  adminPermissions: [],
  adminLevel: 1,
  adminRole: null,
  
  // Security context for admin
  adminSecurityContext: {
    trustScore: 0,
    riskLevel: 'unknown',
    loginAttempts: 0,
    accountLocked: false,
    lockUntil: null,
    lastLogin: null,
    associatedDevices: 0,
    twoFactorEnabled: false
  },
  
  // Admin preferences
  adminPreferences: {
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      security: true,
      reports: true
    },
    dashboard: {
      defaultView: 'overview',
      autoRefresh: true,
      refreshInterval: 30000
    },
    moderation: {
      itemsPerPage: 25,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      showOnlyPending: false
    }
  },
  
  // Error handling
  error: null,
  loginError: null,
  
  // Activity tracking
  activityProfile: {
    totalSessions: 0,
    totalActiveTime: 0,
    featureUsage: {
      moderation: 0,
      analytics: 0,
      userManagement: 0,
      safeZones: 0,
      security: 0
    }
  }
};

// Action types for admin authentication
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_LOGIN_ERROR: 'SET_LOGIN_ERROR',
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  LOGOUT: 'LOGOUT',
  LOAD_PROFILE: 'LOAD_PROFILE',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  UPDATE_SECURITY_CONTEXT: 'UPDATE_SECURITY_CONTEXT',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  REFRESH_SESSION: 'REFRESH_SESSION',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
  RESET_STATE: 'RESET_STATE'
};

// Reducer for admin authentication state
const authReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
      
    case ActionTypes.SET_LOGIN_ERROR:
      return {
        ...state,
        loginError: action.payload,
        isLoading: false
      };
      
    case ActionTypes.LOGIN_START:
      return {
        ...state,
        authState: AUTH_STATES.AUTHENTICATING,
        isLoading: true,
        loginError: null,
        error: null
      };
      
    case ActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        authState: AUTH_STATES.AUTHENTICATED,
        isAuthenticated: true,
        isLoading: false,
        adminUser: action.payload.user,
        adminProfile: action.payload.profile,
        sessionToken: action.payload.token,
        sessionExpiry: action.payload.sessionExpiry,
        lastActivity: new Date(),
        adminPermissions: action.payload.permissions || [],
        adminLevel: action.payload.adminLevel || 1,
        adminRole: action.payload.role || 'admin',
        adminSecurityContext: {
          ...state.adminSecurityContext,
          ...action.payload.securityContext,
          loginAttempts: 0,
          accountLocked: false,
          lastLogin: new Date()
        },
        activityProfile: {
          ...state.activityProfile,
          totalSessions: state.activityProfile.totalSessions + 1
        },
        loginError: null,
        error: null
      };
      
    case ActionTypes.LOGIN_FAILURE:
      return {
        ...state,
        authState: AUTH_STATES.ERROR,
        isAuthenticated: false,
        isLoading: false,
        loginError: action.payload.message,
        adminSecurityContext: {
          ...state.adminSecurityContext,
          loginAttempts: action.payload.loginAttempts || 0,
          accountLocked: action.payload.accountLocked || false,
          lockUntil: action.payload.lockUntil || null
        }
      };
      
    case ActionTypes.SESSION_EXPIRED:
      return {
        ...state,
        authState: AUTH_STATES.SESSION_EXPIRED,
        isAuthenticated: false,
        sessionToken: null,
        sessionExpiry: null,
        error: 'Session expired. Please login again.'
      };
      
    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        authState: AUTH_STATES.UNAUTHENTICATED,
        isLoading: false,
        // Preserve some settings
        adminPreferences: state.adminPreferences
      };
      
    case ActionTypes.LOAD_PROFILE:
      return {
        ...state,
        adminProfile: action.payload.profile,
        adminSecurityContext: {
          ...state.adminSecurityContext,
          ...action.payload.securityContext
        },
        activityProfile: {
          ...state.activityProfile,
          ...action.payload.activityProfile
        }
      };
      
    case ActionTypes.UPDATE_PROFILE:
      return {
        ...state,
        adminProfile: {
          ...state.adminProfile,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_PREFERENCES:
      return {
        ...state,
        adminPreferences: {
          ...state.adminPreferences,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_SECURITY_CONTEXT:
      return {
        ...state,
        adminSecurityContext: {
          ...state.adminSecurityContext,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_ACTIVITY:
      return {
        ...state,
        lastActivity: new Date(),
        activityProfile: {
          ...state.activityProfile,
          totalActiveTime: state.activityProfile.totalActiveTime + 1
        }
      };
      
    case ActionTypes.REFRESH_SESSION:
      return {
        ...state,
        sessionExpiry: action.payload.sessionExpiry,
        lastActivity: new Date()
      };
      
    case ActionTypes.ACCOUNT_LOCKED:
      return {
        ...state,
        authState: AUTH_STATES.LOCKED,
        isAuthenticated: false,
        adminSecurityContext: {
          ...state.adminSecurityContext,
          accountLocked: true,
          lockUntil: action.payload.lockUntil
        },
        error: action.payload.message
      };
      
    case ActionTypes.CLEAR_ERRORS:
      return {
        ...state,
        error: null,
        loginError: null
      };
      
    case ActionTypes.RESET_STATE:
      return {
        ...initialState,
        adminPreferences: state.adminPreferences
      };
      
    default:
      return state;
  }
};

// Create the AuthContext
const AuthContext = createContext();

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { deviceFingerprint, userType } = useUserType();
  
  // Admin login function
  const loginAdmin = useCallback(async (credentials) => {
    try {
      dispatch({ type: ActionTypes.LOGIN_START });
      
      // Call API service for admin login
      const response = await apiService.adminLogin({
        ...credentials,
        deviceFingerprint: deviceFingerprint
      });
      
      if (response.success) {
        // Store token in localStorage
        localStorage.setItem('safestreets_admin_token', response.token);
        
        // Calculate session expiry (default 24 hours)
        const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        dispatch({
          type: ActionTypes.LOGIN_SUCCESS,
          payload: {
            user: response.user,
            profile: response.user, // Initial profile is the user data
            token: response.token,
            sessionExpiry: sessionExpiry,
            permissions: response.user.permissions,
            adminLevel: response.user.adminLevel,
            role: response.user.role || 'admin',
            securityContext: response.securityContext
          }
        });
        
        // Load full profile after login
        await loadAdminProfile();
        
        console.log('✅ Admin login successful');
        return { success: true, user: response.user };
        
      } else {
        dispatch({
          type: ActionTypes.LOGIN_FAILURE,
          payload: {
            message: response.message,
            loginAttempts: response.attemptsRemaining ? (5 - response.attemptsRemaining) : 0,
            accountLocked: response.accountLocked || false,
            lockUntil: response.lockUntil || null
          }
        });
        
        console.log('❌ Admin login failed:', response.message);
        return { success: false, message: response.message };
      }
      
    } catch (error) {
      console.error('❌ Admin login error:', error);
      dispatch({
        type: ActionTypes.LOGIN_FAILURE,
        payload: {
          message: 'Login failed. Please try again.',
          loginAttempts: 0,
          accountLocked: false
        }
      });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }, [deviceFingerprint]);
  
  // Admin logout function
  const logoutAdmin = useCallback(async () => {
    try {
      // Call API service for admin logout
      await apiService.adminLogout();
      
      // Clear local storage
      localStorage.removeItem('safestreets_admin_token');
      
      // Reset state
      dispatch({ type: ActionTypes.LOGOUT });
      
      console.log('✅ Admin logout successful');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Admin logout error:', error);
      
      // Force logout even if API call fails
      localStorage.removeItem('safestreets_admin_token');
      dispatch({ type: ActionTypes.LOGOUT });
      
      return { success: false, message: 'Logout completed with errors' };
    }
  }, []);
  
  // Load admin profile
  const loadAdminProfile = useCallback(async () => {
    try {
      const response = await apiService.getAdminProfile();
      
      if (response.success) {
        dispatch({
          type: ActionTypes.LOAD_PROFILE,
          payload: {
            profile: response.user,
            securityContext: response.securityContext,
            activityProfile: response.activityProfile
          }
        });
        
        console.log('✅ Admin profile loaded');
        return { success: true, profile: response.user };
      } else {
        console.log('❌ Failed to load admin profile:', response.message);
        return { success: false, message: response.message };
      }
      
    } catch (error) {
      console.error('❌ Admin profile load error:', error);
      return { success: false, message: 'Failed to load profile' };
    }
  }, []);
  
  // Update admin preferences
  const updateAdminPreferences = useCallback(async (preferences) => {
    try {
      const response = await apiService.updateUserPreferences(preferences);
      
      if (response.success) {
        dispatch({
          type: ActionTypes.UPDATE_PREFERENCES,
          payload: preferences
        });
        
        // Also save to localStorage for persistence
        localStorage.setItem('safestreets_admin_preferences', JSON.stringify(preferences));
        
        console.log('✅ Admin preferences updated');
        return { success: true };
      } else {
        console.log('❌ Failed to update preferences:', response.message);
        return { success: false, message: response.message };
      }
      
    } catch (error) {
      console.error('❌ Admin preferences update error:', error);
      return { success: false, message: 'Failed to update preferences' };
    }
  }, []);
  
  // Check if admin has specific permission
  const hasAdminPermission = useCallback((permission) => {
    return state.adminPermissions.includes(permission) || 
           state.adminPermissions.includes('super_admin');
  }, [state.adminPermissions]);
  
  // Update activity (for session management)
  const updateActivity = useCallback(() => {
    dispatch({ type: ActionTypes.UPDATE_ACTIVITY });
  }, []);
  
  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_ERRORS });
  }, []);
  
  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('safestreets_admin_token');
      if (storedToken && !state.isAuthenticated) {
        try {
          const response = await apiService.verifyAdminSession();
          if (response.success) {
            // Load profile if session is valid
            await loadAdminProfile();
          } else {
            // Remove invalid token
            localStorage.removeItem('safestreets_admin_token');
            dispatch({ type: ActionTypes.SESSION_EXPIRED });
          }
        } catch (error) {
          console.error('❌ Session verification failed:', error);
          localStorage.removeItem('safestreets_admin_token');
          dispatch({ type: ActionTypes.SESSION_EXPIRED });
        }
      }
    };
    
    verifySession();
  }, [state.isAuthenticated, loadAdminProfile]);
  
  // Load saved preferences on mount
  useEffect(() => {
    const savedPreferences = localStorage.getItem('safestreets_admin_preferences');
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        dispatch({
          type: ActionTypes.UPDATE_PREFERENCES,
          payload: preferences
        });
      } catch (error) {
        console.error('❌ Failed to load saved preferences:', error);
      }
    }
  }, []);
  
  // Activity tracking for session management
  useEffect(() => {
    if (state.isAuthenticated) {
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      
      const handleActivity = () => {
        updateActivity();
      };
      
      activityEvents.forEach(event => {
        document.addEventListener(event, handleActivity, { passive: true });
      });
      
      return () => {
        activityEvents.forEach(event => {
          document.removeEventListener(event, handleActivity);
        });
      };
    }
  }, [state.isAuthenticated, updateActivity]);
  
  // Session expiry check
  useEffect(() => {
    if (state.isAuthenticated && state.sessionExpiry) {
      const checkExpiry = () => {
        if (new Date() > new Date(state.sessionExpiry)) {
          console.log('🕒 Admin session expired');
          dispatch({ type: ActionTypes.SESSION_EXPIRED });
          localStorage.removeItem('safestreets_admin_token');
        }
      };
      
      const interval = setInterval(checkExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [state.isAuthenticated, state.sessionExpiry]);
  
  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Actions
    loginAdmin,
    logoutAdmin,
    loadAdminProfile,
    updateAdminPreferences,
    updateActivity,
    clearErrors,
    
    // Utilities
    hasAdminPermission,
    
    // Computed values
    isSessionExpired: state.authState === AUTH_STATES.SESSION_EXPIRED,
    isAccountLocked: state.authState === AUTH_STATES.LOCKED,
    isAuthenticating: state.authState === AUTH_STATES.AUTHENTICATING,
    sessionTimeRemaining: state.sessionExpiry ? 
      Math.max(0, new Date(state.sessionExpiry) - new Date()) : 0,
    
    // Constants
    AUTH_STATES
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Additional specialized hooks for admin features
export const useAdminAuth = () => {
  const {
    isAuthenticated,
    isLoading,
    adminUser,
    adminProfile,
    adminPermissions,
    adminLevel,
    loginAdmin,
    logoutAdmin,
    hasAdminPermission,
    error,
    loginError,
    clearErrors
  } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    adminUser,
    adminProfile,
    adminPermissions,
    adminLevel,
    loginAdmin,
    logoutAdmin,
    hasAdminPermission,
    error,
    loginError,
    clearErrors
  };
};

export const useAdminSession = () => {
  const {
    sessionToken,
    sessionExpiry,
    lastActivity,
    sessionTimeRemaining,
    isSessionExpired,
    updateActivity
  } = useAuth();
  
  return {
    sessionToken,
    sessionExpiry,
    lastActivity,
    sessionTimeRemaining,
    isSessionExpired,
    updateActivity
  };
};

export const useAdminPreferences = () => {
  const {
    adminPreferences,
    updateAdminPreferences
  } = useAuth();
  
  return {
    preferences: adminPreferences,
    updatePreferences: updateAdminPreferences
  };
};

export const useAdminSecurity = () => {
  const {
    adminSecurityContext,
    isAccountLocked,
    hasAdminPermission
  } = useAuth();
  
  return {
    securityContext: adminSecurityContext,
    isAccountLocked,
    hasAdminPermission
  };
};

export default AuthContext;