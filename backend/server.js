// Load .env before anything else: some modules (middleware/identify.js,
// controllers/authController.js) read env vars at require time, so requiring
// them first would bake in pre-.env values.
require('dotenv').config();

const connectDB = require('./config/db');
const createApp = require('./app');
const compileCache = require('./services/compileCache');

console.log('Starting Backend Server...');

connectDB().then(() => {
  console.log('Database connection initiated...');
}).catch(err => {
  console.error('Database connection failed immediately:', err);
});

const app = createApp();

const PORT = process.env.PORT || 5000;

console.log(`Attempting to listen on port ${PORT}...`);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
console.log('Listen called');

// Compile-cache effectiveness, in the logs where ops actually looks. The
// counters are in-process (reset on restart) — that's a deliberate call: the
// cache itself is Redis-backed, but the hit-rate is a health signal, not
// billing data, and a per-instance sample window is exactly what you want
// when judging a deploy. Only logs when there's been traffic since last time.
const STATS_LOG_INTERVAL_MS = 15 * 60 * 1000;
let lastLoggedSampleCount = 0;
setInterval(() => {
  const s = compileCache.getStats();
  if (s.sampleCount === lastLoggedSampleCount) return;
  lastLoggedSampleCount = s.sampleCount;
  console.log(
    `[compile-stats] hits=${s.hits} misses=${s.misses} hitRate=${(s.hitRate * 100).toFixed(1)}% samples=${s.sampleCount} (since restart)`
  );
}, STATS_LOG_INTERVAL_MS).unref();
