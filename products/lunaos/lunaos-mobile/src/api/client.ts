/**
 * HTTP client for api.lunaos.ai with auth header injection.
 */

import { getToken } from '../utils/storage';
import { logger } from '../utils/logger';

const BASE_URL = 'https://api.lunaos.ai';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    const msg = typeof body === 'object' && body !== null && 'error' in body
      ? String((body as Record<string, unknown>).error)
      : `HTTP ${status}`;
    super(msg);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = opts;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${BASE_URL}${path}`;
  logger.debug('API', `${method} ${path}`);

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorBody);
  }

  return response.json() as Promise<T>;
}

/**
 * Raw fetch for SSE streaming (returns the Response object).
 */
export async function apiStream(
  path: string,
  body: unknown,
): Promise<Response> {
  const token = await getToken();
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${path}`;
  logger.debug('API', `SSE POST ${path}`);

  return fetch(url, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(body),
  });
}
