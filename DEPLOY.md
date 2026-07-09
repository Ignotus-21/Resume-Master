# Deploying Resume Master

The app is three pieces: a **Next.js frontend**, an **Express backend** (which needs
`pdflatex` for PDF compilation), and **MongoDB**. Because the backend needs a system
binary and a persistent process, it can't run on Vercel's serverless functions — so
the frontend goes on Vercel and the backend on a container host.

Recommended free/cheap setup:

| Piece | Host | Notes |
|------|------|-------|
| Frontend (Next.js) | **Vercel** (Hobby, free) | Same as a portfolio deploy |
| Backend (Express + pdflatex) | **Railway** (or Render) via `backend/Dockerfile` | Needs texlive; no idle-sleep on Railway |
| Database | **MongoDB Atlas** (M0, free) | 512 MB |
| Email | **Resend** (free) | Verification + password-reset emails |
| CAPTCHA | **Cloudflare Turnstile** (free) | Signup bot protection |

## 1. MongoDB Atlas
1. Create a free M0 cluster, a database user, and allow network access (0.0.0.0/0 for a start).
2. Copy the connection string → this is `MONGO_URI`.

## 2. Backend → Railway (Docker)
1. New project → Deploy from GitHub repo → set the **root directory** to `backend/`.
   Railway will build using `backend/Dockerfile` (installs texlive + pdflatex).
2. Set environment variables (see `backend/.env.example`):
   - `MONGO_URI` (from Atlas)
   - `JWT_SECRET`, `ENCRYPTION_KEY` (generate with the commands in `.env.example`)
   - `GEMINI_API_KEY`
   - `CORS_ORIGIN` = your Vercel URL, e.g. `https://your-app.vercel.app`
   - `APP_URL` = same Vercel URL (used in email links)
   - `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`
   - `COOKIE_SAMESITE_NONE=true`  ← **required** because the frontend and backend
     are on different domains; without it the auth cookie is dropped by the browser.
   - Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `TURNSTILE_SECRET_KEY`, `GOOGLE_CLIENT_ID`
3. Deploy. Note the public backend URL, e.g. `https://your-backend.up.railway.app`.

## 3. Frontend → Vercel
1. Import the repo, set the **root directory** to `frontend/`.
2. Environment variables:
   - `NEXT_PUBLIC_API_URL` = your Railway backend URL
   - Optional: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
3. Deploy.

## 4. Wire the two together
- Backend `CORS_ORIGIN` must exactly equal the Vercel origin (scheme + host, no trailing slash).
- Both must be HTTPS (Vercel and Railway give you HTTPS automatically) so the
  `SameSite=None; Secure` cookie works.
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
