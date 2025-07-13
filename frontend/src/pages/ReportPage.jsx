import { useState } from 'react'
import { MapPin, Camera, Send, AlertTriangle, Shield, CheckCircle } from 'lucide-react'

function ReportPage() {
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    severity: 3
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // TODO: Add API call here
    console.log('Report submitted:', formData)
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      // Show success message or redirect
    }, 2000)
  }

  const incidentTypes = [
    { value: 'chadabaji', label: 'Chadabaji (Extortion)', icon: '💰' },
    { value: 'teen_gang', label: 'Teen Gang Activity', icon: '👥' },
    { value: 'chintai', label: 'Chhintai (Street robbery)', icon: '⚠️' },
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
                  Location
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
                  📍 Your exact location is never stored. We only use general area information.
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

              {/* Media Upload (Future) */}
              <div>
                <label className="form-label">
                  <Camera className="w-4 h-4 text-bangladesh-green" />
                  Evidence (Optional)
                  <span className="text-xs text-neutral-500 ml-2">Coming soon</span>
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center text-neutral-500">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                  <p className="text-sm">Photo/video upload will be available soon</p>
                  <p className="text-xs">All media will be automatically anonymized</p>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`btn-secondary w-full ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
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