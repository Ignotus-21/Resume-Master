const mongoose = require('mongoose');

const tokenUsageSchema = new mongoose.Schema({
  identity: { type: String, required: true }, // user ID or guest IP
  service: { type: String, required: true },  // e.g., 'chatbot', 'resume-generator', 'ats-checker', 'linkedin-optimizer'
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

tokenUsageSchema.index({ identity: 1, createdAt: -1 });
// Per-request records are only needed for the admin service-breakdown view;
// the running totals live on User/ApiUsage indefinitely. Auto-expire after 90
// days so this collection doesn't grow without bound on a free-tier cluster.
tokenUsageSchema.index({ createdAt: -1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const TokenUsage = mongoose.model('TokenUsage', tokenUsageSchema);
module.exports = TokenUsage;
