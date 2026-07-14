# Resume Master

A full-stack app for managing a "master" career profile and generating tailored,
ATS-optimized resumes as real LaTeX-compiled PDFs — with a visual editor, AI
tailoring, and a job-application tracker, all built around a single Gemini
integration.

## Features

**Master Profile** — one canonical record of your experience, education,
projects, skills, certificates, achievements, publications, volunteering,
patents, hobbies, and custom sections. Fill it in by hand, paste raw text, or
import an existing **PDF or DOCX** resume (local text extraction + magic-byte
file validation, then Gemini structures it for review before saving).

**Resume Workspace** (`/resumes`) — a three-pane editor per tailored resume:
- **Visual editor** for structured content, or **eject to hand-edited LaTeX**
  for full control (one-way per version; revert discards LaTeX edits).
- **4 templates** (`sheets`, `jake`, `compact`, `modern`) with independently
  tunable design tokens — font, size, section spacing, header style, section
  rules, bullet character, date format, link style, columns.
- **Live PDF preview** via a cached LaTeX→PDF compile pipeline (Tectonic).
- **Debounced autosave** with retry/backoff and conflict detection: a save is
  rejected atomically (409) if the resume changed elsewhere since you loaded
  it, instead of silently overwriting.
- **Version duplication** and a **structured + word-level diff view** to
  compare versions.
- Export to PDF or DOCX.

**AI tools (Gemini)** — tailor a resume to a pasted or saved job description,
rewrite individual bullets, suggest resume titles, get bullet-writing
coaching, and a context-aware chat. Guests get a shared free-tier quota;
registered users can add their own Gemini API key.

**Job Tracker** (`/dashboard`) — CRUD for job applications, linked to the
resumes generated for them.

**Cover Letters** (`/cover-letters`) and **Interview Prep** (`/interview`) —
generated from your master profile and a target job description.

**Also included**: an ATS-checker (`/ats-checker`), a LinkedIn-summary
rewriter (`/linkedin`), a usage/metrics dashboard (`/analytics`), and an admin
console (`/admin`) for quota/token configuration.

**Auth** — email/password with email verification and password reset, plus
optional "Continue with Google". Guests can use the app anonymously; signing
up migrates their guest-owned data onto the new account.

## Architecture

| Piece | Stack |
|---|---|
| Frontend | Next.js (App Router, React), Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| PDF rendering | [Tectonic](https://tectonic-typesetting.github.io/) (self-contained LaTeX engine), invoked from `backend/services/latexService.js` |
| AI | Google Gemini (`@google/generative-ai`), JSON-schema-constrained responses |
| Rate limiting / compile cache | In-memory by default; Redis (`ioredis` + `rate-limit-redis`) when `REDIS_URL` is set, shared across both |

A resume document is `{ content, design, templateId, mode }`; LaTeX is
generated deterministically from those three (`backend/shared/resume.js` is
the canonical schema/validation, mirrored in
`frontend/lib/resumeSchema.ts`). LaTeX source is only *stored* when a resume
is ejected to hand-edited mode — otherwise it's always derived on read.

## Getting Started

### 1. Database

```bash
# From the repo root — copy the env file first (see .env.example)
cp .env.example .env
docker compose up -d mongodb
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in GEMINI_API_KEY, JWT_SECRET, ENCRYPTION_KEY (see comments in the file)
npm run dev             # nodemon, or `npm start` for a plain run
```
The backend also needs a `tectonic` binary on `PATH` to compile PDFs locally
(`backend/Dockerfile` installs a pinned version for containerized runs; for
local dev, install it yourself — see the
[Tectonic install docs](https://tectonic-typesetting.github.io/en-US/install.html)).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000). By default `next.config.ts`
proxies `/api/*` to `http://localhost:5000`; no frontend env vars are required
for local dev (see `frontend/.env.example` for optional ones — Google OAuth,
Turnstile CAPTCHA).

### Tests
```bash
cd backend && npm test    # Jest
cd frontend && npm test   # Vitest
```

## Deploying

See **[DEPLOY.md](./DEPLOY.md)** for a full walkthrough: hosting split
(frontend on Vercel, backend as a Docker container elsewhere — the backend
can't run on serverless functions because of the `tectonic` binary and
persistent process it needs), the complete environment variable reference,
optional Redis/email/CAPTCHA setup, and two options for Google OAuth
(Google Cloud Console directly, or Firebase Authentication as an alternative).

## API Overview

All routes are mounted under `/api`. Auth is a JWT in an httpOnly cookie;
unauthenticated requests are tracked as a guest via a separate cookie so
guest-created data can be claimed on signup.

| Base path | Covers |
|---|---|
| `/api/auth` | signup/login/logout, Google sign-in, email verification, password reset, quota/usage |
| `/api/master` | the master profile — get/update, raw-text ingest, PDF/DOCX upload |
| `/api/jobs` | job-application CRUD |
| `/api/resumes` | generate/list/get/update/delete, duplicate, compile (PDF), feedback |
| `/api/ai` | chat, LinkedIn rewrite, bullet rewrite, title suggestions, bullet coaching |
| `/api/cover-letters` | generate/list/get/update/delete |
| `/api/interview` | start/answer/list/get a mock-interview session |
| `/api/admin` | quota/token config, usage stats (admin-only) |

## Project Structure

```
backend/
  controllers/   route handlers
  routes/        Express routers (one per resource above)
  services/      Gemini integration, LaTeX rendering/compilation, compile cache
  shared/        canonical resume schema + validation (content/design/templates)
  models/        Mongoose schemas
  middleware/    auth identification, rate limiting, upload validation
frontend/
  app/           Next.js routes (one folder per page)
  components/    shared UI, including the resume workspace's editor panels
  lib/           API client, autosave engine, diff utilities, resume schema mirror
```
