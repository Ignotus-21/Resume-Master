console.log('Loading masterRoutes...');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { getProfile, updateProfile, ingestRawText, uploadResume } = require('../controllers/masterController');
console.log('masterRoutes loaded controller');

router.get('/', getProfile);
router.post('/', updateProfile);
router.post('/ingest', ingestRawText);
router.post('/upload-resume', upload.single('resume'), uploadResume);

module.exports = router;
