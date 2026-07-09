const TokenUsage = require('../models/TokenUsage');
const User = require('../models/User');
const ApiUsage = require('../models/ApiUsage');

const trackUsage = async (req, service, responseResult) => {
  try {
    if (!responseResult || !responseResult.response || !responseResult.response.usageMetadata) return;

    const inputTokens = responseResult.response.usageMetadata.promptTokenCount || 0;
    const outputTokens = responseResult.response.usageMetadata.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;

    const identity = req.user ? req.user.id : req.quotaIdentity;
    
    await TokenUsage.create({
      identity,
      service,
      inputTokens,
      outputTokens
    });

    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, { $inc: { usedTokens: totalTokens } });
    } else {
      await ApiUsage.findOneAndUpdate({ identity }, { $inc: { usedTokens: totalTokens } });
    }
  } catch (error) {
    console.error("Failed to track token usage:", error);
  }
};

module.exports = { trackUsage };
