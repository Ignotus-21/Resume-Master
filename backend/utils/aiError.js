// Typed error for Gemini failures so controllers can send a clean,
// user-facing status instead of a blanket 500.
//
// Two codes, both 502 (the upstream AI dependency failed, not this API):
//   AI_BAD_RESPONSE — Gemini answered, but the payload didn't survive
//                     parse/validation against the call's response schema.
//   AI_UNAVAILABLE  — the Gemini call itself failed (network, timeout,
//                     upstream quota, safety block).
//
// `message` is safe to show to the user verbatim. Validation specifics
// (paths, expected vs got) go on `detail`, which is logged server-side only.
class AiError extends Error {
  constructor(message, { code = 'AI_UNAVAILABLE', status = 502, detail, cause } = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    if (detail) this.detail = detail;
    if (cause) this.cause = cause;
  }
}

// Drop-in for controller catch blocks: AiError becomes its own status/body,
// anything else stays an opaque 500 so internals never leak.
const respondError = (res, error, fallbackMessage = 'Something went wrong') => {
  if (error instanceof AiError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  return res.status(500).json({ message: fallbackMessage });
};

module.exports = { AiError, respondError };
