const express = require('express');
const router = express.Router();
const { start, answer, list, getById } = require('../controllers/interviewController');

router.post('/start', start);
router.post('/answer', answer);
router.get('/', list);
router.get('/:id', getById);

module.exports = router;
