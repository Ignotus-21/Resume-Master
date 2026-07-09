const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';
const GUEST_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// Fire-and-forget upsert so admin "live users" stats reflect real traffic
// without adding latency to the request.
const trackActiveSession = (req) => {
  try {
    const ActiveSession = require('../models/ActiveSession');
    const trackId = req.user ? req.user.id : req.quotaIdentity;
    ActiveSession.updateOne(
      { identity: trackId },
      { $set: { isGuest: req.isGuest, lastActiveAt: new Date() } },
      { upsert: true }
    ).catch((err) => console.error('Failed to track active session:', err));
  } catch (err) {
    console.error('ActiveSession require error:', err);
  }
};

const identify = (req, res, next) => {
  const token = req.cookies?.token;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
      req.identity = payload.sub;
      // Logged-in users are quota-limited per account (not per IP), so their
      // quota can't be reset by touching cookies.
      req.quotaIdentity = payload.sub;
      req.isGuest = false;
      trackActiveSession(req);
      return next();
    } catch (err) {
      // Invalid/expired token: fall through to guest identification.
    }
  }

  let guestId = req.cookies?.guestId;
  if (!guestId) {
    guestId = crypto.randomUUID();
    res.cookie('guestId', guestId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }
  req.guestId = guestId;
  req.identity = guestId;
  req.isGuest = true;
  // Quota is keyed on the client IP for guests so that simply rotating the
  // guestId cookie cannot reset the free AI quota and drain the shared key.
  // (Requires `trust proxy` to be configured so req.ip is the real client.)
  req.quotaIdentity = `ip:${req.ip}`;
  trackActiveSession(req);

  next();
};

module.exports = identify;
