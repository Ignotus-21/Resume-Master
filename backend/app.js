const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { rateLimitStore } = require('./config/rateLimitStore');
const { sanitizeBody } = require('./middleware/sanitize');
const identify = require('./middleware/identify');
const loadGeminiKey = require('./middleware/loadGeminiKey');
const morgan = require('morgan');

const createApp = () => {
  const app = express();

  // Trust the reverse proxy in front of the app so req.ip is the real client
  // (used for IP-based rate limiting and the guest AI-quota key). Defaults to 0
  // (disabled) so X-Forwarded-For can't be spoofed when NOT behind a trusted
  // proxy; set TRUST_PROXY_HOPS to the real hop count in a proxied deployment.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));

  // Restrict CORS to known frontend origin(s) instead of reflecting any origin.
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      // Allow non-browser tools (no Origin header) and any explicitly allowed origin.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  // Explicit security headers (this is a JSON/PDF API — nothing here renders
  // HTML, so the CSP can lock everything down; the Next.js frontend has its
  // own document policy).
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);
  app.use(identify);
  app.use(loadGeminiKey);

  // Rate limits use Redis when REDIS_URL is set (survives restarts, shared
  // across instances) and fall back to in-memory otherwise. The general limiter
  // sets passOnStoreError so a Redis outage doesn't take the whole API down;
  // the AI and auth limiters below fail closed instead, since they exist
  // specifically to cap AI cost and brute-force risk, and letting requests
  // through unlimited during an outage defeats that purpose.
  // General rate limit across the API.
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore('general'),
    passOnStoreError: true,
  }));

  // Stricter limit on the Gemini-backed / compute-heavy routes (cost & DoS control).
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore('ai'),
    passOnStoreError: false,
  });
  app.use('/api/ai', aiLimiter);
  app.use('/api/resumes/generate', aiLimiter);
  // /api/resumes/compile is NOT an AI route — it has its own compileLimiter
  // (middleware/compile.js) with a budget sized for live editing; putting it
  // behind aiLimiter used to lock users out of their own document mid-edit.
  app.use('/api/resumes/feedback', aiLimiter);
  app.use('/api/master/upload-resume', aiLimiter);
  app.use('/api/master/ingest', aiLimiter);
  app.use('/api/cover-letters/generate', aiLimiter);
  app.use('/api/interview', aiLimiter);

  // Tighter limit on auth routes to slow down credential stuffing/brute force.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore('auth'),
    passOnStoreError: false,
  });
  app.use('/api/auth/signup', authLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/google', authLimiter);
  app.use('/api/auth/verify-email', authLimiter);
  app.use('/api/auth/resend-verification', authLimiter);
  app.use('/api/auth/request-password-reset', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  // Basic Route
  app.get('/', (req, res) => {
    res.send('API is running...');
  });

  // Routes
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/master', require('./routes/masterRoutes'));
  app.use('/api/jobs', require('./routes/jobRoutes'));
  app.use('/api/resumes', require('./routes/resumeRoutes'));
  app.use('/api/cover-letters', require('./routes/coverLetterRoutes'));
  app.use('/api/interview', require('./routes/interviewRoutes'));
  app.use('/api/ai', require('./routes/aiRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/support', require('./routes/supportRoutes'));

  // Central error handler (also catches the CORS rejection thrown above).
  app.use((err, req, res, next) => {
    if (err && err.message === 'Not allowed by CORS') {
      return res.status(403).json({ message: 'Not allowed by CORS' });
    }
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
};

module.exports = createApp;
