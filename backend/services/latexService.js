const fs = require('fs');
const path = require('path');
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
  if (latexCode.length > MAX_LATEX_LENGTH) {
    return { success: false, error: 'LaTeX source exceeds maximum allowed size' };
  }

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
    // execFile (no shell) avoids shell-metacharacter injection via the path.
    // -no-shell-escape blocks \write18 and other shell-escape based RCE vectors.
    // -interaction=nonstopmode prevents hanging on errors.
    // -output-directory defines where files go.
    try {
      await execFilePromise('pdflatex', [
        '-interaction=nonstopmode',
        '-no-shell-escape',
        '-output-directory', workDir,
        texPath,
      ], {
        timeout: 10000,
        cwd: workDir,
        // openin_any=p / openout_any=p restrict TeX file I/O to "paranoid" mode:
        // no reading/writing of absolute paths, parent directories, or dotfiles.
        // This blocks \input{/…/.env}, \openin, \lstinputlisting, etc. from
        // exfiltrating server secrets into the compiled PDF — a critical fix,
        // since -no-shell-escape only blocks \write18 shell execution, not reads.
        env: {
          PATH: process.env.PATH,
          openin_any: 'p',
          openout_any: 'p',
          TEXMFOUTPUT: workDir,
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
