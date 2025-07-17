// === frontend/src/pages/InviteRegisterPage.jsx ===
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Lock, Mail, Shield, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import apiService from '../services/api';
import { useUserType } from '../contexts/UserTypeContext'; // To get device fingerprint

/**
 * InviteRegisterPage Component
 * Handles user registration via a secure, invite-only token.
 * Dynamically adjusts form based on user type if needed (though backend handles role data).
 */
const InviteRegisterPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // Get token from URL query params

  const { deviceFingerprint, loading: userTypeLoading } = useUserType(); // Get device fingerprint
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Add fields for police/researcher if needed directly in the form
    // e.g., badgeNumber: '', department: '', institution: '', researchArea: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true); // Initial loading for token validation/userType context
  const [submitting, setSubmitting] = useState(false); // For form submission
  const [message, setMessage] = useState({ type: '', text: '' });
  const [inviteDetails, setInviteDetails] = useState(null); // To store details from the token

  // Validate the token and fetch invite details if necessary
  useEffect(() => {
    const validateTokenAndFetchDetails = async () => {
      if (!token) {
        setMessage({ type: 'danger', text: 'No invitation token found. Please use the full invite link.' });
        setLoading(false);
        return;
      }

      // Ensure device fingerprint is loaded before attempting token validation
      if (userTypeLoading) {
        return; // Wait for userTypeLoading to be false
      }

      try {
        const response = await apiService.validateInviteToken(token);
        if (response.success) {
          setInviteDetails(response.invite);
          // Pre-fill email if available in invite details
          if (response.invite.email) {
            setFormData(prev => ({ ...prev, email: response.invite.email }));
          }
          setMessage({ type: 'info', text: `Invitation for ${response.invite.userType} is valid. Please complete your registration.` });
        } else {
          setMessage({ type: 'danger', text: response.message || 'Invalid or expired invitation token.' });
          setInviteDetails(null); // Clear invite details on error
        }
      } catch (error) {
        console.error('Error validating invite token on frontend:', error);
        setMessage({ type: 'danger', text: 'Failed to connect to the server to validate invite. Please try again later.' });
        setInviteDetails(null);
      } finally {
        setLoading(false); // Finished initial loading
      }
    };

    validateTokenAndFetchDetails();
  }, [token, userTypeLoading]); // Rerun when token or userTypeLoading changes

  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.username.trim()) {
      errors.username = 'Username is required.';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format.';
    }
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    // Add validation for police/researcher specific fields if they are in formData
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    setMessage({ type: '', text: '' }); // Clear messages on input change
  }, [formErrors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' }); // Clear previous messages
    if (!validateForm()) {
      setMessage({ type: 'danger', text: 'Please correct the errors in the form.' });
      return;
    }

    if (!token || !inviteDetails) { // Ensure token is present and validated
      setMessage({ type: 'danger', text: 'Invalid or missing invitation token. Please refresh the page or use a valid invite link.' });
      return;
    }
    if (!deviceFingerprint) {
      setMessage({ type: 'danger', text: 'Device fingerprint not available. Please try again.' });
      return;
    }

    setSubmitting(true);
    try {
      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        deviceFingerprint: deviceFingerprint,
        // Include other role-specific data if collected in the form
        // badgeNumber: formData.badgeNumber,
        // department: formData.department,
        // institution: formData.institution,
        // etc.
      };

      const response = await apiService.registerWithInvite(token, userData);

      if (response.success) {
        setMessage({ type: 'success', text: response.message || 'Registration successful! Redirecting to login...' });
        setTimeout(() => {
          navigate('/admin/login'); // Redirect to admin login or a general login page
        }, 3000);
      } else {
        setMessage({ type: 'danger', text: response.message || 'Registration failed. Please try again.' });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ type: 'danger', text: 'An unexpected error occurred during registration.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || userTypeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center p-8">
          <Loader2 className="w-12 h-12 text-safe-primary animate-spin mx-auto mb-4" />
          <p className="text-lg text-neutral-700">Loading registration form...</p>
        </div>
      </div>
    );
  }

  // If token is invalid or expired, show only the message
  if (!inviteDetails && message.type === 'danger') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-neutral-50">
        <div className="max-w-md w-full space-y-8 card">
          <div className="card-body text-center">
            <Shield className="w-12 h-12 text-safe-danger mx-auto mb-4" />
            <h2 className="mt-6 text-3xl font-extrabold text-neutral-900">
              Invitation Invalid
            </h2>
            <div className={`mt-6 alert-${message.type}`}>
              <div className="flex items-center space-x-2 justify-center">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              Please ensure you are using the correct and unexpired invitation link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card">
        <div className="card-body">
          <div className="text-center">
            <Shield className="w-12 h-12 text-safe-primary mx-auto mb-4" />
            <h2 className="mt-6 text-3xl font-extrabold text-neutral-900">
              Register Your {inviteDetails?.userType ? inviteDetails.userType.charAt(0).toUpperCase() + inviteDetails.userType.slice(1) : ''} Account
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Complete your registration using your invitation token.
            </p>
          </div>

          {message.text && (
            <div className={`mt-6 alert-${message.type}`}>
              <div className="flex items-center space-x-2">
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="form-label">
                <User /> Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={`form-input ${formErrors.username ? 'border-red-500' : ''}`}
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleInputChange}
                disabled={submitting}
              />
              {formErrors.username && <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>}
            </div>

            <div>
              <label htmlFor="email" className="form-label">
                <Mail /> Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`form-input ${formErrors.email ? 'border-red-500' : ''}`}
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={submitting}
              />
              {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                <Lock /> Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className={`form-input ${formErrors.password ? 'border-red-500' : ''}`}
                placeholder="Create a password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={submitting}
              />
              {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                <Lock /> Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className={`form-input ${formErrors.confirmPassword ? 'border-red-500' : ''}`}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={submitting}
              />
              {formErrors.confirmPassword && <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>}
            </div>

            {/* Dynamic fields based on inviteDetails.userType can be added here */}
            {/* Example for Police: */}
            {inviteDetails?.userType === 'police' && (
              <>
                <div>
                  <label htmlFor="badgeNumber" className="form-label">
                    Badge Number
                  </label>
                  <input
                    id="badgeNumber"
                    name="badgeNumber"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter your badge number"
                    value={formData.badgeNumber || ''}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="department" className="form-label">
                    Department
                  </label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter your department"
                    value={formData.department || ''}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            {/* Example for Researcher: */}
            {inviteDetails?.userType === 'researcher' && (
              <>
                <div>
                  <label htmlFor="institution" className="form-label">
                    Institution
                  </label>
                  <input
                    id="institution"
                    name="institution"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter your institution"
                    value={formData.institution || ''}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="researchArea" className="form-label">
                    Research Area
                  </label>
                  <input
                    id="researchArea"
                    name="researchArea"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Enter your research area"
                    value={formData.researchArea || ''}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </>
            )}


            <button
              type="submit"
              className={`w-full btn btn-primary ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={submitting}
            >
              {submitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Registering...</span>
                </div>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InviteRegisterPage;
