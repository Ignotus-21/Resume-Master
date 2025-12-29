const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TEMP_DIR = path.join(__dirname, '..', 'temp_latex');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const compileLatex = async (latexCode) => {
  const jobId = Math.random().toString(36).substring(7);
  const workDir = path.join(TEMP_DIR, jobId);
  
  try {
    // Create isolated working directory for this job
    await fs.promises.mkdir(workDir, { recursive: true });
    
    const texPath = path.join(workDir, 'resume.tex');
    const pdfPath = path.join(workDir, 'resume.pdf');
    const logPath = path.join(workDir, 'resume.log');

    // Write LaTeX code to file
    await fs.promises.writeFile(texPath, latexCode);

    // Compile
    // -interaction=nonstopmode prevents hanging on errors
    // -output-directory defines where files go
    try {
      await execPromise(`pdflatex -interaction=nonstopmode -output-directory="${workDir}" "${texPath}"`, { timeout: 10000 });
    } catch (error) {
        // compilation failed or had warnings, but we need to check log
    }

    // Check if PDF exists
    if (fs.existsSync(pdfPath)) {
      const pdfBuffer = await fs.promises.readFile(pdfPath);
      await cleanup(workDir);
      return { success: true, pdf: pdfBuffer };
    } else {
        // Read log for errors
        let log = '';
        if (fs.existsSync(logPath)) {
            log = await fs.promises.readFile(logPath, 'utf8');
        }
        await cleanup(workDir);
        return { success: false, log: parseLatexErrors(log) };
    }

  } catch (error) {
    await cleanup(workDir);
    return { success: false, error: error.message };
  }
};

const cleanup = async (dir) => {
    try {
        await fs.promises.rm(dir, { recursive: true, force: true });
    } catch (e) {
        console.error("Cleanup error:", e);
    }
}

const parseLatexErrors = (log) => {
    // Simple parser to extract relevant error lines
    const lines = log.split('\n');
    const errors = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('! ')) {
            errors.push(lines[i]);
            if (lines[i+1]) errors.push(lines[i+1]); // Context
        }
    }
    return errors.length > 0 ? errors.join('\n') : "Unknown LaTeX Compilation Error (Check logs)";
};

module.exports = { compileLatex };
