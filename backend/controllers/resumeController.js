const Resume = require('../models/Resume');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const { tailorResume, getRecommendations } = require('../services/geminiService');
const { compileLatex } = require('../services/latexService');
const { render } = require('../services/latex/render');
const compileCache = require('../services/compileCache');
const { enforceGeminiQuota } = require('../utils/geminiGate');
const { validateDesign, TEMPLATE_IDS, DEFAULT_DESIGN } = require('../shared/resume');

// LaTeX is never a stored truth for structured resumes — it's derived here
// on the way out. Ejected docs (mode 'latex') and unmigrated legacy rows
// return their frozen source instead.
const withLatex = (resumeDoc) => {
  const obj = resumeDoc.toObject ? resumeDoc.toObject() : { ...resumeDoc };
  if (obj.mode === 'latex' && obj.latexSource) {
    obj.latex = obj.latexSource;
  } else if (obj.content) {
    obj.latex = render(obj.content, validateDesign(obj.design), obj.templateId);
  } else if (obj.latexCode) {
    // Pre-v2 row that scripts/migrateResumesV2.js hasn't touched yet.
    obj.latex = obj.latexCode;
    obj.mode = 'latex';
    obj.latexSource = obj.latexCode;
  }
  return obj;
};

const safeTemplateId = (templateId) =>
  TEMPLATE_IDS.includes(templateId) ? templateId : 'sheets';

const createResumeForJob = async (req, res) => {
  const { jobId, jdText, templateId, design, parentResumeId } = req.body;

  try {
    // 1. Get Master Profile
    const profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    // 2. Get Job Description
    let jobDescription = jdText;
    let jobTitle = 'Role';
    let companyName = 'Company';

    if (jobId) {
      const job = await Job.findOne({ _id: jobId, owner: req.identity });
      if (job) {
        jobDescription = job.jdText || job.role + " at " + job.company;
        jobTitle = job.role || 'Role';
        companyName = job.company || 'Company';
      }
    }

    if (!jobDescription) return res.status(400).json({ message: 'Job Description is required' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    // 3. Tailor content — Gemini's ONLY job here is JSON -> JSON. LaTeX is
    // rendered deterministically from the result and never LLM-authored.
    const content = await tailorResume(profile, jobDescription, req.geminiApiKey, req);

    // 4. Save
    const userName = profile.user?.name?.split(' ')[0] || 'Resume';
    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const versionName = `${userName}_${companyName}_${jobTitle}_${uniqueCode}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const resume = new Resume({
      owner: req.identity,
      job: jobId,
      content,
      design: validateDesign(design || DEFAULT_DESIGN),
      templateId: safeTemplateId(templateId),
      mode: 'structured',
      versionName,
      parentResumeId: parentResumeId || undefined,
    });

    await resume.save();

    res.json(withLatex(resume));

  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getResumes = async (req, res) => {
  try {
    const { jobId } = req.query;
    const query = jobId ? { job: jobId, owner: req.identity } : { owner: req.identity };
    const resumes = await Resume.find(query).populate('job').sort({ createdAt: -1 });
    res.json(resumes);
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, owner: req.identity }).populate('job');
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    res.json(withLatex(resume));
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const updateResume = async (req, res) => {
  try {
    const { versionName, content, design, templateId, mode, latexSource } = req.body;

    const resume = await Resume.findOne({ _id: req.params.id, owner: req.identity });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

    if (typeof versionName === 'string' && versionName.trim()) resume.versionName = versionName;
    if (content && typeof content === 'object') resume.content = content;
    if (design && typeof design === 'object') resume.design = validateDesign(design);
    if (templateId) resume.templateId = safeTemplateId(templateId);

    if (mode === 'latex' && resume.mode !== 'latex') {
      // EJECT: freeze the current render (or the client-provided source) as
      // the document's truth. One-way door — visual editing and AI
      // re-tailoring are disabled until revert.
      resume.mode = 'latex';
      resume.latexSource =
        typeof latexSource === 'string' && latexSource.trim()
          ? latexSource
          : render(resume.content || {}, validateDesign(resume.design), resume.templateId);
    } else if (mode === 'structured' && resume.mode === 'latex') {
      // REVERT: back to content/design as truth; hand edits are discarded
      // (the client shows the explicit warning).
      resume.mode = 'structured';
      resume.latexSource = undefined;
    } else if (typeof latexSource === 'string' && resume.mode === 'latex') {
      // Saving hand edits on an already-ejected doc.
      resume.latexSource = latexSource;
    }

    await resume.save();
    await resume.populate('job');
    res.json(withLatex(resume));
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const duplicateResume = async (req, res) => {
  try {
    const source = await Resume.findOne({ _id: req.params.id, owner: req.identity });
    if (!source) return res.status(404).json({ message: 'Resume not found' });

    const copy = new Resume({
      owner: source.owner,
      job: source.job,
      content: source.content,
      design: source.design,
      templateId: source.templateId,
      mode: source.mode,
      latexSource: source.latexSource,
      parentResumeId: source._id,
      versionName: `${source.versionName || 'Resume'}_copy`,
    });
    await copy.save();
    res.json(withLatex(copy));
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const deleteResume = async (req, res) => {
  try {
    const deleted = await Resume.findOneAndDelete({ _id: req.params.id, owner: req.identity });
    if (!deleted) return res.status(404).json({ message: 'Resume not found' });
    res.json({ message: 'Resume deleted' });
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getResumeFeedback = async (req, res) => {
  const { jobId, jdText } = req.body;
  try {
    const profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    let jobDescription = jdText;
    if (jobId) {
      const job = await Job.findOne({ _id: jobId, owner: req.identity });
      if (job) jobDescription = job.jdText || job.role + " at " + job.company;
    }

    if (!jobDescription) return res.status(400).json({ message: 'Job Description is required' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const recommendations = await getRecommendations(profile, jobDescription, req.geminiApiKey, req);
    res.json(recommendations);
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// Runs after middleware/compile.js prepareCompile (which resolved
// req.compileTex, enforced auth for raw LaTeX, and answered cache hits) and
// compileLimiter.
const compileResume = async (req, res) => {
  try {
    const result = await compileLatex(req.compileTex);
    if (result.success) {
      const payload = { pdf: result.pdf.toString('base64'), pages: result.pages };
      await compileCache.set(req.compileHash, payload);
      res.json({
        success: true,
        ...payload,
        ...(req.compileRendered ? { tex: req.compileTex } : {}),
      });
    } else {
      res.json({ success: false, errors: result.errors || [], log: result.log, error: result.error });
    }
  } catch (error) {
    console.error('Resume error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { createResumeForJob, getResumes, getResumeById, updateResume, duplicateResume, deleteResume, getResumeFeedback, compileResume };
