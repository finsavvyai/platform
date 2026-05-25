const API_BASE: string = (() => {
  const url = import.meta.env.VITE_API_URL;
  if (!url && !import.meta.env.DEV) {
    throw new Error('VITE_API_URL is not set. All API requests would go to localhost in production.');
  }
  return url || 'http://localhost:8080';
})();

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

import { tokenManager } from '../utils/tokenManager';

function getAuthHeaders(): Record<string, string> {
  return tokenManager.getAuthHeader();
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}/api/v1${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string>),
  };

  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401) {
    tokenManager.clear();
    if (!endpoint.endsWith('/auth/me')) {
      window.location.href = '/login';
    }
    throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(body.code || 'ERROR', body.message || resp.statusText, resp.status);
  }
  const json = await resp.json();
  return (json.data != null ? json.data : json) as T;
}

async function uploadApi<T>(endpoint: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}/api/v1${endpoint}`;
  const headers: Record<string, string> = { ...getAuthHeaders() };
  const resp = await fetch(url, { method: 'POST', headers, body: formData });
  if (resp.status === 401) {
    tokenManager.clear();
    window.location.href = '/login';
    throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  }
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new ApiError(body.code || 'ERROR', body.message || resp.statusText, resp.status);
  }
  const json = await resp.json();
  return (json.data != null ? json.data : json) as T;
}

export const api = {
  get: <T,>(ep: string) => fetchApi<T>(ep),
  post: <T,>(ep: string, body: unknown) =>
    fetchApi<T>(ep, { method: 'POST', body: JSON.stringify(body) }),
  put: <T,>(ep: string, body: unknown) =>
    fetchApi<T>(ep, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T,>(ep: string) => fetchApi<T>(ep, { method: 'DELETE' }),
  upload: <T,>(ep: string, formData: FormData) => uploadApi<T>(ep, formData),
};
