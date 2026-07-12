# Backend image for hosts that run a persistent Node process (Railway/Render/Fly).
# Includes Tectonic so it can compile resumes to PDF — the reason this can't
# run on Vercel's serverless functions.
FROM node:22-slim

# Tectonic is a self-contained LaTeX engine (statically linked, no texlive
# install needed) that fetches missing packages on the fly — this is the
# binary backend/services/latexService.js actually shells out to. Pinned to a
# specific release and fetched as a plain tarball from GitHub Releases over
# HTTPS (not a "curl | sh" installer script) for a reproducible, auditable
# build; bump TECTONIC_VERSION deliberately rather than tracking "latest".
ENV TECTONIC_VERSION=0.16.9
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl --proto '=https' --tlsv1.2 -fsSL \
       -o /tmp/tectonic.tar.gz \
       "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic \
    && rm /tmp/tectonic.tar.gz \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Pre-create the runtime dirs and hand /app to the built-in non-root `node`
# user, then drop privileges — the process should not run as root. Tectonic
# caches downloaded packages under $HOME/.cache, so that needs to be writable
# by `node` too.
#
# warmTectonicCache.js pre-bakes the Tectonic package cache into the image by
# compiling the fixture profile through every template / font / extra-package
# variant. Without this, the first compile on a cold container fetches LaTeX
# packages over the network at request time (slow, flaky, 30s-timeout-bound).
# It also doubles as a build-time smoke test: if a template stops compiling,
# the image build fails.
RUN mkdir -p uploads temp_latex /home/node/.cache \
    && HOME=/home/node node scripts/warmTectonicCache.js \
    && chown -R node:node /app /home/node

ENV NODE_ENV=production
EXPOSE 5000

USER node

CMD ["node", "server.js"]
