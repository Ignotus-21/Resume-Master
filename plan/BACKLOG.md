# Backlog — known findings not scheduled into a milestone

Items land here when a session finds something real that shouldn't be fixed
in that session. Each entry says where it was found and what would make it
urgent.

## Tectonic package-cache lock contention under concurrent compiles

Found by the pipeline proof (2026-07-12, native Windows run). A `tectonic`
process compiling while other tectonic processes ran in parallel blocked for
255s — well past the 30s `execFile` timeout in
`backend/services/latexService.js` (the timeout kill did not release it
promptly). Root cause: Tectonic serializes access to its per-user package
cache with a lock file.

Not currently a production problem: the backend compiles one document per
request process, and the Docker image pre-bakes the cache so nothing fetches
at request time. It becomes urgent if compiles are ever parallelized
(worker pool, multiple app processes on one host sharing $HOME, or CI running
compile jobs concurrently).

Mitigations when needed: per-worker `TECTONIC_CACHE_DIR`, a compile queue, or
`--only-cached` once the pre-bake guarantees coverage.

## fontawesome5 crashes Tectonic 0.16.9 everywhere (links: 'icons') — OPEN TICKET

SETTLED 2026-07-12 by the docker-build CI job: **the crash is NOT
Windows-only.** On ubuntu-latest the image build compiled warm variants 1-12
(all templates, all fonts) and died at exactly
`[warm 13/15] sheets {"links":"icons"}` — the same silent hard-crash while
loading `FontAwesome5Free-Solid-900.otf` observed natively on Windows (where
even a minimal `\faLink` document kills tectonic, exit 116/127, no TeX log).

Current state (M2.5 step 4 FAIL branch, per plan):
- `DEFAULT_DESIGN.links` is `'hyperlink'` (always was).
- The fontawesome5 variant is removed from `warmTectonicCache.js` so the
  image can build; the icons option is labeled
  "experimental — may fail to compile" in the Design panel, not dropped.
- A user who selects icons today gets a failed compile with no useful log
  (tectonic aborts before writing one).

Fix directions to evaluate: newer Tectonic release (bundle may carry a fixed
font), `fontawesome` v4 package instead of v5, shipping the OTF outside the
bundle, or emoji/text glyph fallbacks for the 4 icons actually used
(faLink, faLinkedin, faBook, faCertificate + contact icons in helpers.js).
