const crypto = require('crypto');

// Generates a URL-safe random token and its SHA-256 hash. We email the raw
// token and store only the hash, so a database leak can't be used to verify
// emails or reset passwords.
const generateToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
};

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

module.exports = { generateToken, hashToken };
