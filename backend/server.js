const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

console.log('Starting Backend Server...');

connectDB().then(() => {
  console.log('Database connection initiated...');
}).catch(err => {
  console.error('Database connection failed immediately:', err);
});

const app = express();
console.log('Express app initialized');

app.use(cors());
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Routes
console.log('Loading routes...');
try {
  app.use('/api/master', require('./routes/masterRoutes'));
  console.log('Master routes loaded');
  app.use('/api/jobs', require('./routes/jobRoutes'));
  console.log('Job routes loaded');
  app.use('/api/resumes', require('./routes/resumeRoutes'));
  console.log('Resume routes loaded');
  app.use('/api/ai', require('./routes/aiRoutes'));
  console.log('AI routes loaded');
} catch (error) {
  console.error('Failed to load routes:', error);
}

const PORT = process.env.PORT || 5000;

console.log(`Attempting to listen on port ${PORT}...`);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
console.log('Listen called');
