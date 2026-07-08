const { execFile } = require('child_process');

jest.mock('child_process', () => ({
  execFile: jest.fn((cmd, args, opts, cb) => cb(null, { stdout: '', stderr: '' })),
}));

const { compileLatex } = require('../services/latexService');

describe('compileLatex', () => {
  afterEach(() => {
    execFile.mockClear();
  });

  it('rejects empty input without invoking pdflatex', async () => {
    const result = await compileLatex('');
    expect(result.success).toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('rejects oversized input without invoking pdflatex', async () => {
    const huge = 'a'.repeat(200001);
    const result = await compileLatex(huge);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/maximum allowed size/);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('invokes pdflatex via execFile (no shell) with -no-shell-escape', async () => {
    await compileLatex('\\documentclass{article}\\begin{document}hi\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
    const [cmd, args] = execFile.mock.calls[0];
    expect(cmd).toBe('pdflatex');
    expect(args).toContain('-no-shell-escape');
    // execFile never invokes a shell, so shell metacharacters in args can't be interpreted.
    expect(args.join(' ')).not.toMatch(/[;&|`$]/);
  });

  it('runs pdflatex in paranoid I/O mode so \\input cannot read server files', async () => {
    // Regression test for the critical LaTeX file-read → secret exfiltration bug.
    await compileLatex('\\documentclass{article}\\begin{document}\\input{/etc/passwd}\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
    const opts = execFile.mock.calls[0][2];
    // openin_any=p / openout_any=p block absolute-path and parent-dir file access.
    expect(opts.env.openin_any).toBe('p');
    expect(opts.env.openout_any).toBe('p');
    // The restricted env must NOT expose app secrets to the TeX process.
    expect(opts.env.JWT_SECRET).toBeUndefined();
    expect(opts.env.ENCRYPTION_KEY).toBeUndefined();
    expect(opts.env.GEMINI_API_KEY).toBeUndefined();
  });
});
