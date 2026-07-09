const TokenUsage = require('../models/TokenUsage');

const trackUsage = async (req, service, responseResult) => {
  try {
    if (!responseResult || !responseResult.response || !responseResult.response.usageMetadata) return;

    const inputTokens = responseResult.response.usageMetadata.promptTokenCount || 0;
    const outputTokens = responseResult.response.usageMetadata.candidatesTokenCount || 0;

    const identity = req.user ? req.user.id : req.quotaIdentity;
    
    await TokenUsage.create({
      identity,
      service,
      inputTokens,
      outputTokens
    });
  } catch (error) {
    console.error("Failed to track token usage:", error);
  }
};

module.exports = { trackUsage };
