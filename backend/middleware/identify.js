const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';
const GUEST_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

const identify = (req, res, next) => {
  const token = req.cookies?.token;

  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
      req.identity = payload.sub;
      req.isGuest = false;
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
  next();
};

module.exports = identify;
