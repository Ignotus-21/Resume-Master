const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const {
  signup,
  login,
  googleLogin,
  logout,
  me,
  quota,
  setGeminiKey,
  removeGeminiKey,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  myUsage,
} = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/logout', logout);
router.get('/me', me);
router.get('/quota', quota);
router.get('/my-usage', requireAuth, myUsage);
router.put('/gemini-key', requireAuth, setGeminiKey);
router.delete('/gemini-key', requireAuth, removeGeminiKey);

router.post('/verify-email', verifyEmail);
router.post('/resend-verification', requireAuth, resendVerification);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

module.exports = router;
