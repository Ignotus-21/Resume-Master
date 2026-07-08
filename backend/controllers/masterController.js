console.log('Loading masterController...');
const MasterProfile = require('../models/MasterProfile');
const { parseResumeData } = require('../services/geminiService');
const { enforceGeminiQuota } = require('../utils/geminiGate');
const fs = require('fs');
console.log('masterController dependencies loaded');

// Fields a client is allowed to set on their own profile. Notably excludes
// `owner` (and Mongo internals) so a caller can't reassign/orphan the record.
const ALLOWED_PROFILE_FIELDS = [
  'user', 'experience', 'education', 'projects', 'skills', 'certificates',
  'achievements', 'hobbies', 'publications', 'volunteering', 'patents',
  'customSections', 'rawText',
];

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

  try {
    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const parsedData = await parseResumeData(text, req.geminiApiKey);

    // Merge parsed data into existing profile
    let profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) {
      profile = new MasterProfile({ ...parsedData, owner: req.identity });
    } else {
      // Logic to append or replace. For simplicity, we'll replace/update provided fields
      // Ideally, we should merge arrays (like adding new projects), but for now let's simple merge
      // or we can push to arrays. Let's do a smart merge for top level fields.

      // Simple merge for User Details
      if (parsedData.user) Object.assign(profile.user, parsedData.user);

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
    res.status(500).json({ message: 'Failed to parse text' });
  }
};

const uploadResume = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    const dataBuffer = fs.readFileSync(req.file.path);

    // Verify the file is actually a PDF (magic bytes), not just claimed via
    // Content-Type/extension, before forwarding it to Gemini.
    const isPdf = dataBuffer.slice(0, 5).toString('ascii') === '%PDF-';
    if (!isPdf) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Uploaded file is not a valid PDF' });
    }

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) {
      fs.unlinkSync(req.file.path);
      return res.status(quotaRejection.status).json(quotaRejection.body);
    }

    // Send Buffer directly to Gemini (Multimodal)
    const parsedData = await parseResumeData(dataBuffer, req.geminiApiKey);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Return parsed data to frontend for review instead of auto-saving
    res.json(parsedData);

  } catch (error) {
    console.error('Resume Parse Error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Failed to process resume' });
  }
};

module.exports = { getProfile, updateProfile, ingestRawText, uploadResume };
