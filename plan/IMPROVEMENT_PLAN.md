# Resume Master — Improvement & Deployment Plan

_A roadmap for UI, UX, feature, and security improvements, plus a fully free-tier deployment strategy._

---

## 0. Current State (what already exists)

Resume Master is a full-stack AI resume platform. It is **already fairly mature** — the review below builds on a solid base, it is not a rescue.

**Stack**
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind v4, framer-motion, lucide-react.
- **Backend:** Express 5, Mongoose 9 (MongoDB), Google Gemini, JWT-in-httpOnly-cookie auth.
- **PDF:** LaTeX compiled server-side.
- **Extras:** Resend email (verify + reset), Cloudflare Turnstile CAPTCHA, Google OAuth, guest→user data migration, token-based quota system, admin dashboard.

**Features already shipped:** master profile + PDF resume ingestion, job tracker, AI resume tailoring, ATS/match scoring, cover letters, interview prep, LinkedIn optimizer, AI chat, per-account & per-IP token quotas, BYOK (bring-your-own Gemini key), admin token controls.

**Security already done well** (credit where due):
- NoSQL-injection stripping of `$`/dotted keys on body **and** query (`middleware/sanitize.js`).
- Ownership scoping on every resource via `req.identity` — no IDOR in `jobController`/`aiController`/etc.
- `helmet`, tiered rate limits (general / AI / auth), bcrypt cost 12, hashed email-verify & reset tokens, account-enumeration-safe password reset, Google token `email_verified` check before account linking.
- LaTeX compiled with no shell escape, size caps, per-job UUID temp dirs, non-root Docker user.
- IP-keyed guest quota so rotating the `guestId` cookie can't reset free usage.

---

## 1. 🔴 CRITICAL — Deploy blockers & correctness bugs (fix first)

These will break the app in production **today**. They gate everything else.

| # | Issue | Evidence | Fix |
|---|-------|----------|-----|
| C1 | **PDF compilation will fail in prod.** Code shells out to `tectonic`, but the Docker image installs `texlive`/`pdflatex` and never installs tectonic. | `backend/services/latexService.js:55` calls `execFilePromise('tectonic', …)`; `backend/Dockerfile:9-14` installs only `texlive-*`. | Pick one engine. **Recommended: keep `tectonic`** (auto-downloads packages → smaller image, handles `titlesec`/`fontawesome` on the fly). Replace the `texlive` apt block with a tectonic install, or revert the code to `pdflatex`. Update `DEPLOY.md` to match. |
| C2 | **Hardcoded model `gemini-3.5-flash` — likely an invalid model ID**, which would make every AI call 404/400. | `backend/services/geminiService.js:4`, `backend/controllers/aiController.js:7`. | Verify against the current Gemini model list and move the name to an env var (`GEMINI_MODEL`) so it can be changed without a redeploy. Use a valid current flash model. |
| C3 | **Docs drift.** `DEPLOY.md` still describes `pdflatex`/`texlive` and Railway-specifics that no longer match the code. | `DEPLOY.md` vs `latexService.js`. | Rewrite deploy docs after C1 (see §7). |
| C4 | **Leftover migration/utility scripts committed at repo root.** `theme-migrator.js`, `theme-migrator-2.js`, `update_controllers.js`, `process_icon.js` are one-off tools sitting in the repo root. | root listing | Move to `/scripts` or delete. Keeps the root clean and avoids confusion. |

---

## 2. 🔐 Security improvements

Ordered by risk. The base is good; these are the meaningful gaps.

### High
1. **CSRF protection.** Auth is a cookie (`token`) sent with `SameSite=None` in the cross-domain (Vercel + Railway) setup. CORS + JSON-preflight is the only thing standing between you and cross-site state changes — fragile. **Options (pick one):**
   - **Best:** deploy frontend and backend on the **same site** (e.g. `app.example.com` + `api.example.com` behind one domain, or Next.js `rewrites` proxying `/api/*` to the backend) so the cookie can be `SameSite=Lax` and CSRF largely evaporates. This also removes the `COOKIE_SAMESITE_NONE` foot-gun.
   - **Or:** add the double-submit CSRF token pattern (`csrf` cookie + `X-CSRF-Token` header checked on all mutating routes).
2. **Enforce email verification** for sensitive/expensive actions. Right now `emailVerified` is tracked and a banner is shown, but unverified accounts appear to retain full access — free AI tokens can be farmed with throwaway emails. Gate AI generation (or reduce quota) until verified.
3. **Password strength + breach check.** Only `length >= 8` is enforced. Add a zxcvbn-style strength meter (frontend) and reject the most common passwords (backend).
4. **Prompt-injection hardening.** Resume/JD/chat text is user-controlled and flows straight into Gemini prompts (`geminiService.js`). Add explicit delimiters and a system instruction that untrusted content cannot override instructions; never reflect model output into privileged actions.

### Medium
5. **Security headers beyond helmet defaults:** set an explicit **Content-Security-Policy**, `Referrer-Policy`, and HSTS (helmet defaults are minimal for an API + SPA). Add CSP on the Next.js side too.
6. **JWT sessions can't be revoked.** A 7-day JWT stays valid after logout/password-reset (logout only clears the cookie client-side). Add a `tokenVersion` on the user, bump it on password reset / "log out everywhere", and check it in `identify`.
7. **Rate-limit store.** `express-rate-limit` uses in-memory state by default — resets on every deploy and is per-instance. Back it with MongoDB or Upstash Redis (free tier) so limits actually hold.
8. **Uploaded-PDF handling.** `multer` stores to disk with `dest`; ensure files are deleted after parsing (verify `masterController.uploadResume` cleans up) and consider `pdf-parse` DoS limits (large/malicious PDFs).
9. **Account lockout / progressive delays** on repeated failed logins (beyond the 20/15min IP limit) to blunt credential stuffing on a single account.

### Low / hygiene
10. Dependency scanning (`npm audit` in CI, Dependabot).
11. Structured logging without PII; today `console.error(err)` may leak stack/user data in prod logs.
12. Add `helmet`'s `crossOriginResourcePolicy` config appropriate for cross-origin PDF downloads.

---

## 3. 🎨 UI improvements

The current design is a clean Google-palette light theme with framer-motion polish. Gaps:

1. **Dark mode.** `globals.css` defines only light `:root` tokens — yet the scrollbar thumb is a dark slate (`#475569`) and the dashboard loading skeleton uses `bg-slate-800/40`, so there are **leftover dark-theme fragments on a light background**. Either commit to light-only (remove the slate leftovers) or — better — add a proper `prefers-color-scheme` + toggle dark theme using the existing CSS variables.
2. **Design-token consistency.** Colors are hardcoded as hex literals throughout components (`text-[#202124]`, `bg-[#1a73e8]`, …) instead of the CSS variables already defined. Migrate to the tokens (or Tailwind theme extension) so a palette change is one edit, not a repo-wide find/replace (the presence of `theme-migrator.js` suggests this pain is already felt).
3. **Component library depth.** There's a small `ui/` kit (Button, Card, Badge, Toast, Spinner, EmptyState). Extend with shared `Input`, `Textarea`, `Select`, `Modal`, `Dropdown` — right now inputs are re-styled inline on every page (see the dashboard form), which is a lot of duplicated Tailwind.
4. **Loading & skeleton states** standardized across pages (dashboard has skeletons; verify resumes/cover-letters/interview do too).
5. **Responsive audit** of the resume preview/print view and admin tables on mobile.
6. **Empty-state + first-run polish** — great `EmptyState` component exists; make sure every list route uses it.

---

## 4. 🧭 UX improvements

1. **Guided onboarding.** First action should funnel to "upload your resume / paste your profile" → the whole product depends on the master profile existing. Add a first-run checklist or wizard.
2. **Show quota clearly & proactively.** A `QuotaModal` fires on 429, but users should see remaining tokens **before** they hit the wall (a header pill / progress bar), plus a clear BYOK upsell ("add your own key for unlimited").
3. **Autosave + unsaved-changes guards** on the master profile and resume editors.
4. **Optimistic UI** for job status changes (dashboard currently refetches all jobs on every status change — laggy at scale; update locally then reconcile).
5. **Better AI feedback loops:** streaming responses for chat and long generations (spinner-only waits feel broken on 10–20s LaTeX/tailor calls); show token cost per action.
6. **`confirm()` dialogs** (e.g. delete job) should become the styled `Modal` for consistency and accessibility.
7. **Accessibility pass:** focus traps in modals, ARIA labels on icon-only buttons (some exist), color-contrast check on the grey-on-grey text (`#5f6368` on `#f8f9fa`), keyboard nav for the status dropdowns.
8. **Resume versioning / history** — let users see and restore previous generated versions per job.
9. **Diff/preview before download** — show the tailored resume vs. master so users trust the AI didn't drop content (the prompts already fight this; surface it).

---

## 5. 🚀 Feature roadmap

**Quick wins**
- Export to **DOCX** (deps `docx` + `html-docx-js-typescript` are already installed but appear underused) in addition to PDF.
- **Multiple resume templates/themes** (the LaTeX is AI-generated per call — offer 2–3 curated styles for consistency and speed, and to reduce token spend).
- **Public share link** for a generated resume (read-only, expiring token).
- **Application analytics** — there's an `/analytics` page; wire funnel metrics (apps per status, response rate, time-to-interview).

**Medium**
- **Chrome extension / bookmarklet** to capture a job posting → auto-create a job + JD.
- **Browser-based ATS keyword highlighter** on the JD.
- **Email/reminder nudges** ("follow up on X, applied 7 days ago") — Resend is already wired.
- **Cover letter & interview history** browsing/reuse.

**Larger**
- **Team/coach mode** (share profile with a mentor for feedback).
- **Job board integrations** (LinkedIn/Indeed import).
- **Multi-language resumes.**

---

## 6. ✅ Testing, CI & DevEx

- Backend already has a **strong Jest/supertest suite** (auth, crypto, rateLimit, quota, sanitize, security hardening, uploads, interview, coverLetter…). Keep it green in CI.
- **Add a GitHub Actions workflow** (free for public/limited private minutes): `npm ci && npm test` for backend, `npm run build && npm run lint` for frontend, on every PR.
- **No frontend tests yet** — add Playwright smoke tests (login, add job, generate resume) — free, and Chromium is available.
- Add **Dependabot** + `npm audit` gate.
- Add a `.env.example` completeness check so deploys don't miss a var.

---

## 7. ☁️ Deployment plan — 100% free tier

Goal: get the whole stack live at $0/month, with an architecture that also fixes the CSRF/cookie fragility (§2.1).

### 7.1 Component → free host mapping

| Piece | Recommended free host | Free-tier notes | Why |
|-------|----------------------|-----------------|-----|
| **Frontend (Next.js)** | **Vercel Hobby** | Unlimited-ish personal projects, HTTPS, CDN, preview deploys | First-class Next.js support |
| **Backend (Express + LaTeX)** | **Render** free web service, **or Fly.io** free allowance, **or Railway** trial | Needs a Docker container (system binary for LaTeX). Render free **sleeps after 15 min idle** (cold starts); Fly.io keeps a small always-on VM in free allowance | Serverless (Vercel funcs) **cannot** run because you need a persistent process + a LaTeX/tectonic binary |
| **Database** | **MongoDB Atlas M0** | 512 MB, shared, free forever | Managed, matches Mongoose |
| **Email** | **Resend free** | 3,000 emails/mo, 100/day | Already integrated |
| **CAPTCHA** | **Cloudflare Turnstile** | Free, unlimited | Already integrated |
| **Auth (optional)** | **Google OAuth** | Free | Already integrated |
| **Rate-limit / cache store (optional)** | **Upstash Redis free** | 10k cmd/day | Fixes §2.7 |
| **CI** | **GitHub Actions** | Free minutes | §6 |
| **File uploads** | Ephemeral disk on the backend container is fine (PDFs are parsed then discarded) | No S3 needed | Keep it free |

> **Recommendation:** **Vercel (frontend) + Fly.io (backend) + Atlas (DB)** is the most robust $0 combo, because Fly.io avoids Render's cold-start sleep. If cold starts are acceptable, Render is the simplest.

### 7.2 Architecture decision that kills the CSRF/cookie pain

Instead of `frontend.vercel.app` calling `backend.fly.dev` cross-site (which forces `SameSite=None` cookies), **proxy the API through the frontend origin**:

- Add a Next.js rewrite: `/api/:path*` → `https://<backend-host>/api/:path*` (`next.config.ts`).
- Now the browser talks only to the Vercel origin → cookie can be `SameSite=Lax`, `COOKIE_SAMESITE_NONE` stays off, and CSRF surface shrinks dramatically.
- Set `NEXT_PUBLIC_API_URL=""` (same-origin) so `apiFetch` hits `/api/...` on Vercel.

This is free, and it's the single highest-leverage deployment change.

### 7.3 Step-by-step

**1. MongoDB Atlas**
1. Create free **M0** cluster, a DB user, network access (start `0.0.0.0/0`, tighten later).
2. Copy the SRV connection string → `MONGO_URI`.

**2. Backend → Fly.io (or Render)**
1. Fix **C1 first** (tectonic vs texlive) — the image must actually contain the LaTeX engine the code calls.
2. `fly launch` from `backend/` (uses the Dockerfile). Pick a region near Atlas.
3. Set secrets (`fly secrets set …` / Render env):
   - `MONGO_URI`, `JWT_SECRET`, `ENCRYPTION_KEY` (generate per `.env.example`), `GEMINI_API_KEY`, `GEMINI_MODEL`
   - `CORS_ORIGIN=https://<your-vercel-domain>` (still set, for direct calls / preflight)
   - `APP_URL=https://<your-vercel-domain>` (email links)
   - `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`
   - With the §7.2 proxy you can **omit** `COOKIE_SAMESITE_NONE`.
4. Note the backend URL, e.g. `https://resume-backend.fly.dev`.

**3. Frontend → Vercel**
1. Import repo, root directory `frontend/`.
2. Add the `/api/*` rewrite pointing at the backend URL (§7.2).
3. Env: `NEXT_PUBLIC_API_URL=` (empty for same-origin) or the backend URL if you skip the proxy; plus optional `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
4. Deploy.

**4. Wire-up & verify**
- Update Google OAuth authorized origins + Turnstile allowed domains to the Vercel domain.
- Smoke test: signup → verify email → upload resume → add job → generate & **download PDF** (this is the C1 canary) → AI chat.

**5. Free-tier hardening**
- Keep the backend warm on Render with a free cron pinger (e.g. GitHub Actions scheduled `curl`) if cold starts hurt — or use Fly.io to avoid the issue.
- Atlas M0 is 512 MB: add TTL indexes on `ActiveSession` / old `ApiUsage` / `ChatSession` to auto-expire and stay under quota.
- Set an Atlas alert near the storage cap.

### 7.4 Cost ceiling
Everything above is $0/month within free limits. The only spend risk is **Gemini API usage** — which is exactly why the token-quota + BYOK system already exists. Keep guest limits conservative and require email verification (§2.2) to prevent free-token farming.

---

## 8. Suggested execution order

1. **Phase 0 (blockers):** C1 tectonic/Docker fix, C2 model-id/env, C3 docs, C4 root cleanup. → deployable.
2. **Phase 1 (deploy):** ship via §7 with the same-origin proxy (§7.2). Add GitHub Actions CI (§6).
3. **Phase 2 (security):** email-verification gate (2.2), persistent rate-limit store (2.7), CSP/HSTS (2.5), JWT revocation (2.6).
4. **Phase 3 (UX/UI):** design tokens + dark mode (3.1/3.2), quota visibility (4.2), onboarding wizard (4.1), shared form components (3.3).
5. **Phase 4 (features):** DOCX export, curated templates, share links, analytics wiring.

---

_This is a planning document only — no application code was changed._
