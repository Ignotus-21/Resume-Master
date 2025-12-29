const express = require('express');
const router = express.Router();
const { createResumeForJob, getResumes, getResumeById, updateResume, deleteResume, getResumeFeedback, compileResume } = require('../controllers/resumeController');

router.post('/generate', createResumeForJob);
router.post('/compile', compileResume);
router.post('/feedback', getResumeFeedback);
router.get('/', getResumes);
router.get('/:id', getResumeById);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

module.exports = router;
