const { consumeQuota } = require('../services/quotaService');

/**
 * Enforces the shared-key quota unless the caller has their own Gemini key.
 * Returns null when the call is allowed to proceed, or an object describing
 * the 429 response to send when the free quota is exhausted.
 */
const enforceGeminiQuota = async (req) => {
  // Email/password accounts must verify their email before using AI. This is
  // the main anti-abuse lever against bots farming free quota with fake emails.
  // Google users are verified; guests are separately IP-quota-limited.
  if (req.user && req.user.isEmailAccount && !req.user.emailVerified) {
    return {
      status: 403,
      body: { message: 'Please verify your email to use AI features. Check your inbox for the verification link.' },
    };
  }

  if (req.geminiApiKey) return null;

  // quotaIdentity is the account id for logged-in users and an IP-derived key
  // for guests, so guests can't reset the quota by rotating the guestId cookie.
  const { allowed, resetAt } = await consumeQuota(req.quotaIdentity || req.identity);
  if (allowed) return null;

  return {
    status: 429,
    body: {
      code: 'QUOTA_EXCEEDED',
      message: `Free AI quota exceeded. Add your own Gemini API key in Settings for unlimited use, or try again after ${resetAt.toISOString()}.`,
      resetAt,
    },
  };
};

module.exports = { enforceGeminiQuota };
