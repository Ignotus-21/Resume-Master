const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';
const GUEST_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// Fire-and-forget upsert so admin "live users" stats reflect real traffic
// without adding latency to the request. Debounced per-identity in memory so
// a burst of requests from the same user/guest doesn't write on every single
// one — the "live in the last 5 minutes" check tolerates this being stale by
// up to a minute.
const TRACK_DEBOUNCE_MS = 60 * 1000;
const lastTracked = new Map();

// Without this, lastTracked would grow forever (one entry per unique
// identity ever seen) over the life of a long-running process.
setInterval(() => {
  const cutoff = Date.now() - TRACK_DEBOUNCE_MS;
  for (const [id, ts] of lastTracked) {
    if (ts < cutoff) lastTracked.delete(id);
  }
}, TRACK_DEBOUNCE_MS).unref();

const trackActiveSession = (req) => {
  try {
    const trackId = req.user ? req.user.id : req.quotaIdentity;
    const now = Date.now();
    if (now - (lastTracked.get(trackId) || 0) < TRACK_DEBOUNCE_MS) return;
    lastTracked.set(trackId, now);

    const ActiveSession = require('../models/ActiveSession');
    ActiveSession.updateOne(
      { identity: trackId },
      { $set: { isGuest: req.isGuest, lastActiveAt: new Date() } },
      { upsert: true }
    ).catch((err) => console.error('Failed to track active session:', err));
  } catch (err) {
    console.error('ActiveSession require error:', err);
  }
};

// A JWT is revoked when the user's tokenVersion moved past the version the
// token was minted with (password reset / "log out everywhere"), or when the
// account no longer exists (deleted user). On DB errors it fails open so an
// outage doesn't log everyone out (revocation is a best-effort defense, not
// the auth check).
const isTokenRevoked = async (payload) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(payload.sub).select('tokenVersion').lean();
    if (!user) return true;
    return (user.tokenVersion || 0) !== (payload.v || 0);
  } catch (err) {
    return false;
  }
};

const identify = async (req, res, next) => {
  const token = req.cookies?.token;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (await isTokenRevoked(payload)) throw new Error('Token revoked');
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
