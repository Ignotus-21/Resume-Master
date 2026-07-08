const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
  owner: { type: String, required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  role: { type: String },
  questions: [{ type: String }],
  turns: [{
    question: { type: String },
    answer: { type: String },
    feedback: { type: String },
    score: { type: Number },
  }],
}, {
  timestamps: true,
});

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
module.exports = InterviewSession;
