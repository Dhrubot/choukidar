// === src/pages/ReportPage.jsx (COMPLETE ENHANCED VERSION) ===
// Enhanced Report Page with Female Safety Features + All Original Elements Preserved
// Integrates with backend Report model and security features

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, AlertTriangle, Send, ChevronDown, Navigation, 
  MapPin, Clock, Users, Eye, EyeOff, Settings, Heart,
  Lock, Globe, User, Calendar, ExternalLink, CheckCircle
} from 'lucide-react'
import { useSubmitReport } from '../hooks/useReports'
import { useAuth } from '../contexts/AuthContext' // Single import for enhanced context
import { useDevice } from '../contexts/DeviceContext' // Updated import for device fingerprint
import apiService from '../services/api'
import logger, { logDebug, logError, logInfo } from '../services/utils/logger'
import errorHandler, { handleValidationError, handleLocationError, handleApiError } from '../services/utils/errorHandler'
import LocationPicker from '../components/LocationPicker/LocationPicker'
import { isWithinBangladesh } from '../config/locationConfig'

function ReportPage() {
  const navigate = useNavigate()
  const { submitReport, submitting, success, error, reset } = useSubmitReport()
  const { deviceFingerprint, userType, preferences } = useDevice() // Get device fingerprint from DeviceContext
  const { userType: authUserType, preferences: authPreferences } = useAuth() // Get user type and preferences from AuthContext
  
  // Use authContext data as primary, fallback to device context if needed
  const currentUserType = authUserType || userType
  const currentPreferences = authPreferences || preferences
  
  // Form state
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    severity: 3
  })
  
  const [formErrors, setFormErrors] = useState({})
  const [selectedLocation, setSelectedLocation] = useState(null)
  
  // Enhanced UI state
  const [showFemaleSafetyMode, setShowFemaleSafetyMode] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [selectedIncidentCategory, setSelectedIncidentCategory] = useState('general')
  
  // Location state
  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          logDebug(`Got user location: ${latitude}, ${longitude}`, 'ReportPage')
          setUserLocation({ lat: latitude, lng: longitude})
          setLocationLoading(false)
        },
        (error) => {
          const errorResponse = handleLocationError(error, 'ReportPage')
          logError('Could not get user location', 'ReportPage', error)
          setLocationLoading(false)
          setLocationError(errorResponse.message || 'Unable to get location. You can still select manually.')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      )
    }
  }, [])

  // Initialize female safety mode from preferences
  useEffect(() => {
    if (currentPreferences?.femaleSafetyMode) {
      setShowFemaleSafetyMode(currentPreferences.femaleSafetyMode)
    }
  }, [currentPreferences])

  // Handle location selection from LocationPicker
  const handleLocationSelect = (locationData) => {
    logDebug('Location selected in ReportPage', 'ReportPage', locationData)
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
    const formErrors = validateForm()
    if (Object.keys(formErrors).length > 0) {
      const errorResponse = handleValidationError(formErrors, 'ReportPage')
      logError('Form validation failed', 'ReportPage', formErrors)
      setFormErrors(formErrors)
      // Show user-friendly validation error
      if (errorResponse.type === 'toast') {
        // You can integrate with your toast system here
        console.warn(errorResponse.message) // Temporary fallback
      }
      return
    }
    
    try {
      // Determine coordinates to use (enhanced logic)
      let coordinates
      let locationSource = 'default'
      
      if (selectedLocation) {
        // Use manually selected location (priority)
        coordinates = [selectedLocation.lng, selectedLocation.lat]
        logDebug('Using manually selected location', 'ReportPage', coordinates)
        locationSource = selectedLocation.source
      } else if (userLocation) {
        // Fallback to user's GPS location
        coordinates = [userLocation.lng, userLocation.lat]
        logDebug('Using GPS fallback location', 'ReportPage', coordinates)
        locationSource = 'GPS'
      } else {
        // Final fallback to Dhaka center
        coordinates = [90.4125, 23.8103]
        logDebug('Using default Dhaka location', 'ReportPage', coordinates)
        locationSource = 'default'
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
          obfuscated: true, // Always obfuscate for privacy
          // Enhanced location context for female safety
          locationContext: getLocationContext(formData.type)
        },
        severity: parseInt(formData.severity),
        timestamp: new Date().toISOString(),
        // Enhanced security and privacy
        deviceFingerprint: deviceFingerprint,
        culturalContext: getCulturalContext(formData.type),
        femaleSafetyMode: showFemaleSafetyMode
      }

      logInfo('Submitting report with enhanced data', 'ReportPage', reportData)

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
      setSelectedIncidentCategory('general')
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      const errorResponse = handleApiError(err, 'ReportPage')
      logError('Failed to submit report', 'ReportPage', err)
      
      // Show user-friendly error message
      if (errorResponse.type === 'toast') {
        // Integrate with your toast notification system
        alert(errorResponse.message) // Temporary fallback until toast system is integrated
      }
    }
  }

  // Get location context based on incident type
  const getLocationContext = (incidentType) => {
    const femaleSafetyTypes = [
      'eve_teasing', 'stalking', 'inappropriate_touch', 'verbal_harassment',
      'unsafe_transport', 'workplace_harassment', 'domestic_incident', 'unsafe_area_women'
    ]
    
    if (femaleSafetyTypes.includes(incidentType)) {
      return {
        publicSpace: ['eve_teasing', 'verbal_harassment', 'unsafe_area_women'].includes(incidentType),
        transportRelated: incidentType === 'unsafe_transport',
        workplaceRelated: incidentType === 'workplace_harassment',
        residentialArea: incidentType === 'domestic_incident',
        isolatedArea: ['stalking', 'inappropriate_touch'].includes(incidentType)
      }
    }
    
    return {
      publicSpace: true,
      transportRelated: false,
      workplaceRelated: false,
      residentialArea: false,
      isolatedArea: false
    }
  }

  // Get cultural context based on incident type
  const getCulturalContext = (incidentType) => {
    const femaleSafetyTypes = [
      'eve_teasing', 'stalking', 'inappropriate_touch', 'verbal_harassment',
      'unsafe_transport', 'workplace_harassment', 'domestic_incident', 'unsafe_area_women'
    ]
    
    if (femaleSafetyTypes.includes(incidentType)) {
      return {
        conservativeArea: false, // Can be detected by location later
        religiousContext: false,
        familyRelated: incidentType === 'domestic_incident',
        requiresFemaleModerator: true
      }
    }
    
    return {
      conservativeArea: false,
      religiousContext: false,
      familyRelated: false,
      requiresFemaleModerator: false
    }
  }

  // Enhanced incident types with female safety categories
  const incidentCategories = {
    general: {
      label: 'General Criminal Activity',
      icon: AlertTriangle,
      color: 'text-red-600',
      description: 'Street crimes, extortion, and general criminal activities',
      types: [
        { value: 'chadabaji', label: '💰 Chadabaji (Extortion)', description: 'Political harassment or forced donations' },
        { value: 'teen_gang', label: '👥 Teen Gang Activity', description: 'Youth gangs involved in robbery or violence' },
        { value: 'chintai', label: '⚠️ Chintai (Harassment)', description: 'Illegal extortion by gangs or groups' },
        { value: 'other', label: '🚨 Other Criminal Activity', description: 'Other street crimes or illegal activities' }
      ]
    },
    female_safety: {
      label: 'Female Safety & Harassment',
      icon: Heart,
      color: 'text-pink-600',
      description: 'Gender-based harassment and safety concerns for women',
      types: [
        { value: 'eve_teasing', label: '😰 Eve Teasing', description: 'Street harassment targeting women' },
        { value: 'stalking', label: '👁️ Stalking', description: 'Following or tracking women persistently' },
        { value: 'inappropriate_touch', label: '🚫 Inappropriate Touch', description: 'Unwanted physical contact or harassment' },
        { value: 'verbal_harassment', label: '💬 Verbal Harassment', description: 'Catcalling, inappropriate comments, or verbal abuse' },
        { value: 'unsafe_transport', label: '🚌 Unsafe Transport', description: 'Harassment in rickshaw, bus, or ride-sharing' },
        { value: 'workplace_harassment', label: '🏢 Workplace Harassment', description: 'Professional harassment or inappropriate behavior' },
        { value: 'domestic_incident', label: '🏠 Domestic Incident', description: 'Family or domestic-related safety concerns' },
        { value: 'unsafe_area_women', label: '⚠️ Unsafe Area for Women', description: 'Areas specifically dangerous for women' }
      ]
    }
  }

  // Get current incident types based on selected category
  const getCurrentIncidentTypes = () => {
    const baseTypes = [{ value: '', label: 'Select incident type...', disabled: true }]
    
    if (selectedIncidentCategory === 'general') {
      return [...baseTypes, ...incidentCategories.general.types]
    } else if (selectedIncidentCategory === 'female_safety') {
      return [...baseTypes, ...incidentCategories.female_safety.types]
    }
    
    // Show all types if no category selected
    return [
      ...baseTypes,
      ...incidentCategories.general.types,
      ...incidentCategories.female_safety.types
    ]
  }

  // Check if current type is female safety related
  const isFemaleSafetyType = (type) => {
    return incidentCategories.female_safety.types.some(t => t.value === type)
  }

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

        {/* Female Safety Mode Toggle */}
        <div className="card mb-6 bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-pink-500 rounded-full p-2">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-800">Female Safety Mode</h3>
                  <p className="text-sm text-neutral-600">Enhanced privacy and female-only validation</p>
                </div>
              </div>
              <button
                onClick={() => setShowFemaleSafetyMode(!showFemaleSafetyMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showFemaleSafetyMode ? 'bg-pink-500' : 'bg-neutral-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showFemaleSafetyMode ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            
            {showFemaleSafetyMode && (
              <div className="mt-4 p-3 bg-pink-100 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Shield className="w-4 h-4 text-pink-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-pink-800">
                    <p className="font-medium mb-1">Enhanced Protection Active</p>
                    <ul className="text-xs space-y-1">
                      <li>• Location obfuscation increased to ±200m</li>
                      <li>• Report will be validated by female moderators only</li>
                      <li>• Cultural sensitivity flags automatically applied</li>
                      <li>• Priority processing for safety concerns</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Status Section - PRESERVED from original */}
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
                  {isFemaleSafetyType(formData.type) && showFemaleSafetyMode && (
                    <span className="block mt-1 font-medium">
                      🌸 This report will be reviewed by female moderators for cultural sensitivity.
                    </span>
                  )}
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
              
              {/* Incident Category Selection */}
              <div>
                <label className="form-label">
                  <Settings className="w-4 h-4 text-bangladesh-green" />
                  Incident Category *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(incidentCategories).map(([key, category]) => {
                    const Icon = category.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedIncidentCategory(key)
                          setFormData(prev => ({ ...prev, type: '' })) // Reset type when category changes
                        }}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedIncidentCategory === key
                            ? 'border-safe-primary bg-safe-primary/5'
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`w-6 h-6 ${category.color}`} />
                          <div>
                            <h4 className="font-medium text-neutral-800">{category.label}</h4>
                            <p className="text-sm text-neutral-600 mt-1">{category.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

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
                    {getCurrentIncidentTypes().map((type) => (
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
                      {getCurrentIncidentTypes().find(t => t.value === formData.type)?.description}
                    </p>
                    
                    {/* Female Safety Information */}
                    {isFemaleSafetyType(formData.type) && (
                      <div className="mt-2 p-2 bg-pink-50 rounded border-l-4 border-pink-400">
                        <p className="text-sm text-pink-800 font-medium">
                          🌸 Female Safety Report: This report will receive enhanced privacy protection
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Description - Enhanced with better validation - PRESERVED character count feedback */}
              <div>
                <label className="form-label">
                  <Send className="w-4 h-4 text-bangladesh-green" />
                  Description *
                  <span className="text-xs text-neutral-500 ml-2">(minimum 10 characters)</span>
                </label>
                <textarea 
                  className={`form-textarea h-32 ${formErrors.description ? 'border-red-500' : ''}`}
                  placeholder={
                    isFemaleSafetyType(formData.type) 
                      ? "Describe the incident with as much detail as you're comfortable sharing. Remember, this is completely anonymous and will be handled with sensitivity."
                      : "Describe what happened, when it occurred, and any other relevant details..."
                  }
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
                {/* PRESERVED: Better character count feedback from original */}
                <div className="flex justify-between text-xs mt-1">
                  <span className={formErrors.description ? 'text-red-600' : 'text-neutral-400'}>
                    {formErrors.description || `${formData.description.length}/1000 characters`}
                  </span>
                  {formData.description.length >= 10 && (
                    <span className="text-green-600">✓ Minimum length met</span>
                  )}
                </div>
              </div>

              {/* Location Selection - Enhanced with better integration - PRESERVED original structure */}
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

                {/* PRESERVED: Manual location description from original */}
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

              {/* Severity Level - PRESERVED original enhanced structure */}
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

                {/* PRESERVED: Severity Description from original */}
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting Report...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Send className="w-5 h-5 mr-2" />
                    {isFemaleSafetyType(formData.type) ? 'Submit Female Safety Report' : 'Submit Report Anonymously'}
                  </div>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Enhanced Privacy Notice */}
        <div className="alert-info">
          <div className="flex items-start">
            <Shield className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Your Privacy is Protected</h4>
              <p className="text-sm text-blue-700 mb-3">
                🔒 Your report is completely anonymous. We do not store personal information, track your identity, or log IP addresses. 
                Location data is obfuscated to protect your privacy while helping authorities understand incident patterns.
              </p>
              
              {/* Enhanced privacy for female safety reports */}
              {(isFemaleSafetyType(formData.type) || showFemaleSafetyMode) && (
                <div className="mt-3 p-3 bg-pink-50 rounded-lg border-l-4 border-pink-400">
                  <h5 className="font-medium text-pink-800 mb-2">🌸 Enhanced Female Safety Protection</h5>
                  <ul className="text-sm text-pink-700 space-y-1">
                    <li>• Location obfuscation increased to ±200m (vs ±100m standard)</li>
                    <li>• Report will be validated by female moderators only</li>
                    <li>• Cultural sensitivity flags automatically applied</li>
                    <li>• Priority processing for safety concerns</li>
                    <li>• Enhanced moderation with specialized training</li>
                  </ul>
                </div>
              )}
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
              {isFemaleSafetyType(formData.type) && (
                <p className="text-sm text-red-700 mt-2 font-medium">
                  🆘 For immediate help with harassment or violence, contact the National Emergency Service (999) 
                  or Women's Rights organizations.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Help Resources for Female Safety */}
        {(isFemaleSafetyType(formData.type) || showFemaleSafetyMode) && (
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-start">
              <Heart className="w-5 h-5 mr-3 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-800 mb-3">Support Resources</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-purple-700 mb-1">Emergency Help</h5>
                    <ul className="text-purple-600 space-y-1">
                      <li>• Emergency: 999</li>
                      <li>• Police: 100</li>
                      <li>• National Women's Crisis Line</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-purple-700 mb-1">Support Organizations</h5>
                    <ul className="text-purple-600 space-y-1">
                      <li>• Bangladesh National Women Lawyers' Association</li>
                      <li>• Ain O Salish Kendra</li>
                      <li>• Local NGO support centers</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-purple-600 mt-3">
                  Remember: You are not alone. There are people and organizations ready to help.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportPage