console.log('Loading masterController...');
const MasterProfile = require('../models/MasterProfile');
const { parseResumeData } = require('../services/geminiService');
const fs = require('fs');
console.log('masterController dependencies loaded');

const getProfile = async (req, res) => {
  try {
    // Single user mode: get the first document
    let profile = await MasterProfile.findOne();
    if (!profile) {
      profile = await MasterProfile.create({});
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    // Robust update: Find the single profile and update it atomically
    let profile = await MasterProfile.findOne();
    
    if (profile) {
      // Use findByIdAndUpdate to ensure clean replacement of arrays/nested fields
      profile = await MasterProfile.findByIdAndUpdate(
        profile._id, 
        { $set: req.body }, 
        { new: true, runValidators: true }
      );
    } else {
      profile = await MasterProfile.create(req.body);
    }
    
    res.json(profile);
  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ message: error.message });
  }
};

const ingestRawText = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: 'No text provided' });

  try {
    const parsedData = await parseResumeData(text);
    
    // Merge parsed data into existing profile
    let profile = await MasterProfile.findOne();
    if (!profile) {
      profile = new MasterProfile(parsedData);
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
    res.status(500).json({ message: error.message });
  }
};

const uploadResume = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    
    // Send Buffer directly to Gemini (Multimodal)
    const parsedData = await parseResumeData(dataBuffer);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    // Return parsed data to frontend for review instead of auto-saving
    res.json(parsedData);
    
  } catch (error) {
    console.error('Resume Parse Error:', error);
    res.status(500).json({ message: 'Failed to process resume' });
  }
};

module.exports = { getProfile, updateProfile, ingestRawText, uploadResume };
