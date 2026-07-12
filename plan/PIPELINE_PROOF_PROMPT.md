# Claude Code Prompt — Pipeline Proof (run before Phase 2)

> Run this on your own machine (needs Docker + network access to fetch the
> Tectonic binary/packages — my sandbox has neither). Paste the "REPORT BACK"
> section it produces into the chat with Claude (the planning assistant) when
> done. Do this before starting any Phase 2 milestone work.

---

## Prompt

```
We are about to start Phase 2 of the Resume Master rebuild (see
plan/RESUME_MASTER_V2_PLAN.md and plan/CLAUDE_CODE_PROMPT.md). Before writing
any new code, I need hard proof that the M0-M5 rebuild actually works
end-to-end with a real Tectonic compiler, not just unit/mock tests. Do not
start any Phase 2 feature work in this session — this is verification only.

Branch: bug-fix-1 (current HEAD, includes the merged feat/v2-rebuild work).

## Step 1 — Rebuild the Docker image for real

  docker compose build backend

This must succeed. The Dockerfile pre-bakes the Tectonic package cache by
compiling a fixture doc at build time — if any of the 4 templates (jake,
sheets, compact, modern) has a bad package reference or a LaTeX syntax error,
the build should fail here, loudly, not silently.

Report:
  - Did the build succeed? If not, paste the exact failure.
  - Wall-clock build time.
  - Image size (docker images | grep the backend image).

## Step 2 — Run the previously-skipped Tectonic-gated tests

  docker compose up -d
  docker compose exec backend npm test

Last report said "8 auto-skip (they need a real Tectonic binary)". With
Tectonic now present in the container, those should run for real.

Report:
  - Total pass/fail/skip counts, compared to the last report (151 pass / 8
    skip / 1 pre-existing fail).
  - Do all 8 previously-skipped tests now pass? Paste any failures in full,
    including the Tectonic log output, not just the assertion message.
  - Confirm the pre-existing uploadResume.test.js failure is still isolated to
    that one test and still unrelated to this work (sanity check, don't fix it
    now unless it's one line).

## Step 3 — Compile-time proof for all 4 templates against a real profile

Write (if it doesn't already exist as a script) a one-off script,
scripts/proveTemplates.js, that:
  1. Loads/builds a realistic fixture MasterProfile — pull real shape from
     backend/models/MasterProfile.js, and DELIBERATELY include LaTeX special
     characters in the fixture data: "R&D", "C++", "100% growth", "Node_JS",
     "A&M University", "$1.2M ARR", "#1 ranked", "C#", "50%+ uplift".
  2. For each of the 4 templates x 3 design-token variants (default, dense
     "compact" spacing + smallest font, spacious "airy" spacing + largest
     font), calls render() then compileLatex() for real (not mocked).
  3. Records: success/fail, page count, compile wall-clock time, PDF byte
     size, and whether it was a cache hit or miss.
  4. Writes a results table to stdout and to /tmp/template-proof-report.json.

Run it twice in a row (second run should hit the compile cache).

Report the full table: template x variant x {success, pages, ms, cached}.
Anything that fails to compile, paste the actual Tectonic log (parseLatexErrors
output), not a summary.

## Step 4 — Cold vs warm compile timing (validates the M2 Dockerfile pre-bake)

  docker compose down
  docker compose up -d
  # immediately, before anything else touches the container:
  time docker compose exec backend node -e "
    const { render } = require('./services/latex/render');
    const { compileLatex } = require('./services/latexService');
    // use the same fixture profile as step 3, jake template, default design
    ... (adapt to actual render/compileLatex signatures)
  "

This measures the FIRST compile after a fresh container start. The whole point
of pre-baking the Tectonic cache into the image was to make this fast and
network-independent.

Report: cold compile time in ms. If it's not clearly faster than a compile
that has to fetch packages over the network (should be a low single-digit
number of seconds, not tens of seconds), say so plainly — don't round up a bad
number to a good one.

## Step 5 — Migration script, against a real (non-production) copy of the DB

DO NOT run this against production data. Use a local Mongo instance or a
dumped/restored copy.

  docker compose exec backend node scripts/migrateResumesV2.js --dry-run

If a --dry-run flag doesn't exist, add one now (log what it would change
without writing) — this script mutates every existing Resume document and
should not be run blind the first time.

Then, against the dry-run-verified local copy:

  docker compose exec backend node scripts/migrateResumesV2.js

Report:
  - How many documents were migrated, how many skipped/unmappable (the script
    was supposed to log anything it can't map — paste that log in full).
  - Spot-check: pick 2 migrated documents and confirm content/mode/latexSource
    look correct (paste the before/after for one legacy resume).

## Step 6 — Manual click-through (do this one yourself, in the browser, not via Claude Code)

  1. docker compose up -d, run frontend dev server against it
  2. Generate a new resume from a job description
  3. Switch to Visual editor, edit a bullet, accept an AI rewrite
  4. Switch to Code view, confirm it's read-only with the banner
  5. Change 3 design tokens (font, margin, accent color) in the Design panel,
     confirm the PDF preview updates and looks right
  6. Eject to LaTeX, confirm the modal copy is accurate, make a manual edit,
     recompile
  7. Revert to structured, confirm your content/design are intact and the
     LaTeX edit is gone
  8. Download PDF and DOCX, open both, confirm they contain the same content

This step is yours to run and report on directly — Claude Code should NOT
fabricate or assume this step passed. If you (Claude Code) are able to drive
a browser via a tool, do so and report what you actually saw; otherwise leave
this step for me to do manually and say so.

## Step 7 — Baseline the two metrics the plan asked to measure

The current code has no counters for compile cache hit rate or cold-compile
time (confirmed absent from backend/services/compileCache.js). Before Phase 2
adds more compile-heavy features, add the minimum viable version of this:

  - In compileCache.js, increment simple in-process counters on get() hit vs
    miss (a Map or two numbers is enough — no new dependency, no dashboard).
  - Expose them at GET /api/admin/compile-stats (reuse existing adminAuth
    middleware) returning { hits, misses, hitRate, sampleCount }.
  - Log cache hit/miss + compile duration at info level on every compile.

This is intentionally tiny — a few lines, no new infra — just enough that
Phase 2 decisions about the cache/compile pipeline are based on real numbers
instead of guesses.

Report: after running steps 3 and the manual click-through in step 6, what do
the counters show?

## REPORT BACK — fill this in and paste the whole thing back

    PIPELINE PROOF REPORT
    ======================
    Docker build:        PASS / FAIL   (time: ___, image size: ___)
    Test suite:          ___ pass / ___ fail / ___ skip
      previously-skipped Tectonic tests now passing: ___ / 8
      uploadResume.test.js still isolated failure: YES / NO
    Template compile matrix (4 templates x 3 variants = 12 cells):
      all 12 passed: YES / NO  (if NO, paste failures)
      page counts: ___
    Cold compile time (fresh container, first compile): ___ ms
    Compile cache: second run of proveTemplates.js — hit rate: ___
    Migration: ___ migrated, ___ skipped/unmappable (paste unmappable log)
    Manual click-through (step 6): PASS / PARTIAL / NOT RUN — notes: ___
    Compile-stats endpoint added: YES / NO — current counters: ___

    Anything that surprised you, or any place the M0-M5 report overstated
    what actually works: ___
```

---

## Why this order, and why it's not part of the Phase 2 feature prompt

This isn't a milestone — it's a gate. Everything in the item-6 report's
"improve next" list (Gemini JSON mode, autosave, page-break polish, entry
points, metrics) assumes the compile pipeline underneath it is trustworthy.
If step 3 or step 4 above turns up a template that doesn't actually compile,
or a cold-start time that's still slow, that's cheaper to fix now — before
Phase 2 builds JSON-mode tailoring and autosave on top of it — than to
discover it after.

Once you've got a filled-in REPORT BACK, bring it back here and the Phase 2
prompt (Gemini structured output → autosave → page-break polish → entry
points → metrics wiring → diff/drag-reorder nice-to-haves, sequenced as
milestones) gets tailored to whatever the proof actually found, instead of
assuming the M0-M5 report's optimistic case.
