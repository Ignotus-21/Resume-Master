const express = require('express');
const router = express.Router();
const { createResumeForJob, getResumes, getResumeById, updateResume, deleteResume, getResumeFeedback } = require('../controllers/resumeController');

router.post('/generate', createResumeForJob);
router.post('/feedback', getResumeFeedback);
router.get('/', getResumes);
router.get('/:id', getResumeById);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

module.exports = router;
