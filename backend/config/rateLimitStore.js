const { RedisStore } = require('rate-limit-redis');

// Redis-backed rate-limit store so limits survive restarts and are shared
// across instances. Configure with REDIS_URL (or UPSTASH_REDIS_URL) — an
// Upstash free-tier rediss:// URL works. When unset (local dev, tests) this
// returns undefined and express-rate-limit falls back to its in-memory store.
let client;

// Lazily create the single shared ioredis connection. Also used by the
// compile cache (services/compileCache.js) so the whole app holds one
// connection. Returns null when no Redis is configured.
const getRedisClient = () => {
  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
  if (!url) return null;

  if (!client) {
    const Redis = require('ioredis');
    client = new Redis(url, {
      // Fail fast instead of queueing commands while disconnected — each
      // limiter's passOnStoreError setting decides whether that timeout
      // fails the request open or closed.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    client.on('error', (err) => console.error('Rate-limit Redis error:', err.message));
  }
  return client;
};

const rateLimitStore = (prefix) => {
  const redis = getRedisClient();
  if (!redis) return undefined;

  // Distinct prefix per limiter so the general/AI/auth counters don't collide
  // (they all key on the client IP).
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`,
  });
};

module.exports = { rateLimitStore, getRedisClient };
