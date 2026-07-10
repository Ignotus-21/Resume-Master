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
    // Tectonic has no shell-escape support and --untrusted is set, but it does
    // NOT sandbox \input/\openin file reads (confirmed against upstream docs —
    // see the comment in latexService.js). The one thing we *can* and do
    // enforce is that the child process env is an explicit allowlist (PATH,
    // HOME) rather than the full process.env, so app secrets can't leak into
    // it even if a crafted document tried to read its own environment.
    await compileLatex('\\documentclass{article}\\begin{document}\\input{/etc/passwd}\\end{document}');
    expect(execFile).toHaveBeenCalledTimes(1);
    const opts = execFile.mock.calls[0][2];
    expect(Object.keys(opts.env).sort()).toEqual(['HOME', 'PATH']);
    expect(opts.env.JWT_SECRET).toBeUndefined();
    expect(opts.env.ENCRYPTION_KEY).toBeUndefined();
    expect(opts.env.GEMINI_API_KEY).toBeUndefined();
  });
});
