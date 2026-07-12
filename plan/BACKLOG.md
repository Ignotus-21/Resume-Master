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

## fontawesome5 crashes Tectonic 0.16.9 on Windows (links: 'icons')

A minimal `\usepackage{fontawesome5}` + `\faLink` document hard-crashes the
Windows Tectonic build (silent exit 116/127, fontconfig error at startup, no
log). Linux verdict comes from the `docker-build` CI job, which compiles the
icons variant via `warmTectonicCache.js` at image build time. If CI is green
this is a Windows-dev-machine caveat only; if red, the `links: 'icons'`
design token compiles nowhere and needs a redesign (see M2.5 step 4 outcome
in the PR that added this file).
