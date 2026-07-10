const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const TEMP_DIR = path.join(__dirname, '..', 'temp_latex');
const MAX_LATEX_LENGTH = 200000; // ~200KB of LaTeX source is already generous
const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB safety cap on the compiled output

// Tectonic (like any LaTeX engine) doesn't sandbox filesystem reads — these
// primitives can pull an arbitrary local file's content into the compiled
// PDF (\input{/etc/passwd}-style). This endpoint takes raw user-supplied
// LaTeX with no auth requirement (guests can use it too, by design), so
// block the file-inclusion commands outright rather than trying to sandbox
// the compiler itself. Deliberately excludes \includegraphics, which is
// used legitimately in resumes and can't be abused the same way (it must
// decode as a valid image, not arbitrary bytes rendered as text).
// No trailing \b: \openin is always followed by a stream number with no
// separator (\openin0=...), so a word-boundary check there would never
// match. include(?!graphics) is the one exclusion that actually needs to be
// precise, since \includegraphics is legitimate and common in resumes.
const DANGEROUS_LATEX_PATTERN = /\\(input|include(?!graphics)|openin|read|lstinputlisting|verbatiminput|InputIfFileExists|IfFileExists)/;

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const compileLatex = async (latexCode) => {
  if (typeof latexCode !== 'string' || latexCode.length === 0) {
    return { success: false, error: 'LaTeX code is required' };
  }

  // Auto-sanitize packages Tectonic doesn't bundle/support
  latexCode = latexCode
    .replace(/\\usepackage\{fullpage\}/g, '\\usepackage[margin=0.5in]{geometry}')
    .replace(/\\usepackage\[.*?\]\{fullpage\}/g, '\\usepackage[margin=0.5in]{geometry}');

  if (latexCode.length > MAX_LATEX_LENGTH) {
    return { success: false, error: 'LaTeX source exceeds maximum allowed size' };
  }

  if (DANGEROUS_LATEX_PATTERN.test(latexCode)) {
    return { success: false, error: 'LaTeX source contains disallowed file-inclusion commands (\\input, \\include, \\openin, etc.)' };
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

    // Compile using Tectonic for automatic package management. It fetches
    // missing packages (titlesec, fontawesome, etc.) on the fly, and — unlike
    // pdflatex — has no \write18/shell-escape support at all, so there's no
    // flag needed to disable it. execFile (no shell) avoids shell-metacharacter
    // injection via the path/args.
    // NOTE: this does not sandbox filesystem reads — a crafted \input/\openin
    // with an absolute or ../ path can still read any file the `node` process
    // user can access. That risk existed before this change too (no
    // openin_any/texmf.cnf restriction is configured anywhere in this repo);
    // flagging it here rather than claiming it's covered.
    let execError = null;
    try {
      await execFilePromise('tectonic', [
        '--untrusted',
        '--outdir', workDir,
        texPath,
      ], {
        timeout: 30000, // Increased timeout because downloading packages takes time
        cwd: workDir,
        // Tectonic needs HOME to find its cache/config dir (set up in the
        // Dockerfile for the non-root `node` user) — passing only PATH here
        // replaced the whole environment and dropped it, breaking package
        // caching/downloads.
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
        },
      });
    } catch (error) {
        // Compilation errors are diagnosed from resume.log below, but non-LaTeX
        // failures (missing binary, network error fetching a package, timeout)
        // won't produce one — keep the raw error to surface if there's no log.
        console.error('Tectonic compilation error:', error.message || error);
        execError = error.message || String(error);
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
        // No log at all (e.g. missing binary, network error, timeout) means
        // parseLatexErrors would fall back to a generic message — surface the
        // actual execFile error instead when there's nothing else to go on.
        if (!log && execError) {
          return { success: false, log: execError };
        }
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
