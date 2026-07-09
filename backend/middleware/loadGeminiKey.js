const User = require('../models/User');
const { decrypt } = require('../utils/crypto');

// For a logged-in user, loads their BYOK Gemini key (if any) and their
// verification status so downstream handlers can gate AI on a verified email.
// No-op for guests — BYOK requires an account and guests are IP-quota-limited.
const loadGeminiKey = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const user = await User.findById(req.user.id).select('geminiApiKeyEncrypted emailVerified passwordHash googleId');
    if (user) {
      if (user.geminiApiKeyEncrypted) {
        req.geminiApiKey = decrypt(user.geminiApiKeyEncrypted);
      }
      req.user.emailVerified = Boolean(user.emailVerified);
      // "Email account" = signed up with email/password (no Google link).
      req.user.isEmailAccount = Boolean(user.passwordHash) && !user.googleId;
    }
  } catch (err) {
    console.error('Failed to load user auth state:', err);
  }
  next();
};

module.exports = loadGeminiKey;
