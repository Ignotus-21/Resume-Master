const fs = require('fs');
const path = 'backend/services/geminiService.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let currentFn = '';
for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(/const (\w+) = async/);
  if (match) currentFn = match[1];
  
  if (lines[i].includes("trackUsage(req, '$1'")) {
    let service = currentFn;
    if (service === 'parseResumeData') service = 'resume-parser';
    else if (service === 'tailorResume') service = 'resume-tailor';
    else if (service === 'generateLatex') service = 'latex-generator';
    else if (service === 'generateCoverLetter') service = 'cover-letter';
    else if (service === 'generateLinkedInContent') service = 'linkedin-optimizer';
    else if (service.includes('Interview')) service = 'interview-prep';
    else service = 'other';
    
    lines[i] = `    if (req) await trackUsage(req, '${service}', result);`;
  }
}

fs.writeFileSync(path, lines.join('\n'));
