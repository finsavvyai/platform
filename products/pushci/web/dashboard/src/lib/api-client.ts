import { API_BASE_URL } from '../config';
import {
  ApiError,
  AuthExpiredError,
  AUTH_EXPIRED_EVENT,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
} from './api-errors';

const API = API_BASE_URL;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;

const TOKEN_KEY = 'pushci_token';
const USER_KEY = 'pushci_user';

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function readErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error || res.statusText || `HTTP ${res.status}`;
  }
  const text = await res.text().catch(() => '');
  return text || res.statusText || `HTTP ${res.status}`;
}

function emitAuthExpired(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function backoffDelay(attempt: number): number {
  const exp = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return Math.round(exp * (0.5 + Math.random() * 0.5));
}

function isIdempotent(method: string | undefined): boolean {
  if (!method) return true;
  const upper = method.toUpperCase();
  return upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS';
}

function isRetryable(err: unknown): boolean {
  return err instanceof TimeoutError || err instanceof NetworkError || err instanceof ServerError;
}

async function attempt<T>(path: string, opts: FetchOptions): Promise<T> {
  const token = getToken();
  const externalSignal = opts.signal ?? null;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onAbort);
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = window.setTimeout(() => controller.abort('timeout'), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
  } catch (err) {
    if (controller.signal.aborted && controller.signal.reason === 'timeout') {
      throw new TimeoutError();
    }
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
  } finally {
    window.clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
  }

  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed) localStorage.setItem(TOKEN_KEY, refreshed);

  if (!res.ok) {
    const message = await readErrorMessage(res);
    if (res.status === 401) {
      emitAuthExpired();
      throw new AuthExpiredError();
    }
    if (res.status === 403) throw new ForbiddenError(message);
    if (res.status === 404) throw new NotFoundError(message);
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After')) || null;
      throw new RateLimitError(retryAfter, message);
    }
    if (res.status >= 500) throw new ServerError(res.status, message);
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const retries = opts.retries ?? (isIdempotent(opts.method) ? DEFAULT_RETRIES : 0);
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt<T>(path, opts);
    } catch (err) {
      lastError = err;
      if (i === retries || !isRetryable(err)) throw err;
      await sleep(backoffDelay(i), opts.signal ?? undefined);
    }
  }
  throw lastError;
}

export { backoffDelay, isIdempotent, isRetryable };
