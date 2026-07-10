const ApiUsage = require('../models/ApiUsage');
const User = require('../models/User');
const AppConfig = require('../models/AppConfig');

const WINDOW_MS = (parseFloat(process.env.SHARED_GEMINI_RATE_WINDOW_HOURS) || 4) * 60 * 60 * 1000;

// Flat estimate reserved atomically at admission time, trued up to the real
// cost once it's known (see trackUsage). This closes the check-then-act race
// where concurrent requests could all read the same "under limit" snapshot
// before any of them recorded usage: the reservation and the admit decision
// now happen in one atomic conditional update, so a burst can't collectively
// exceed the limit by more than a single reservation's worth.
const RESERVE_ESTIMATE = 500;

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

    // Atomically reserve the estimate as part of the same operation that
    // decides admission — the filter and the $inc run as one document-level
    // operation, so two concurrent requests can't both read "under limit"
    // and both get admitted.
    const reserved = await User.findOneAndUpdate(
      { _id: req.user.id, usedTokens: { $lte: totalLimit - RESERVE_ESTIMATE } },
      { $inc: { usedTokens: RESERVE_ESTIMATE } },
      { new: true }
    );
    if (!reserved) {
      return { allowed: false, remaining: 0, resetAt: null }; // Lifetime limit reached
    }
    return { allowed: true, remaining: totalLimit - reserved.usedTokens };
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
    
    // Atomically reserve the estimate as part of the same operation that
    // decides admission (see RESERVE_ESTIMATE above).
    const reserved = await ApiUsage.findOneAndUpdate(
      { identity, usedTokens: { $lte: config.guestTokenLimit - RESERVE_ESTIMATE } },
      { $inc: { usedTokens: RESERVE_ESTIMATE } },
      { new: true }
    );
    if (!reserved) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(usage.windowStart.getTime() + WINDOW_MS)
      };
    }

    return {
      allowed: true,
      remaining: config.guestTokenLimit - reserved.usedTokens,
      resetAt: new Date(reserved.windowStart.getTime() + WINDOW_MS)
    };
  }
};

// Refunds a reservation that was never trued up by trackUsage — the Gemini
// call threw before trackUsage ran, or trackUsage itself bailed out early
// (missing response/usageMetadata). Without this, a run of transient
// failures would permanently burn RESERVE_ESTIMATE tokens each time and
// could eventually lock a user out even though nothing real was consumed.
const refundReservation = async (req) => {
  if (req.geminiApiKey) return; // BYOK never reserved anything
  // Refund only while the reservation is outstanding (set by geminiGate,
  // cleared by trackUsage's true-up). Without this, a failure in a request's
  // SECOND Gemini call would refund a reservation the first call already
  // consumed, crediting tokens that were really spent.
  if (req.quotaReserved !== true) return;
  req.quotaReserved = false;
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { usedTokens: -RESERVE_ESTIMATE } });
    } else {
      const identity = req.quotaIdentity || req.identity;
      if (!identity) return;
      await ApiUsage.findOneAndUpdate({ identity }, { $inc: { usedTokens: -RESERVE_ESTIMATE } });
    }
  } catch (error) {
    console.error('Failed to refund quota reservation:', error);
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

module.exports = { consumeQuota, getQuotaStatus, WINDOW_MS, getConfig, RESERVE_ESTIMATE, refundReservation };
