const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/master_resume');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log and let the HTTP server keep running rather than killing the whole
    // process — a transient Mongo outage shouldn't take down the API, and
    // Mongoose will keep retrying the connection in the background.
    console.error(`MongoDB connection error: ${error.message}`);
  }
};

module.exports = connectDB;
