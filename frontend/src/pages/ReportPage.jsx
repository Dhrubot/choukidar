// === src/pages/ReportPage.jsx ===
import { useState } from 'react'
import { MapPin, Camera, Send } from 'lucide-react'

function ReportPage() {
  const [formData, setFormData] = useState({
    type: '',
    description: '',
    location: '',
    severity: 3
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Report submitted:', formData)
    // Add API call here
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="container-mobile">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-4">
            Report an Incident
          </h1>
          <p className="text-neutral-600">
            Help make your community safer by reporting incidents anonymously
          </p>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Incident Type */}
              <div>
                <label className="form-label">Incident Type</label>
                <select 
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  required
                >
                  <option value="">Select incident type</option>
                  <option value="chadabaji">Chadabaji (Extortion)</option>
                  <option value="teen_gang">Teen Gang Activity</option>
                  <option value="chintai">Chintai (Political Harassment)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="form-label">Description</label>
                <textarea 
                  className="form-textarea h-32"
                  placeholder="Describe what happened (minimum 10 characters)"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  minLength={10}
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label className="form-label">Location</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="form-input pl-10"
                    placeholder="Enter location or area"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    required
                  />
                  <MapPin className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className="form-label">Severity Level (1-5)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  className="w-full"
                  value={formData.severity}
                  onChange={(e) => setFormData({...formData, severity: parseInt(e.target.value)})}
                />
                <div className="flex justify-between text-sm text-neutral-500 mt-1">
                  <span>Low</span>
                  <span className="font-medium">Level {formData.severity}</span>
                  <span>High</span>
                </div>
              </div>

              {/* Submit Button */}
              <button type="submit" className="btn-secondary w-full">
                <Send className="w-5 h-5 mr-2" />
                Submit Report
              </button>
            </form>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="alert-info mt-6">
          <p className="text-sm">
            🔒 Your report is completely anonymous. We do not store personal information or track your identity.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ReportPage