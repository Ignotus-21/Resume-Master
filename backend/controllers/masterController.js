const MasterProfile = require('../models/MasterProfile');
const { parseResumeData } = require('../services/geminiService');
const { enforceGeminiQuota } = require('../utils/geminiGate');
const { respondError } = require('../utils/aiError');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// Fields a client is allowed to set on their own profile. Notably excludes
// `owner` (and Mongo internals) so a caller can't reassign/orphan the record.
const ALLOWED_PROFILE_FIELDS = [
  'user', 'experience', 'education', 'projects', 'skills', 'certificates',
  'achievements', 'hobbies', 'publications', 'volunteering', 'patents',
  'customSections', 'rawText',
];

// Matches the JD/resume-text caps used elsewhere (resumeController.js,
// aiController.js) so extracted/pasted resume text can't blow past what
// those endpoints allow — without this, a highly-compressible DOCX (bounded
// only by multer's 5MB upload limit, not by its decompressed text size) or a
// large pasted-text body could balloon the Gemini prompt.
const MAX_TEXT_LENGTH = 20000;

const pickProfileFields = (body) => {
  const picked = {};
  for (const field of ALLOWED_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      picked[field] = body[field];
    }
  }
  return picked;
};

const getProfile = async (req, res) => {
  try {
    let profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) {
      profile = await MasterProfile.create({ owner: req.identity });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ message: 'Failed to load profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const updates = pickProfileFields(req.body);

    // Robust update: Find this identity's profile and update it atomically
    let profile = await MasterProfile.findOne({ owner: req.identity });

    if (profile) {
      // Use findByIdAndUpdate to ensure clean replacement of arrays/nested fields
      profile = await MasterProfile.findByIdAndUpdate(
        profile._id,
        { $set: updates },
        { new: true, runValidators: true }
      );
    } else {
      profile = await MasterProfile.create({ ...updates, owner: req.identity });
    }

    res.json(profile);
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

const ingestRawText = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'No text provided' });
  if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ message: `text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` });
  }

  try {
    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const parsedData = await parseResumeData(text, req.geminiApiKey, req);

    // Merge parsed data into existing profile
    let profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) {
      profile = new MasterProfile({ ...parsedData, owner: req.identity });
    } else {
      // Logic to append or replace. For simplicity, we'll replace/update provided fields
      // Ideally, we should merge arrays (like adding new projects), but for now let's simple merge
      // or we can push to arrays. Let's do a smart merge for top level fields.

      // Simple merge for User Details (profile.user may be undefined on a
      // profile that was created with only { owner }).
      if (parsedData.user) {
        profile.user = Object.assign(profile.user || {}, parsedData.user);
      }

      // For arrays, we probably want to append unique items, but let's just add them for now
      // The user can edit them in UI.
      if (parsedData.experience) profile.experience.push(...parsedData.experience);
      if (parsedData.education) profile.education.push(...parsedData.education);
      if (parsedData.projects) profile.projects.push(...parsedData.projects);
      if (parsedData.skills) profile.skills = parsedData.skills; // Replace skills usually
      // ... handle others
    }

    await profile.save();
    res.json(profile);
  } catch (error) {
    console.error('Ingest Text Error:', error);
    respondError(res, error, 'Failed to parse text');
  }
};

const DOCX_MIMETYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const uploadResume = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const dataBuffer = fs.readFileSync(req.file.path);

    // Verify the file really is what it claims (magic bytes), not just the
    // Content-Type/extension, before spending an AI call on it. A .docx is a
    // ZIP container, so it starts with PK\x03\x04.
    const isDocx = req.file.mimetype === DOCX_MIMETYPE;
    const magicOk = isDocx
      ? dataBuffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
      : dataBuffer.slice(0, 5).toString('ascii') === '%PDF-';
    if (!magicOk) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: `Uploaded file is not a valid ${isDocx ? 'DOCX' : 'PDF'}` });
    }

    // Extract plain text locally instead of sending the raw file to Gemini.
    // Runs BEFORE the quota gate so an unreadable file never reserves quota.
    let text;
    if (isDocx) {
      const mammoth = require('mammoth');
      text = (await mammoth.extractRawText({ buffer: dataBuffer })).value;
    } else {
      text = (await pdfParse(dataBuffer)).text;
    }
    if (!text || !text.trim()) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: 'No readable text found in that file. If it is a scanned image, try a text-based export instead.',
      });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: `Extracted text exceeds the maximum length of ${MAX_TEXT_LENGTH} characters. Trim the document and try again.`,
      });
    }

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) {
      fs.unlinkSync(req.file.path);
      return res.status(quotaRejection.status).json(quotaRejection.body);
    }

    const parsedData = await parseResumeData(text, req.geminiApiKey, req);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Return parsed data to frontend for review instead of auto-saving
    res.json(parsedData);

  } catch (error) {
    console.error('Resume Parse Error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    respondError(res, error, 'Failed to process resume');
  }
};

module.exports = { getProfile, updateProfile, ingestRawText, uploadResume };
