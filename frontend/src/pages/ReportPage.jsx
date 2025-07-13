// === src/pages/ReportPage.jsx (Complete with ALL original functionality + config integration) ===
import { useState, useEffect } from 'react'
import { MapPin, Camera, Send, AlertTriangle, Shield, CheckCircle, Navigation } from 'lucide-react'
import { useSubmitReport } from '../hooks/useReports'
import LocationPicker from '../components/LocationPicker/LocationPicker'
import { isWithinBangladesh } from '../config/locationConfig'

function ReportPage() {
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    severity: 3
  })

  // Location state management (keeping original functionality)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)

  const { submitReport, submitting, error, success, reset } = useSubmitReport()

  // Original GPS location functionality (preserved for backward compatibility)
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser')
      return
    }

    setLocationLoading(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const gpsLocation = { lat: latitude, lng: longitude }
        setUserLocation(gpsLocation)
        setLocationLoading(false)
        
        // Auto-set in LocationPicker as well
        setSelectedLocation({
          lat: latitude,
          lng: longitude,
          address: 'GPS Location',
          source: 'GPS',
          withinBangladesh: isWithinBangladesh(latitude, longitude)
        })
        
        console.log('📍 Got user location:', { latitude, longitude })
      },
      (error) => {
        let errorMessage = 'Unable to get location'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
        }
        setLocationError(errorMessage)
        setLocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 600000 // 10 minutes
      }
    )
  }

  // Helper function to check if coordinates are within Bangladesh (now using config)
  // const isWithinBangladesh = (lat, lng) => {
  //   const bangladeshBounds = {
  //     north: 26.0,
  //     south: 20.0,
  //     east: 93.0,
  //     west: 88.0
  //   }
  //   
  //   return lat >= bangladeshBounds.south && 
  //          lat <= bangladeshBounds.north && 
  //          lng >= bangladeshBounds.west && 
  //          lng <= bangladeshBounds.east
  // }
  // Now using isWithinBangladesh from locationConfig.js

  // Get user's current location on component mount (original behavior)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
        },
        (error) => {
          console.log('Could not get user location:', error)
          // Don't show error to user initially - LocationPicker will handle this
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 600000 // 10 minutes
        }
      )
    }
  }, [])

  // Handle location selection from LocationPicker
  const handleLocationSelect = (locationData) => {
    console.log('📍 Location selected in ReportPage:', locationData)
    setSelectedLocation(locationData)
    
    // Update form data with the address
    if (locationData) {
      setFormData(prev => ({
        ...prev,
        location: locationData.address || 'Selected location'
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        location: ''
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      // Determine coordinates to use (enhanced logic)
      let coordinates
      let locationSource = 'default'
      
      if (selectedLocation) {
        // Use manually selected location (priority)
        coordinates = [selectedLocation.lng, selectedLocation.lat]
        locationSource = selectedLocation.source
        console.log('🚀 Using manually selected location:', coordinates)
      } else if (userLocation) {
        // Fallback to user's GPS location
        coordinates = [userLocation.lng, userLocation.lat]
        locationSource = 'GPS'
        console.log('🚀 Using GPS fallback location:', coordinates)
      } else {
        // Final fallback to Dhaka center
        coordinates = [90.4125, 23.8103]
        locationSource = 'default'
        console.log('🚀 Using default Dhaka location:', coordinates)
      }

      // Enhanced report data structure with security measures
      const reportData = {
        type: formData.type,
        description: formData.description,
        location: {
          coordinates: coordinates,
          address: formData.location || 'Location provided',
          source: locationSource,
          withinBangladesh: selectedLocation?.withinBangladesh ?? 
                           (userLocation ? isWithinBangladesh(userLocation.lat, userLocation.lng) : true),
          obfuscated: true // Always obfuscate for privacy
        },
        severity: formData.severity,
        timestamp: new Date().toISOString() // Add timestamp for better tracking
      }

      console.log('🚀 Submitting report with enhanced data:', reportData)

      await submitReport(reportData)
      
      // Reset form on success (preserve original behavior)
      setFormData({
        type: '',
        description: '',
        location: '',
        severity: 3
      })
      setSelectedLocation(null)
      
      // Clear location states
      setUserLocation(null)
      setLocationError(null)
      setLocationLoading(false)
    } catch (err) {
      console.error('Failed to submit report:', err)
    }
  }

  const incidentTypes = [
    { value: 'chadabaji', label: 'Chadabaji (Extortion)', icon: '💰' },
    { value: 'teen_gang', label: 'Teen Gang Activity', icon: '👥' },
    { value: 'chintai', label: 'Chintai (Street Robbery)', icon: '⚠️' },
    { value: 'other', label: 'Other Criminal Activity', icon: '🚨' }
  ]

  const getSeverityColor = (level) => {
    if (level <= 2) return 'bg-green-500'
    if (level <= 3) return 'bg-yellow-500'
    if (level <= 4) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getSeverityLabel = (level) => {
    if (level <= 2) return 'Low Risk'
    if (level <= 3) return 'Moderate Risk'
    if (level <= 4) return 'High Risk'
    return 'Critical Risk'
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container-mobile">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="bg-gradient-safe rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-4">
            Report an Incident
          </h1>
          <p className="text-neutral-600 leading-relaxed">
            Help make your community safer by reporting incidents anonymously and securely
          </p>
        </div>

        {/* Location Status Section (RESTORED from original) */}
        <div className="card mb-6">
          <div className="card-body">
            <h3 className="font-medium text-neutral-800 mb-3 flex items-center">
              <Navigation className="w-5 h-5 mr-2 text-bangladesh-green" />
              Location Services
            </h3>
            
            {!userLocation && !locationLoading && !locationError && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700 mb-3">
                  📍 For better accuracy, allow location access to automatically detect your area.
                </p>
                <button 
                  onClick={getCurrentLocation}
                  className="btn-primary btn-sm"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Get My Location
                </button>
              </div>
            )}

            {locationLoading && (
              <div className="bg-blue-50 p-4 rounded-lg flex items-center">
                <div className="loading-spinner w-4 h-4 mr-3"></div>
                <span className="text-blue-700">Getting your location...</span>
              </div>
            )}

            {userLocation && (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-700 font-medium">Location detected!</span>
                  {!isWithinBangladesh(userLocation.lat, userLocation.lng) && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Outside Bangladesh
                    </span>
                  )}
                </div>
                <p className="text-sm text-green-600 mt-1">
                  Your report will use your current area (location is obfuscated for privacy)
                </p>
              </div>
            )}

            {locationError && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-yellow-700 font-medium">Location unavailable</span>
                </div>
                <p className="text-sm text-yellow-600 mt-1">{locationError}</p>
                <p className="text-sm text-yellow-600">No worries - you can still submit a report with manual location selection below.</p>
              </div>
            )}
          </div>
        </div>

        {/* Success Message (RESTORED) */}
        {success && (
          <div className="alert-success mb-6 animate-slide-up">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-800 mb-1">Report Submitted Successfully!</h4>
                <p className="text-sm text-green-700">
                  Thank you for helping make your community safer. Your report has been received and will be reviewed by our moderation team.
                </p>
                <button 
                  onClick={reset}
                  className="text-sm text-green-600 underline mt-2"
                >
                  Submit another report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message (RESTORED) */}
        {error && (
          <div className="alert-danger mb-6">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 mb-1">Submission Failed</h4>
                <p className="text-sm text-red-700">{error}</p>
                <button 
                  onClick={reset}
                  className="text-sm text-red-600 underline mt-2"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <div className="card mb-6">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Incident Type (Enhanced with visual cards) */}
              <div>
                <label className="form-label">
                  <AlertTriangle className="w-4 h-4 text-bangladesh-green" />
                  Type of Incident
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {incidentTypes.map((type) => (
                    <label 
                      key={type.value}
                      className={`incident-type-card ${formData.type === type.value ? 'selected' : ''}`}
                    >
                      <input 
                        type="radio" 
                        name="type" 
                        value={type.value}
                        checked={formData.type === type.value}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="sr-only"
                        required
                      />
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{type.icon}</span>
                        <span className="font-medium">{type.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description (RESTORED with character counter) */}
              <div>
                <label className="form-label">
                  <Send className="w-4 h-4 text-bangladesh-green" />
                  Description
                  <span className="text-xs text-neutral-500 ml-2">(minimum 10 characters)</span>
                </label>
                <textarea 
                  className="form-textarea h-32"
                  placeholder="Describe what happened, when it occurred, and any other relevant details..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  minLength={10}
                  maxLength={1000}
                  required
                />
                <div className="text-xs text-neutral-400 mt-1">
                  {formData.description.length}/1000 characters
                </div>
              </div>

              {/* Location Selection - HYBRID APPROACH */}
              <div>
                <label className="form-label mb-3">
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 text-bangladesh-green" />
                    Location Selection
                  </span>
                </label>
                
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLocation={selectedLocation}
                  userLocation={userLocation}
                  className="mb-4"
                />

                {/* Manual location description (enhanced) */}
                <div className="mt-4">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">
                    Additional Location Details
                  </label>
                  <div className="input-with-icon">
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder="Enter area, landmark, or general location (e.g., Dhanmondi Area)"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      required
                    />
                    <MapPin className="icon" />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    📍 {selectedLocation || userLocation 
                      ? 'Your selected location will be used and obfuscated for privacy' 
                      : 'Provide a general area description - exact location is never stored'
                    }
                  </p>
                </div>
              </div>

              {/* Severity Level (RESTORED with detailed descriptions) */}
              <div>
                <label className="form-label justify-between">
                  <span className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-bangladesh-green" />
                    Severity Level
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getSeverityColor(formData.severity)}`}>
                    {getSeverityLabel(formData.severity)}
                  </span>
                </label>
                
                <div className="mt-4">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    className="w-full"
                    value={formData.severity}
                    onChange={(e) => setFormData({...formData, severity: parseInt(e.target.value)})}
                  />
                  <div className="flex justify-between text-sm text-neutral-500 mt-2">
                    <span>1 - Minor</span>
                    <span className="font-medium">Level {formData.severity}</span>
                    <span>5 - Critical</span>
                  </div>
                </div>

                {/* Severity Description (RESTORED from original) */}
                <div className="mt-3 p-3 rounded-lg bg-neutral-50">
                  <div className="text-sm text-neutral-600">
                    {formData.severity <= 2 && (
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                        Minor incident with minimal impact on community safety
                      </div>
                    )}
                    {formData.severity === 3 && (
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2 text-yellow-500" />
                        Moderate incident requiring attention from authorities
                      </div>
                    )}
                    {formData.severity === 4 && (
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                        Serious incident with significant community impact
                      </div>
                    )}
                    {formData.severity === 5 && (
                      <div className="flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                        Critical incident requiring immediate attention
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button (RESTORED original styling) */}
              <button 
                type="submit" 
                disabled={submitting || !formData.type || !formData.description}
                className={`btn-secondary w-full py-4 text-lg ${
                  submitting || !formData.type || !formData.description 
                    ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting Report...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Send className="w-5 h-5 mr-2" />
                    Submit Report Anonymously
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Privacy Notice (RESTORED) */}
        <div className="alert-info">
          <div className="flex items-start">
            <Shield className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Your Privacy is Protected</h4>
              <p className="text-sm text-blue-700">
                🔒 Your report is completely anonymous. We do not store personal information, track your identity, or log IP addresses. 
                Location data is obfuscated to protect your privacy while helping authorities understand incident patterns.
              </p>
            </div>
          </div>
        </div>

        {/* Emergency Notice (RESTORED) */}
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 mr-3 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 mb-1">Emergency Situations</h4>
              <p className="text-sm text-red-700">
                🚨 For immediate danger or ongoing crimes, call <strong>999</strong> directly. 
                SafeStreets is for reporting and mapping incidents, not emergency response.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportPage