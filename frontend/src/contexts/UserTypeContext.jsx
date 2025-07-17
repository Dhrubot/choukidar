// === frontend/src/contexts/UserTypeContext.jsx ===
// User Type Context for SafeStreets Bangladesh Frontend
// Manages user type state, device fingerprinting, and role-based features

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { useAuth } from './AuthContext'; // Import useAuth from AuthContext

// Device fingerprinting service
const generateDeviceFingerprint = () => {
  try {
    // Create canvas fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('SafeStreets Device Security', 2, 2);
    const canvasData = canvas.toDataURL();
    
    // Collect device characteristics
    const deviceData = {
      canvas: btoa(canvasData).slice(0, 32),
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: btoa(navigator.userAgent).slice(0, 16),
      timestamp: Date.now(),
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      hardwareConcurrency: navigator.hardwareConcurrency || 4
    };
    
    // Generate fingerprint hash
    const fingerprintString = JSON.stringify(deviceData);
    const fingerprint = btoa(fingerprintString).slice(0, 32);
    
    console.log('📱 Device fingerprint generated:', fingerprint);
    return fingerprint;
    
  } catch (error) {
    console.error('❌ Error generating device fingerprint:', error);
    // Fallback fingerprint
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

// Initial state
const initialState = {
  // User identity
  userType: 'anonymous',
  userId: null,
  deviceFingerprint: null,
  
  // Authentication state (general, will be overridden by AuthContext for admin)
  isAuthenticated: false,
  authToken: null,
  
  // User data
  user: null,
  permissions: ['view_map', 'submit_report', 'validate_reports'],
  
  // Security context
  securityContext: {
    trustScore: 50,
    riskLevel: 'medium',
    quarantined: false,
    deviceTrusted: false
  },
  
  // UI state
  preferences: {
    language: 'en',
    theme: 'light',
    femaleSafetyMode: false,
    mapSettings: {
      defaultView: 'clusters',
      showSafeZones: true,
      showFemaleIncidents: true
    }
  },
  
  // Loading states
  loading: true,
  error: null,
  
  // Session state
  sessionActive: false,
  lastActivity: Date.now()
};

// Action types
const ActionTypes = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_USER_CONTEXT: 'SET_USER_CONTEXT',
  SET_USER_TYPE: 'SET_USER_TYPE',
  SET_AUTHENTICATION: 'SET_AUTHENTICATION',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  UPDATE_SECURITY_CONTEXT: 'UPDATE_SECURITY_CONTEXT',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  LOGOUT: 'LOGOUT',
  RESET_STATE: 'RESET_STATE',
  // New action type to sync with AuthContext for authenticated users
  SYNC_AUTHENTICATED_USER: 'SYNC_AUTHENTICATED_USER',
};

// Reducer
const userTypeReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
        error: action.payload ? null : state.error
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      };
      
    case ActionTypes.SET_USER_CONTEXT:
      return {
        ...state,
        ...action.payload,
        loading: false,
        error: null,
        sessionActive: true,
        lastActivity: Date.now()
      };
      
    case ActionTypes.SET_USER_TYPE:
      return {
        ...state,
        userType: action.payload.userType,
        permissions: action.payload.permissions || state.permissions,
        loading: false
      };
      
    case ActionTypes.SET_AUTHENTICATION:
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        authToken: action.payload.token,
        user: action.payload.user,
        userType: action.payload.user?.userType || 'anonymous',
        permissions: action.payload.permissions || state.permissions,
        loading: false
      };
      
    case ActionTypes.UPDATE_PREFERENCES:
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_SECURITY_CONTEXT:
      return {
        ...state,
        securityContext: {
          ...state.securityContext,
          ...action.payload
        }
      };
      
    case ActionTypes.UPDATE_ACTIVITY:
      return {
        ...state,
        lastActivity: Date.now()
      };
      
    case ActionTypes.LOGOUT:
      return {
        ...initialState,
        deviceFingerprint: state.deviceFingerprint,
        userType: 'anonymous',
        loading: false
      };
      
    case ActionTypes.RESET_STATE:
      return {
        ...initialState,
        loading: false
      };

    // New case to sync authenticated user details from AuthContext
    case ActionTypes.SYNC_AUTHENTICATED_USER:
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        userType: action.payload.userType,
        user: action.payload.user,
        permissions: action.payload.permissions,
        securityContext: {
          ...state.securityContext, // Keep existing device-related security context
          ...action.payload.securityContext // Override with user-specific security context
        },
        loading: false, // Assume loading is done once authenticated user is synced
      };
      
    default:
      return state;
  }
};

// Create context
const UserTypeContext = createContext();

// Provider component
export const UserTypeProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userTypeReducer, initialState);
  // Get authentication state from AuthContext
  const { isAuthenticated: authContextIsAuthenticated, adminUser, adminPermissions, adminSecurityContext, isLoading: authLoading } = useAuth();
  
  // Initialize device fingerprint and user context
  const initializeUserContext = useCallback(async () => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      // Generate or retrieve device fingerprint
      let deviceFingerprint = localStorage.getItem('safestreets_device_id');
      if (!deviceFingerprint) {
        deviceFingerprint = generateDeviceFingerprint();
        localStorage.setItem('safestreets_device_id', deviceFingerprint);
      }
      
      // Get user context from backend
      const response = await apiService.getUserContext(deviceFingerprint);
      
      if (response.success) {
        dispatch({
          type: ActionTypes.SET_USER_CONTEXT,
          payload: {
            userType: response.userContext.userType,
            userId: response.userContext.userId,
            deviceFingerprint: response.userContext.deviceFingerprint,
            permissions: response.userContext.permissions,
            securityContext: response.userContext.securityContext,
            user: response.user,
            preferences: response.user?.preferences || initialState.preferences
          }
        });
        
        console.log('✅ User context initialized:', response.userContext.userType);
      } else {
        throw new Error(response.message || 'Failed to initialize user context');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize user context:', error);
      
      // Fallback to basic anonymous context
      const fallbackFingerprint = generateDeviceFingerprint();
      dispatch({
        type: ActionTypes.SET_USER_CONTEXT,
        payload: {
          userType: 'anonymous',
          userId: `fallback_${Date.now()}`,
          deviceFingerprint: fallbackFingerprint,
          permissions: ['view_map', 'submit_report'],
          securityContext: {
            trustScore: 25,
            riskLevel: 'medium',
            quarantined: false,
            deviceTrusted: false
          }
        }
      });
      
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: 'Limited functionality - connection issues detected'
      });
    }
  }, []);
  
  // Admin login (this function is primarily for AuthContext to call,
  // UserTypeContext will sync from AuthContext's state)
  const loginAdmin = useCallback(async (credentials) => {
    // This function is less relevant here now that AuthContext is the primary login handler
    // We'll keep it for compatibility but its logic should be minimal or removed if AuthContext handles it fully.
    console.warn("UserTypeContext's loginAdmin called. Consider using AuthContext's loginAdmin directly.");
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      const response = await apiService.adminLogin({
        ...credentials,
        deviceFingerprint: state.deviceFingerprint
      });
      
      if (response.success) {
        localStorage.setItem('safestreets_admin_token', response.token);
        dispatch({
          type: ActionTypes.SET_AUTHENTICATION,
          payload: {
            isAuthenticated: true,
            token: response.token,
            user: response.user,
            permissions: response.user.permissions
          }
        });
        console.log('✅ Admin login successful (via UserTypeContext):', response.user.username);
        return { success: true };
      } else {
        throw new Error(response.message || 'Login failed');
      }
      
    } catch (error) {
      console.error('❌ Admin login failed (via UserTypeContext):', error);
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: error.message || 'Login failed'
      });
      return { success: false, error: error.message };
    }
  }, [state.deviceFingerprint]);
  
  // Admin logout
  const logoutAdmin = useCallback(async () => {
    try {
      await apiService.adminLogout();
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('safestreets_admin_token');
      
      // Reset to anonymous state
      dispatch({ type: ActionTypes.LOGOUT });
      
      // Reinitialize as anonymous user
      await initializeUserContext();
      
      console.log('✅ Logged out successfully');
    }
  }, [initializeUserContext]);
  
  // Update user preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    try {
      if (state.userType !== 'anonymous') {
        const response = await apiService.updateUserPreferences(newPreferences);
        if (response.success) {
          dispatch({
            type: ActionTypes.UPDATE_PREFERENCES,
            payload: newPreferences
          });
          return { success: true };
        }
      } else {
        // Update local preferences for anonymous users
        dispatch({
          type: ActionTypes.UPDATE_PREFERENCES,
          payload: newPreferences
        });
        
        // Store in localStorage for anonymous users
        const currentPrefs = JSON.parse(localStorage.getItem('safestreets_preferences') || '{}');
        localStorage.setItem('safestreets_preferences', JSON.stringify({
          ...currentPrefs,
          ...newPreferences
        }));
        
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Failed to update preferences:', error);
      return { success: false, error: error.message };
    }
  }, [state.userType]);
  
  // Check permission
  const hasPermission = useCallback((permission) => {
    return state.permissions.includes(permission) || 
           state.permissions.includes('super_admin');
  }, [state.permissions]);
  
  // Update activity timestamp
  const updateActivity = useCallback(() => {
    dispatch({ type: ActionTypes.UPDATE_ACTIVITY });
  }, []);
  
  // Check if user is quarantined
  const isQuarantined = useCallback(() => {
    return state.securityContext.quarantined;
  }, [state.securityContext.quarantined]);
  
  // Get user display info
  const getUserDisplayInfo = useCallback(() => {
    if (state.userType === 'admin' && state.user) {
      return {
        type: 'Admin',
        name: state.user.username,
        level: `Level ${state.user.adminLevel}`,
        permissions: state.permissions
      };
    } else if (state.userType === 'police' && state.user) {
      return {
        type: 'Police',
        name: state.user.rank || 'Officer',
        department: state.user.department,
        permissions: state.permissions
      };
    } else if (state.userType === 'researcher' && state.user) {
      return {
        type: 'Researcher',
        name: state.user.institution,
        level: state.user.accessLevel,
        permissions: state.permissions
      };
    } else {
      return {
        type: 'Citizen',
        name: 'Anonymous User',
        level: `Trust: ${state.securityContext.trustScore}`,
        permissions: state.permissions
      };
    }
  }, [state.userType, state.user, state.permissions, state.securityContext]);
  
  // Initialize on mount
  useEffect(() => {
    initializeUserContext();
  }, [initializeUserContext]);
  
  // --- NEW: Sync UserTypeContext with AuthContext's authenticated state ---
  useEffect(() => {
    // Only sync if AuthContext indicates authentication and UserTypeContext is not already authenticated as the same user
    if (authContextIsAuthenticated && adminUser && state.userType !== 'admin') {
      console.log('🔄 UserTypeContext: Syncing with AuthContext for authenticated admin.');
      dispatch({
        type: ActionTypes.SYNC_AUTHENTICATED_USER,
        payload: {
          isAuthenticated: authContextIsAuthenticated,
          userType: 'admin', // Explicitly set to admin
          user: adminUser,
          permissions: adminPermissions,
          securityContext: adminSecurityContext // Use security context from AuthContext
        }
      });
    } else if (!authContextIsAuthenticated && state.userType !== 'anonymous' && !authLoading) {
      // If AuthContext is no longer authenticated, and UserTypeContext is not anonymous,
      // and AuthContext has finished loading, reset UserTypeContext to anonymous.
      // This handles logout scenarios.
      console.log('🔄 UserTypeContext: AuthContext indicates logout. Resetting to anonymous.');
      // Re-initialize to get a fresh anonymous context based on device fingerprint
      initializeUserContext();
    }
  }, [authContextIsAuthenticated, adminUser, adminPermissions, adminSecurityContext, authLoading, state.userType, initializeUserContext]); // Add initializeUserContext to dependencies

  // Check for stored admin token on mount (This is now less critical as AuthContext handles primary auth check)
  useEffect(() => {
    const storedToken = localStorage.getItem('safestreets_admin_token');
    if (storedToken && !state.isAuthenticated && !authContextIsAuthenticated) {
      // Verify token with backend
      apiService.getAdminProfile() // This call is also made by AuthContext, might be redundant here
        .then(response => {
          if (response.success) {
            // This part might be removed if AuthContext is the sole source of truth for admin auth
            dispatch({
              type: ActionTypes.SET_AUTHENTICATION,
              payload: {
                isAuthenticated: true,
                token: storedToken,
                user: response.user,
                permissions: response.user.permissions
              }
            });
          } else {
            localStorage.removeItem('safestreets_admin_token');
          }
        })
        .catch(() => {
          localStorage.removeItem('safestreets_admin_token');
        });
    }
  }, [state.isAuthenticated, authContextIsAuthenticated]); // Keep authContextIsAuthenticated here

  // Load saved preferences for anonymous users
  useEffect(() => {
    if (state.userType === 'anonymous' && !state.loading) {
      const savedPrefs = JSON.parse(localStorage.getItem('safestreets_preferences') || '{}');
      if (Object.keys(savedPrefs).length > 0) {
        dispatch({
          type: ActionTypes.UPDATE_PREFERENCES,
          payload: savedPrefs
        });
      }
    }
  }, [state.userType, state.loading]);
  
  // Activity tracking
  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
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
  }, [updateActivity]);
  
  // Context value
  const contextValue = {
    // State
    ...state,
    
    // Actions
    loginAdmin, // This will be less used directly now
    logoutAdmin,
    updatePreferences,
    updateActivity,
    
    // Utilities
    hasPermission,
    isQuarantined,
    getUserDisplayInfo,
    
    // Data
    deviceFingerprint: state.deviceFingerprint
  };
  
  return (
    <UserTypeContext.Provider value={contextValue}>
      {children}
    </UserTypeContext.Provider>
  );
};

// Hook to use the context
export const useUserType = () => {
  const context = useContext(UserTypeContext);
  if (!context) {
    throw new Error('useUserType must be used within a UserTypeProvider');
  }
  return context;
};

// Additional hooks for specific functionality
export const usePermissions = () => {
  const { permissions, hasPermission } = useUserType();
  return { permissions, hasPermission };
};

export const useSecurityContext = () => {
  const { securityContext, isQuarantined } = useUserType();
  return { securityContext, isQuarantined };
};

export const useAdminAuth = () => {
  const { 
    userType, // This will now correctly reflect 'admin' from SYNC_AUTHENTICATED_USER
    isAuthenticated, 
    user, 
    loginAdmin, 
    logoutAdmin,
    loading,
    error 
  } = useUserType();
  
  return {
    isAdmin: userType === 'admin',
    isAuthenticated,
    adminUser: user,
    loginAdmin,
    logoutAdmin,
    loading,
    error
  };
};

export default UserTypeContext;