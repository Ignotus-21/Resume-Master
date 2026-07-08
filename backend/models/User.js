const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String },
  geminiApiKeyEncrypted: { type: String },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
module.exports = User;
