const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const Resume = require('../models/Resume');
const ChatSession = require('../models/ChatSession');
const ApiUsage = require('../models/ApiUsage');
const { encrypt } = require('../utils/crypto');
const { getQuotaStatus } = require('../services/quotaService');

const isProd = process.env.NODE_ENV === 'production';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const issueToken = (res, user) => {
  const token = jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: TOKEN_MAX_AGE,
  });
};

// Reassigns any guest-owned records onto the newly authenticated account, so
// work done before signing up/in isn't lost.
const migrateGuestData = async (guestId, userId) => {
  if (!guestId || guestId === userId) return;
  const ownerFilter = { owner: guestId };
  const ownerUpdate = { $set: { owner: userId } };

  // MasterProfile.owner is unique, so reassigning the guest profile would throw
  // a duplicate-key error if the account already has one. Only claim the guest
  // profile when the account has none; otherwise drop it (keep the account's).
  const existingProfile = await MasterProfile.exists({ owner: userId });
  if (existingProfile) {
    await MasterProfile.deleteOne(ownerFilter);
  } else {
    await MasterProfile.updateOne(ownerFilter, ownerUpdate);
  }

  await Promise.all([
    Job.updateMany(ownerFilter, ownerUpdate),
    Resume.updateMany(ownerFilter, ownerUpdate),
    ChatSession.updateMany(ownerFilter, ownerUpdate),
    ApiUsage.deleteOne({ identity: guestId }),
  ]);
};

const clearGuestCookie = (res) => {
  res.clearCookie('guestId');
};

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  hasOwnKey: Boolean(user.geminiApiKeyEncrypted),
});

const signup = async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ message: 'Email and a password of at least 8 characters are required' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, name });

    await migrateGuestData(req.guestId, user._id.toString());
    clearGuestCookie(res);
    issueToken(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    await migrateGuestData(req.guestId, user._id.toString());
    clearGuestCookie(res);
    issueToken(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const googleLogin = async (req, res) => {
  if (!googleClient) {
    return res.status(400).json({ message: 'Google sign-in is not configured on this server' });
  }

  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: 'Missing Google credential' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // Require a verified email before trusting it for account lookup/linking,
    // otherwise a Google token carrying an unverified email could be used to
    // take over an existing email/password account.
    if (!payload.email || payload.email_verified !== true) {
      return res.status(401).json({ message: 'Google account email is not verified' });
    }

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email.toLowerCase() });
      if (user) {
        user.googleId = payload.sub;
        await user.save();
      } else {
        user = await User.create({
          email: payload.email.toLowerCase(),
          googleId: payload.sub,
          name: payload.name,
        });
      }
    }

    await migrateGuestData(req.guestId, user._id.toString());
    clearGuestCookie(res);
    issueToken(res, user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: 'Google sign-in failed' });
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
};

const me = async (req, res) => {
  if (!req.user) return res.json({ user: null, guest: true });

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.json({ user: null, guest: true });
    res.json({ user: publicUser(user), guest: false });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const quota = async (req, res) => {
  try {
    if (req.geminiApiKey) {
      return res.json({ usingOwnKey: true, limit: null, remaining: null, resetAt: null });
    }
    const status = await getQuotaStatus(req.quotaIdentity || req.identity);
    res.json({ usingOwnKey: false, ...status });
  } catch (error) {
    console.error('Quota lookup error:', error);
    res.status(500).json({ message: 'Failed to load quota' });
  }
};

const setGeminiKey = async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({ message: 'A valid Gemini API key is required' });
  }
  try {
    const encrypted = encrypt(apiKey.trim());
    await User.findByIdAndUpdate(req.user.id, { geminiApiKeyEncrypted: encrypted });
    res.json({ message: 'API key saved' });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const removeGeminiKey = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $unset: { geminiApiKeyEncrypted: '' } });
    res.json({ message: 'API key removed' });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { signup, login, googleLogin, logout, me, quota, setGeminiKey, removeGeminiKey };
