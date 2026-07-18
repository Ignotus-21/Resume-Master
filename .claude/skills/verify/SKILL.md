---
name: verify
description: How to launch and drive Resume Master locally to verify changes end-to-end (backend API, frontend UI via headless Chrome).
---

# Verifying Resume Master changes

## Launch

- Backend: `cd backend && node server.js` — listens on 5000 (uses `backend/.env`:
  real MONGO_URI Atlas + working GEMINI_API_KEY are present). Listens BEFORE
  the DB connects, so give it ~3s before writes will succeed.
- Frontend: `cd frontend && npx next dev` — port 3000, proxies `/api/*` to
  `http://localhost:5000` (next.config.ts rewrite). Ready in ~2s, first page
  compile ~10s.
- Guests work without login: `identify` middleware assigns a cookie identity.
  All data (profile, jobs, resumes) is owner-scoped to that cookie, so API
  seeding and browser driving must share cookies.

## Driving the UI headlessly

No Playwright in the repo (deliberate). Use `puppeteer-core` (npm i in the
session scratchpad) with installed Chrome at
`C:/Program Files/Google/Chrome/Application/chrome.exe`, headless 'new', and a
persistent `userDataDir` so cookies survive browser restarts (needed for
close-tab/reopen flows).

- Seed data from INSIDE the page (`page.evaluate(fetch(...))`) so the guest
  cookie matches: POST `/api/master` (profile), POST `/api/jobs`, POST
  `/api/resumes/generate` (real Gemini call, ~10s).
- Open a resume: on /resumes the placeholder lists versions as
  `button[title="<versionName>"]`; same selector in the workspace's left rail.
- The autosave chip lives in the top bar; find it by scanning button text for
  'Saved' / 'Unsaved changes' / 'Saving…' / 'Save failed, retrying…' /
  'Save failed, retry'.
- Count network saves with `page.on('request')` filtering PUT `/api/resumes/`.
- Backend PUT/GET evidence: morgan logs every request to the backend's stdout.

## Gotchas

- Tectonic is NOT installed on this machine's PATH: the PDF pane shows
  "spawn tectonic ENOENT" for every compile. Ignore for non-compile
  verification; compile verification needs the downloaded binary (see
  pipeline-proof notes) or the Docker image.
- Headless `browser.close()` bypasses beforeunload, so unsaved-changes
  prompts can't be observed headlessly.
- For offline/retry probes, sync via a marker file the orchestrator touches
  after actually killing the backend — sleep-based timing races and produces
  false results.
- Gemini quota: guests share an IP-derived 4h window; heavy AI driving can
  exhaust it (429 QUOTA_EXCEEDED).
