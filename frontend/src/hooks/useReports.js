// === src/hooks/useReports.js ===
import { useState, useEffect } from 'react'
import apiService from '../services/api'

export function useReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getReports()
      setReports(data.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  return {
    reports,
    loading,
    error,
    refetch: fetchReports
  }
}

export function useSubmitReport() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const submitReport = async (reportData) => {
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await apiService.submitReport(reportData)
      setSuccess(true)
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setError(null)
    setSuccess(false)
  }

  return {
    submitReport,
    submitting,
    error,
    success,
    reset
  }
}