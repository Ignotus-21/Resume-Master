const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  company: { type: String, required: true },
  role: { type: String, required: true },
  jdText: { type: String }, // The full job description
  jobUrl: { type: String },
  status: { 
    type: String, 
    enum: ['Applied', 'Interviewing', 'Rejected', 'Offer', 'Wishlist'],
    default: 'Wishlist' 
  },
  dateApplied: { type: Date },
  keywords: [String], // Extracted from JD
}, {
  timestamps: true,
});

const Job = mongoose.model('Job', jobSchema);
module.exports = Job;
