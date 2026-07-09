const mongoose = require('mongoose');

const coverLetterSchema = new mongoose.Schema({
  owner: { type: String, required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // Optional link to a job
  versionName: { type: String },
  body: { type: String, required: true },
  tone: { type: String },
}, {
  timestamps: true,
});

const CoverLetter = mongoose.model('CoverLetter', coverLetterSchema);
module.exports = CoverLetter;
