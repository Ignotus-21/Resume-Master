const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  contextType: { type: String, enum: ['General', 'Job', 'Resume'], default: 'General' },
  contextId: { type: mongoose.Schema.Types.ObjectId }, // ID of Job or Resume
  history: [{
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: String }], // Google Gemini format
    timestamp: { type: Date, default: Date.now }
  }],
}, {
  timestamps: true,
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);
module.exports = ChatSession;
