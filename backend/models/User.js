const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String },
  geminiApiKeyEncrypted: { type: String },
  isAdmin: { type: Boolean, default: false },

  // Email verification (email/password accounts). Google accounts are verified
  // by Google, so they're created with emailVerified = true.
  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String },
  emailVerifyExpires: { type: Date },

  // Password reset
  passwordResetTokenHash: { type: String },
  passwordResetExpires: { type: Date },
}, {
  timestamps: true,
});

// Token lookups happen on verify/reset; sparse indexes keep them off a full
// collection scan while ignoring the many docs where these are unset.
userSchema.index({ emailVerifyTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
