const User = require('../models/User');
const { decrypt } = require('../utils/crypto');

// Attaches req.geminiApiKey when the logged-in user has configured their own
// key (BYOK). No-op for guests — bringing your own key requires an account.
const loadGeminiKey = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const user = await User.findById(req.user.id).select('geminiApiKeyEncrypted');
    if (user?.geminiApiKeyEncrypted) {
      req.geminiApiKey = decrypt(user.geminiApiKeyEncrypted);
    }
  } catch (err) {
    console.error('Failed to load Gemini key:', err);
  }
  next();
};

module.exports = loadGeminiKey;
