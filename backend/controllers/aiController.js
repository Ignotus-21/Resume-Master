const ChatSession = require('../models/ChatSession');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const MAX_MESSAGE_LENGTH = 8000;

const startChat = async (req, res) => {
  const { contextType, contextId } = req.body;
  if (typeof contextId === 'string' && contextId.length > 200) {
    return res.status(400).json({ message: 'contextId is too long' });
  }
  try {
    const session = await ChatSession.create({
      contextType,
      contextId,
      history: []
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Add user message
    session.history.push({ role: 'user', parts: [{ text: message }] });

    // Prepare history for Gemini
    // Gemini expects history in format: { role: 'user'|'model', parts: [{ text: '...' }] }
    // We can filter our history to match this
    const historyForGemini = session.history.map(h => ({
      role: h.role,
      parts: [{ text: h.parts[0].text }]
    }));

    const chat = model.startChat({
      history: historyForGemini.slice(0, -1), // Exclude the last message we just added to send it via sendMessage
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    // Add model response
    session.history.push({ role: 'model', parts: [{ text: text }] });
    await session.save();

    res.json({ text, history: session.history });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const session = await ChatSession.findById(req.params.sessionId);
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { startChat, sendMessage, getHistory };
