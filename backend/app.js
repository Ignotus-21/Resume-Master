const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { sanitizeBody } = require('./middleware/sanitize');
const identify = require('./middleware/identify');
const loadGeminiKey = require('./middleware/loadGeminiKey');

const createApp = () => {
  const app = express();

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
  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);
  app.use(identify);
  app.use(loadGeminiKey);

  // General rate limit across the API.
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Stricter limit on the Gemini-backed / compute-heavy routes (cost & DoS control).
  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/ai', aiLimiter);
  app.use('/api/resumes/generate', aiLimiter);
  app.use('/api/resumes/compile', aiLimiter);
  app.use('/api/resumes/feedback', aiLimiter);
  app.use('/api/master/upload-resume', aiLimiter);
  app.use('/api/master/ingest', aiLimiter);

  // Tighter limit on auth routes to slow down credential stuffing/brute force.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/auth/signup', authLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/google', authLimiter);

  // Basic Route
  app.get('/', (req, res) => {
    res.send('API is running...');
  });

  // Routes
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/master', require('./routes/masterRoutes'));
  app.use('/api/jobs', require('./routes/jobRoutes'));
  app.use('/api/resumes', require('./routes/resumeRoutes'));
  app.use('/api/ai', require('./routes/aiRoutes'));

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
