# Backend image for hosts that run a persistent Node process (Railway/Render/Fly).
# Includes a TeX Live subset so pdflatex can compile resumes to PDF — the reason
# this can't run on Vercel's serverless functions.
FROM node:22-slim

# pdflatex + the packages a typical resume template needs. texlive-latex-extra
# covers most classes/packages; drop it if you want a smaller image and simpler
# resumes only.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# The uploads/ and temp_latex/ dirs are created at runtime by the app.
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
