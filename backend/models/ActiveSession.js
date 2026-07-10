const mongoose = require('mongoose');

const activeSessionSchema = new mongoose.Schema({
  identity: { type: String, required: true, unique: true },
  isGuest: { type: Boolean, default: false },
  // Auto-expire an hour after the last request so stale sessions don't
  // accumulate indefinitely on the free-tier Atlas storage cap.
  lastActiveAt: { type: Date, default: Date.now, expires: 3600 }
});

const ActiveSession = mongoose.model('ActiveSession', activeSessionSchema);
module.exports = ActiveSession;
