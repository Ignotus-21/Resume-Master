const mongoose = require('mongoose');

const tokenUsageSchema = new mongoose.Schema({
  identity: { type: String, required: true }, // user ID or guest IP
  service: { type: String, required: true },  // e.g., 'chatbot', 'resume-generator', 'ats-checker', 'linkedin-optimizer'
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

tokenUsageSchema.index({ identity: 1, createdAt: -1 });
tokenUsageSchema.index({ createdAt: -1 });

const TokenUsage = mongoose.model('TokenUsage', tokenUsageSchema);
module.exports = TokenUsage;
