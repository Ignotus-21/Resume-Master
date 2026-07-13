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
// PDF (\input{/etc/passwd}-style). Raw user-supplied LaTeX now additionally
// requires auth at the route level (see middleware/compile.js), but the
// source-level block stays as defense in depth. Deliberately excludes
// \includegraphics, which is used legitimately in resumes and can't be
// abused the same way (it must decode as a valid image, not arbitrary bytes
// rendered as text).
// (?![a-zA-Z]) rather than \b: \openin/\read are always followed directly by
// a stream number with no separator (\openin0=...), which \b would reject
// (no boundary between two word chars). The negative lookahead still rejects
// letter-extended names sharing a prefix — \includegraphics, \includeonly,
// \inputencoding — which are legitimate and unrelated to file inclusion.
const DANGEROUS_LATEX_PATTERN = /\\(input|include|openin|read|lstinputlisting|verbatiminput|InputIfFileExists|IfFileExists)(?![a-zA-Z])/;

// \csname input\endcsname builds the control sequence \input from a token
// list at expansion time and behaves identically to it, despite containing
// no literal \input token — so it walks straight past the pattern above.
// This closes that specific, concretely reported bypass, but it does not
// make the block airtight: TeX is Turing-complete and offers other ways to
// construct a command name dynamically (\expandafter, \lowercase/\uccode
// tricks, \let-aliasing to a new name). A determined attacker can likely
// still find a variant this doesn't catch — actually closing this
// vulnerability class requires OS-level sandboxing of the compiler process,
// not more regex. Documenting that ceiling rather than claiming it's closed.
const CSNAME_BYPASS_PATTERN = /\\csname\s*(input|include|openin|read|lstinputlisting|verbatiminput|InputIfFileExists|IfFileExists)\s*\\endcsname/;

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Real page count from the compiled PDF (not an estimate): count page
// objects, falling back to the page-tree /Count. Object streams could hide
// these in a compressed PDF, but Tectonic's xdvipdfmx output keeps page
// dictionaries visible.
const countPdfPages = (pdfBuffer) => {
  const s = pdfBuffer.toString('latin1');
  const pageObjects = s.match(/\/Type\s*\/Page[^s]/g);
  if (pageObjects && pageObjects.length > 0) return pageObjects.length;
  let max = 0;
  const re = /\/Count\s+(\d+)/g;
  let m;
  while ((m = re.exec(s)) !== null) max = Math.max(max, Number(m[1]));
  return max || 1;
};

// KNOWN RISK (pipeline proof, 2026-07-12): concurrent tectonic processes
// contend on the shared package-cache lock — a compile running alongside
// parallel compiles was observed blocking 250s+ despite the 30s execFile
// timeout below. Fine while compiles are serialized per process; revisit
// before ever parallelizing compiles in production.
const compileLatex = async (latexCode) => {
  if (typeof latexCode !== 'string' || latexCode.length === 0) {
    return { success: false, error: 'LaTeX code is required' };
  }

  if (latexCode.length > MAX_LATEX_LENGTH) {
    return { success: false, error: 'LaTeX source exceeds maximum allowed size' };
  }

  if (DANGEROUS_LATEX_PATTERN.test(latexCode) || CSNAME_BYPASS_PATTERN.test(latexCode)) {
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
      return { success: true, pdf: pdfBuffer, pages: countPdfPages(pdfBuffer) };
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
          return { success: false, log: execError, errors: [] };
        }
        const errors = parseLatexErrors(log);
        return {
          success: false,
          errors,
          // Legacy string form so older clients / error panes keep working.
          log: errors.length
            ? errors.map((e) => `${e.severity === 'error' ? '!' : '⚠'} ${e.line ? `l.${e.line} ` : ''}${e.message}${e.context ? `\n  ${e.context}` : ''}`).join('\n')
            : 'Unknown LaTeX Compilation Error (Check logs)',
        };
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

// Structured TeX log parsing so the UI can render Overleaf-style badge
// counts and editor gutter markers.
// Returns [{ line: number|null, severity: 'error'|'warning', message, context }].
const parseLatexErrors = (log) => {
    const lines = String(log || '').split('\n');
    const results = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // "! Undefined control sequence." followed (within a few lines) by
        // "l.42 \foo" + the source context after the line number.
        if (line.startsWith('! ')) {
            const entry = { line: null, severity: 'error', message: line.slice(2).trim(), context: '' };
            for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
                const m = lines[j].match(/^l\.(\d+)\s?(.*)$/);
                if (m) {
                    entry.line = Number(m[1]);
                    entry.context = (m[2] + (lines[j + 1] || '').trim()).trim();
                    break;
                }
            }
            results.push(entry);
            continue;
        }

        // "Overfull \hbox (15.3pt too wide) in paragraph at lines 100--102"
        let m = line.match(/^(Overfull|Underfull) \\[hv]box \(([^)]*)\).* at lines? (\d+)/);
        if (m) {
            results.push({
                line: Number(m[3]),
                severity: 'warning',
                message: `${m[1]} box (${m[2]})`,
                context: '',
            });
            continue;
        }

        // "LaTeX Warning: Reference `x' undefined on input line 12."
        m = line.match(/^(?:LaTeX|Package \S+) Warning: (.*)$/);
        if (m) {
            let message = m[1].trim();
            // Warnings wrap across lines; pull in the continuation if the
            // line number is on the next one.
            if (!/on input line \d+/.test(message) && lines[i + 1] && /^\s{2,}/.test(lines[i + 1])) {
                message += ' ' + lines[i + 1].trim();
            }
            const lineMatch = message.match(/on input line (\d+)/);
            results.push({
                line: lineMatch ? Number(lineMatch[1]) : null,
                severity: 'warning',
                message,
                context: '',
            });
        }
    }
    return results;
};

module.exports = { compileLatex, parseLatexErrors, countPdfPages };
