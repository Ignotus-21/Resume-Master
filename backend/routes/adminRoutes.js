const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ApiUsage = require('../models/ApiUsage');
const User = require('../models/User');
const TokenUsage = require('../models/TokenUsage');
const ActiveSession = require('../models/ActiveSession');
const AppConfig = require('../models/AppConfig');
const compileCache = require('../services/compileCache');

const router = express.Router();

// Compile-cache effectiveness counters (in-process, reset on restart) — the
// baseline numbers Phase 2 compile-pipeline decisions are supposed to use.
router.get('/compile-stats', adminAuth, (req, res) => {
  res.json(compileCache.getStats());
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const liveAnonymousUsers = await ActiveSession.countDocuments({ isGuest: true, lastActiveAt: { $gte: fiveMinutesAgo } });
    const liveRegisteredUsers = await ActiveSession.countDocuments({ isGuest: false, lastActiveAt: { $gte: fiveMinutesAgo } });
    // ActiveSession rows expire (TTL) an hour after last activity, so they
    // can't answer "lifetime" questions — count distinct guest identities in
    // ApiUsage instead, which never expires. Guest identities are always
    // `ip:<addr>` (see identify.js); filter on that prefix so any
    // non-guest identity that ever ends up in this collection isn't counted.
    const totalAnonymousVisitors = (await ApiUsage.distinct('identity', { identity: /^ip:/ })).length;

    const tokenAggregation = await TokenUsage.aggregate([
      {
        $group: {
          _id: "$service",
          totalInputTokens: { $sum: "$inputTokens" },
          totalOutputTokens: { $sum: "$outputTokens" },
          totalRequests: { $sum: 1 }
        }
      }
    ]);
    
    const tokenBreakdown = {};
    tokenAggregation.forEach(t => {
      tokenBreakdown[t._id] = {
        input: t.totalInputTokens,
        output: t.totalOutputTokens,
        requests: t.totalRequests
      };
    });

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        liveAnonymous: liveAnonymousUsers,
        liveRegistered: liveRegisteredUsers,
        totalAnonymous: totalAnonymousVisitors,
      },
      tokens: tokenBreakdown,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

router.get('/token-breakdown', adminAuth, async (req, res) => {
  try {
    // Registered Users
    const users = await User.find({}).select('email name usedTokens extraTokens createdAt isAdmin geminiApiKeyEncrypted');
    
    // Live Anonymous Users
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const liveSessions = await ActiveSession.find({ isGuest: true, lastActiveAt: { $gte: fiveMinutesAgo } });
    
    const liveGuestIdentities = liveSessions.map(s => s.identity);
    const liveGuestsUsage = await ApiUsage.find({ identity: { $in: liveGuestIdentities } });
    
    // Cumulative Inactive Anonymous Users. Restrict to guest (`ip:`-prefixed)
    // identities so any non-guest identity in this collection isn't mixed in.
    const inactiveGuestUsage = await ApiUsage.aggregate([
      { $match: { identity: { $regex: /^ip:/, $nin: liveGuestIdentities } } },
      { $group: { _id: null, totalUsed: { $sum: "$usedTokens" }, count: { $sum: 1 } } }
    ]);
    
    // Fetch service breakdown per identity
    const serviceBreakdown = await TokenUsage.aggregate([
      {
        $group: {
          _id: { identity: "$identity", service: "$service" },
          total: { $sum: { $add: ["$inputTokens", "$outputTokens"] } }
        }
      }
    ]);

    const usageMap = {};
    serviceBreakdown.forEach(b => {
      const id = b._id && b._id.identity ? b._id.identity.toString() : 'unknown';
      if (!usageMap[id]) usageMap[id] = {};
      usageMap[id][b._id && b._id.service ? b._id.service : 'unknown'] = b.total;
    });

    let config = await AppConfig.findOne({ key: 'global' });
    if (!config) config = { defaultTokenLimit: 15000, guestTokenLimit: 5000 };

    res.json({
      registeredUsers: users.map(u => {
        const services = u._id ? (usageMap[u._id.toString()] || {}) : {};
        const totalUsage = Object.values(services).reduce((sum, val) => sum + val, 0);
        return {
          id: u._id,
          email: u.email,
          name: u.name,
          usedTokens: u.usedTokens || 0,
          totalUsage: totalUsage,
          extraTokens: u.extraTokens || 0,
          totalLimit: config.defaultTokenLimit + (u.extraTokens || 0),
          isAdmin: u.isAdmin,
          isByok: !!u.geminiApiKeyEncrypted,
          services: services
        };
      }),
      liveGuests: liveGuestsUsage.map(g => ({
        identity: g.identity,
        usedTokens: g.usedTokens || 0,
        services: g.identity ? (usageMap[g.identity.toString()] || {}) : {}
      })),
      cumulativeInactiveGuests: inactiveGuestUsage[0] || { totalUsed: 0, count: 0 },
      config
    });
  } catch (error) {
    console.error('Token breakdown error:', error);
    res.status(500).json({ message: 'Failed to fetch token breakdown' });
  }
});

router.post('/config', adminAuth, async (req, res) => {
  try {
    const defaultTokenLimit = Number(req.body.defaultTokenLimit);
    const guestTokenLimit = Number(req.body.guestTokenLimit);
    if (!Number.isSafeInteger(defaultTokenLimit) || defaultTokenLimit < 0 ||
        !Number.isSafeInteger(guestTokenLimit) || guestTokenLimit < 0) {
      return res.status(400).json({ message: 'Token limits must be non-negative integers' });
    }
    const config = await AppConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: { defaultTokenLimit, guestTokenLimit } },
      { new: true, upsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update config' });
  }
});

router.post('/users/:id/tokens', adminAuth, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Token grant amount must be a positive integer' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { $inc: { extraTokens: amount } }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Tokens granted', extraTokens: user.extraTokens });
  } catch (error) {
    res.status(500).json({ message: 'Failed to grant tokens' });
  }
});

module.exports = router;
