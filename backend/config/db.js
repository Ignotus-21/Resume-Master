const mongoose = require('mongoose');

const MAX_RETRIES = Number(process.env.MONGO_CONNECT_RETRIES ?? 5);
const RETRY_DELAY_MS = Number(process.env.MONGO_CONNECT_RETRY_MS ?? 3000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mongoose does not retry the *initial* connect, so a Mongo instance that isn't
// up yet (common in container startup ordering) would otherwise leave the API
// permanently disconnected. Retry a few times with a fixed delay; if it still
// fails, keep the HTTP server up (Mongoose auto-reconnects once Mongo returns)
// rather than crashing the process.
const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/master_resume';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  console.error('MongoDB unreachable after retries; API will serve errors until it recovers.');
};

module.exports = connectDB;
