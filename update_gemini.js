const fs = require('fs');

const path = 'backend/services/geminiService.js';
let code = fs.readFileSync(path, 'utf8');

// Add trackUsage import
if (!code.includes('trackUsage')) {
  code = "const { trackUsage } = require('../utils/trackUsage');\n" + code;
}

// Update all functions to take req
// e.g. const tailorResume = async (resumeData, jobData, apiKey) => {
code = code.replace(/const (\w+) = async \(([^)]*apiKey[^)]*)\) => \{/g, "const $1 = async ($2, req = null) => {");

// Inject trackUsage after result
// const result = await model.generateContent(prompt);
code = code.replace(/const result = await model\.generateContent\([^)]+\);/g, "$&\n    if (req) await trackUsage(req, '$1' /* we need to dynamically set this or just generic */, result);");

fs.writeFileSync(path, code);
