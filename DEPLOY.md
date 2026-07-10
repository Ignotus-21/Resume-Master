# Deploying Resume Master

The app is three pieces: a **Next.js frontend**, an **Express backend** (which needs
`tectonic` for PDF compilation), and **MongoDB**. Because the backend needs a system
binary and a persistent process, it can't run on Vercel's serverless functions — so
the frontend goes on Vercel and the backend on a container host.

Recommended free/cheap setup:

| Piece | Host | Notes |
|------|------|-------|
| Frontend (Next.js) | **Vercel** (Hobby, free) | Same as a portfolio deploy |
| Backend (Express + tectonic) | **Railway** (or Render) via `backend/Dockerfile` | Fetches LaTeX packages on the fly; no idle-sleep on Railway |
| Database | **MongoDB Atlas** (M0, free) | 512 MB |
| Email | **Resend** (free) | Verification + password-reset emails |
| CAPTCHA | **Cloudflare Turnstile** (free) | Signup bot protection |

## 1. MongoDB Atlas
1. Create a free M0 cluster, a database user, and allow network access (0.0.0.0/0 for a start).
2. Copy the connection string → this is `MONGO_URI`.

## 2. Backend → Railway (Docker)
1. New project → Deploy from GitHub repo → set the **root directory** to `backend/`.
   Railway will build using `backend/Dockerfile` (installs the `tectonic` binary).
2. Set environment variables (see `backend/.env.example`):
   - `MONGO_URI` (from Atlas)
   - `JWT_SECRET`, `ENCRYPTION_KEY` (generate with the commands in `.env.example`)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)
   - `CORS_ORIGIN` = your Vercel URL, e.g. `https://your-app.vercel.app`
   - `APP_URL` = same Vercel URL (used in email links)
   - `NODE_ENV=production`
   - `TRUST_PROXY_HOPS=2` with the recommended same-origin proxy (client →
     Vercel → backend host = 2 proxy hops), or `1` if the browser calls the
     backend directly.
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`
3. Deploy. Note the public backend URL, e.g. `https://your-backend.up.railway.app`.

## 3. Frontend → Vercel
1. Import the repo, set the **root directory** to `frontend/`.
2. Environment variables:
   - `BACKEND_URL` = your backend URL — `next.config.ts` proxies `/api/*` there,
     so the browser only ever talks to the Vercel origin.
   - `NEXT_PUBLIC_API_URL` = leave **unset/empty** (same-origin via the proxy).
   - Optional: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
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

## Email & CAPTCHA (optional but recommended)
- **Resend:** create an API key, set `RESEND_API_KEY` and `EMAIL_FROM` on the backend.
  Without it, verification/reset links are logged to the backend console (dev only).
- **Turnstile:** create a widget, put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  (frontend) and the secret in `TURNSTILE_SECRET_KEY` (backend). Without them, signup
  works with no CAPTCHA.

## Local Docker test of the backend
```bash
cd backend
docker build -t resume-backend .
docker run --rm -p 5000:5000 --env-file .env resume-backend
```
