# Deploying Resume Master

## Architecture

The app is three pieces, plus two optional pieces:

| Piece | What it is | Why it's deployed the way it is |
|---|---|---|
| **Frontend** (`frontend/`) | Next.js (App Router) | Static/SSR app; deploys anywhere Next.js runs. |
| **Backend** (`backend/`) | Express API | Needs the `tectonic` LaTeX binary on `PATH` and a long-lived process, so it **cannot** run on Vercel's serverless functions. Ships as a Docker image (`backend/Dockerfile`) for exactly this reason. |
| **Database** | MongoDB | Stores users, master profiles, jobs, resumes. |
| **Redis** (optional) | Rate-limit store + compile cache | `backend/config/rateLimitStore.js` and `backend/services/compileCache.js` share one `ioredis` connection. Without it, rate limits reset on every restart and the compile cache is in-process memory only — both still work, just not shared across instances/restarts. |
| **Email / CAPTCHA** (optional) | Resend, Cloudflare Turnstile | Verification/reset emails and signup bot protection. The app runs without either — see the section below. |

Recommended free/cheap setup:

| Piece | Host | Notes |
|------|------|-------|
| Frontend (Next.js) | **Vercel** (Hobby, free) | Same as a portfolio deploy |
| Backend (Express + tectonic) | **Railway** (or Render/Fly) via `backend/Dockerfile` | Installs `tectonic` at build time and pre-bakes its package cache (see "What the backend image build does" below); no idle-sleep on Railway |
| Database | **MongoDB Atlas** (M0, free) | 512 MB |
| Redis | **Upstash** (free tier) | Optional; `rediss://` URL |
| Email | **Resend** (free) | Verification + password-reset emails |
| CAPTCHA | **Cloudflare Turnstile** (free) | Signup bot protection |
| OAuth | **Google Cloud Console** OR **Firebase Authentication** | Either issues the Google ID token the backend already verifies — see the OAuth section |

---

## 1. MongoDB Atlas

1. Create a free M0 cluster, a database user, and allow network access (`0.0.0.0/0` to start; tighten to your backend host's static IP/CIDR once known).
2. Copy the connection string → this is `MONGO_URI`.

## 2. Backend → Railway (Docker)

1. New project → **Deploy from GitHub repo** → set the **root directory** to `backend/`.
   Railway builds using `backend/Dockerfile`.

   **What the image build does** (so build times/failures make sense): the
   `Dockerfile` installs a pinned `tectonic` binary (`TECTONIC_VERSION`), then
   runs `scripts/warmTectonicCache.js` at build time, which compiles a fixture
   resume through every template/font/design-variant combination. This
   pre-bakes Tectonic's package cache into the image so the *first real
   request* doesn't pay a slow, flaky, network-bound package fetch — and it
   doubles as a build-time smoke test: if a template stops compiling, the
   image build fails instead of production. Expect the build to take a few
   minutes; this is normal, not a hang.

2. Set environment variables. This table is the full set from
   `backend/.env.example`, grouped by whether the app runs without them:

   **Required:**
   | Variable | Value |
   |---|---|
   | `MONGO_URI` | from Atlas, step 1 |
   | `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — encrypts each user's own Gemini key if they set one |
   | `GEMINI_API_KEY` | your Gemini API key (shared free-tier quota for guests/users without their own key) |
   | `CORS_ORIGIN` | your Vercel URL, e.g. `https://your-app.vercel.app` (comma-separate multiple origins if needed — see `backend/app.js`) |
   | `APP_URL` | same Vercel URL — used to build links in verification/reset emails |
   | `NODE_ENV` | `production` — required for `Secure` auth cookies |
   | `TRUST_PROXY_HOPS` | `2` with the recommended same-origin proxy (client → Vercel → backend host = 2 hops); `1` if the browser calls the backend directly. Getting this wrong either trusts a spoofable `X-Forwarded-For` (too high) or rate-limits/quotas everyone under one IP (too low, e.g. `0` behind a proxy). |

   **Optional (feature stays off/degraded if unset):**
   | Variable | Effect if unset |
   |---|---|
   | `GEMINI_MODEL` | Defaults to `gemini-3.5-flash`. Override to pin a different model without a redeploy. |
   | `SHARED_GEMINI_RATE_WINDOW_HOURS` | Defaults to `6` — the guest/shared-key AI quota window. |
   | `GOOGLE_CLIENT_ID` | "Continue with Google" is hidden; email/password auth still works. See the OAuth section. |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Verification/reset emails are logged to the backend console instead of sent — fine for a first deploy, not for real users. |
   | `TURNSTILE_SECRET_KEY` | Signup CAPTCHA is skipped. |
   | `REDIS_URL` (or `UPSTASH_REDIS_URL`) | Rate limits reset on restart and aren't shared across instances; compile cache is in-process memory only. Both degrade gracefully, they don't break. |
   | `COOKIE_SAMESITE_NONE` | Leave `false` (or unset) with the recommended proxy setup. Only `true` if the frontend calls the backend cross-domain directly — see "Wire the two together" below. |

3. Deploy. Note the public backend URL, e.g. `https://your-backend.up.railway.app`.

## 3. Frontend → Vercel

1. Import the repo, set the **root directory** to `frontend/`.
2. Environment variables:
   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | your backend URL from step 2.3 — `next.config.ts` proxies `/api/*` there, so the browser only ever talks to the Vercel origin |
   | `NEXT_PUBLIC_API_URL` | leave **unset/empty** (same-origin via the proxy) |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | optional, must match the backend's `GOOGLE_CLIENT_ID` — see OAuth section |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | optional, pairs with the backend's `TURNSTILE_SECRET_KEY` |
3. Deploy.

## 4. Wire the two together

- With the proxy (recommended) the auth cookie stays `SameSite=Lax` and no
  cross-site cookie setup is needed. **Verify login works through the proxy**:
  open the Vercel URL, sign up/log in, and confirm the `token` cookie is set on
  the Vercel domain and `/api/auth/me` returns your user.
- Only if you skip the proxy and set `NEXT_PUBLIC_API_URL` to the backend URL
  directly: set `COOKIE_SAMESITE_NONE=true` on the backend (cross-domain
  cookies need `SameSite=None; Secure`, both sides HTTPS) and make backend
  `CORS_ORIGIN` exactly equal the Vercel origin (scheme + host, no trailing
  slash). This path is more fragile (CSRF surface, third-party-cookie
  restrictions) — prefer the proxy.
- Update Google OAuth authorized origins and Turnstile allowed domains to include
  the Vercel domain.

---

## 5. OAuth ("Continue with Google")

`GOOGLE_CLIENT_ID` (backend) / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) is the
**only** thing that turns Google sign-in on. Both must be the same OAuth 2.0
**Web client ID**. There are two ways to get one — pick whichever you're more
comfortable operating. Both feed the exact same backend code path, so you can
switch later without a schema or code change.

How the flow works today, for context: `frontend/components/GoogleSignInButton.tsx`
loads Google Identity Services (`accounts.google.com/gsi/client`) and renders
the official Google button. On success it hands a Google-issued **ID token**
(a JWT) to `POST /api/auth/google`, and `backend/controllers/authController.js`
verifies it with `google-auth-library`'s `OAuth2Client.verifyIdToken()`,
checking the token's audience against `GOOGLE_CLIENT_ID` and requiring
`email_verified: true` before linking/creating the account. No Google secret
ever touches the backend — only the public client ID.

### Option A — Google Cloud Console directly (fewer moving parts)

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials),
   create a project if you don't have one.
2. **OAuth consent screen**: set it up as "External", add your app name and
   support email. You don't need to submit for verification for personal/small
   use — Google just shows an "unverified app" warning to users until you do.
3. **Create Credentials → OAuth client ID → Web application.**
   - **Authorized JavaScript origins**: your Vercel URL
     (`https://your-app.vercel.app`) and `http://localhost:3000` for local dev.
   - **Authorized redirect URIs**: not needed — Google Identity Services'
     token-based flow doesn't redirect.
4. Copy the generated **Client ID** into `GOOGLE_CLIENT_ID` (backend) and
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend). Ignore the client secret — this
   app never uses it.

### Option B — Firebase Authentication (if you'd rather manage sign-in from Firebase)

Firebase is a reasonable alternative when you already run other Firebase
services, want its user-management console, or plan to add more sign-in
providers later. Under the hood, Firebase's Google provider for web is *also*
just a Google OAuth Web client — Firebase auto-provisions one for you, and you
can point this app's existing verification code at it with **no backend
changes**:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Google → Enable.**
3. Expand **Web SDK configuration** on that same screen — Firebase shows a
   **Web client ID** (and a Web client secret you don't need). This is a
   normal Google OAuth client, auto-created in the associated Google Cloud
   project; you can also find/edit it under that project's
   [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
   page, where you can add `https://your-app.vercel.app` and
   `http://localhost:3000` as authorized JavaScript origins exactly as in
   Option A.
4. Use that **Web client ID** as `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
5. Two ways to get the frontend to actually produce a matching token:
   - **No code change (simplest):** ignore the Firebase JS SDK entirely and
     keep using `GoogleSignInButton.tsx` as-is — Google Identity Services
     issues an ID token against the same Web client ID Firebase created, and
     the backend verifies it exactly as in Option A. This is what "using
     Firebase as an option" buys you here: Firebase purely as the place you
     *configure* the OAuth client and manage users, not as code running in
     the app.
   - **Use the Firebase JS SDK instead of GSI (small code change):** if you
     want `firebase/auth`'s `signInWithPopup(new GoogleAuthProvider())` flow
     (e.g. because you're already pulling in Firebase for other features),
     don't send Firebase's own ID token to the backend — the backend expects
     a raw Google ID token, not a Firebase-minted one. Extract the Google
     credential instead:
     ```ts
     import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';

     const result = await signInWithPopup(getAuth(firebaseApp), new GoogleAuthProvider());
     const googleCredential = GoogleAuthProvider.credentialFromResult(result);
     onCredential(googleCredential!.idToken!); // same shape GoogleSignInButton already emits
     ```
     Swap this in as the body of a replacement for
     `frontend/components/GoogleSignInButton.tsx`'s `onCredentialRef.current(...)`
     call; `backend/controllers/authController.js`'s `googleLogin` needs no
     changes either way, since it only ever sees a Google ID token.

Either option: **the two client IDs (backend and frontend) must match each
other**, and must be added as an authorized JavaScript origin for every domain
that serves the login page (Vercel URL + `localhost:3000` for dev).

---

## Email & CAPTCHA (optional but recommended)
- **Resend:** create an API key, set `RESEND_API_KEY` and `EMAIL_FROM` on the backend.
  Without it, verification/reset links are logged to the backend console (dev only).
- **Turnstile:** create a widget, put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  (frontend) and the secret in `TURNSTILE_SECRET_KEY` (backend). Without them, signup
  works with no CAPTCHA.

## Redis (optional — shared rate limiting and compile cache)

`REDIS_URL` (or `UPSTASH_REDIS_URL`) is read once by
`backend/config/rateLimitStore.js`, which lazily opens a single shared
`ioredis` connection reused by both the rate limiters (general/AI/auth) and
`backend/services/compileCache.js` (caches compiled PDFs by a hash of their
LaTeX source, so re-viewing an unchanged resume skips a Tectonic invocation).

1. Create a free Upstash Redis database, region close to your backend host.
2. Copy the `rediss://` connection string into `REDIS_URL` on the backend.

Without it: rate-limit counters reset on every backend restart/redeploy and
aren't shared if you ever scale to multiple instances, and the compile cache
is per-process memory only. Neither is a functional blocker for a single-
instance deploy — add Redis when you outgrow that.

## Local Docker test of the backend
```bash
cd backend
docker build -t resume-backend .
docker run --rm -p 5000:5000 --env-file .env resume-backend
```

Or bring up backend + MongoDB together from the repo root (see
`docker-compose.yml`; copy `.env.example` → `.env` first for the Mongo root
credentials, and `backend/.env.example` → `backend/.env` for the app secrets):
```bash
docker compose up --build
```

## Verifying a deploy end-to-end

After both sides are live:
1. Open the Vercel URL, sign up (or "Continue with Google" if configured),
   confirm `/api/auth/me` returns your user and the `token` cookie is set on
   the Vercel domain (see "Wire the two together" above).
2. Create a Master Profile, generate a resume, and confirm the PDF preview
   compiles — this exercises Tectonic on the backend host end-to-end.
3. Check the backend logs for `Rate-limit Redis error` (only relevant if you
   set `REDIS_URL`) and for any `Google login error` if OAuth is enabled.
