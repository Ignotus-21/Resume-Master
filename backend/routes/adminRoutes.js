const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const ApiUsage = require('../models/ApiUsage');
const User = require('../models/User');

const router = express.Router();

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    
    // Aggregate API usage
    const usageRecords = await ApiUsage.find({});
    
    let totalTokensUsed = 0;
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
      },
      quota: {
        totalIdentitiesTracked: usageRecords.length,
        totalTokensUsed,
        identitiesOverQuota: overQuotaCount,
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

module.exports = router;
