const { execFile } = require('child_process');

jest.mock('child_process', () => ({
  execFile: jest.fn((cmd, args, opts, cb) => cb(null, { stdout: '', stderr: '' })),
}));

const { compileLatex } = require('../services/latexService');

describe('compileLatex', () => {
  afterEach(() => {
    execFile.mockClear();
  });

  it('rejects empty input without invoking tectonic', async () => {
    const result = await compileLatex('');
    expect(result.success).toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('rejects oversized input without invoking tectonic', async () => {
    const huge = 'a'.repeat(200001);
    const result = await compileLatex(huge);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum allowed size/);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('invokes tectonic via execFile (no shell) with --untrusted', async () => {
    await compileLatex('\\documentclass{article}\\begin{document}hi\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = execFile.mock.calls[0];
    expect(cmd).toBe('tectonic');
    expect(args).toContain('--untrusted');
    // execFile never invokes a shell, so shell metacharacters in args can't be interpreted.
    expect(args.join(' ')).not.toMatch(/[;&|`$]/);
  });

  it('does not leak app secrets into the tectonic child process environment', async () => {
    // The one thing we *can* and do enforce at the process level is that the
    // child env is an explicit allowlist (PATH, HOME) rather than the full
    // process.env, so app secrets can't leak into it even indirectly.
    await compileLatex('\\documentclass{article}\\begin{document}hi\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
    const opts = execFile.mock.calls[0][2];
    expect(Object.keys(opts.env).sort()).toEqual(['HOME', 'PATH']);
    expect(opts.env.JWT_SECRET).toBeUndefined();
    expect(opts.env.ENCRYPTION_KEY).toBeUndefined();
    expect(opts.env.GEMINI_API_KEY).toBeUndefined();
  });

  it('rejects LaTeX containing file-inclusion commands without invoking tectonic', async () => {
    // Regression test for the file-read → info-disclosure risk: tectonic
    // doesn't sandbox \input/\openin, so these are blocked at the source
    // level instead (see DANGEROUS_LATEX_PATTERN in latexService.js).
    const attempts = [
      '\\input{/etc/passwd}',
      '\\include{../../.env}',
      '\\openin0=/etc/passwd \\read0 to\\x',
      '\\lstinputlisting{/etc/passwd}',
    ];
    for (const payload of attempts) {
      const result = await compileLatex(`\\documentclass{article}\\begin{document}${payload}\\end{document}`);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/disallowed file-inclusion/);
    }
    expect(execFile).not.toHaveBeenCalled();
  });

  it('still allows \\includegraphics (legitimate resume use, not a file-read primitive)', async () => {
    await compileLatex('\\documentclass{article}\\begin{document}\\includegraphics{photo.png}\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it('still allows \\inputencoding and \\includeonly (legitimate commands sharing a prefix with blocked ones)', async () => {
    // Regression test: an earlier version of DANGEROUS_LATEX_PATTERN matched
    // any command starting with "input"/"include", which wrongly rejected
    // legitimate commands like \inputencoding (inputenc package).
    await compileLatex('\\documentclass{article}\\usepackage[utf8]{inputenc}\\inputencoding{utf8}\\begin{document}\\includeonly{a}hi\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
  });
});
