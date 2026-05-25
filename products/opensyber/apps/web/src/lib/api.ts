import { API_BASE_URL } from './api-config';
const DEFAULT_TIMEOUT_MS = 10_000;

interface ApiOptions extends RequestInit {
  token?: string;
  orgId?: string | null;
  timeoutMs?: number;
  /**
   * Additional headers to forward upstream. Used by proxy routes to
   * pass through client-signed TokenForge headers (X-TF-*) without
   * stripping them.
   */
  forwardHeaders?: Record<string, string>;
}

export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, orgId, timeoutMs = DEFAULT_TIMEOUT_MS, forwardHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'X-Org-Id': orgId } : {}),
    ...(forwardHeaders ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...(fetchOptions.headers as Record<string, string>),
    },
    signal: fetchOptions.signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error((error as { message: string }).message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
