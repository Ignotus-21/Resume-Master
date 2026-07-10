import type { NextConfig } from "next";

// Proxy /api/* to the Express backend so the browser only ever talks to the
// frontend origin. This keeps the auth cookie SameSite=Lax (no CSRF-prone
// SameSite=None) in production and works identically in `next dev`.
// Set BACKEND_URL in deployment (e.g. the Fly.io/Railway URL); defaults to
// the local backend for dev. Skipped entirely when the app is configured to
// call the backend directly via NEXT_PUBLIC_API_URL.
const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
    ];
  },
};

export default nextConfig;
