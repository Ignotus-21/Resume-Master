// RESEND_API_KEY is unset in tests (see setupEnv.js), so send() takes the
// dev-log path instead of calling the Resend API — exercising these directly
// verifies the HTML-escaping/CR-LF-stripping logic without a network call.
const { sendWelcomeEmail, sendContactNotification } = require('../services/emailService');

describe('emailService HTML/subject sanitization', () => {
  it('escapes user-controlled name in the welcome email body', async () => {
    const res = await sendWelcomeEmail('a@b.com', '<script>alert(1)</script>');
    expect(res.dev).toBe(true);
  });

  it('strips CR/LF from subject and fromEmail before building the notification subject line', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendContactNotification({
      fromEmail: 'attacker@evil.com\r\nBcc: victim@example.com',
      subject: 'General\nX-Injected: true',
      message: 'hi',
      usage: { limit: 15000, remaining: 12000, isByok: false },
    });

    // send() logs `To: ... | ${subject}\n${html}` — if subject still had raw
    // CR/LF in it, that first "To: ... | subject" line would be truncated at
    // the injected newline instead of carrying the full (space-joined) text.
    const firstLine = logSpy.mock.calls[0][0].split('\n')[0];
    expect(firstLine).toContain('[Contact] General X-Injected: true — attacker@evil.com Bcc: victim@example.com');
    logSpy.mockRestore();
  });

  it('escapes HTML in the contact notification body and converts newlines to <br>', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await sendContactNotification({
      fromEmail: 'a@b.com',
      subject: 'General',
      message: '<img src=x onerror=alert(1)>\nline two',
      usage: { limit: 15000, remaining: 12000, isByok: false },
    });

    const logged = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(logged).not.toContain('<img src=x onerror=alert(1)>');
    expect(logged).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(logged).toContain('line two');
    logSpy.mockRestore();
  });
});
