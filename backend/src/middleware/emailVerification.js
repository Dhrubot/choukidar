// === backend/src/middleware/emailVerification.js ===
// Email Verification Enforcement Middleware

const requireEmailVerification = (req, res, next) => {
  const { user, userType } = req.userContext;
  
  // Only enforce email verification for admin users
  if (userType === 'admin') {
    if (!user.roleData.admin.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email verification required. Please check your email and verify your account.',
        emailVerificationRequired: true,
        userType: 'admin'
      });
    }
  }
  
  next();
};

const requireEmailVerificationForLogin = (adminUser) => {
  if (adminUser.userType === 'admin' && !adminUser.roleData.admin.emailVerified) {
    return {
      verified: false,
      message: 'Please verify your email before logging in. Check your inbox for the verification link.'
    };
  }
  return { verified: true };
};

module.exports = {
  requireEmailVerification,
  requireEmailVerificationForLogin
};