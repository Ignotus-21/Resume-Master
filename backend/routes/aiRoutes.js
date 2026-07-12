const express = require('express');
const router = express.Router();
const { startChat, sendMessage, getHistory, linkedinRewrite, rewriteBulletHandler, suggestTitlesHandler, bulletCoachHandler } = require('../controllers/aiController');

router.post('/start', startChat);
router.post('/send', sendMessage);
router.post('/linkedin-rewrite', linkedinRewrite);
router.post('/rewrite-bullet', rewriteBulletHandler);
router.post('/suggest-titles', suggestTitlesHandler);
router.post('/bullet-coach', bulletCoachHandler);
router.get('/:sessionId', getHistory);

module.exports = router;
