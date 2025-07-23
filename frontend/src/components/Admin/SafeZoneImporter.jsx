// === src/components/Admin/SafeZoneImporter.jsx ===
import { useState, useRef } from 'react'
import { X, Upload, Download, FileText, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import apiService from '../../services/api'

const SafeZoneImporter = ({ onClose, onImport }) => {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [preview, setPreview] = useState([])
  const [importResults, setImportResults] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    // Validate file type
    const allowedTypes = ['text/csv', 'application/json', 'text/plain']
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV or JSON file')
      return
    }

    setFile(selectedFile)
    setError(null)
    setSuccess(null)
    setImportResults(null)
    
    // Preview file contents
    previewFile(selectedFile)
  }

  const previewFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        let data = []

        if (file.name.endsWith('.json')) {
          data = JSON.parse(content)
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(content)
        }

        // Show first 5 rows as preview
        setPreview(Array.isArray(data) ? data.slice(0, 5) : [])
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
        setPreview([])
      }
    }
    reader.readAsText(file)
  }

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const data = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      data.push(row)
    }

    return data
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiService.request('/safe-zones/admin/import', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set content-type for FormData
      })

      if (response.success) {
        setImportResults(response.data)
        setSuccess(`Successfully imported ${response.data.successful} safe zones`)
        
        // Close modal after delay if fully successful
        if (response.data.failed === 0) {
          setTimeout(() => {
            onImport()
          }, 2000)
        }
      } else {
        setError(response.message || 'Import failed')
      }
    } catch (err) {
      setError(err.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = `name,description,zoneType,category,status,safetyScore,longitude,latitude,district,upazila,street,area,phone,email,features
Dhaka Metropolitan Police HQ,Main police headquarters for Dhaka,government,police_station,active,9.2,90.4125,23.8103,Dhaka,Ramna,Shahbagh Road,Ramna,+8801234567890,info@dmp.gov.bd,"security_cameras,lighting,emergency_phone"
Dhaka Medical College Hospital,Premier medical facility,healthcare,hospital,active,8.8,90.4203,23.7261,Dhaka,Shahbagh,Bakshibazar Road,Shahbagh,+8801987654321,info@dmch.gov.bd,"first_aid,wheelchair_accessible,parking"
University of Dhaka,Oldest university in Bangladesh,educational,school,active,8.5,90.3938,23.7279,Dhaka,Shahbagh,Nilkhet Road,Shahbagh,+8801122334455,info@du.ac.bd,"security_cameras,lighting,parking"`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'safe_zones_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-safe-primary" />
            Import Safe Zones
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Instructions */}
          <div className="bg-safe-info/10 border border-safe-info/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-safe-info mt-0.5" />
              <div>
                <h4 className="font-medium text-safe-info mb-2">Import Instructions</h4>
                <ul className="text-sm text-safe-info space-y-1">
                  <li>• Supported formats: CSV, JSON</li>
                  <li>• Required fields: name, description, district, longitude, latitude</li>
                  <li>• Optional fields: zoneType, category, status, safetyScore, address fields, contact info</li>
                  <li>• Features should be comma-separated in quotes</li>
                  <li>• Download template below for proper format</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
            <div>
              <h4 className="font-medium text-neutral-900">Download Template</h4>
              <p className="text-sm text-neutral-600">Get a sample CSV file with proper formatting</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Select File
            </label>
            <div 
              className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-safe-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-safe-primary" />
                  <div>
                    <p className="font-medium text-neutral-900">{file.name}</p>
                    <p className="text-sm text-neutral-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-neutral-700 mb-2">
                    Choose a file to upload
                  </p>
                  <p className="text-sm text-neutral-500">
                    CSV or JSON files up to 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* File Preview */}
          {preview.length > 0 && (
            <div>
              <h4 className="font-medium text-neutral-900 mb-3">File Preview (First 5 rows)</h4>
              <div className="bg-neutral-50 rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200">
                      {Object.keys(preview[0]).map(key => (
                        <th key={key} className="text-left py-2 px-3 font-medium text-neutral-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index} className="border-b border-neutral-100">
                        {Object.values(row).map((value, i) => (
                          <td key={i} className="py-2 px-3 text-neutral-600">
                            {String(value).substring(0, 50)}
                            {String(value).length > 50 ? '...' : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-safe-success/10 border border-safe-success/20 text-safe-success px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{success}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-safe-danger/10 border border-safe-danger/20 text-safe-danger px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="bg-white border border-neutral-200 rounded-lg p-4">
              <h4 className="font-medium text-neutral-900 mb-3">Import Results</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-safe-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-safe-success">{importResults.successful}</div>
                  <div className="text-sm text-safe-success">Successful</div>
                </div>
                <div className="text-center p-3 bg-safe-danger/10 rounded-lg">
                  <div className="text-2xl font-bold text-safe-danger">{importResults.failed}</div>
                  <div className="text-sm text-safe-danger">Failed</div>
                </div>
                <div className="text-center p-3 bg-safe-info/10 rounded-lg">
                  <div className="text-2xl font-bold text-safe-info">{importResults.total}</div>
                  <div className="text-sm text-safe-info">Total</div>
                </div>
              </div>

              {/* Error Details */}
              {importResults.errors && importResults.errors.length > 0 && (
                <div className="mt-4">
                  <h5 className="font-medium text-neutral-900 mb-2">Import Errors:</h5>
                  <div className="bg-neutral-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="text-sm text-safe-danger mb-1">
                        Row {error.row}: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            {importResults && importResults.successful > 0 ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            className="btn-primary flex items-center gap-2"
            disabled={loading || !file}
          >
            {loading ? (
              <>
                <div className="loading-spinner w-4 h-4"></div>
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import Safe Zones
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SafeZoneImporter
