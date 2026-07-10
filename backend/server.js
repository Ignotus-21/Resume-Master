// Load .env before anything else: some modules (middleware/identify.js,
// controllers/authController.js) read env vars at require time, so requiring
// them first would bake in pre-.env values.
require('dotenv').config();

const connectDB = require('./config/db');
const createApp = require('./app');

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
