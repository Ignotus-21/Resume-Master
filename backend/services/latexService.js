const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const TEMP_DIR = path.join(__dirname, '..', 'temp_latex');
const MAX_LATEX_LENGTH = 200000; // ~200KB of LaTeX source is already generous
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB safety cap on the compiled output

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const compileLatex = async (latexCode) => {
  if (typeof latexCode !== 'string' || latexCode.length === 0) {
    return { success: false, error: 'LaTeX code is required' };
  }

  // Auto-sanitize problematic packages for BasicTeX compatibility
  latexCode = latexCode
    .replace(/\\usepackage\{fullpage\}/g, '\\usepackage[margin=0.5in]{geometry}')
    .replace(/\\usepackage\[.*?\]\{fullpage\}/g, '\\usepackage[margin=0.5in]{geometry}');

  if (latexCode.length > MAX_LATEX_LENGTH) {
    return { success: false, error: 'LaTeX source exceeds maximum allowed size' };
  }

  // Collision-resistant per-job directory so concurrent compiles never share a
  // working dir (which would risk mixing one user's output into another's).
  const jobId = crypto.randomUUID();
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
    // execFile (no shell) avoids shell-metacharacter injection via the path.
    // -no-shell-escape blocks \write18 and other shell-escape based RCE vectors.
    // -interaction=nonstopmode prevents hanging on errors.
    // -output-directory defines where files go.
    // Compile using Tectonic for automatic package management
    // This allows downloading missing packages (like titlesec, fontawesome, etc.) on the fly!
    try {
      await execFilePromise('tectonic', [
        '--outdir', workDir,
        texPath,
      ], {
        timeout: 30000, // Increased timeout because downloading packages takes time
        cwd: workDir,
        env: {
          PATH: process.env.PATH,
        },
      });
    } catch (error) {
        // compilation failed or had warnings, but we need to check log
    }

    // Check if PDF exists
    if (fs.existsSync(pdfPath)) {
      const stat = await fs.promises.stat(pdfPath);
      if (stat.size > MAX_PDF_SIZE) {
        await cleanup(workDir);
        return { success: false, error: 'Compiled PDF exceeds maximum allowed size' };
      }
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
