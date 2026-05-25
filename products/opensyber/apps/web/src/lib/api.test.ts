import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './api';

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes GET request to API base URL', async () => {
    const mockData = { users: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }));

    const result = await apiClient('/api/users');
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('includes Authorization header when token provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await apiClient('/api/user', { token: 'my-token' });
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('does not include Authorization header without token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await apiClient('/api/user');
    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[1].headers.Authorization).toBeUndefined();
  });

  it('throws on non-ok response with message from body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    }));

    await expect(apiClient('/api/missing')).rejects.toThrow('Not found');
  });

  it('throws with status code when response body has no message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    }));

    await expect(apiClient('/api/error')).rejects.toThrow('API error: 500');
  });

  it('throws with fallback when response body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    }));

    await expect(apiClient('/api/broken')).rejects.toThrow('Unknown error');
  });

  it('passes through additional fetch options', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await apiClient('/api/data', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ key: 'value' }),
      }),
    );
  });

  it('includes AbortSignal.timeout by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await apiClient('/api/data');

    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('respects custom signal when provided', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }));

    await apiClient('/api/data', { signal: controller.signal });

    const fetchCall = (fetch as any).mock.calls[0];
    expect(fetchCall[1].signal).toBe(controller.signal);
  });
});
