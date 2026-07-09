const mongoose = require('mongoose');

const activeSessionSchema = new mongoose.Schema({
  identity: { type: String, required: true, unique: true },
  isGuest: { type: Boolean, default: false },
  lastActiveAt: { type: Date, default: Date.now }
});

const ActiveSession = mongoose.model('ActiveSession', activeSessionSchema);
module.exports = ActiveSession;
