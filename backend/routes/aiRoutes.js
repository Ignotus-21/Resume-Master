const express = require('express');
const router = express.Router();
const { linkedinRewrite, rewriteBulletHandler, suggestTitlesHandler, bulletCoachHandler } = require('../controllers/aiController');

// DISABLED — general-purpose chatbot (POST /start, POST /send, and the
// GET /:sessionId history read that only served it): it passed raw user text
// straight into chat.sendMessage() with no system instruction, no topic
// scoping, and no output moderation — an open prompt-injection / off-brand
// generation / quota-abuse surface on this app's shared Gemini key.
// The controller functions (startChat/sendMessage/getHistory) and the
// ChatSession model are intentionally kept: a safe reintroduction needs a
// system instruction constraining topic/persona to resume/career coaching,
// and ideally a moderation pass on output before it reaches the user.
// Requests to these paths now fall through to a clean 404.
// router.post('/start', startChat);
// router.post('/send', sendMessage);
// router.get('/:sessionId', getHistory);

router.post('/linkedin-rewrite', linkedinRewrite);
router.post('/rewrite-bullet', rewriteBulletHandler);
router.post('/suggest-titles', suggestTitlesHandler);
router.post('/bullet-coach', bulletCoachHandler);

module.exports = router;
