const { consumeQuota } = require('../services/quotaService');

/**
 * Enforces the shared-key quota unless the caller has their own Gemini key.
 * Returns null when the call is allowed to proceed, or an object describing
 * the 429 response to send when the free quota is exhausted.
 */
const enforceGeminiQuota = async (req) => {
  if (req.geminiApiKey) return null;

  // quotaIdentity is the account id for logged-in users and an IP-derived key
  // for guests, so guests can't reset the quota by rotating the guestId cookie.
  const { allowed, resetAt } = await consumeQuota(req.quotaIdentity || req.identity);
  if (allowed) return null;

  return {
    status: 429,
    body: {
      message: `Free AI quota exceeded. Add your own Gemini API key in Settings for unlimited use, or try again after ${resetAt.toISOString()}.`,
      resetAt,
    },
  };
};

module.exports = { enforceGeminiQuota };
