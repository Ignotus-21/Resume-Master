const express = require('express');
const router = express.Router();
const { generate, list, getById, update, remove } = require('../controllers/coverLetterController');

router.post('/generate', generate);
router.get('/', list);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
