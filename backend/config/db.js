const mongoose = require('mongoose');

// Fall back to safe defaults if the env vars are unset or non-numeric (Number()
// of a bad value is NaN, which would otherwise break the retry loop entirely).
const MAX_RETRIES = Number(process.env.MONGO_CONNECT_RETRIES) || 5;
const RETRY_DELAY_MS = Number(process.env.MONGO_CONNECT_RETRY_MS) || 3000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mongoose does not retry the *initial* connect (its auto-reconnect only kicks in
// after a connection was once established). A Mongo instance that isn't up yet
// (common in container startup ordering) would otherwise leave the API
// permanently disconnected. We retry a bounded number of times up front, then —
// if still unreachable — keep retrying in the background so the process can come
// up and recover on its own without crashing.
const attemptConnect = async (uri) => {
  const conn = await mongoose.connect(uri);
  console.log(`MongoDB Connected: ${conn.connection.host}`);
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/master_resume';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await attemptConnect(uri);
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  // Retries exhausted: keep trying in the background rather than crashing, so a
  // transient outage doesn't take the whole API down and it recovers when Mongo
  // returns. (There is no established connection yet, so Mongoose won't do this
  // for us.)
  console.error(`MongoDB unreachable after ${MAX_RETRIES} attempts; retrying in the background every ${RETRY_DELAY_MS}ms.`);
  const backgroundRetry = async () => {
    try {
      await attemptConnect(uri);
    } catch {
      setTimeout(backgroundRetry, RETRY_DELAY_MS);
    }
  };
  setTimeout(backgroundRetry, RETRY_DELAY_MS);
};

module.exports = connectDB;
