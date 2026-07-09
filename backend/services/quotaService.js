const ApiUsage = require('../models/ApiUsage');

const LIMIT = parseInt(process.env.SHARED_GEMINI_RATE_LIMIT, 10) || 15;
const WINDOW_MS = (parseFloat(process.env.SHARED_GEMINI_RATE_WINDOW_HOURS) || 4) * 60 * 60 * 1000;

/**
 * Atomically checks and consumes one unit of the shared-key quota for an
 * identity (user id or guest IP). Fixed window: resets count once WINDOW_MS has
 * elapsed. Every step is a single atomic Mongo operation so concurrent requests
 * can neither double-create the record nor increment past the limit.
 */
const consumeQuota = async (identity) => {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - WINDOW_MS);

  // 1. Create the record if missing. Upsert is atomic; a concurrent upsert race
  //    surfaces as a benign duplicate-key error which we ignore.
  try {
    await ApiUsage.updateOne(
      { identity },
      { $setOnInsert: { identity, count: 0, windowStart: now } },
      { upsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
  }

  // 2. Reset the window if it has expired. The windowStart filter guarantees
  //    only the first concurrent request performs the reset.
  await ApiUsage.updateOne(
    { identity, windowStart: { $lt: windowFloor } },
    { $set: { count: 0, windowStart: now } }
  );

  // 3. Increment only while under the limit. Because the filter and $inc are a
  //    single atomic op, parallel requests can never both push past LIMIT.
  const updated = await ApiUsage.findOneAndUpdate(
    { identity, count: { $lt: LIMIT } },
    { $inc: { count: 1 } },
    { new: true }
  );

  if (updated) {
    return {
      allowed: true,
      remaining: Math.max(0, LIMIT - updated.count),
      resetAt: new Date(updated.windowStart.getTime() + WINDOW_MS),
    };
  }

  // Over the limit: report when the current window resets.
  const current = await ApiUsage.findOne({ identity });
  const resetAt = current
    ? new Date(current.windowStart.getTime() + WINDOW_MS)
    : new Date(now.getTime() + WINDOW_MS);
  return { allowed: false, remaining: 0, resetAt };
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
