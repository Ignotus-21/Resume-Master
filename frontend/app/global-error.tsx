'use client';

// Last-resort boundary for errors thrown by the root layout itself. It
// replaces the whole document (globals.css may not have loaded), so styles
// are inline.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#202124' }}>Something went wrong</h1>
          <p style={{ color: '#5f6368', margin: '8px 0 16px' }}>An unexpected error occurred.</p>
          <button
            onClick={reset}
            style={{ background: '#202124', color: '#fff', border: 0, borderRadius: 9999, padding: '10px 24px', fontSize: 14, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
