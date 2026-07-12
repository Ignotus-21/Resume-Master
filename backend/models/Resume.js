const mongoose = require('mongoose');

// v2: a resume is { content, design, templateId, mode }. LaTeX is derived
// from those by backend/services/latex/render.js and is only STORED when the
// user ejects to hand-edited LaTeX (mode: 'latex' -> latexSource is frozen).
const resumeSchema = new mongoose.Schema({
  owner: { type: String, required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // Optional link to a job
  versionName: { type: String }, // e.g., "Software Engineer V1"
  atsScore: { type: Number },

  content: { type: Object },   // ResumeContent (MasterProfile-shaped, tailored)
  design: { type: Object },    // DesignTokens (validated on every write)
  templateId: { type: String, default: 'sheets' },
  mode: { type: String, enum: ['structured', 'latex'], default: 'structured' },
  latexSource: { type: String }, // only meaningful when mode === 'latex'
  parentResumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' }, // version lineage

  // Deprecated pre-v2 fields, kept for old rows until scripts/migrateResumesV2.js
  // has run everywhere. Do not write to these.
  latexCode: { type: String },
  pdfUrl: { type: String },
  tailoredData: { type: Object },
}, {
  timestamps: true,
});

const Resume = mongoose.model('Resume', resumeSchema);
module.exports = Resume;
