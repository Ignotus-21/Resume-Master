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

// Per-day, per-service token usage for the admin timeline. Backed by the
// per-request TokenUsage records, which TTL out after 90 days (see
// models/TokenUsage.js) — so this is a rolling window, not all-time. Days
// are UTC calendar days.
router.get('/usage-timeline', adminAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 90, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await TokenUsage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            service: '$service',
          },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          requests: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': -1 } },
    ]);

    // Fold per-(day,service) rows into one entry per day, newest first.
    const byDay = new Map();
    for (const row of rows) {
      const { day, service } = row._id;
      if (!byDay.has(day)) {
        byDay.set(day, { date: day, totalTokens: 0, totalRequests: 0, services: {} });
      }
      const entry = byDay.get(day);
      const total = row.inputTokens + row.outputTokens;
      entry.services[service || 'other'] = {
        input: row.inputTokens,
        output: row.outputTokens,
        requests: row.requests,
        total,
      };
      entry.totalTokens += total;
      entry.totalRequests += row.requests;
    }

    res.json({ windowDays: days, days: [...byDay.values()] });
  } catch (error) {
    console.error('Usage timeline error:', error);
    res.status(500).json({ message: 'Failed to fetch usage timeline' });
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
    const liveUsageByIdentity = new Map(liveGuestsUsage.map(u => [u.identity, u]));

    // Cumulative inactive-guest consumption. ApiUsage.usedTokens is the WRONG
    // source for this: it's the rolling-window quota counter, reset to 0
    // every SHARED_GEMINI_RATE_WINDOW_HOURS by consumeQuota — summing it
    // reports only the current window's leftovers, not what guests actually
    // consumed. Sum the per-request TokenUsage records instead (real token
    // counts). Those TTL out after 90 days, so this is "last 90 days", and
    // the UI labels it that way. Restrict to guest (`ip:`-prefixed)
    // identities so any non-guest identity isn't mixed in.
    const inactiveGuestUsage = await TokenUsage.aggregate([
      { $match: { identity: { $regex: /^ip:/, $nin: liveGuestIdentities } } },
      { $group: { _id: "$identity", total: { $sum: { $add: ["$inputTokens", "$outputTokens"] } } } },
      { $group: { _id: null, totalUsed: { $sum: "$total" }, count: { $sum: 1 } } }
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
      // Build the live list from the live SESSIONS, not from ApiUsage rows —
      // a guest who is live but hasn't spent AI tokens this window has no
      // ApiUsage row and used to vanish here while still being counted in
      // the "Live Guests" stat card.
      liveGuests: liveGuestIdentities.map(identity => ({
        identity,
        usedTokens: liveUsageByIdentity.get(identity)?.usedTokens || 0,
        services: usageMap[identity] || {}
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
