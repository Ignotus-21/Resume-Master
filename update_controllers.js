const fs = require('fs');

const paths = [
  'backend/controllers/masterController.js',
  'backend/controllers/resumeController.js',
  'backend/controllers/coverLetterController.js',
  'backend/controllers/interviewController.js'
];

for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  let code = fs.readFileSync(p, 'utf8');
  
  // Replace calls that pass apiKey to also pass req
  code = code.replace(/(parseResumeData\([^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(tailorResume\([^,]+,\s*[^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(generateLatex\([^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(getRecommendations\([^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(generateCoverLetter\([^,]+,\s*[^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(generateInterviewQuestions\([^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(evaluateInterviewAnswer\([^,]+,\s*[^,]+,\s*[^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  code = code.replace(/(generateLinkedInContent\([^,]+,\s*req\.geminiApiKey)(?!\s*,\s*req)/g, "$1, req");
  
  fs.writeFileSync(p, code);
}
