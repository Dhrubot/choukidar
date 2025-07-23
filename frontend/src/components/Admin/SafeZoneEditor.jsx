// === src/components/Admin/SafeZoneEditor.jsx ===
import { useState, useEffect } from 'react'
import { X, MapPin, Save, AlertTriangle, CheckCircle } from 'lucide-react'
import apiService from '../../services/api'

const SafeZoneEditor = ({ zone, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    zoneType: 'government',
    category: 'police_station',
    status: 'active',
    safetyScore: 8,
    location: {
      type: 'Point',
      coordinates: [90.4125, 23.8103] // Default to Dhaka
    },
    address: {
      street: '',
      area: '',
      district: '',
      upazila: '',
      division: '',
      postalCode: ''
    },
    operatingHours: {
      isAlwaysOpen: true,
      schedule: {}
    },
    contactInfo: {
      phone: '',
      email: '',
      website: ''
    },
    features: [],
    adminNotes: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Initialize form with existing zone data
  useEffect(() => {
    if (zone) {
      setFormData({
        ...formData,
        ...zone,
        location: zone.location || formData.location,
        address: { ...formData.address, ...zone.address },
        operatingHours: { ...formData.operatingHours, ...zone.operatingHours },
        contactInfo: { ...formData.contactInfo, ...zone.contactInfo }
      })
    }
  }, [zone])

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleCoordinateChange = (index, value) => {
    const newCoords = [...formData.location.coordinates]
    newCoords[index] = parseFloat(value) || 0
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        coordinates: newCoords
      }
    }))
  }

  const handleFeatureToggle = (feature) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) return 'Name is required'
    if (!formData.description.trim()) return 'Description is required'
    if (!formData.address.district.trim()) return 'District is required'
    if (formData.safetyScore < 1 || formData.safetyScore > 10) return 'Safety score must be between 1-10'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const endpoint = zone 
        ? `/safe-zones/admin/${zone._id}`
        : '/safe-zones/admin'
      
      const method = zone ? 'PUT' : 'POST'
      
      const response = await apiService.request(endpoint, {
        method,
        body: formData
      })

      if (response.success) {
        setSuccess(true)
        setTimeout(() => {
          onSave()
        }, 1000)
      } else {
        setError(response.message || 'Failed to save safe zone')
      }
    } catch (err) {
      setError(err.message || 'Failed to save safe zone')
    } finally {
      setLoading(false)
    }
  }

  const availableFeatures = [
    'security_cameras', 'lighting', 'emergency_phone', 'security_guard',
    'first_aid', 'wheelchair_accessible', 'parking', 'public_transport'
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h3 className="text-xl font-bold text-neutral-900">
            {zone ? 'Edit Safe Zone' : 'Add New Safe Zone'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-safe-success/10 border border-safe-success/20 text-safe-success px-4 py-3 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Safe zone saved successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-safe-danger/10 border border-safe-danger/20 text-safe-danger px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Zone Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                  placeholder="Enter zone name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Safety Score *
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.1"
                  value={formData.safetyScore}
                  onChange={(e) => handleInputChange('safetyScore', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                placeholder="Describe this safe zone"
                required
              />
            </div>

            {/* Type and Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Zone Type
                </label>
                <select
                  value={formData.zoneType}
                  onChange={(e) => handleInputChange('zoneType', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                >
                  <option value="government">Government</option>
                  <option value="educational">Educational</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="commercial">Commercial</option>
                  <option value="residential">Residential</option>
                  <option value="transport">Transport</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                >
                  <option value="police_station">Police Station</option>
                  <option value="hospital">Hospital</option>
                  <option value="school">School</option>
                  <option value="mosque">Mosque</option>
                  <option value="market">Market</option>
                  <option value="park">Park</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <h4 className="text-lg font-medium text-neutral-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-safe-primary" />
                Location Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.coordinates[0]}
                    onChange={(e) => handleCoordinateChange(0, e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.coordinates[1]}
                    onChange={(e) => handleCoordinateChange(1, e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    District *
                  </label>
                  <input
                    type="text"
                    value={formData.address.district}
                    onChange={(e) => handleInputChange('address.district', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="e.g., Dhaka"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Upazila
                  </label>
                  <input
                    type="text"
                    value={formData.address.upazila}
                    onChange={(e) => handleInputChange('address.upazila', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="e.g., Dhanmondi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={formData.address.street}
                    onChange={(e) => handleInputChange('address.street', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Area
                  </label>
                  <input
                    type="text"
                    value={formData.address.area}
                    onChange={(e) => handleInputChange('address.area', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="Area or neighborhood"
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-lg font-medium text-neutral-900 mb-4">
                Available Features
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {availableFeatures.map(feature => (
                  <label key={feature} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.features.includes(feature)}
                      onChange={() => handleFeatureToggle(feature)}
                      className="rounded border-neutral-300 text-safe-primary focus:ring-safe-primary/20"
                    />
                    <span className="text-sm text-neutral-700 capitalize">
                      {feature.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h4 className="text-lg font-medium text-neutral-900 mb-4">
                Contact Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contactInfo.phone}
                    onChange={(e) => handleInputChange('contactInfo.phone', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="+880..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.contactInfo.email}
                    onChange={(e) => handleInputChange('contactInfo.email', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="contact@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={formData.contactInfo.website}
                    onChange={(e) => handleInputChange('contactInfo.website', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Admin Notes
              </label>
              <textarea
                value={formData.adminNotes}
                onChange={(e) => handleInputChange('adminNotes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-safe-primary/20 focus:border-safe-primary"
                placeholder="Internal notes for administrators"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {zone ? 'Update' : 'Create'} Safe Zone
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SafeZoneEditor
