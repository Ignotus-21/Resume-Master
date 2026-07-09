// Transactional email via Resend. If RESEND_API_KEY isn't configured, we log the
// link to the server console instead of sending — so local dev and the test
// suite work without an email provider.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Resume Master <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
