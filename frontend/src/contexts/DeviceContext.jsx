// === frontend/src/contexts/DeviceContext.jsx ===

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import apiService from '../services/api';

// Simplified fingerprint generation logic
const generateDeviceFingerprint = () => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('SafeStreets Device Security', 2, 2);
    return btoa(canvas.toDataURL()).slice(0, 64);
  } catch (error) {
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  const [fingerprint, setFingerprint] = useState(null);

  useEffect(() => {
    // This effect runs only once on initial app load.
    let storedFingerprint = localStorage.getItem('deviceFingerprint');

    if (!storedFingerprint) {
      storedFingerprint = generateDeviceFingerprint();
      localStorage.setItem('deviceFingerprint', storedFingerprint);
    }
    
    console.log('📱 DeviceContext Initialized. Fingerprint:', storedFingerprint.substring(0, 15) + '...');
    setFingerprint(storedFingerprint);

    // IMPORTANT: Set the fingerprint on the global apiService instance
    // This ensures all subsequent API calls from any service will have it.
    apiService.setDeviceFingerprint(storedFingerprint);

  }, []); // Empty dependency array ensures this runs only once.

  // useMemo ensures the context value object is stable unless the fingerprint changes.
  const value = useMemo(() => ({
    deviceFingerprint: fingerprint
  }), [fingerprint]);

  // We don't render children until the fingerprint has been generated and set.
  return fingerprint ? (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  ) : null; // Or a loading spinner
};

// Custom hook to easily access the context
export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};