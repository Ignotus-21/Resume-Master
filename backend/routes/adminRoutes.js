const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ApiUsage = require('../models/ApiUsage');
const User = require('../models/User');
const TokenUsage = require('../models/TokenUsage');
const ActiveSession = require('../models/ActiveSession');

const router = express.Router();

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    
    // Live users (active within the last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const liveAnonymousUsers = await ActiveSession.countDocuments({ isGuest: true, lastActiveAt: { $gte: fiveMinutesAgo } });
    const liveRegisteredUsers = await ActiveSession.countDocuments({ isGuest: false, lastActiveAt: { $gte: fiveMinutesAgo } });
    
    // Total historical anonymous visitors
    const totalAnonymousVisitors = await ActiveSession.countDocuments({ isGuest: true });

    // Detailed token usage by service
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

    // Old general quota usage limit (legacy rate limiting)
    const usageRecords = await ApiUsage.find({});
    let totalTokensUsed = 0; // Legacy api call counts
    let overQuotaCount = 0;
    const limit = parseInt(process.env.SHARED_GEMINI_RATE_LIMIT, 10) || 15;
    
    for (const record of usageRecords) {
      totalTokensUsed += record.count;
      if (record.count >= limit) {
        overQuotaCount++;
      }
    }

    res.json({
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        liveAnonymous: liveAnonymousUsers,
        liveRegistered: liveRegisteredUsers,
        totalAnonymous: totalAnonymousVisitors,
      },
      tokens: tokenBreakdown,
      quota: {
        totalIdentitiesTracked: usageRecords.length,
        totalApiRequests: totalTokensUsed,
        identitiesOverQuota: overQuotaCount,
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

module.exports = router;
