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
});
