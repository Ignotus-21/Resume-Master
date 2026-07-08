const ApiUsage = require('../models/ApiUsage');

const LIMIT = parseInt(process.env.SHARED_GEMINI_RATE_LIMIT, 10) || 15;
const WINDOW_MS = (parseFloat(process.env.SHARED_GEMINI_RATE_WINDOW_HOURS) || 4) * 60 * 60 * 1000;

/**
 * Atomically checks and consumes one unit of the shared-key quota for an identity
 * (user id or guest id). Fixed window: resets count once WINDOW_MS has elapsed.
 */
const consumeQuota = async (identity) => {
  const now = new Date();

  let usage = await ApiUsage.findOne({ identity });

  if (!usage) {
    usage = await ApiUsage.create({ identity, count: 1, windowStart: now });
    return { allowed: true, remaining: LIMIT - 1, resetAt: new Date(now.getTime() + WINDOW_MS) };
  }

  const windowExpired = now.getTime() - usage.windowStart.getTime() >= WINDOW_MS;

  if (windowExpired) {
    usage = await ApiUsage.findOneAndUpdate(
      { identity },
      { $set: { count: 1, windowStart: now } },
      { new: true }
    );
    return { allowed: true, remaining: LIMIT - 1, resetAt: new Date(now.getTime() + WINDOW_MS) };
  }

  const resetAt = new Date(usage.windowStart.getTime() + WINDOW_MS);

  if (usage.count >= LIMIT) {
    return { allowed: false, remaining: 0, resetAt };
  }

  const updated = await ApiUsage.findOneAndUpdate(
    { identity },
    { $inc: { count: 1 } },
    { new: true }
  );
  return { allowed: true, remaining: Math.max(0, LIMIT - updated.count), resetAt };
};

const getQuotaStatus = async (identity) => {
  const now = new Date();
  const usage = await ApiUsage.findOne({ identity });
  if (!usage || now.getTime() - usage.windowStart.getTime() >= WINDOW_MS) {
    return { limit: LIMIT, remaining: LIMIT, resetAt: new Date(now.getTime() + WINDOW_MS) };
  }
  return {
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - usage.count),
    resetAt: new Date(usage.windowStart.getTime() + WINDOW_MS),
  };
};

module.exports = { consumeQuota, getQuotaStatus, LIMIT, WINDOW_MS };
