const express = require('express');
const router = express.Router();
const { createResumeForJob, getResumes, getResumeById, updateResume, duplicateResume, deleteResume, getResumeFeedback, compileResume } = require('../controllers/resumeController');
const { prepareCompile, compileLimiter } = require('../middleware/compile');

router.post('/generate', createResumeForJob);
// prepareCompile: renders structured docs / auth-gates raw LaTeX / answers
// cache hits before the limiter, so cached compiles don't count against it.
router.post('/compile', prepareCompile, compileLimiter, compileResume);
router.post('/feedback', getResumeFeedback);
router.post('/:id/duplicate', duplicateResume);
router.get('/', getResumes);
router.get('/:id', getResumeById);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

module.exports = router;
