// The /api/resumes/compile pipeline: prepareCompile -> compileLimiter -> controller.
//
// prepareCompile decides what gets compiled and answers cache hits BEFORE the
// rate limiter runs, so cached compiles never count against the limit:
//   - { content, design, templateId }  -> server-rendered from our own
//     templates: trusted input, guests allowed (the normal structured flow).
//   - { latexCode }                    -> raw client LaTeX: requires auth.
//     Tectonic isn't filesystem-sandboxed and latexService's \input block
//     isn't airtight, so anonymous callers don't get to feed it arbitrary TeX.
const rateLimit = require('express-rate-limit');
const { rateLimitStore } = require('../config/rateLimitStore');
const { render } = require('../services/latex/render');
const { validateDesign } = require('../shared/resume');
const compileCache = require('../services/compileCache');

const prepareCompile = async (req, res, next) => {
  const { latexCode, content, design, templateId } = req.body || {};

  if (typeof latexCode === 'string' && latexCode.trim()) {
    if (!req.user) {
      return res.status(401).json({ message: 'Sign in required to compile custom LaTeX' });
    }
    req.compileTex = latexCode;
    req.compileRendered = false;
  } else if (content && typeof content === 'object') {
    req.compileTex = render(content, validateDesign(design), templateId);
    req.compileRendered = true;
  } else {
    return res.status(400).json({ message: 'Provide latexCode, or content/design/templateId' });
  }

  req.compileHash = compileCache.hashTex(req.compileTex);
  const cached = await compileCache.get(req.compileHash);
  if (cached) {
    console.log(`[compile] cache hit hash=${req.compileHash.slice(0, 12)}`);
    return res.json({
      success: true,
      pdf: cached.pdf,
      pages: cached.pages,
      cached: true,
      ...(req.compileRendered ? { tex: req.compileTex } : {}),
    });
  }
  next();
};

// Compile is not an AI route — it used to sit behind aiLimiter (60/15min),
// which combined with keystroke-debounced compiles locked users out of their
// own document mid-edit. Own limiter, own budget; cache hits never reach it.
// passOnStoreError: a Redis blip shouldn't brick the editor — the general
// /api limiter still caps overall traffic.
const compileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore('compile'),
  passOnStoreError: true,
});

module.exports = { prepareCompile, compileLimiter };
