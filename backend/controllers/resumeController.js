const Resume = require('../models/Resume');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const { tailorResume, generateLatex, getRecommendations } = require('../services/geminiService');
const { compileLatex } = require('../services/latexService');

const createResumeForJob = async (req, res) => {
  const { jobId, jdText } = req.body;
  
  try {
    // 1. Get Master Profile
    const profile = await MasterProfile.findOne();
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    // 2. Get Job Description
    let jobDescription = jdText;
    let jobTitle = 'Role';
    let companyName = 'Company';

    if (jobId) {
      const job = await Job.findById(jobId);
      if (job) {
        jobDescription = job.jdText || job.role + " at " + job.company;
        jobTitle = job.role || 'Role';
        companyName = job.company || 'Company';
      }
    }

    if (!jobDescription) return res.status(400).json({ message: 'Job Description is required' });

    // 3. Tailor Resume
    const tailoredData = await tailorResume(profile, jobDescription);

    // 4. Generate LaTeX
    const latexCode = await generateLatex(tailoredData);

    // 5. Save
    const userName = profile.user?.name?.split(' ')[0] || 'Resume';
    const uniqueCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const versionName = `${userName}_${companyName}_${jobTitle}_${uniqueCode}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const resume = new Resume({
      job: jobId,
      latexCode,
      tailoredData,
      versionName,
    });
    
    await resume.save();
    
    res.json(resume);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const getResumes = async (req, res) => {
  try {
    const { jobId } = req.query;
    const query = jobId ? { job: jobId } : {};
    const resumes = await Resume.find(query).populate('job').sort({ createdAt: -1 });
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getResumeById = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).populate('job');
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    res.json(resume);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateResume = async (req, res) => {
  try {
    const { latexCode, versionName } = req.body;
    const updateData = {};
    if (latexCode) updateData.latexCode = latexCode;
    if (versionName) updateData.versionName = versionName;

    const resume = await Resume.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    res.json(resume);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteResume = async (req, res) => {
  try {
    await Resume.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resume deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getResumeFeedback = async (req, res) => {
  const { jobId, jdText } = req.body;
  try {
    const profile = await MasterProfile.findOne();
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    let jobDescription = jdText;
    if (jobId) {
      const job = await Job.findById(jobId);
      if (job) jobDescription = job.jdText || job.role + " at " + job.company;
    }

    if (!jobDescription) return res.status(400).json({ message: 'Job Description is required' });

    const recommendations = await getRecommendations(profile, jobDescription);
    res.json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const compileResume = async (req, res) => {
  const { latexCode } = req.body;
  if (!latexCode || typeof latexCode !== 'string') {
    return res.status(400).json({ message: 'LaTeX code is required' });
  }

  try {
    const result = await compileLatex(latexCode);
    if (result.success) {
      // Send PDF as base64 string
      res.json({ success: true, pdf: result.pdf.toString('base64') });
    } else {
      res.json({ success: false, log: result.log, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createResumeForJob, getResumes, getResumeById, updateResume, deleteResume, getResumeFeedback, compileResume };
