const dotenv = require('dotenv');
const connectDB = require('./config/db');
const createApp = require('./app');

dotenv.config();

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
