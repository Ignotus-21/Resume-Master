// Transactional email via Resend. If RESEND_API_KEY isn't configured, we log the
// link to the server console instead of sending — so local dev and the test
// suite work without an email provider.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Resume Master <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
// Where contact-form submissions land. Falls back to EMAIL_FROM (which always
// has a default) rather than the raw env var, so this can't end up undefined.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || EMAIL_FROM;

const send = async ({ to, subject, html }) => {
  if (!RESEND_API_KEY) {
    console.log(`[email:dev] To: ${to} | ${subject}\n${html}`);
    return { delivered: false, dev: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    // Bound the request so a slow provider can't stall signup/verify/reset.
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${detail}`);
  }
  return { delivered: true };
};

const sendVerificationEmail = (to, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return send({
    to,
    subject: 'Verify your email — Resume Master',
    html: `
      <p>Welcome to Resume Master! Please confirm your email to unlock AI features.</p>
      <p><a href="${link}">Verify my email</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p>This link expires in 24 hours.</p>
    `,
  });
};

const sendPasswordResetEmail = (to, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return send({
    to,
    subject: 'Reset your password — Resume Master',
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${link}">Reset my password</a></p>
      <p>Or paste this link into your browser:<br>${link}</p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
};

const sendWelcomeEmail = (to, name) => {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return send({
    to,
    subject: 'Welcome to Resume Master',
    html: `
      <p>${greeting}</p>
      <p>Your email is verified — welcome to Resume Master!</p>
      <p>Here's what you can do:</p>
      <ul>
        <li><strong>Tailored resumes per job</strong> — generate a resume matched to a specific job posting in seconds.</li>
        <li><strong>Visual editor + AI rewrites</strong> — fine-tune wording and layout, with AI suggestions along the way.</li>
        <li><strong>Job tracking</strong> — keep every application and its tailored resume organized in one place.</li>
      </ul>
      <p><a href="${APP_URL}/dashboard">Go to your dashboard</a> or <a href="${APP_URL}/profile">build out your profile</a> to get started.</p>
    `,
  });
};

const sendContactNotification = ({ fromEmail, subject, message, usage }) => {
  const usageLine = usage.isByok
    ? 'Using their own Gemini API key (BYOK) — not on shared quota.'
    : `Shared quota: ${usage.remaining} / ${usage.limit} tokens remaining.`;
  return send({
    to: ADMIN_EMAIL,
    subject: `[Contact] ${subject} — ${fromEmail}`,
    html: `
      <p><strong>From:</strong> ${fromEmail}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Usage context:</strong> ${usageLine}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail, sendContactNotification };
