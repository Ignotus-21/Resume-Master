const express = require('express');
const router = express.Router();
const { startChat, sendMessage, getHistory, linkedinRewrite } = require('../controllers/aiController');

router.post('/start', startChat);
router.post('/send', sendMessage);
router.post('/linkedin-rewrite', linkedinRewrite);
router.get('/:sessionId', getHistory);

module.exports = router;
