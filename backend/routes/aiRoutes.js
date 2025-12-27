const express = require('express');
const router = express.Router();
const { startChat, sendMessage, getHistory } = require('../controllers/aiController');

router.post('/start', startChat);
router.post('/send', sendMessage);
router.get('/:sessionId', getHistory);

module.exports = router;
