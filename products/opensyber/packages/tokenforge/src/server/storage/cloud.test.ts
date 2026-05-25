import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudStorage } from './cloud.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CloudStorage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws on invalid API key', () => {
    expect(() => new CloudStorage('')).toThrow('Invalid API key');
    expect(() => new CloudStorage('invalid')).toThrow('Invalid API key');
  });

  it('accepts valid API key', () => {
    const storage = new CloudStorage('tf_abc123');
    expect(storage).toBeDefined();
  });

  it('calls getSession with correct path and body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));
    const storage = new CloudStorage('tf_abc123');
    await storage.getSession('sess_1', 'dev_1');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://tokenforge-api.opensyber.cloud/v1/storage/get-session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tf_abc123',
        }),
      }),
    );
  });

  it('uses custom apiBase', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));
    const storage = new CloudStorage('tf_abc123', {
      apiBase: 'https://custom.api.com',
    });
    await storage.hasNonce('nonce_1');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.api.com/v1/storage/has-nonce',
      expect.anything(),
    );
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
    );
    const storage = new CloudStorage('tf_abc123');
    await expect(storage.getSession('s', 'd')).rejects.toThrow('Unauthorized');
  });

  it('sends Authorization header on every request', async () => {
    mockFetch.mockResolvedValue(jsonResponse(true));
    const storage = new CloudStorage('tf_test_key_123');
    await storage.storeNonce('n1', 60);
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer tf_test_key_123');
  });

  it('every storage RPC routes to its documented /v1/storage/* path', async () => {
    mockFetch.mockImplementation(async () => jsonResponse(null));
    const storage = new CloudStorage('tf_abc');
    const expected: Array<[string, () => Promise<unknown>]> = [
      ['/v1/storage/create-session', () => storage.createSession({} as never)],
      ['/v1/storage/update-trust', () => storage.updateTrustScore('d1', 50)],
      ['/v1/storage/revoke-session', () => storage.revokeSession('d1', 'manual')],
      ['/v1/storage/revoke-user-sessions', () => storage.revokeUserSessions('u1')],
      ['/v1/storage/list-sessions', () => storage.listUserSessions('u1', 10)],
      ['/v1/storage/restore-trust', () => storage.restoreTrust('d1', 'u1')],
      ['/v1/storage/log-event', () => storage.logEvent({ id: 'e1' } as never)],
      ['/v1/storage/list-events', () => storage.listEvents('u1', 10, 0)],
      ['/v1/storage/create-challenge', () => storage.createChallenge({ id: 'c1' } as never)],
      ['/v1/storage/get-challenge', () => storage.getChallenge('c1', 'u1')],
      ['/v1/storage/update-challenge', () => storage.updateChallengeStatus('c1', 'verified')],
      ['/v1/storage/count-challenges', () => storage.countRecentChallenges('u1', 60)],
      ['/v1/storage/store-otp', () => storage.storeOtp('c1', '123456', 60)],
      ['/v1/storage/get-otp', () => storage.getOtp('c1')],
      ['/v1/storage/delete-otp', () => storage.deleteOtp('c1')],
    ];
    for (const [path, call] of expected) {
      mockFetch.mockClear();
      await call();
      expect(mockFetch).toHaveBeenCalledWith(
        `https://tokenforge-api.opensyber.cloud${path}`,
        expect.objectContaining({ method: 'POST' }),
      );
    }
  });

  it('every RPC sends Content-Type: application/json on the body', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null));
    const storage = new CloudStorage('tf_abc');
    await storage.updateChallengeStatus('c1', 'verified', '2026-05-07T00:00:00Z');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({
      challengeId: 'c1', status: 'verified', completedAt: '2026-05-07T00:00:00Z',
    });
  });

  it('falls back to "API error <status>" when error JSON has no message field', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const storage = new CloudStorage('tf_abc');
    await expect(storage.getSession('s', 'd')).rejects.toThrow(/API error 503/);
  });

  it('falls back to res.statusText when error body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(new Response('not-json', { status: 502, statusText: 'Bad Gateway' }));
    const storage = new CloudStorage('tf_abc');
    await expect(storage.getSession('s', 'd')).rejects.toThrow(/Bad Gateway/);
  });
});
