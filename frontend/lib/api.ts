export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseBody(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

/**
 * Thin fetch wrapper: resolves the API base URL once, throws ApiError on
 * non-2xx responses so callers can handle failures in one place instead of
 * duplicating res.ok checks everywhere.
 */
export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  const body = await parseBody(res);
  if (!res.ok) {
    const message = (body && typeof body === 'object' && 'message' in body)
      ? (body as { message: string }).message
      : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
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
