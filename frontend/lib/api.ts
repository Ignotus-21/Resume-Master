export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  status: number;
  body?: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseBody(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    // A non-2xx response can carry an empty/invalid JSON body (e.g. from a
    // proxy); don't let res.json()'s SyntaxError escape as a raw error.
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return res.text();
}

/**
 * Thin fetch wrapper: resolves the API base URL once, throws ApiError on
 * non-2xx responses so callers can handle failures in one place instead of
 * duplicating res.ok checks everywhere.
 */
export async function apiFetch(path: string, options?: RequestInit) {
  // Force credentials last so a caller's options can't accidentally drop the
  // auth/session cookies — apiFetch always sends them.
  const res = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include' });
  const body = await parseBody(res);
  if (!res.ok) {
    const message = (body && typeof body === 'object' && 'message' in body)
      ? (body as { message: string }).message
      : `Request failed with status ${res.status}`;
      
    // Dispatch global event for quota exhaustion UX
    if (res.status === 429 && body && typeof body === 'object' && body.code === 'QUOTA_EXCEEDED') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('quota-exceeded', { detail: { resetAt: body.resetAt } }));
      }
    }

    throw new ApiError(message, res.status, body);
  }
  return body;
}

export function apiJson(path: string, method: string, data: unknown) {
  return apiFetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
