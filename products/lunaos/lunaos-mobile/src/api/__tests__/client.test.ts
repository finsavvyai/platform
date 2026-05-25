/**
 * Tests for the HTTP API client.
 * Validates base URL, auth header injection, error handling.
 */

import { http, HttpResponse } from 'msw';
import { server } from '../../test-utils/mocks/server';
import { apiFetch, apiStream, ApiError } from '../client';
import * as storage from '../../utils/storage';

const BASE_URL = 'https://api.lunaos.ai';

jest.mock('../../utils/storage');
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

beforeEach(() => {
  mockStorage.getToken.mockResolvedValue(null);
});

describe('apiFetch', () => {
  it('makes GET requests to the correct base URL', async () => {
    server.use(
      http.get(`${BASE_URL}/test-path`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );

    const result = await apiFetch<{ ok: boolean }>('/test-path');
    expect(result).toEqual({ ok: true });
  });

  it('injects Authorization header when token exists', async () => {
    mockStorage.getToken.mockResolvedValue('my-jwt');
    let capturedAuth = '';

    server.use(
      http.get(`${BASE_URL}/auth-check`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization') ?? '';
        return HttpResponse.json({ authed: true });
      }),
    );

    await apiFetch('/auth-check');
    expect(capturedAuth).toBe('Bearer my-jwt');
  });

  it('skips auth header when skipAuth is true', async () => {
    mockStorage.getToken.mockResolvedValue('my-jwt');
    let capturedAuth: string | null = null;

    server.use(
      http.get(`${BASE_URL}/public`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ public: true });
      }),
    );

    await apiFetch('/public', { skipAuth: true });
    expect(capturedAuth).toBeNull();
  });

  it('sends JSON body on POST', async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE_URL}/submit`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ created: true });
      }),
    );

    await apiFetch('/submit', {
      method: 'POST',
      body: { name: 'test' },
    });

    expect(capturedBody).toEqual({ name: 'test' });
  });

  it('throws ApiError on non-ok response', async () => {
    server.use(
      http.get(`${BASE_URL}/fail`, () =>
        HttpResponse.json({ error: 'Not found' }, { status: 404 }),
      ),
    );

    await expect(apiFetch('/fail')).rejects.toThrow(ApiError);

    try {
      await apiFetch('/fail');
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.message).toBe('Not found');
    }
  });

  it('handles non-JSON error bodies gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/text-error`, () =>
        new HttpResponse('Server Error', { status: 500 }),
      ),
    );

    await expect(apiFetch('/text-error')).rejects.toThrow(ApiError);
  });
});

describe('apiStream', () => {
  it('sends POST with Accept: text/event-stream', async () => {
    let capturedAccept = '';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, ({ request }) => {
        capturedAccept = request.headers.get('Accept') ?? '';
        return new HttpResponse('event: token\ndata: hello\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    const response = await apiStream('/agents/execute', { agent: 'test' });
    expect(capturedAccept).toBe('text/event-stream');
    expect(response.ok).toBe(true);
  });

  it('injects auth token into SSE requests', async () => {
    mockStorage.getToken.mockResolvedValue('sse-token');
    let capturedAuth = '';

    server.use(
      http.post(`${BASE_URL}/agents/execute`, ({ request }) => {
        capturedAuth = request.headers.get('Authorization') ?? '';
        return new HttpResponse('', {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    );

    await apiStream('/agents/execute', {});
    expect(capturedAuth).toBe('Bearer sse-token');
  });
});
