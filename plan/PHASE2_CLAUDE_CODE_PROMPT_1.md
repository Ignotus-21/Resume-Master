# Claude Code Prompt — Phase 2

> Prereq: the pipeline proof session found and fixed a real bug (`bookmarks=false`
> in `base.js`) and left useful infra (compile-cache counters, `--dry-run`
> migration, `proveTemplates.js`) uncommitted on the working tree. M2.5 below
> commits that and closes the two gaps the proof session couldn't reach locally
> (no Docker, no Playwright). Paste milestones one at a time, same discipline as
> before: one milestone, one PR, wait for merge.

---

## M2.5 — Close the proof gate (small, do first)

```
Milestone M2.5. Branch: fix/pipeline-proof-gate.

Context: a native (non-Docker) pipeline proof run just found and fixed a real
bug — sheets/compact templates crashed hyperref because \section{\MakeUppercase{...}}
breaks inside a PDF-bookmark string. Fixed with bookmarks=false in base.js.
Also found: cold compile with an EMPTY Tectonic cache takes 102s and blows the
30s execFile timeout in latexService.js — this is why the Dockerfile pre-bake
step is load-bearing, not optional. And: fontawesome5 (used by the
links:'icons' design token) hard-crashes Tectonic 0.16.9 on Windows — unknown
whether this is Windows-specific or a real template bug, because there's no
Docker/Linux available on that machine.

1. Review and commit the working-tree changes from the proof session (they are
   real fixes, already tested against real Tectonic 0.16.9):
     - base.js (bookmarks=false) + regenerated renderTemplates.test.js.snap
     - compileCache.js (hit/miss counters + getStats())
     - adminRoutes.js (GET /api/admin/compile-stats behind adminAuth)
     - compile.js / resumeController.js (hit/miss + duration logging)
     - migrateResumesV2.js (--dry-run flag)
     - proveTemplates.js (new script)
   Squash-commit with a message that names the bug, the fix, and the proof
   that found it. Run the full test suite once more before committing.

2. Fix the docker-compose.yml gap the proof session hit: there is no `backend`
   service, only `mongodb`. Add one (build: backend/Dockerfile context, env
   from .env, depends_on mongodb) so `docker compose build backend` and
   `docker compose up` work as the original plan assumed.

3. Add a CI job that settles the fontawesome5 question on real Linux, without
   requiring Docker on anyone's laptop:
     - New job in .github/workflows/ci.yml, runs on ubuntu-latest (same as the
       existing jobs — this is genuinely Linux, unlike the machine that ran
       the proof).
     - `docker build -f backend/Dockerfile backend` — this exercises
       warmTectonicCache.js at build time, which includes the icons/
       fontawesome5 variant. If it fails, the build step fails loudly (same
       behavior the Dockerfile already has).
     - Trigger on push to bug-fix-1/main and on workflow_dispatch (don't
       necessarily need it on every PR yet — docker build is slow; your call,
       but at minimum make it easy to trigger on demand).

4. Once that CI job has run once and you have a real answer:
     - PASSES on Linux -> fontawesome5 was a Windows-Tectonic-build quirk.
       Leave links:'icons' as-is, note the Windows caveat in a comment near
       the tokens.js icon handling for future contributors on Windows.
     - FAILS on Linux -> it's a real template/package issue. Change the
       DEFAULT_DESIGN link style away from 'icons' to 'hyperlink', keep
       'icons' as a selectable-but-labeled-experimental option in the Design
       panel, and file a follow-up ticket. Do not silently drop the option.

5. Note for later (not this milestone, just log it): the proof found that a
   compile running alongside parallel warm-up/test compiles can block for
   250s+ despite the 30s timeout — Tectonic's package-cache lock contention.
   Add a one-line comment where compileLatex() is defined flagging this as a
   known risk if compiles are ever parallelized in production, and add it to
   whatever backlog/issues list the project uses. Do not fix it now — it's
   not a Phase 2 blocker, just don't lose the finding.

Done when: CI is green including the new docker-build job, docker-compose up
brings up a working backend against real Tectonic, and the icons decision in
step 4 is made based on evidence rather than left ambiguous.
```

---

## M6 — Gemini structured output (JSON mode)

```
Milestone M6. Branch: feat/v2-gemini-json-mode.

This is the single biggest remaining reliability gap in the app. Every AI call
today (tailorResume, rewriteBullet, suggestTitles, bulletCoach, and whatever
the JD-match scoring call is) gets a free-text response from Gemini, strips
markdown code fences with string manipulation, and JSON.parse()s what's left.
Any response that doesn't fit that exact shape — an extra sentence, no fences,
a trailing comma — throws, and today that throw likely surfaces as a raw 500.

1. For every Gemini call in geminiService.js, switch to structured output:
     generationConfig: { responseMimeType: 'application/json', responseSchema: {...} }
   Define an explicit JSON schema per call (tailored content, bullet rewrites
   array, title suggestions array, coach question/bullet, match score object).
   Use the shared IR types from shared/resume.js / backend/shared/resume.js as
   the source of truth for what the schema should look like — don't hand-author
   a second, drifting definition of "what a bullet point looks like."

2. Delete the markdown-fence-stripping code entirely. With responseMimeType set,
   Gemini returns raw JSON — if you still need to strip fences after this
   change, the schema isn't being honored and that's a bug to chase, not a
   workaround to keep.

3. Add a typed parse-and-validate step after JSON.parse (zod or a hand-rolled
   validator against the same schema) so a schema-conformant-but-semantically-
   wrong response (e.g. an empty array where content was expected) fails
   explicitly with a clear error, not a downstream null-pointer three files away.

4. Decide and implement the failure path when Gemini still errors or times out
   despite JSON mode: what does the user see, and does the quota
   reservation get refunded? (It should — check quotaService's refund path
   still fires on this new failure branch.)

5. Tests: for each Gemini call, a test that feeds a deliberately malformed-but-
   schema-adjacent response through the parse/validate step and confirms it
   fails with a useful error rather than crashing the request. Mock the Gemini
   client at the SDK boundary, not by string-matching prompts.

Done when: no code path parses Gemini output by stripping markdown strings, and
a malformed AI response produces a clean user-facing error instead of a 500.
```

---

## M7 — Autosave

```
Milestone M7. Branch: feat/v2-autosave.

Today ResumeWorkspace has an explicit Save button — the only way to lose work
is to forget to click it, close the tab, or lose connectivity mid-edit.

1. Debounced autosave (1.5-2s after last edit, separate debounce from the
   compile debounce — don't couple save timing to compile timing) on content
   and design changes. Server already validates everything on save; reuse that
   path, don't add a second lighter-weight save endpoint.

2. Save-state indicator in the top bar: "Saved" / "Saving…" / "Unsaved changes"
   / "Save failed — retrying". Small, not intrusive — this is UI trust
   signaling, not a modal.

3. Conflict handling: if the same resume is open in two tabs/sessions, last-
   write-wins is acceptable for v1, but detect it (compare updatedAt on save)
   and surface a non-blocking warning rather than silently clobbering. Don't
   build real-time collaboration — that's out of scope.

4. Retry with backoff on save failure (network blip, transient 5xx); surface a
   clear failure state if retries are exhausted, and make sure in-progress
   edits are never lost from the browser's memory even if the network save is
   failing (this is the actual promise autosave is making to the user).

5. Test: rapid-fire edits (simulate keystrokes) settle into exactly one save
   call after the debounce window, not N saves. Test the conflict-detection
   path with a stale updatedAt.

Done when: I can edit for 5 minutes, close the tab without clicking Save, and
reopen the resume with everything intact.
```

---

## M8 — Page-break polish

```
Milestone M8. Branch: feat/v2-page-breaks.

LaTeX will happily orphan a section heading at the bottom of a page with its
content starting on the next one. Cheap fix, real visual-quality win for any
resume that runs to 2 pages.

1. Add \needspace{Nlines} (needspace package) before each major section
   heading in base.js / the shared template rendering path, tuned to roughly
   the height of a heading + first bullet so a heading never prints alone at
   the bottom of a page.
2. Also check for: a bullet's first line orphaned from its remaining lines
   across a page break (harder to fully prevent in LaTeX, but at minimum don't
   make it worse — check current \begin{itemize} settings for widow/orphan
   control options like \raggedbottom interactions).
3. Add needspace to the Dockerfile's pre-baked package set / warmTectonicCache.js
   fixture so it's cached at build time like everything else — don't let this
   be the thing that reintroduces a cold-compile package fetch.
4. Update the snapshot tests for the 12-cell matrix (4 templates x 3 variants)
   since preambles now change; regenerate snapshots, review the diff is only
   the needspace addition.
5. Visual check: construct a 2-page fixture resume that would previously have
   orphaned a heading, confirm it doesn't after this change. Add that fixture
   as a permanent test case, not a one-off manual check.

Done when: a 2-page resume never shows a lone section heading at the bottom of
a page in the compiled matrix's test fixtures.
```

---

## M9 — Entry points

```
Milestone M9. Branch: feat/v2-entry-points.

Context: generation currently requires a saved MasterProfile AND a saved Job
before a resume can be generated. That's two forms before value. This is
almost certainly where new users bounce today.

1. "Paste a JD, get a resume" fast path: accept a raw job description string
   without requiring the user to first create a persisted Job entity. Create
   the Job record behind the scenes (or make it genuinely optional — your
   call, but the user-facing flow should be "paste JD -> go", not "create job
   -> create job -> go").

2. Polished import-from-existing-resume flow: user uploads a PDF/DOCX resume,
   Gemini (via the new M6 structured-output path — reuse the schema, don't
   hand-roll a second free-text parse) extracts it into MasterProfile shape,
   user reviews/corrects before it's saved. This is the single highest-leverage
   onboarding feature per the original SheetsResume comparison ("multiple entry
   points: existing resume / LinkedIn / scratch").

3. Both paths should land the user directly in ResumeWorkspace with something
   already rendered — not a blank form. First-impression latency matters more
   here than anywhere else in the app; if generation takes >3-4s, show a
   skeleton of the workspace with a compile-in-progress state, don't show a
   blank spinner page.

4. Test the extraction path against a handful of real-shaped resume fixtures
   (different formats: single-column, two-column, a resume with unusual
   section names) and confirm reasonable field mapping — this is inherently
   fuzzy, so define "reasonable" as: required fields (name, at least one
   experience entry) populate correctly, and nothing crashes on a messy input.

Done when: a brand-new user can go from "nothing" to "a rendered, tailored
resume in the workspace" via either path in under 2 minutes without hitting a
form that doesn't obviously lead anywhere.
```

---

## M10 — Metrics wrap-up + polish nice-to-haves

```
Milestone M10. Branch: feat/v2-metrics-and-polish.

Compile-stats counters and the admin endpoint already exist (added during the
pipeline proof). This milestone finishes wiring them in and picks up the
smaller nice-to-haves from the original report, roughly in order of value:

1. Metrics: confirm compile-stats counters persist across restarts if that
   matters for your ops (currently in-memory per the proof report — decide if
   that's fine for now or needs Redis-backing like the compile cache itself).
   Surface hits/misses/hitRate somewhere you'll actually look at it — doesn't
   need a dashboard, a periodic log line or a simple admin page reading the
   existing endpoint is enough.

2. Word-level diff on AI bullet-rewrite accepts (currently, if it's a full
   replace with no highlighting, add a lightweight word-diff so the user sees
   what changed, not just before/after blocks).

3. True drag-reorder for sections/bullets, replacing the current up/down arrow
   buttons (a documented deviation from the original plan — fine as a v1, worth
   upgrading now that the rest of the workspace is stable).

4. Content-level version diff view: parentResumeId lineage is already stored
   from the fork/duplicate feature — build the UI that diffs two versions'
   `content` (structured diff, not a .tex diff).

5. Unify the standalone ATS-checker page with the in-workspace JD-Match panel
   — right now these are two surfaces doing overlapping work; consolidate into
   one, decide which UI wins.

These are independent — feel free to sequence/split further if any one turns
out bigger than expected. Don't let #2-5 block on each other.
```

---

## Still pending, not a Claude Code task

**Manual click-through (proof step 6).** Wasn't run — no Playwright MCP
available in that session, no `GEMINI_API_KEY` on that machine. Do this
yourself against an environment with real credentials once M2.5 lands (or
enable a Playwright MCP connector and start a fresh Claude Code session to
drive it). Specifically confirm: generate → edit → accept an AI rewrite →
eject → manual LaTeX edit → revert → download PDF + DOCX both look right.
This is the one thing in the whole rebuild that's still unverified by anyone,
human or otherwise.
