const TokenUsage = require('../models/TokenUsage');
const User = require('../models/User');
const ApiUsage = require('../models/ApiUsage');
const { RESERVE_ESTIMATE, refundReservation } = require('../services/quotaService');

const trackUsage = async (req, service, responseResult) => {
  try {
    // consumeQuota already reserved RESERVE_ESTIMATE atomically at admission
    // time (see quotaService.js). Every path below that doesn't reach the
    // real true-up must refund it, or a run of malformed/failed responses
    // would permanently burn tokens without ever recording real usage.
    if (!responseResult || !responseResult.response) {
      await refundReservation(req);
      return;
    }
    // response is a promise in this SDK (every caller does `await result.response`
    // before using it) — reading .usageMetadata off it directly always returned
    // undefined, silently no-op'ing every call to this function.
    const response = await responseResult.response;
    if (!response || !response.usageMetadata) {
      await refundReservation(req);
      return;
    }

    const inputTokens = response.usageMetadata.promptTokenCount || 0;
    const outputTokens = response.usageMetadata.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;

    const identity = req.user ? req.user.id : req.quotaIdentity;

    // Best-effort: this per-request breakdown record is only for the admin
    // service-breakdown view. If it fails to insert, the running quota
    // counters below must still update — they're what actually enforces
    // the limit.
    TokenUsage.create({ identity, service, inputTokens, outputTokens })
      .catch((err) => console.error('Failed to record TokenUsage:', err));

    // Tokens spent on a user's own Gemini key don't draw from the shared-key
    // quota, so don't count them against usedTokens (otherwise removing a
    // BYOK key later would leave the account pre-charged against the shared
    // limit for usage that never touched it).
    if (req.geminiApiKey) return;

    // True up to the real cost instead of adding the full amount again. This
    // can go negative (refunding an over-estimate), which is correct.
    const adjustment = totalTokens - RESERVE_ESTIMATE;

    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { usedTokens: adjustment } });
    } else {
      await ApiUsage.findOneAndUpdate(
        { identity },
        { $inc: { usedTokens: adjustment }, $setOnInsert: { identity, count: 0, windowStart: new Date() } },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error("Failed to track token usage:", error);
    // The true-up above may never have applied (e.g. the DB write itself
    // failed) — fall back to refunding the reservation so this request nets
    // to zero rather than leaving a permanent stray charge.
    await refundReservation(req).catch(() => {});
  }
};

module.exports = { trackUsage };
