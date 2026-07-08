console.log('Loading masterRoutes...');
const express = require('express');
const router = express.Router();
const multer = require('multer');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

const { getProfile, updateProfile, ingestRawText, uploadResume } = require('../controllers/masterController');
console.log('masterRoutes loaded controller');

router.get('/', getProfile);
router.post('/', updateProfile);
router.post('/ingest', ingestRawText);
router.post('/upload-resume', (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, uploadResume);

module.exports = router;
