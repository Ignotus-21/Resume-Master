const Resume = require('../models/Resume');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const { tailorResume, tailorResumeWithJobMeta, getRecommendations } = require('../services/geminiService');
const { compileLatex } = require('../services/latexService');
const { render } = require('../services/latex/render');
const compileCache = require('../services/compileCache');
const { enforceGeminiQuota } = require('../utils/geminiGate');
const { validateDesign, TEMPLATE_IDS, DEFAULT_DESIGN, SECTION_KEYS } = require('../shared/resume');
const { respondError } = require('../utils/aiError');

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

const MAX_JD_TEXT_LENGTH = 20000;

// MasterProfile document -> ResumeContent: user + every IR section, with
// Mongo bookkeeping (_id/__v/timestamps) stripped so the stored content is a
// plain IR object, not a snapshot of subdocument internals.
const stripMongoKeys = (value) => {
  if (Array.isArray(value)) return value.map(stripMongoKeys);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id' || k === '__v' || k === 'createdAt' || k === 'updatedAt') continue;
      out[k] = stripMongoKeys(v);
    }
    return out;
  }
  return value;
};

const profileToContent = (profileDoc) => {
  const profile = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
  const content = { user: profile.user || {} };
  for (const key of SECTION_KEYS) {
    if (profile[key] !== undefined) content[key] = profile[key];
  }
  return stripMongoKeys(content);
};

const profileHasContent = (profileDoc) => {
  const profile = profileDoc.toObject ? profileDoc.toObject() : profileDoc;
  if (profile.user?.name?.trim()) return true;
  return SECTION_KEYS.some((key) => {
    const v = profile[key];
    if (key === 'skills') return v && Object.values(v).some((list) => Array.isArray(list) && list.length > 0);
    return Array.isArray(v) && v.length > 0;
  });
};

// One endpoint, three entry paths:
//  - jobId          -> tailor against that saved job (the original flow)
//  - jdText only    -> tailor against the pasted JD; the Job record is created
//                      here, behind the scenes, from the tailor call's job meta
//  - neither        -> instant untailored "base" resume straight from the
//                      MasterProfile: no Gemini call, no quota. This is what
//                      the import-onboarding flow lands on.
const createResumeForJob = async (req, res) => {
  const { jobId, jdText, templateId, design, parentResumeId } = req.body;

  if (typeof jdText === 'string' && jdText.length > MAX_JD_TEXT_LENGTH) {
    return res.status(400).json({ message: 'Job description is too long' });
  }

  try {
    // 1. Get Master Profile
    const profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile || !profileHasContent(profile)) {
      return res.status(404).json({
        message: 'Your Master Profile is empty. Import an existing resume or fill in your profile first.',
      });
    }

    const userName = profile.user?.name?.split(' ')[0] || 'Resume';
    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const buildVersionName = (companyName, jobTitle) =>
      `${userName}_${companyName}_${jobTitle}_${uniqueCode}`.replace(/[^a-zA-Z0-9_]/g, '_');

    let content;
    let job = null;
    let versionName;

    if (jobId) {
      const savedJob = await Job.findOne({ _id: jobId, owner: req.identity });
      const jobDescription = savedJob
        ? savedJob.jdText || savedJob.role + ' at ' + savedJob.company
        : jdText;
      if (!jobDescription) return res.status(400).json({ message: 'Job Description is required' });

      const quotaRejection = await enforceGeminiQuota(req);
      if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

      // Tailor content — Gemini's ONLY job here is JSON -> JSON. LaTeX is
      // rendered deterministically from the result and never LLM-authored.
      content = await tailorResume(profile, jobDescription, req.geminiApiKey, req);
      job = savedJob;
      versionName = buildVersionName(savedJob?.company || 'Company', savedJob?.role || 'Role');
    } else if (typeof jdText === 'string' && jdText.trim()) {
      const quotaRejection = await enforceGeminiQuota(req);
      if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

      const data = await tailorResumeWithJobMeta(profile, jdText, req.geminiApiKey, req);
      content = data.resume;

      // The Job record exists so downstream features (JD match, cover
      // letters, the tracker) work — the user never had to fill a job form.
      job = await Job.create({
        owner: req.identity,
        role: data.job.role || 'Role',
        company: data.job.company || 'Unknown Company',
        jdText,
        status: 'Wishlist',
      });
      versionName = buildVersionName(data.job.company || 'Unknown', data.job.role || 'Role');
    } else {
      // Base resume: the profile as-is, rendered deterministically. Instant.
      content = profileToContent(profile);
      versionName = buildVersionName('Base', 'Resume');
    }

    const resume = new Resume({
      owner: req.identity,
      job: job?._id,
      content,
      design: validateDesign(design || DEFAULT_DESIGN),
      templateId: safeTemplateId(templateId),
      mode: 'structured',
      versionName,
      parentResumeId: parentResumeId || undefined,
    });

    await resume.save();
    // The workspace reads doc.job.jdText (Match panel, bullet AI) — return it
    // populated so a freshly generated resume behaves like a reloaded one.
    if (job) resume.job = job;

    res.json(withLatex(resume));

  } catch (error) {
    console.error('Resume error:', error);
    respondError(res, error);
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
    const { versionName, content, design, templateId, mode, latexSource, baseUpdatedAt } = req.body;

    const resume = await Resume.findOne({ _id: req.params.id, owner: req.identity });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

    // Concurrent-edit detection (same resume open in two tabs/sessions).
    // baseUpdatedAt is the updatedAt the client loaded; if the stored doc has
    // moved past it, someone else wrote in between. Last-write-wins is the
    // accepted v1 behavior — this save still applies — but the response
    // carries conflict:true so the client can warn instead of clobbering
    // silently. Clients that don't send baseUpdatedAt are unaffected.
    let conflict = false;
    if (typeof baseUpdatedAt === 'string' && baseUpdatedAt) {
      const base = Date.parse(baseUpdatedAt);
      conflict =
        Number.isFinite(base) &&
        resume.updatedAt instanceof Date &&
        resume.updatedAt.getTime() > base;
    }

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
    const payload = withLatex(resume);
    if (conflict) payload.conflict = true;
    res.json(payload);
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
    respondError(res, error);
  }
};

// Runs after middleware/compile.js prepareCompile (which resolved
// req.compileTex, enforced auth for raw LaTeX, and answered cache hits) and
// compileLimiter.
const compileResume = async (req, res) => {
  try {
    const started = Date.now();
    const result = await compileLatex(req.compileTex);
    console.log(`[compile] cache miss hash=${req.compileHash.slice(0, 12)} success=${result.success} durationMs=${Date.now() - started}`);
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
