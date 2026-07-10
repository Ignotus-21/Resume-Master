const CoverLetter = require('../models/CoverLetter');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const { generateCoverLetter } = require('../services/geminiService');
const { enforceGeminiQuota } = require('../utils/geminiGate');

const ALLOWED_UPDATE_FIELDS = ['versionName', 'body', 'tone'];
const pickAllowed = (body) => {
  const picked = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) picked[field] = body[field];
  }
  return picked;
};

const generate = async (req, res) => {
  const { jobId, jdText, tone, length } = req.body;

  if (jobId !== undefined && typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Invalid jobId' });
  }

  try {
    const profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    let jobDescription = jdText;
    let companyName = 'Company';
    let jobTitle = 'Role';
    if (jobId) {
      const job = await Job.findOne({ _id: jobId, owner: req.identity });
      if (job) {
        jobDescription = job.jdText || `${job.role} at ${job.company}`;
        companyName = job.company || companyName;
        jobTitle = job.role || jobTitle;
      }
    }

    if (!jobDescription) return res.status(400).json({ message: 'Job description is required' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const body = await generateCoverLetter(profile, jobDescription, { tone, length }, req.geminiApiKey, req);

    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const versionName = `${companyName}_${jobTitle}_${uniqueCode}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const coverLetter = await CoverLetter.create({
      owner: req.identity,
      job: jobId || undefined,
      versionName,
      body,
      tone: tone || 'Professional',
    });

    res.json(coverLetter);
  } catch (error) {
    console.error('Cover Letter error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const list = async (req, res) => {
  try {
    const items = await CoverLetter.find({ owner: req.identity }).populate('job').sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Cover Letter error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    const item = await CoverLetter.findOne({ _id: req.params.id, owner: req.identity }).populate('job');
    if (!item) return res.status(404).json({ message: 'Cover letter not found' });
    res.json(item);
  } catch (error) {
    console.error('Cover Letter error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    const item = await CoverLetter.findOneAndUpdate(
      { _id: req.params.id, owner: req.identity },
      pickAllowed(req.body),
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Cover letter not found' });
    res.json(item);
  } catch (error) {
    console.error('Cover Letter error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const remove = async (req, res) => {
  try {
    const deleted = await CoverLetter.findOneAndDelete({ _id: req.params.id, owner: req.identity });
    if (!deleted) return res.status(404).json({ message: 'Cover letter not found' });
    res.json({ message: 'Cover letter deleted' });
  } catch (error) {
    console.error('Cover Letter error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { generate, list, getById, update, remove };
