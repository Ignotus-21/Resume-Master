# Claude Code Prompt — Resume Master v2

> **How to use this:** commit `RESUME_MASTER_V2_PLAN.md` to the repo as `docs/V2_PLAN.md` first. Then start Claude Code in the repo root and paste **§A (Kickoff)**. After it reports back, paste milestones **M0 → M5 one at a time**, reviewing and merging between each. Do not paste them all at once.

---

## §A — Kickoff (paste this first)

```
You are working on Resume Master, a full-stack AI resume platform.
Stack: Next.js 16 / React 19 (frontend), Express 5 / MongoDB / Mongoose (backend),
Gemini API, Tectonic for LaTeX→PDF. Current branch: bug-fix-1.

Read `docs/V2_PLAN.md` in full before writing any code. It contains the audit,
the architecture decision, and the phased plan. This prompt is the execution
contract for that plan.

## The product

Today the app asks Gemini to WRITE LaTeX source code from scratch on every
resume generation. `templateStyle` is a string ('classic'|'modern'|'compact')
interpolated into a prompt. There are no template files in the repo. This is the
root defect and everything in this rebuild descends from fixing it.

We are rebuilding the rendering layer into:

  **SheetsResume's simplicity on the surface. Overleaf's power in the engine.**

- Visual mode (default): a guided, section-by-section form with live PDF preview
  and per-bullet AI suggestions. The user never sees LaTeX.
- Code mode: Monaco + real LaTeX, recompile, error gutter — Overleaf's
  `Code | Visual` toggle is the literal architecture.
- Customization comes from structured DESIGN TOKENS (font, margins, spacing,
  section order, accent, rules...), NOT from hand-editing .tex.

## Non-negotiable architecture rules

1. **JSON is the single source of truth.** A resume is
   `{ content, design, templateId, mode }`. LaTeX is a PURE DETERMINISTIC
   FUNCTION of that: `render(content, design, templateId) -> string`.
   Sync. No I/O. No network. No randomness. No LLM.

2. **Gemini NEVER emits LaTeX. Ever.** It does JSON→JSON content operations
   only: tailor content, rewrite a bullet, suggest job titles, score against a
   JD, coach a bullet. Delete `generateLatex()` from `geminiService.js` in M1
   and never reintroduce anything like it.

3. **Never parse LaTeX back into JSON.** It is not solvable in the general case.
   Hand-editing is exposed as an explicit one-way "Eject to LaTeX" door
   (`mode: 'latex'`), modelled on `create-react-app eject`. If you find yourself
   writing a .tex parser, stop and ask me.

4. **All user content is escaped through one tested function.** `escapeLatex()`
   is the single choke point. No template file may interpolate raw user strings.

5. PDF, DOCX and HTML are SIBLING RENDERERS of the same IR. `generateDocx.ts`
   currently renders from `tailoredData` while the PDF renders from `latexCode`
   — two sources of truth that will silently diverge. Collapse them.

## Working agreement

- One milestone = one PR = one focused branch off `bug-fix-1`. Do not start the
  next milestone until I've merged the previous one.
- `npm test` (backend) and `npm run lint` + `npm run build` (frontend) must pass
  before you tell me a milestone is done. CI must stay green.
- Do NOT rewrite what already works: auth, sessions, token revocation, quota +
  reservation/refund accounting, rate-limit store, Turnstile, sanitize
  middleware, CORS/Helmet config, the existing 16 backend test files. These are
  well-built. Leave them alone unless a milestone explicitly says otherwise.
- The `MasterProfile` schema is already the right IR (experience / education /
  projects / skills / certificates / achievements / publications / volunteering
  / patents / customSections). Build on it. Don't redesign it.
- Add tests as you go. Snapshot tests on rendered .tex are the regression net
  for the whole system — treat them as load-bearing.
- Ask before: adding a dependency, changing an existing DB field's meaning, or
  touching an auth/quota path.

## Your first task (no code yet)

1. Read `docs/V2_PLAN.md`, then read these files and confirm you understand the
   current data flow end to end:
   - backend/services/geminiService.js  (generateLatex, tailorResume)
   - backend/services/latexService.js   (compileLatex, parseLatexErrors)
   - backend/controllers/resumeController.js
   - backend/models/Resume.js, backend/models/MasterProfile.js
   - backend/app.js  (rate limiters)
   - frontend/app/resumes/useResumeGeneration.ts, page.tsx, types.ts
   - frontend/app/resumes/generateDocx.ts
   - frontend/components/resume/LatexEditor.tsx

2. Report back with:
   - A 10-line trace of the current "generate a resume" flow.
   - Confirmation of these 4 bugs I found, with file:line, or a correction if
     I'm wrong:
     (a) 1s keystroke debounce on compile + `/api/resumes/compile` behind
         `aiLimiter` (60/15min) => a user editing for ~3 min gets rate-limited
         out of their own document.
     (b) No AbortController on compile => a slow response can clobber a newer
         preview.
     (c) No LaTeX escaping anywhere in the codebase; `& % $ # _ { }` in user
         content (e.g. "R&D", "C++", "100% growth") depend on the LLM escaping
         them correctly.
     (d) `latexService.js` compiles unauthenticated user-supplied LaTeX, and its
         own comments concede the `\input` block isn't airtight and Tectonic
         isn't filesystem-sandboxed.
   - Anything you'd sequence differently, and why.

Do not write code until I approve. Then we start at M0.
```

---

## §B — Milestones (paste one at a time)

### M0 — Foundations: types, escaping, design tokens

```
Milestone M0. Branch: feat/v2-foundations. No user-visible change.

1. `shared/types/resume.ts` — the IR, imported by BOTH frontend and backend
   (wire up the tsconfig path / a small shared package; tell me which you pick).
     - ResumeContent      (mirrors MasterProfile, minus owner/timestamps)
     - DesignTokens       (spec in docs/V2_PLAN.md §3 — implement it exactly)
     - SectionKey, TemplateId, RenderMode ('structured' | 'latex')
     - DEFAULT_DESIGN, and a `validateDesign()` that clamps every numeric range.

2. `backend/services/latex/escape.js`
     - `escapeLatex(str)` — handle \ { } $ & # ^ _ ~ % correctly, in the right
       order (backslash FIRST or you'll double-escape).
     - `escapeUrl(str)` for \href targets (different rules — % and # must survive).
     - `escapeList(arr, sep)` convenience.
     THIS IS THE MOST IMPORTANT FUNCTION IN THE CODEBASE. Test it hard:
       * every special char individually and in combination
       * real-world strings: "R&D", "C++", "100% growth", "Node_JS", "A&M",
         "$1.2M ARR", "#1 ranked", "50%+ uplift", "C#", "~/.bashrc"
       * idempotency guard: escaping already-escaped text must not double-escape
       * a property test (fast-check) asserting output always compiles inside a
         minimal document
     Every one of those strings must survive a real Tectonic compile. Write that
     as an integration test.

3. `backend/services/latex/tokens.js` — DesignTokens -> preamble fragments:
   font package selection, geometry margins, \setstretch, titlesec spacing,
   colour definitions, section rule on/off. Pure functions, unit tested.

4. Migrate `backend/models/Resume.js`:
     + content: Object, design: Object, templateId: String,
       mode: { type: String, enum: ['structured','latex'], default: 'structured' },
       latexSource: String   (only meaningful when mode === 'latex')
       parentResumeId: ObjectId (version lineage)
     - keep `latexCode` for now, deprecated; write `scripts/migrateResumesV2.js`
       to backfill existing rows (content <- tailoredData, mode <- 'latex',
       latexSource <- latexCode) and log anything it can't map.

Done when: escape + tokens are fully unit tested, the migration script runs clean
against a seeded local DB, `npm test` passes. No behaviour change to the app yet.
```

---

### M1 — Deterministic template engine (kill LLM-authored LaTeX)

```
Milestone M1. Branch: feat/v2-template-engine. This is the heart of the rebuild.

1. `backend/services/latex/templates/jake.js`
   Port the Jake Gutierrez / sb2nov template (I use it in Overleaf; it's the
   canonical CS resume template). Preamble packages: latexsym, titlesec,
   marvosym, color, verbatim, enumitem, hyperref, fancyhdr, babel, tabularx,
   fontawesome5, multicol, glyphtounicode.
   IMPORTANT: use `geometry` directly, NOT `fullpage`. `latexService.js`
   currently string-replaces fullpage->geometry at compile time (a bandaid) —
   fix it at the source and delete that replace.
   Must support ALL MasterProfile sections including customSections, and honour
   design.sectionOrder / hiddenSections / sectionTitles.

2. `backend/services/latex/templates/sheets.js`
   Clone the SheetsResume format: single column, Garamond default, ATS-first,
   standardised section headings with a horizontal rule, no columns, no colour.
   This is the "safe default" template and should be the app's default.

3. `backend/services/latex/templates/compact.js` and `modern.js`.

4. `backend/services/latex/render.js`
     render(content, design, templateId) -> string
   Pure. Synchronous. No I/O, no network, no LLM, no Date.now(), no randomness.
   Same input MUST always produce byte-identical output — assert this in a test.

5. DELETE `generateLatex()` from `backend/services/geminiService.js`.
   Rewrite `resumeController.createResumeForJob`:
     tailorResume(profile, jd)  ->  content JSON     [Gemini, JSON->JSON only]
     render(content, design, templateId)  ->  .tex   [pure, deterministic]
     save { content, design, templateId, mode:'structured' }
   Keep the existing quota reserve/refund semantics exactly as they are.

6. Re-point `frontend/app/resumes/generateDocx.ts` at `content` + `design` so
   PDF and DOCX render from the same IR. Add a test asserting both outputs
   contain the same set of bullet strings for a fixture profile.

7. Tests (the regression net for everything downstream):
     - snapshot: fixture profile × 4 templates × 3 design variants -> .tex
     - integration: every one of those snapshots COMPILES under Tectonic
     - determinism: render() called twice returns identical bytes
     - a profile whose every field contains LaTeX special chars still compiles

Done when: no code path anywhere can produce LaTeX from an LLM, and the four
templates compile from a fixture profile in CI.
```

---

### M2 — Compile infrastructure

```
Milestone M2. Branch: feat/v2-compile-infra. Make compiles fast, safe, cheap.

1. `backend/Dockerfile`: PRE-BAKE THE TECTONIC PACKAGE CACHE at image build time
   — compile a fixture doc using the union of all packages across the 4
   templates, so the cache is warm in the image. Today Tectonic fetches packages
   over the network at request time with a 30s timeout, which makes the first
   compile on a cold Fly.io machine slow and flaky. Verify with a cold-container
   timing test and report before/after numbers.

2. Redis-backed compile cache: sha256(tex) -> pdf, TTL 24h. Reuse the existing
   Redis connection from `config/rateLimitStore.js`. Design-token tweaks and
   undo/redo become instant. Report the cache hit rate on a realistic edit session.

3. Rate limiting (this is a real bug today):
     - Move `/api/resumes/compile` OFF `aiLimiter` — it is not an AI route, and
       60/15min combined with a 1s keystroke debounce locks users out of their
       own document mid-edit.
     - New `compileLimiter`: 300 / 15min. Cache hits must NOT count against it.

4. Auth on compile:
     - mode 'structured' -> LaTeX is server-rendered from our own templates:
       trusted input, guests allowed (keep the current guest flow).
     - mode 'latex' / raw client-supplied LaTeX -> require `requireAuth`.
       Rationale: latexService's own comments concede the \input block isn't
       airtight and Tectonic isn't filesystem-sandboxed.
     - Keep the existing DANGEROUS_LATEX_PATTERN / csname checks; do not weaken
       them. Add a test for each documented bypass.

5. `parseLatexErrors` -> return STRUCTURED errors:
     { line: number, severity: 'error'|'warning', message: string, context: string }[]
   so the UI can render an Overleaf-style badge count and gutter markers. Unit
   test against 3 real Tectonic log fixtures (undefined control sequence,
   missing $, overfull hbox).

6. Frontend `useResumeGeneration.ts`:
     - AbortController; cancel in-flight compile when a new one starts
     - debounce 800ms
     - `autoCompile` toggle (default on), persisted to localStorage
     - never let an older response overwrite a newer preview (guard on a request id)

Done when: a cold container's first compile is <2s, an edit session of 5 minutes
never hits a rate limit, and errors carry line numbers.
```

---

### M3 — Overleaf shell (Code | Visual)

```
Milestone M3. Branch: feat/v2-workspace. The chrome. Reference: the Overleaf
screenshot in docs/ — match its information architecture, not its visual style.

`frontend/app/resumes/` — new `ResumeWorkspace` three-pane layout:
  LEFT   rail: section outline + version list (collapsible)
  CENTER: Visual editor OR Monaco code editor (the toggle switches this pane)
  RIGHT : PDF preview
  Draggable dividers, widths persisted to localStorage.

Top bar:
  [ Code | Visual ] toggle  ·  Recompile (+ auto-compile dropdown)  ·
  error badge with count (red, like Overleaf's)  ·  page nav (1/2)  ·
  zoom  ·  Download ▾ (PDF / DOCX / .tex)

- OUTLINE PANEL driven off `design.sectionOrder`: lists Work Experience,
  Education, Projects, Technical Skills, Certifications, etc. Clicking a section
  scrolls BOTH the editor and the PDF preview to it. (MasterProfile's keys give
  you this almost for free — don't over-engineer it.)
- `PdfPane`: page nav, zoom, fit-width, and PRESERVE SCROLL POSITION ACROSS
  RECOMPILES. This is the single detail that makes live preview feel good rather
  than nauseating. Do not skip it.
- Code mode: Monaco with a real LaTeX tokenizer (not `defaultLanguage="latex"`,
  which Monaco doesn't ship), error markers in the gutter from M2's structured
  errors, Cmd/Ctrl+S = recompile.
- In `mode: 'structured'`, the code pane is READ-ONLY with a banner:
  "This LaTeX is generated from your content. Eject to edit it directly."

Done when: I can drive the whole existing flow through the new workspace, and
switching Code/Visual never loses state or triggers a spurious recompile.
```

---

### M4 — Visual editor (the SheetsResume experience)

```
Milestone M4. Branch: feat/v2-visual-editor. This is where the product is won.

Guided, section-by-section form in the center pane. Live PDF on the right. The
user NEVER sees LaTeX.

1. Section forms for every MasterProfile section, incl. customSections.
   Drag-to-reorder sections AND bullets. Toggle section visibility. Rename
   section headings inline. All of it writes to `content` / `design.*` and
   triggers a debounced recompile.

2. PER-BULLET AI SUGGESTIONS (Sheets' single best interaction — copy it closely):
   hover a bullet -> ✨ button -> Gemini returns 3 rewrites -> accept / regenerate
   / dismiss, with the diff highlighted. New geminiService method:
     rewriteBullet(bullet, roleContext, jd?) -> string[3]
   Must respect the existing quota reserve/refund pattern. Batch where possible.

3. BULLET COACH (Sheets' "Work Experience Assistant"): for a thin bullet, Gemini
   asks a follow-up question ("What was the scale? Any measurable outcome? Which
   tools did you use?"), then drafts a stronger STAR-style bullet from the answer.
   Small chat affordance inside the experience card, not a separate page.

4. JOB TITLE SUGGESTIONS per role against the target JD:
     suggestTitles(role, jd) -> string[]
   Show them as chips. Include the honesty guardrail in the prompt: suggest only
   truthful variants of the same role, never inflate seniority.

5. JD-MATCH PANEL — reuse the existing `getRecommendations`. Show score, missing
   keywords, and a one-click "weave this keyword into a bullet" action.

6. PAGE-COUNT METER: after each compile, read the real page count from the PDF
   and show "2 pages — trim ~4 bullets to fit 1 page." Use the ACTUAL compiled
   page count. Do not estimate from character counts; we have a real compiler,
   which is exactly the advantage the competition doesn't have.

Done when: I can build a resume start to finish, tailor it to a JD, and polish
every bullet with AI — without ever seeing a backslash.
```

---

### M5 — Customization panel + eject + versions

```
Milestone M5. Branch: feat/v2-customization. The differentiator vs SheetsResume.

Context: every review of SheetsResume names the same weakness — one template, no
layout control, "leaves real work on the table" for senior candidates. We have a
LaTeX compiler. This milestone is the answer to that.

1. DESIGN PANEL — every DesignTokens field, live:
   font (Garamond / Times / Arial / Georgia / Verdana / Charter / Fira Sans /
   Source Sans Pro), font size, margins, line spacing, section spacing, accent
   colour (with a "none — pure B/W" default), section rule on/off, bullet char,
   date format, link style (hyperlink / plaintext / fontawesome icons), 1 or 2
   columns, header style.
   Every change re-renders + recompiles. With M2's cache this should feel instant
   — if it doesn't, fix the cache before shipping this.

2. TEMPLATE GALLERY with live thumbnails rendered from THE USER'S OWN CONTENT,
   not stock previews. (Render each template at low DPI, cache by
   contentHash+templateId.) Nobody else does this and it's obviously better.

3. ATS-SAFETY LINTER: warn when 2-column + photo + heavy colour are combined,
   explain the tradeoff in one sentence, and DO NOT BLOCK IT. Inform, don't
   nanny.

4. EJECT TO LATEX (the one-way door):
     - Confirm modal, plain language: "You'll be editing LaTeX directly. The
       visual editor and AI tailoring won't be available for this version. Your
       structured version is kept — you can revert anytime."
     - Sets mode:'latex', freezes latexSource, disables Visual tab + AI
       re-tailoring for that resume.
     - "Revert to structured" restores content/design and discards LaTeX edits,
       with a clear warning. Nothing is silently lost.

5. VERSION TREE: duplicate, rename, diff two versions side by side (content-level
   diff, not .tex diff), "tailor this version for a new JD" (which forks it via
   parentResumeId).

Done when: I can produce visibly different, ATS-clean resumes for a startup role
vs a FAANG role from the same master profile, in under a minute each.
```

---

## §C — Guardrails to repeat if Claude Code drifts

Paste these verbatim if you see the failure mode:

- *"You're about to have an LLM produce LaTeX. Stop. Gemini does JSON→JSON only. `render()` is pure and deterministic."*
- *"You're writing a LaTeX parser. Stop — read §3 of docs/V2_PLAN.md. Hand-edited LaTeX is a one-way door, not a round trip."*
- *"That template interpolates a user string directly. Every user string goes through `escapeLatex()`. No exceptions."*
- *"Don't touch auth/quota/rate-limit-store. They work and they're tested."*
- *"Ship the milestone. Don't start the next one until I've merged this."*
