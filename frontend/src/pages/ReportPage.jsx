// === src/pages/ReportPage.jsx (FIXED - Dropdown, Improved Validation, Clean Integration) ===
import { useState, useEffect } from 'react'
import { MapPin, Send, AlertTriangle, Shield, CheckCircle, Navigation, ChevronDown } from 'lucide-react'
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

  // Location state management (streamlined)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)
  const [formErrors, setFormErrors] = useState({})

  const { submitReport, submitting, error, success, reset } = useSubmitReport()

  // Get user's current location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation({ lat: latitude, lng: longitude })
          setLocationLoading(false)
          console.log('📍 Got user location:', { latitude, longitude })
        },
        (error) => {
          console.log('Could not get user location:', error)
          setLocationLoading(false)
          // Don't show error to user initially - LocationPicker will handle this
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
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
      
      // Clear location error if one exists
      if (formErrors.location) {
        setFormErrors(prev => ({ ...prev, location: null }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        location: ''
      }))
    }
  }

  // Enhanced form validation
  const validateForm = () => {
    const errors = {}

    // Incident type validation
    if (!formData.type) {
      errors.type = 'Please select an incident type'
    }

    // Description validation
    if (!formData.description) {
      errors.description = 'Description is required'
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters'
    } else if (formData.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters'
    }

    // Location validation
    if (!formData.location && !selectedLocation && !userLocation) {
      errors.location = 'Please provide a location'
    }

    // Severity validation
    if (!formData.severity || formData.severity < 1 || formData.severity > 5) {
      errors.severity = 'Please select a valid severity level'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    if (!validateForm()) {
      console.log('❌ Form validation failed:', formErrors)
      return
    }
    
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

      // Enhanced report data structure matching backend schema
      const reportData = {
        type: formData.type,
        description: formData.description.trim(),
        location: {
          coordinates: coordinates,
          address: formData.location || 'Location provided',
          source: locationSource,
          withinBangladesh: selectedLocation?.withinBangladesh ?? 
                           (userLocation ? isWithinBangladesh(userLocation.lat, userLocation.lng) : true),
          obfuscated: true // Always obfuscate for privacy
        },
        severity: parseInt(formData.severity),
        timestamp: new Date().toISOString()
      }

      console.log('🚀 Submitting report with enhanced data:', reportData)

      await submitReport(reportData)
      
      // Reset form on success
      setFormData({
        type: '',
        description: '',
        location: '',
        severity: 3
      })
      setSelectedLocation(null)
      setFormErrors({})
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Failed to submit report:', err)
    }
  }

  // Incident types for dropdown (matching backend schema)
  const incidentTypes = [
    { value: '', label: 'Select incident type...', disabled: true },
    { value: 'chadabaji', label: '💰 Chadabaji (Extortion)', description: 'Political harassment or forced donations' },
    { value: 'teen_gang', label: '👥 Teen Gang Activity', description: 'Youth gangs involved in robbery or violence' },
    { value: 'chintai', label: '⚠️ Chintai (Harassment)', description: 'Illegal extortion by gangs or groups' },
    { value: 'other', label: '🚨 Other Criminal Activity', description: 'Other street crimes or illegal activities' }
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

        {/* Location Status Section */}
        <div className="card mb-6">
          <div className="card-body">
            <h3 className="font-medium text-neutral-800 mb-3 flex items-center">
              <Navigation className="w-5 h-5 mr-2 text-bangladesh-green" />
              Location Services
            </h3>
            
            {locationLoading && (
              <div className="bg-blue-50 p-4 rounded-lg flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                <span className="text-blue-700">Detecting your location...</span>
              </div>
            )}

            {userLocation && !locationLoading && (
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
                  Your report will use your current area (coordinates are obfuscated for privacy)
                </p>
              </div>
            )}

            {!userLocation && !locationLoading && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700 mb-3">
                  📍 For better accuracy, you can select your location using the options below.
                </p>
                <p className="text-xs text-blue-600">
                  Don't worry - your exact location is never stored for privacy protection.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Success Message */}
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

        {/* Error Message */}
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
              
              {/* Incident Type - FIXED: Now using dropdown */}
              <div>
                <label className="form-label">
                  <AlertTriangle className="w-4 h-4 text-bangladesh-green" />
                  Type of Incident *
                </label>
                <div className="relative">
                  <select
                    className={`form-select appearance-none ${formErrors.type ? 'border-red-500' : ''}`}
                    value={formData.type}
                    onChange={(e) => {
                      setFormData({...formData, type: e.target.value})
                      if (formErrors.type) {
                        setFormErrors(prev => ({ ...prev, type: null }))
                      }
                    }}
                    required
                  >
                    {incidentTypes.map((type) => (
                      <option 
                        key={type.value} 
                        value={type.value}
                        disabled={type.disabled}
                      >
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                </div>
                {formErrors.type && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.type}</p>
                )}
                
                {/* Show description for selected type */}
                {formData.type && (
                  <div className="mt-2 p-3 bg-neutral-50 rounded-lg">
                    <p className="text-sm text-neutral-600">
                      {incidentTypes.find(t => t.value === formData.type)?.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Description - Enhanced with better validation */}
              <div>
                <label className="form-label">
                  <Send className="w-4 h-4 text-bangladesh-green" />
                  Description *
                  <span className="text-xs text-neutral-500 ml-2">(minimum 10 characters)</span>
                </label>
                <textarea 
                  className={`form-textarea h-32 ${formErrors.description ? 'border-red-500' : ''}`}
                  placeholder="Describe what happened, when it occurred, and any other relevant details..."
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({...formData, description: e.target.value})
                    if (formErrors.description) {
                      setFormErrors(prev => ({ ...prev, description: null }))
                    }
                  }}
                  minLength={10}
                  maxLength={1000}
                  required
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className={formErrors.description ? 'text-red-600' : 'text-neutral-400'}>
                    {formErrors.description || `${formData.description.length}/1000 characters`}
                  </span>
                  {formData.description.length >= 10 && (
                    <span className="text-green-600">✓ Minimum length met</span>
                  )}
                </div>
              </div>

              {/* Location Selection - Enhanced with better integration */}
              <div>
                <label className="form-label mb-3">
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 text-bangladesh-green" />
                    Location Selection *
                  </span>
                </label>
                
                <LocationPicker
                  onLocationSelect={handleLocationSelect}
                  initialLocation={selectedLocation}
                  userLocation={userLocation}
                  className="mb-4"
                />

                {/* Manual location description */}
                <div className="mt-4">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">
                    Additional Location Details
                  </label>
                  <div className="input-with-icon">
                    <input 
                      type="text" 
                      className={`form-input ${formErrors.location ? 'border-red-500' : ''}`}
                      placeholder="Enter area, landmark, or general location (e.g., Dhanmondi Area)"
                      value={formData.location}
                      onChange={(e) => {
                        setFormData({...formData, location: e.target.value})
                        if (formErrors.location) {
                          setFormErrors(prev => ({ ...prev, location: null }))
                        }
                      }}
                      required
                    />
                    <MapPin className="icon" />
                  </div>
                  {formErrors.location && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.location}</p>
                  )}
                  <p className="text-xs text-neutral-500 mt-1">
                    📍 {selectedLocation || userLocation 
                      ? 'Your selected location will be used and obfuscated for privacy' 
                      : 'Provide a general area description - exact location is never stored'
                    }
                  </p>
                </div>
              </div>

              {/* Severity Level - Enhanced */}
              <div>
                <label className="form-label justify-between">
                  <span className="flex items-center">
                    <AlertTriangle className="w-4 h-4 text-bangladesh-green" />
                    Severity Level *
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
                    onChange={(e) => {
                      setFormData({...formData, severity: parseInt(e.target.value)})
                      if (formErrors.severity) {
                        setFormErrors(prev => ({ ...prev, severity: null }))
                      }
                    }}
                  />
                  <div className="flex justify-between text-sm text-neutral-500 mt-2">
                    <span>1 - Minor</span>
                    <span className="font-medium">Level {formData.severity}</span>
                    <span>5 - Critical</span>
                  </div>
                </div>

                {/* Severity Description */}
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
                {formErrors.severity && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.severity}</p>
                )}
              </div>

              {/* Submit Button - Enhanced */}
              <button 
                type="submit" 
                disabled={submitting || Object.keys(formErrors).length > 0}
                className={`btn-secondary w-full py-4 text-lg ${
                  submitting || Object.keys(formErrors).length > 0
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

        {/* Privacy Notice */}
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

        {/* Emergency Notice */}
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