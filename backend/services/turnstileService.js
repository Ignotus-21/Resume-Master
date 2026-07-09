// Verifies a Cloudflare Turnstile token. If TURNSTILE_SECRET_KEY isn't set, the
// check is skipped (returns true) so local dev / tests work without CAPTCHA.
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

const verifyTurnstile = async (token, remoteip) => {
  if (!TURNSTILE_SECRET_KEY) return true; // CAPTCHA not configured — allow.
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: token });
    if (remoteip) body.append('remoteip', remoteip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      // Bound the request so signup can't hang if Cloudflare is slow.
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return false;
  }
};

const isTurnstileEnabled = () => Boolean(TURNSTILE_SECRET_KEY);

module.exports = { verifyTurnstile, isTurnstileEnabled };
