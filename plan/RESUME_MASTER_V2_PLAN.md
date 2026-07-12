# Resume Master v2 — Architecture & Build Plan

**Thesis:** SheetsResume's simplicity on the surface. Overleaf's power in the engine.
**Repo:** `Ignotus-21/Resume-Master` @ `bug-fix-1` (reviewed at `568a30b`)

---

## 1. Audit: what's actually there

### The root problem

`backend/services/geminiService.js → generateLatex()` asks Gemini to **author the LaTeX document from scratch** on every generation. `templateStyle` is a string interpolated into the prompt:

> *"TEMPLATE STYLE: Please use the '${templateStyle}' style. If 'modern', make it sleek with sans-serif fonts. If 'compact', optimize spacing heavily."*

There is no template file anywhere in the repo. Commit `568a30b` is titled *"Add SheetsResume templates"* but adds only a `<select>` with three strings in it.

Consequences, all of which are currently live:

| # | Issue | Where | Impact |
|---|---|---|---|
| 1 | LaTeX is non-deterministic | `geminiService.generateLatex` | Same profile → different document every time. "Templates" are unreproducible. |
| 2 | Unbounded `\usepackage` | same | Model can emit any package. Tectonic must fetch it at request time. Compile fails on typos. |
| 3 | No LaTeX escaping anywhere | whole repo | `R&D`, `C++`, `100%`, `Node_JS`, `#1` rely on the model escaping `& % $ # _ { } ~ ^ \`. Eventually it won't. |
| 4 | Editor rate-limits its own user | `useResumeGeneration.ts:53` + `app.js:88` | 1s debounce on every keystroke → compile. `/api/resumes/compile` is behind `aiLimiter` (60 / 15min). ~3 min of editing = locked out of your own document. |
| 5 | No compile cancellation | `useResumeGeneration.handleCompile` | No `AbortController`. Slow response from compile N-1 clobbers the preview from compile N. |
| 6 | Two renderers, two truths | `latexCode` (PDF) vs `tailoredData` (`generateDocx.ts`) | PDF and DOCX are independently authored and will silently diverge. No test covers this. |
| 7 | Unauthenticated compile of arbitrary LaTeX | `routes/resumeRoutes.js:6` | No `requireAuth`. `latexService.js`'s own comments concede the `\input` regex isn't airtight and Tectonic isn't FS-sandboxed. Fine today (LaTeX is generator-authored); a real arbitrary-file-read vector the moment users can type `.tex`. |
| 8 | Tectonic fetches packages at request time | `latexService.js:88` (30s timeout) | No pre-baked cache in `backend/Dockerfile`. Cold start on Fly.io = slow, network-dependent, flaky first compile. |
| 9 | No design/version model | `models/Resume.js` | No `templateId`, no `design`, no lineage. `latexCode` is the only artifact. |
| 10 | `parseLatexErrors` returns a string blob | `latexService.js:150` | Can't map errors to line numbers → no Overleaf-style inline error gutter. |

### What's good and stays

Genuinely solid foundations — do not rewrite these:

- Auth, sessions, token revocation, email verification, password reset (`authController`, 407 LOC, well-tested)
- Quota + reservation/refund accounting (`quotaService`, `geminiGate`, `trackUsage`) — the refund-on-failure pattern is correct
- Redis-backed rate limiting with fail-closed on AI routes (`config/rateLimitStore.js`)
- Turnstile, sanitize middleware, CORS allowlist, Helmet CSP
- 16 backend test files, CI workflow, Dependabot
- `MasterProfile` schema — already rich enough (experience/education/projects/skills/certificates/achievements/publications/volunteering/patents/**customSections**). This is the IR. Keep it.

The backend is well-built. **The rendering layer is the part that's wrong.**

---

## 2. What to steal, and from where

### From SheetsResume (surface, simplicity)

| Feature | Why it works |
|---|---|
| **Per-bullet AI "Quick Suggestions"** | Click a bullet → 3 rewrites → accept/reject inline. AI as a coach, not an author. This is their single best interaction. |
| **Work Experience Assistant** | A chatbot that *asks follow-up questions* to extract scope/metrics/tools you forgot to mention, then drafts the bullet. |
| **Guided section-by-section flow** | Always one obvious next step. In-flow guidance on what to write and what to omit. |
| **Job-title suggestions per role** | AI proposes honest title variants better matched to the target JD. |
| **Multiple entry points** | Start from existing resume / LinkedIn / scratch. |
| **Small set of ATS-safe fonts** | Garamond, Times New Roman, Arial, Verdana, Georgia. Constrained choice ≠ no choice. |
| **Unlimited named versions** | Tailor per application, keep them all. |

### From Overleaf (engine, power)

Straight off the screenshot:

| Feature | Notes |
|---|---|
| **`Code` \| `Visual` toggle** | **This is the whole architecture, not a UI detail.** See §3. |
| **Split pane + draggable divider** | Editor left, PDF right. |
| **Recompile button + auto-compile dropdown** | Explicit control. Solves audit issue #4. |
| **Error/warning badge with count** (the red `4`) | Needs structured errors from `parseLatexErrors`. |
| **File outline panel** | *Work Experience, Education, Projects, Technical Skills, Volunteer Experiences, Certifications* — this is a **section navigator**, and it maps 1:1 onto your `MasterProfile` keys. Free feature. |
| **PDF page nav + zoom** | `1 / 2`, `123%`. |
| **Monaco with LaTeX syntax highlighting** | Already installed (`@monaco-editor/react`), just underused. |
| **SyncTeX-ish click-to-jump** | Stretch goal. |

### What SheetsResume can't do — and you can

Every review of Sheets names the same limitation:

> *"A single clean, ATS-safe template. No room to match it to your career stage."* — Enhancv
> *"For senior professionals who need... layout choices that match seniority, Sheets leaves real work on the table."*

**They have one template and no layout control. You have a LaTeX compiler.** That gap is the product.

---

## 3. The architecture decision

### Single source of truth

```
ResumeDocument {
  content:    ResumeContent   // JSON — the MasterProfile-shaped data (tailored)
  design:     DesignTokens    // JSON — font, size, margins, spacing, order, rules, accent
  templateId: 'jake' | 'sheets' | 'compact' | 'deedy' | ...
  mode:       'structured' | 'latex'
}
```

**LaTeX is a pure, deterministic function — never a stored truth:**

```
render(content, design, templateId) → .tex   (no LLM, no network, no randomness)
```

DOCX and HTML are **sibling renderers of the same IR** — which kills audit issue #6 permanently. Same input, three outputs, one test asserting they carry the same content.

### Gemini's new job description

Gemini **never emits LaTeX again.** It is demoted to JSON→JSON content operations only:

- `tailorContent(content, jd) → content`
- `rewriteBullet(bullet, context, jd) → string[3]`
- `suggestTitles(role, jd) → string[]`
- `scoreAgainstJd(content, jd) → { score, missingKeywords, ... }`
- `interviewBulletCoach(experience) → question` (the Sheets Work Experience Assistant)

Effects: compile success → ~100%. Latency drops (no 2000-token LaTeX generation). Token cost drops. Templates become reproducible. Escaping becomes a tested pure function instead of a prayer.

### "A ton of customization" — without hand-editing LaTeX

This is the key move. Customization is **structured design tokens**, not raw `.tex`:

```ts
DesignTokens {
  font:          'Garamond' | 'TimesNewRoman' | 'Arial' | 'Georgia' | 'Verdana' | 'Charter' | 'FiraSans' | 'SourceSansPro'
  fontSize:      10 | 10.5 | 11 | 12          // pt
  margin:        0.4 – 1.0                     // in
  lineSpacing:   0.9 – 1.3
  sectionSpacing:'tight' | 'normal' | 'airy'
  sectionOrder:  SectionKey[]                  // drag to reorder
  hiddenSections:SectionKey[]
  sectionTitles: Record<SectionKey, string>    // rename "Work Experience" → "Experience"
  accentColor:   hex | null                    // null = pure B/W ATS-safe
  headerStyle:   'centered' | 'left' | 'two-column'
  sectionRule:   'line' | 'none'
  bulletChar:    '•' | '–' | '▪'
  dateFormat:    'MMM YYYY' | 'MM/YYYY' | 'YYYY'
  links:         'hyperlink' | 'plaintext' | 'icons'   // fontawesome5 icons per your Overleaf file
  columns:       1 | 2
  showPhoto:     boolean
}
```

Cross that with 4–5 templates and you have thousands of reproducible variants, **all round-trippable, all ATS-testable, zero parse-back problem.** This is strictly more customization than Sheets offers, delivered with less complexity than raw LaTeX.

### The escape hatch: "Eject to LaTeX" (one-way door)

Parsing arbitrary hand-edited LaTeX back into structured JSON is **not solvable in the general case.** Do not attempt it. Do not let anyone talk you into "just a small parser."

Model it honestly, exactly like CRA/Next `eject`:

- `mode: 'structured'` (default) → Visual editor, all renderers, AI can re-tailor. `latexSource` is derived on the fly and never persisted as truth.
- User clicks **Eject to LaTeX** → confirm modal → `mode: 'latex'`, `latexSource` is frozen into the document, Visual tab and AI re-tailoring are disabled for that resume.
- **Revert to structured** stays available, and plainly warns it discards LaTeX edits (the original `content`/`design` are still there — nothing is lost, the *hand edits* are).
- Copy must be blunt: *"You'll be editing LaTeX directly. The visual editor and AI tailoring won't be available for this version. Your structured version is kept — you can revert anytime."*

Users who eject are ~2% and know exactly what they're doing. Everyone else never sees LaTeX and never has to.

---

## 4. Phased build plan

Each phase is one PR, independently shippable, `main` stays green throughout.

### Phase 0 — Foundations (breaking, do first)
Establish the IR, escaping, and design tokens. No user-visible change yet.

- `shared/types/resume.ts` — `ResumeContent`, `DesignTokens`, `SectionKey`, `TemplateId`, `RenderMode` (single source, imported by both FE and BE)
- `backend/services/latex/escape.js` — `escapeLatex()` handling `\ { } $ & # ^ _ ~ %`, plus URL-safe escaping. **Property-test it.** This is the highest-leverage 30 lines in the codebase.
- `backend/services/latex/tokens.js` — `DesignTokens` → LaTeX preamble fragments (font package, geometry, spacing, colors)
- Migrate `models/Resume.js`: add `content`, `design`, `templateId`, `mode`, `parentResumeId`. Keep `latexCode` as `latexSource` for ejected docs. Back-compat migration script for existing rows.

### Phase 1 — Deterministic template engine
Kill `generateLatex()`.

- `backend/services/latex/templates/jake.js` — port your Overleaf `main.tex` (the sb2nov/Jake Gutierrez template). Preamble: `latexsym, titlesec, marvosym, color, verbatim, enumitem, hyperref, fancyhdr, babel, tabularx, fontawesome5, multicol, glyphtounicode`. **Replace `fullpage` with `geometry` at the source** — `latexService.js` currently string-replaces it at compile time, which is a bandaid.
- `backend/services/latex/templates/sheets.js` — single-column, Garamond, ATS-first, section-header rules. The Sheets clone.
- `backend/services/latex/templates/compact.js`, `modern.js`
- `backend/services/latex/render.js` — `render(content, design, templateId) → string`. Pure. Sync. No I/O.
- **Delete `generateLatex` from `geminiService.js`.** Rewrite `resumeController.createResumeForJob` to: tailor content (Gemini, JSON→JSON) → `render()` → save.
- **Snapshot tests**: fixture profile × 4 templates × 3 design variants → `.tex` snapshots + assert each compiles. This is your regression net forever.
- Re-point `generateDocx.ts` at `content` + `design` so PDF/DOCX share the IR.

### Phase 2 — Compile infrastructure
Make compiles fast, safe, and cheap enough to run on every keystroke.

- **Pre-bake the Tectonic package cache into `backend/Dockerfile`** — compile a fixture doc with the full union of template packages at image build time. Kills cold-start latency and request-time network dependency (audit #8).
- **Content-hash compile cache** (Redis, `sha256(tex) → pdf`, TTL 24h). Design-token tweaks and undo/redo become instant.
- **Move compile off `aiLimiter`** onto its own limiter — it's not an AI route, and the current config actively breaks the editor (audit #4). Cached hits shouldn't count. Suggested: 300 / 15min uncached.
- **`requireAuth` on `/api/resumes/compile`** for `mode: 'latex'` documents. Structured-mode compiles use server-rendered LaTeX (trusted input, guests OK). Raw user LaTeX from an unauthenticated caller → block (audit #7).
- **Structured error parsing**: `parseLatexErrors` returns `{ line, severity, message, context }[]` so the UI can render an Overleaf-style error badge + gutter markers (audit #10).
- Frontend: `AbortController` on in-flight compiles, 800ms debounce, **auto-compile toggle** defaulting on (audit #5).

### Phase 3 — Overleaf shell
The `Code | Visual` chrome.

- `ResumeWorkspace` — three-pane: left rail (section outline / version list), center (Visual **or** Code), right (PDF preview). Draggable dividers, persisted widths.
- Top bar: `Code | Visual` toggle · Recompile + auto-compile dropdown · error badge with count · page nav · zoom · download (PDF/DOCX/TEX).
- **Outline panel** driven off `sectionOrder` — click a section, scroll both editor and preview to it. (Your `MasterProfile` keys give you this nearly for free.)
- `PdfPane`: page nav, zoom, fit-width, and **preserve scroll position across recompiles** — critical, this is what makes live preview feel good instead of nauseating.
- Code mode: Monaco + real LaTeX tokenizer, error markers in the gutter, read-only banner for structured mode ("This is generated. Eject to edit directly.").

### Phase 4 — Visual editor (the Sheets experience)
This is where the product is won.

- Section-by-section guided form, live preview beside it. Never shows LaTeX.
- **Per-bullet AI suggestions**: hover a bullet → ✨ → 3 rewrites → accept / regenerate / dismiss. Diff-highlight the change.
- **Bullet Coach**: for a thin bullet, Gemini asks a follow-up ("What was the scale? Any measurable outcome? Which tools?") and drafts a stronger STAR-style bullet from the answer.
- **Job title suggestions** per role against the target JD.
- **JD-match panel** (you already have `getRecommendations`) — score, missing keywords, one-click "add this keyword to a bullet."
- Drag-to-reorder sections and bullets. Toggle section visibility. Rename section headings.
- Content-length meter: "This will run to 2 pages. Trim ~4 bullets to fit 1." (Compile, count pages, tell the truth — the paid tools mostly guess.)

### Phase 5 — Customization panel + polish
The differentiator against Sheets.

- Design panel: font, size, margins, spacing, accent, rules, bullet char, date format, columns, header style — **every change re-renders and recompiles from cache (instant)**.
- Template gallery with live thumbnails rendered from *the user's own content*, not stock previews.
- **ATS-safety linter**: warn on 2-column + photo + accent colors, explain the tradeoff, don't block it.
- Eject-to-LaTeX flow with the honest modal.
- Version tree: duplicate, name, diff two versions, "tailor this one for a new JD."

---

## 5. Milestone sequencing for Claude Code

Do **not** hand this whole document to Claude Code at once. One PR per phase, in order. Phase 1 must not begin until Phase 0's escaping tests are green — everything downstream is built on that function being correct.

**Definition of done for the whole build:** a user pastes a JD, gets a tailored resume in a proven ATS template, tweaks bullets with AI, reorders sections, switches font and margins, watches the PDF update live, downloads PDF + DOCX — and never sees a backslash. And if they want to, they hit *Code*, and the full LaTeX is right there.
