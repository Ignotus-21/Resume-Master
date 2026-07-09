const InterviewSession = require('../models/InterviewSession');
const MasterProfile = require('../models/MasterProfile');
const Job = require('../models/Job');
const { generateInterviewQuestions, evaluateInterviewAnswer } = require('../services/geminiService');
const { enforceGeminiQuota } = require('../utils/geminiGate');

const start = async (req, res) => {
  const { jobId, jdText } = req.body;

  if (jobId !== undefined && typeof jobId !== 'string') {
    return res.status(400).json({ message: 'Invalid jobId' });
  }

  try {
    let jobDescription = jdText;
    let role = 'the role';
    let jobRef;
    if (jobId) {
      const job = await Job.findOne({ _id: jobId, owner: req.identity });
      if (job) {
        jobDescription = job.jdText || `${job.role} at ${job.company}`;
        role = job.role || role;
        jobRef = job._id;
      }
    }

    if (!jobDescription) return res.status(400).json({ message: 'A job or job description is required' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const profile = await MasterProfile.findOne({ owner: req.identity });
    const questions = await generateInterviewQuestions(jobDescription, profile, req.geminiApiKey);

    const session = await InterviewSession.create({
      owner: req.identity,
      job: jobRef,
      role,
      questions,
      turns: [],
    });

    res.json(session);
  } catch (error) {
    console.error('Interview error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const answer = async (req, res) => {
  const { sessionId, question, answer: answerText } = req.body;

  if (typeof sessionId !== 'string' || !sessionId) {
    return res.status(400).json({ message: 'A valid sessionId is required' });
  }
  if (typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ message: 'A question is required' });
  }
  if (typeof answerText !== 'string' || !answerText.trim()) {
    return res.status(400).json({ message: 'An answer is required' });
  }

  try {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: req.identity }).populate('job');
    if (!session) return res.status(404).json({ message: 'Interview session not found' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const jobDescription = session.job?.jdText || session.role;
    const evaluation = await evaluateInterviewAnswer(question, answerText, jobDescription, req.geminiApiKey);

    session.turns.push({
      question,
      answer: answerText,
      feedback: evaluation.feedback,
      score: evaluation.score,
    });
    await session.save();

    res.json({ feedback: evaluation.feedback, score: evaluation.score, turns: session.turns });
  } catch (error) {
    console.error('Interview error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const list = async (req, res) => {
  try {
    const sessions = await InterviewSession.find({ owner: req.identity }).populate('job').sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    console.error('Interview error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    const session = await InterviewSession.findOne({ _id: req.params.id, owner: req.identity }).populate('job');
    if (!session) return res.status(404).json({ message: 'Interview session not found' });
    res.json(session);
  } catch (error) {
    console.error('Interview error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = { start, answer, list, getById };
