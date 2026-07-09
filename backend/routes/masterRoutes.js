const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const multer = require('multer');

// Ensure the upload target exists — it's gitignored, so a fresh clone/container
// won't have it and multer would otherwise throw ENOENT on first upload.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

const { getProfile, updateProfile, ingestRawText, uploadResume } = require('../controllers/masterController');

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
