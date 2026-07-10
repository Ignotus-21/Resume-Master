const ApiUsage = require('../models/ApiUsage');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

const WINDOW_MS = (parseFloat(process.env.SHARED_GEMINI_RATE_WINDOW_HOURS) || 4) * 60 * 60 * 1000;

let cachedConfig = null;
let lastConfigFetch = 0;

const getConfig = async () => {
  if (cachedConfig && Date.now() - lastConfigFetch < 60000) {
    return cachedConfig;
  }
  // Atomic upsert so concurrent cold requests can't both miss findOne() and
  // race into create(), which would throw a duplicate-key error on `key`.
  const config = await AppConfig.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', defaultTokenLimit: 15000, guestTokenLimit: 5000 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  cachedConfig = config;
  lastConfigFetch = Date.now();
  return config;
};

/**
 * Checks if a user or guest has enough tokens to make a request.
 * Takes the `req` object to check user authentication and BYOK status.
 */
const consumeQuota = async (req) => {
  if (!req.user && !(req.quotaIdentity || req.identity)) {
    throw new Error('consumeQuota called without an identified request (identify middleware must run first)');
  }
  const config = await getConfig();

  if (req.user) {
    // Logged in user
    const user = await User.findById(req.user.id);
    if (!user) return { allowed: false, remaining: 0 };
    
    // Bypass for BYOK — check the key actually usable on this request (set by
    // loadGeminiKey), not just whether one is stored: if decryption fails
    // (e.g. after an ENCRYPTION_KEY rotation), the request silently falls
    // back to the shared key and must still be quota-checked.
    if (req.geminiApiKey) {
      return { allowed: true, remaining: Infinity, isByok: true };
    }

    const totalLimit = config.defaultTokenLimit + (user.extraTokens || 0);
    const used = user.usedTokens || 0;

    if (used >= totalLimit) {
      return { allowed: false, remaining: 0, resetAt: null }; // Lifetime limit reached
    }
    return { allowed: true, remaining: totalLimit - used };
  } else {
    // Guest (IP-based)
    const identity = req.quotaIdentity || req.identity;
    const now = new Date();
    const windowFloor = new Date(now.getTime() - WINDOW_MS);
    
    // Upsert the record
    let usage;
    try {
      usage = await ApiUsage.findOneAndUpdate(
        { identity },
        { $setOnInsert: { identity, count: 0, usedTokens: 0, windowStart: now } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        usage = await ApiUsage.findOne({ identity });
      } else {
        throw err;
      }
    }
    
    // Reset window if expired. A concurrent request may have already reset
    // the same window, in which case this match returns null — re-fetch
    // rather than crash on a null `usage` below.
    if (usage.windowStart < windowFloor) {
      const resetUsage = await ApiUsage.findOneAndUpdate(
        { identity, windowStart: { $lt: windowFloor } },
        { $set: { count: 0, usedTokens: 0, windowStart: now } },
        { new: true }
      );
      usage = resetUsage || await ApiUsage.findOne({ identity });
    }
    
    // Check tokens. Guard against pre-existing ApiUsage docs from before
    // usedTokens existed on the schema — undefined would make the >= check
    // always false (silently unlimited) and the subtraction below NaN.
    const usedTokens = usage.usedTokens || 0;
    if (usedTokens >= config.guestTokenLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(usage.windowStart.getTime() + WINDOW_MS)
      };
    }

    return {
      allowed: true,
      remaining: config.guestTokenLimit - usedTokens,
      resetAt: new Date(usage.windowStart.getTime() + WINDOW_MS)
    };
  }
};

const getQuotaStatus = async (req) => {
  if (!req.user && !(req.quotaIdentity || req.identity)) {
    throw new Error('getQuotaStatus called without an identified request (identify middleware must run first)');
  }
  const config = await getConfig();

  if (req.user) {
    const user = await User.findById(req.user.id);
    if (!user) return { limit: 0, remaining: 0 };
    if (req.geminiApiKey) {
      return { limit: Infinity, remaining: Infinity, isByok: true };
    }
    const totalLimit = config.defaultTokenLimit + (user.extraTokens || 0);
    const used = user.usedTokens || 0;
    return { limit: totalLimit, remaining: Math.max(0, totalLimit - used) };
  } else {
    const identity = req.quotaIdentity || req.identity;
    const usage = await ApiUsage.findOne({ identity });
    const now = new Date();
    
    if (!usage || now.getTime() - usage.windowStart.getTime() >= WINDOW_MS) {
      return { limit: config.guestTokenLimit, remaining: config.guestTokenLimit, resetAt: new Date(now.getTime() + WINDOW_MS) };
    }
    return {
      limit: config.guestTokenLimit,
      remaining: Math.max(0, config.guestTokenLimit - (usage.usedTokens || 0)),
      resetAt: new Date(usage.windowStart.getTime() + WINDOW_MS),
    };
  }
};

module.exports = { consumeQuota, getQuotaStatus, WINDOW_MS, getConfig };
