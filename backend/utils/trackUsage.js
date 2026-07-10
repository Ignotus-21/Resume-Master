const TokenUsage = require('../models/TokenUsage');
const User = require('../models/User');
const ApiUsage = require('../models/ApiUsage');
const { RESERVE_ESTIMATE } = require('../services/quotaService');

const trackUsage = async (req, service, responseResult) => {
  try {
    // By the time trackUsage runs, model.generateContent() already
    // succeeded and the caller is about to deliver real content — refunding
    // the reservation here (rather than just leaving it as the charge)
    // would make that response effectively free. Only the caller's own
    // catch block (guarded by its `tracked` flag) should ever refund, since
    // that's the one place that can prove no content was produced at all.
    if (!responseResult || !responseResult.response) return;
    // response is a promise in this SDK (every caller does `await result.response`
    // before using it) — reading .usageMetadata off it directly always returned
    // undefined, silently no-op'ing every call to this function.
    const response = await responseResult.response;
    if (!response || !response.usageMetadata) return;

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
    // Reaching here means usageMetadata was already parsed — real usage
    // almost certainly occurred and the caller is delivering real content.
    // A failure this late is most likely a transient DB write error, not
    // proof the request never happened, so leave the reservation in place
    // as the (imprecise but safe) charge rather than refunding it.
    console.error("Failed to track token usage:", error);
  }
};

module.exports = { trackUsage };
