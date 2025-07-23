// === frontend/src/contexts/AuthContext.jsx ===
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import { useDevice } from './DeviceContext';

// --- User Types ---
const USER_TYPES = {
  ANONYMOUS: 'anonymous',
  ADMIN: 'admin',
  POLICE: 'police',
  RESEARCHER: 'researcher'
};

// --- Authentication States ---
const AUTH_STATES = {
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  SESSION_EXPIRED: 'session_expired',
  ERROR: 'error'
};

// --- Initial State ---
const initialState = {
  // Core authentication
  isAuthenticated: false,
  isLoading: true,
  authState: AUTH_STATES.UNAUTHENTICATED,
  
  // User data
  user: null,
  userId: null,
  userType: USER_TYPES.ANONYMOUS,
  
  // Session management
  sessionToken: null,
  sessionExpiry: null,
  lastActivity: Date.now(),
  
  // Authorization
  permissions: ['view_map', 'submit_report', 'validate_reports'],
  
  // Security context
  securityContext: {
    trustScore: 50,
    riskLevel: 'medium',
    quarantined: false,
    deviceTrusted: false,
    loginAttempts: 0
  },
  
  // Preferences (from your original)
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
  
  // Error handling
  error: null,
  loginError: null,
};

// --- Action Types ---
const ActionTypes = {
  INIT_START: 'INIT_START',
  INIT_SUCCESS: 'INIT_SUCCESS',
  INIT_FAILURE: 'INIT_FAILURE',
  
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  
  LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  CLEAR_ERRORS: 'CLEAR_ERRORS',
};

// --- Reducer ---
const authReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.INIT_START:
      return { 
        ...state, 
        isLoading: true, 
        error: null,
        authState: AUTH_STATES.UNAUTHENTICATED
      };
    
    case ActionTypes.INIT_SUCCESS:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: action.payload.userType !== USER_TYPES.ANONYMOUS,
        authState: action.payload.userType !== USER_TYPES.ANONYMOUS 
          ? AUTH_STATES.AUTHENTICATED 
          : AUTH_STATES.UNAUTHENTICATED,
        user: action.payload.user,
        userId: action.payload.userId,
        userType: action.payload.userType,
        permissions: action.payload.permissions,
        securityContext: {
          ...state.securityContext,
          ...action.payload.securityContext
        },
        preferences: action.payload.preferences || state.preferences,
        sessionToken: action.payload.sessionToken,
        sessionExpiry: action.payload.sessionExpiry,
        lastActivity: Date.now(),
      };

    case ActionTypes.LOGIN_START:
      return { 
        ...state, 
        isLoading: true, 
        authState: AUTH_STATES.AUTHENTICATING,
        error: null,
        loginError: null
      };

    case ActionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        authState: AUTH_STATES.AUTHENTICATED,
        user: action.payload.user,
        userId: action.payload.user.id,
        userType: action.payload.userType,
        permissions: action.payload.permissions,
        securityContext: {
          ...state.securityContext,
          ...action.payload.securityContext,
          loginAttempts: 0 // Reset on successful login
        },
        sessionToken: action.payload.token,
        sessionExpiry: action.payload.sessionExpiry,
        preferences: action.payload.preferences || state.preferences,
        lastActivity: Date.now(),
        error: null,
        loginError: null,
      };
    
    case ActionTypes.LOGIN_FAILURE:
      return {
        ...state,
        isLoading: false,
        authState: AUTH_STATES.ERROR,
        loginError: action.payload.message,
        securityContext: {
          ...state.securityContext,
          loginAttempts: action.payload.loginAttempts || 0
        }
      };

    case ActionTypes.INIT_FAILURE:
      return {
        ...state,
        isLoading: false,
        authState: AUTH_STATES.ERROR,
        error: action.payload,
        // Fallback to basic anonymous state
        userType: USER_TYPES.ANONYMOUS,
        permissions: ['view_map', 'submit_report'],
        securityContext: {
          trustScore: 25,
          riskLevel: 'medium',
          quarantined: false,
          deviceTrusted: false,
          loginAttempts: 0
        }
      };

    case ActionTypes.SESSION_EXPIRED:
      return {
        ...state,
        isAuthenticated: false,
        authState: AUTH_STATES.SESSION_EXPIRED,
        sessionToken: null,
        sessionExpiry: null,
        user: null,
        userId: null,
        userType: USER_TYPES.ANONYMOUS,
        permissions: ['view_map', 'submit_report'],
        error: 'Session expired. Please login again.'
      };

    case ActionTypes.LOGOUT_SUCCESS:
      return {
        ...initialState,
        isLoading: false,
        authState: AUTH_STATES.UNAUTHENTICATED,
        // Preserve device-specific preferences
        preferences: {
          ...initialState.preferences,
          language: state.preferences.language,
          theme: state.preferences.theme
        }
      };

    case ActionTypes.UPDATE_PREFERENCES:
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      };

    case ActionTypes.UPDATE_ACTIVITY:
      return {
        ...state,
        lastActivity: Date.now()
      };

    case ActionTypes.CLEAR_ERRORS:
      return {
        ...state,
        error: null,
        loginError: null
      };

    default:
      return state;
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { deviceFingerprint } = useDevice();

  const initialize = useCallback(async () => {
    if (!deviceFingerprint) return;

    dispatch({ type: ActionTypes.INIT_START });
    try {
      // Check for existing session token first
      const storedToken = localStorage.getItem('safestreets_admin_token');
      if (storedToken) {
        const sessionResponse = await apiService.verifyAdminSession();
        if (sessionResponse.success) {
          // Initialize as authenticated user
          dispatch({
            type: ActionTypes.INIT_SUCCESS,
            payload: {
              userType: USER_TYPES.ADMIN,
              user: sessionResponse.user,
              userId: sessionResponse.user.id,
              permissions: sessionResponse.user.permissions,
              securityContext: sessionResponse.securityContext,
              preferences: sessionResponse.preferences,
              sessionToken: storedToken,
              sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });
          console.log('✅ AuthContext: Restored admin session');
          return;
        } else {
          localStorage.removeItem('safestreets_admin_token');
        }
      }

      // Initialize as anonymous user
      const response = await apiService.getUserContext(deviceFingerprint);
      if (response.success) {
        dispatch({
          type: ActionTypes.INIT_SUCCESS,
          payload: {
            userType: USER_TYPES.ANONYMOUS,
            user: response.user,
            userId: response.userContext.userId,
            permissions: response.userContext.permissions,
            securityContext: response.userContext.securityContext,
            preferences: response.user?.preferences
          }
        });
        console.log('✅ AuthContext: Initialized as anonymous user');
      } else {
        throw new Error(response.message || 'Failed to initialize user session.');
      }
    } catch (err) {
      console.error('❌ AuthContext initialization failed:', err);
      dispatch({ type: ActionTypes.INIT_FAILURE, payload: err.message });
    }
  }, [deviceFingerprint]);

  // Generic login function that works for all user types
  const login = useCallback(async (credentials, userType = USER_TYPES.ADMIN) => {
    dispatch({ type: ActionTypes.LOGIN_START });
    try {
      let response;
      
      // Call appropriate login endpoint
      switch (userType) {
        case USER_TYPES.ADMIN:
          response = await apiService.adminLogin({
            ...credentials,
            deviceFingerprint
          });
          break;
        case USER_TYPES.POLICE:
          response = await apiService.policeLogin({
            ...credentials,
            deviceFingerprint
          });
          break;
        case USER_TYPES.RESEARCHER:
          response = await apiService.researcherLogin({
            ...credentials,
            deviceFingerprint
          });
          break;
        default:
          throw new Error('Invalid user type');
      }

      if (response.success && response.token) {
        // Store token (using generic key for now, could be user-type specific)
        localStorage.setItem('safestreets_admin_token', response.token);
        
        dispatch({
          type: ActionTypes.LOGIN_SUCCESS,
          payload: {
            userType,
            user: response.user,
            permissions: response.user.permissions,
            securityContext: response.securityContext,
            preferences: response.preferences,
            token: response.token,
            sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        });
        
        console.log(`✅ ${userType} login successful`);
        return { success: true, user: response.user };
      } else {
        dispatch({
          type: ActionTypes.LOGIN_FAILURE,
          payload: {
            message: response.message || 'Login failed',
            loginAttempts: response.loginAttempts || 0
          }
        });
        return { success: false, message: response.message };
      }
    } catch (err) {
      console.error('❌ Login failed:', err);
      dispatch({
        type: ActionTypes.LOGIN_FAILURE,
        payload: { message: 'Login failed. Please try again.' }
      });
      return { success: false, message: 'Login failed. Please try again.' };
    }
  }, [deviceFingerprint]);

  // Convenience method for admin login
  const loginAdmin = useCallback((credentials) => {
    return login(credentials, USER_TYPES.ADMIN);
  }, [login]);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint if authenticated
      if (state.userType !== USER_TYPES.ANONYMOUS) {
        await apiService.adminLogout();
      }
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      localStorage.removeItem('safestreets_admin_token');
      dispatch({ type: ActionTypes.LOGOUT_SUCCESS });
      // Re-initialize as anonymous
      await initialize();
    }
  }, [state.userType, initialize]);

  // Update preferences
  const updatePreferences = useCallback(async (newPreferences) => {
    try {
      if (state.userType !== USER_TYPES.ANONYMOUS) {
        const response = await apiService.updateUserPreferences(newPreferences);
        if (!response.success) {
          throw new Error(response.message);
        }
      } else {
        // Store locally for anonymous users
        const currentPrefs = JSON.parse(localStorage.getItem('safestreets_preferences') || '{}');
        localStorage.setItem('safestreets_preferences', JSON.stringify({
          ...currentPrefs,
          ...newPreferences
        }));
      }
      
      dispatch({
        type: ActionTypes.UPDATE_PREFERENCES,
        payload: newPreferences
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to update preferences:', error);
      return { success: false, error: error.message };
    }
  }, [state.userType]);

  // Permission check
  const hasPermission = useCallback((permission) => {
    return state.permissions.includes('super_admin') || state.permissions.includes(permission);
  }, [state.permissions]);

  // Activity update
  const updateActivity = useCallback(() => {
    dispatch({ type: ActionTypes.UPDATE_ACTIVITY });
  }, []);

  // Clear errors
  const clearErrors = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_ERRORS });
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Load saved preferences for anonymous users
  useEffect(() => {
    if (state.userType === USER_TYPES.ANONYMOUS && !state.isLoading) {
      const savedPrefs = JSON.parse(localStorage.getItem('safestreets_preferences') || '{}');
      if (Object.keys(savedPrefs).length > 0) {
        dispatch({
          type: ActionTypes.UPDATE_PREFERENCES,
          payload: savedPrefs
        });
      }
    }
  }, [state.userType, state.isLoading]);

  // Activity tracking
  useEffect(() => {
    if (state.isAuthenticated) {
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handleActivity = () => updateActivity();
      
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
          console.log('🕒 Session expired');
          dispatch({ type: ActionTypes.SESSION_EXPIRED });
          localStorage.removeItem('safestreets_admin_token');
        }
      };
      
      const interval = setInterval(checkExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [state.isAuthenticated, state.sessionExpiry]);

  const value = {
    // State
    ...state,
    
    // Actions
    login,
    loginAdmin,
    logout,
    updatePreferences,
    updateActivity,
    clearErrors,
    
    // Utilities
    hasPermission,
    isAdmin: state.userType === USER_TYPES.ADMIN && state.isAuthenticated,
    isPolice: state.userType === USER_TYPES.POLICE && state.isAuthenticated,
    isResearcher: state.userType === USER_TYPES.RESEARCHER && state.isAuthenticated,
    isAnonymous: state.userType === USER_TYPES.ANONYMOUS,
    
    // Computed values
    isSessionExpired: state.authState === AUTH_STATES.SESSION_EXPIRED,
    isAuthenticating: state.authState === AUTH_STATES.AUTHENTICATING,
    sessionTimeRemaining: state.sessionExpiry ? 
      Math.max(0, new Date(state.sessionExpiry) - new Date()) : 0,
    
    // Constants
    USER_TYPES,
    AUTH_STATES
  };

  return (
    <AuthContext.Provider value={value}>
      {!state.isLoading ? children : <div>Loading Session...</div>}
    </AuthContext.Provider>
  );
};

// Main hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Specialized hooks for convenience
export const usePermissions = () => {
  const { permissions, hasPermission } = useAuth();
  return { permissions, hasPermission };
};

export const usePreferences = () => {
  const { preferences, updatePreferences } = useAuth();
  return { preferences, updatePreferences };
};

export const useAdminAuth = () => {
  const { 
    isAuthenticated, 
    isAdmin, 
    user, 
    loginAdmin, 
    logout, 
    hasPermission,
    isLoading,
    error,
    loginError,
    clearErrors
  } = useAuth();
  
  return {
    isAuthenticated: isAuthenticated && isAdmin,
    adminUser: isAdmin ? user : null,
    loginAdmin,
    logoutAdmin: logout,
    hasAdminPermission: hasPermission,
    isLoading,
    error,
    loginError,
    clearErrors
  };
};

export const useSession = () => {
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

export default AuthContext;