const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // Optional link to a job
  latexCode: { type: String, required: true },
  pdfUrl: { type: String }, // If we upload it somewhere or store path
  versionName: { type: String }, // e.g., "Software Engineer V1"
  atsScore: { type: Number },
  tailoredData: { type: Object }, // The JSON used to generate this resume
}, {
  timestamps: true,
});

const Resume = mongoose.model('Resume', resumeSchema);
module.exports = Resume;
