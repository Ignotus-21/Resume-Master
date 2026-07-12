const ChatSession = require('../models/ChatSession');
const MasterProfile = require('../models/MasterProfile');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { enforceGeminiQuota } = require('../utils/geminiGate');
const { generateLinkedInContent } = require('../services/geminiService');
const { trackUsage } = require('../utils/trackUsage');
const { refundReservation } = require('../services/quotaService');
const { respondError } = require('../utils/aiError');

const CHAT_MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash";

let defaultClient = null;
const getChatModel = (apiKey) => {
  if (apiKey) {
    return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: CHAT_MODEL_NAME });
  }
  if (!defaultClient) {
    defaultClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return defaultClient.getGenerativeModel({ model: CHAT_MODEL_NAME });
};

const MAX_MESSAGE_LENGTH = 8000;
const VALID_CONTEXT_TYPES = ['General', 'Job', 'Resume'];

const startChat = async (req, res) => {
  const { contextType, contextId } = req.body;
  if (typeof contextId === 'string' && contextId.length > 200) {
    return res.status(400).json({ message: 'contextId is too long' });
  }
  // Normalize/validate contextType against the schema enum so a stray value
  // (e.g. an old client sending "job") returns a clean 400 rather than a 500.
  if (contextType !== undefined && !VALID_CONTEXT_TYPES.includes(contextType)) {
    return res.status(400).json({ message: 'Invalid contextType' });
  }
  try {
    const session = await ChatSession.create({
      owner: req.identity,
      contextType: contextType || 'General',
      contextId,
      history: []
    });
    res.json(session);
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const sendMessage = async (req, res) => {
  const { sessionId, message } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'message is required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ message: `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
  }

  let reserved = false;
  let tracked = false;
  try {
    const session = await ChatSession.findOne({ _id: sessionId, owner: req.identity });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);
    reserved = true;

    // Add user message
    session.history.push({ role: 'user', parts: [{ text: message }] });

    // Prepare history for Gemini
    // Gemini expects history in format: { role: 'user'|'model', parts: [{ text: '...' }] }
    // We can filter our history to match this
    const historyForGemini = session.history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts[0].text }]
    }));

    const model = getChatModel(req.geminiApiKey);
    const chat = model.startChat({
      history: historyForGemini.slice(0, -1), // Exclude the last message we just added to send it via sendMessage
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    await trackUsage(req, 'chatbot', result);
    tracked = true;

    const response = await result.response;
    const text = response.text();

    // Add model response
    session.history.push({ role: 'model', parts: [{ text: text }] });
    await session.save();

    res.json({ text, history: session.history });

  } catch (error) {
    console.error('AI error:', error);
    // Only refund if quota was actually reserved for this request — a
    // failure before enforceGeminiQuota ran (e.g. the session lookup) never
    // charged anything, so refunding here would double-credit the user.
    if (reserved && !tracked) await refundReservation(req).catch(() => {});
    res.status(500).json({ message: 'Something went wrong' });
  }
};

const getHistory = async (req, res) => {
  try {
    const session = await ChatSession.findOne({ _id: req.params.sessionId, owner: req.identity });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// --- v2 content operations: JSON in, JSON out. Never LaTeX. -----------------

const MAX_BULLET_LENGTH = 1000;
const MAX_JD_LENGTH = 20000;

const rewriteBulletHandler = async (req, res) => {
  const { bullet, roleContext, jd } = req.body;
  if (typeof bullet !== 'string' || !bullet.trim()) {
    return res.status(400).json({ message: 'bullet is required' });
  }
  if (bullet.length > MAX_BULLET_LENGTH) {
    return res.status(400).json({ message: 'bullet is too long' });
  }
  if (typeof jd === 'string' && jd.length > MAX_JD_LENGTH) {
    return res.status(400).json({ message: 'jd is too long' });
  }
  try {
    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const { rewriteBullet } = require('../services/geminiService');
    const rewrites = await rewriteBullet(bullet, roleContext, jd, req.geminiApiKey, req);
    res.json({ rewrites });
  } catch (error) {
    console.error('AI error:', error);
    respondError(res, error);
  }
};

const suggestTitlesHandler = async (req, res) => {
  const { role, jd } = req.body;
  if (typeof role !== 'string' || !role.trim()) {
    return res.status(400).json({ message: 'role is required' });
  }
  if (typeof jd !== 'string' || !jd.trim()) {
    return res.status(400).json({ message: 'jd is required' });
  }
  if (jd.length > MAX_JD_LENGTH) {
    return res.status(400).json({ message: 'jd is too long' });
  }
  try {
    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const { suggestTitles } = require('../services/geminiService');
    const titles = await suggestTitles(role, jd, req.geminiApiKey, req);
    res.json({ titles });
  } catch (error) {
    console.error('AI error:', error);
    respondError(res, error);
  }
};

const bulletCoachHandler = async (req, res) => {
  const { bullet, roleContext, answer } = req.body;
  if (typeof bullet !== 'string' || !bullet.trim()) {
    return res.status(400).json({ message: 'bullet is required' });
  }
  if (bullet.length > MAX_BULLET_LENGTH || (typeof answer === 'string' && answer.length > MAX_BULLET_LENGTH * 2)) {
    return res.status(400).json({ message: 'input is too long' });
  }
  try {
    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const { bulletCoach } = require('../services/geminiService');
    const result = await bulletCoach({ bullet, roleContext, answer }, req.geminiApiKey, req);
    res.json(result);
  } catch (error) {
    console.error('AI error:', error);
    respondError(res, error);
  }
};

const linkedinRewrite = async (req, res) => {
  try {
    const profile = await MasterProfile.findOne({ owner: req.identity });
    if (!profile) return res.status(404).json({ message: 'Master Profile not found' });

    const quotaRejection = await enforceGeminiQuota(req);
    if (quotaRejection) return res.status(quotaRejection.status).json(quotaRejection.body);

    const content = await generateLinkedInContent(profile, req.geminiApiKey, req);
    res.json(content);
  } catch (error) {
    console.error('AI error:', error);
    respondError(res, error);
  }
};

module.exports = { startChat, sendMessage, getHistory, linkedinRewrite, rewriteBulletHandler, suggestTitlesHandler, bulletCoachHandler };
