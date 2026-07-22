const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { rateLimitStore } = require('../config/rateLimitStore');
const requireAuth = require('../middleware/requireAuth');
const { submitContact } = require('../controllers/supportController');

// Low-volume, legitimate-use route (support/token requests) — generous but
// still capped against spam. passOnStoreError: true, a Redis blip shouldn't
// block someone from reaching support.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('contact'),
  passOnStoreError: true,
});

router.post('/contact', requireAuth, contactLimiter, submitContact);

module.exports = router;
