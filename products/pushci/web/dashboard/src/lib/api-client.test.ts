import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiFetch,
  backoffDelay,
  isIdempotent,
  isRetryable,
} from './api-client';
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

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('isIdempotent', () => {
  it('treats absent method as GET', () => {
    expect(isIdempotent(undefined)).toBe(true);
  });
  it('matches GET, HEAD, OPTIONS', () => {
    expect(isIdempotent('GET')).toBe(true);
    expect(isIdempotent('head')).toBe(true);
    expect(isIdempotent('OPTIONS')).toBe(true);
  });
  it('rejects POST, PUT, PATCH, DELETE', () => {
    expect(isIdempotent('POST')).toBe(false);
    expect(isIdempotent('PUT')).toBe(false);
    expect(isIdempotent('PATCH')).toBe(false);
    expect(isIdempotent('DELETE')).toBe(false);
  });
});

describe('isRetryable', () => {
  it('retries timeout, network, and server errors', () => {
    expect(isRetryable(new TimeoutError())).toBe(true);
    expect(isRetryable(new NetworkError())).toBe(true);
    expect(isRetryable(new ServerError(503, 'down'))).toBe(true);
  });
  it('does not retry 4xx errors', () => {
    expect(isRetryable(new ForbiddenError())).toBe(false);
    expect(isRetryable(new NotFoundError())).toBe(false);
    expect(isRetryable(new RateLimitError())).toBe(false);
    expect(isRetryable(new AuthExpiredError())).toBe(false);
    expect(isRetryable(new ApiError(418, 'teapot'))).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('grows exponentially with jitter inside expected band', () => {
    const samples = Array.from({ length: 30 }, (_, i) => backoffDelay(i % 4));
    for (const d of samples) expect(d).toBeGreaterThanOrEqual(125);
    for (const d of samples) expect(d).toBeLessThanOrEqual(2000);
  });
});

describe('apiFetch error mapping', () => {
  it('maps 401 to AuthExpiredError, emits event, and clears storage', async () => {
    localStorage.setItem('pushci_token', 'old');
    localStorage.setItem('pushci_user', '{}');
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 401 }));
    await expect(apiFetch('/p')).rejects.toBeInstanceOf(AuthExpiredError);
    expect(localStorage.getItem('pushci_token')).toBeNull();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('maps 403 to ForbiddenError with message', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ error: 'not yours' }, { status: 403 }),
    );
    await expect(apiFetch('/p')).rejects.toMatchObject({
      status: 403,
      message: 'not yours',
    });
  });

  it('maps 429 with Retry-After', async () => {
    globalThis.fetch = vi.fn(async () => new Response('slow', {
      status: 429,
      headers: { 'Retry-After': '7' },
    }));
    const err = await apiFetch('/p').catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBe(7);
  });
});

describe('apiFetch retry behavior', () => {
  it('retries idempotent requests on 5xx and eventually succeeds', async () => {
    const calls = vi.fn()
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    globalThis.fetch = calls;
    const result = await apiFetch<{ ok: boolean }>('/p');
    expect(result.ok).toBe(true);
    expect(calls).toHaveBeenCalledTimes(2);
  });

  it('does not retry POST requests by default', async () => {
    const calls = vi.fn(async () => new Response('boom', { status: 503 }));
    globalThis.fetch = calls;
    await expect(
      apiFetch('/p', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('does not retry 4xx (ForbiddenError) even on GET', async () => {
    const calls = vi.fn(async () =>
      jsonResponse({ error: 'no' }, { status: 403 }),
    );
    globalThis.fetch = calls;
    await expect(apiFetch('/p')).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('respects explicit retries=0 on GET', async () => {
    const calls = vi.fn(async () => new Response('boom', { status: 502 }));
    globalThis.fetch = calls;
    await expect(apiFetch('/p', { retries: 0 })).rejects.toBeInstanceOf(ServerError);
    expect(calls).toHaveBeenCalledTimes(1);
  });
});
