import { useState, useEffect } from 'react'
import { MapPin, Camera, Send, AlertTriangle, Shield, CheckCircle, Navigation } from 'lucide-react'
import { useSubmitReport } from '../hooks/useReports'

function ReportPage() {
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    severity: 3
  })

  const [userLocation, setUserLocation] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(null)

  const { submitReport, submitting, error, success, reset } = useSubmitReport()

  // Get user's current location
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
        setUserLocation({ lat: latitude, lng: longitude })
        setLocationLoading(false)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      // Use user location if available, otherwise default coordinates
      const coordinates = userLocation 
        ? [userLocation.lng, userLocation.lat] 
        : [90.4125, 23.8103] // Default to Dhaka center

      const reportData = {
        type: formData.type,
        description: formData.description,
        location: {
          coordinates: coordinates,
          address: formData.location
        },
        severity: formData.severity
      }

      console.log('🚀 Submitting report with coordinates:', coordinates)

      await submitReport(reportData)
      
      // Reset form on success
      setFormData({
        type: '',
        description: '',
        location: '',
        severity: 3
      })
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

        {/* Location Status */}
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
                <p className="text-sm text-yellow-600">No worries - you can still submit a report with a manual location.</p>
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
              
              {/* Incident Type */}
              <div>
                <label className="form-label">
                  <AlertTriangle className="w-4 h-4 text-bangladesh-green" />
                  Incident Type
                </label>
                <select 
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="">Select incident type</option>
                  {incidentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
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
                  required
                />
                <div className="text-xs text-neutral-400 mt-1">
                  {formData.description.length}/1000 characters
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="form-label">
                  <MapPin className="w-4 h-4 text-bangladesh-green" />
                  Location Description
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
                  📍 {userLocation 
                    ? 'Your GPS location will be used and obfuscated for privacy' 
                    : 'Provide a general area description - exact location is never stored'
                  }
                </p>
              </div>

              {/* Severity Level */}
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
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={submitting}
                className={`btn-secondary w-full ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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