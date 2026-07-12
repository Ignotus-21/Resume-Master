// Compile cache: sha256(tex) -> { pdf: base64, pages }, TTL 24h.
// render() is deterministic, so design-token tweaks and undo/redo hit this
// cache and feel instant. Uses the shared Redis connection when configured,
// with a small in-memory LRU fallback for dev/single-instance setups.
const crypto = require('crypto');
const { getRedisClient } = require('../config/rateLimitStore');

const TTL_SECONDS = 24 * 60 * 60;
const MEMORY_MAX_ENTRIES = 30; // PDFs are ~100KB base64; keep the fallback small
const memory = new Map();

const hashTex = (tex) => crypto.createHash('sha256').update(tex).digest('hex');

const key = (hash) => `compile:${hash}`;

const get = async (hash) => {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(key(hash));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      // Cache is an optimization — never fail a compile over it.
      console.error('Compile cache get error:', err.message);
      return null;
    }
  }
  const hit = memory.get(hash);
  if (!hit) return null;
  // LRU touch
  memory.delete(hash);
  memory.set(hash, hit);
  return hit;
};

const set = async (hash, payload) => {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(key(hash), JSON.stringify(payload), 'EX', TTL_SECONDS);
    } catch (err) {
      console.error('Compile cache set error:', err.message);
    }
    return;
  }
  memory.set(hash, payload);
  while (memory.size > MEMORY_MAX_ENTRIES) {
    memory.delete(memory.keys().next().value);
  }
};

module.exports = { hashTex, get, set };
