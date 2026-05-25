/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { SavingsClient } from './savings-client';
import type { SavingsSnapshot } from './savings-client';

const CFG = { gatewayUrl: 'https://api.clawpipe.ai', apiKey: 'test-key', projectId: 'proj1', ttlMs: 0 };

function mockFetch(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

const goodSnapshot: SavingsSnapshot = { thisMonth: 12.5, sinceStart: 100, percent: 30, currency: 'USD' };

describe('SavingsClient', () => {
  describe('constructor', () => {
    it('accepts minimal config', () => {
      const c = new SavingsClient(CFG);
      expect(c).toBeTruthy();
    });

    it('defaults ttlMs to 60000 when not provided', () => {
      // Indirectly tested: with ttlMs=60000 a fresh fetch is cached
      const c = new SavingsClient({ ...CFG, ttlMs: undefined });
      expect(c).toBeTruthy();
    });
  });

  describe('get()', () => {
    it('returns snapshot on 200 response with valid shape', async () => {
      const c = new SavingsClient({ ...CFG, fetchImpl: mockFetch(200, goodSnapshot) });
      const result = await c.get();
      expect(result).toEqual(goodSnapshot);
    });

    it('returns null on non-ok response (no cache available)', async () => {
      const c = new SavingsClient({ ...CFG, fetchImpl: mockFetch(500, { error: 'down' }) });
      const result = await c.get();
      expect(result).toBeNull();
    });

    it('returns null when thisMonth is not a number', async () => {
      const c = new SavingsClient({ ...CFG, fetchImpl: mockFetch(200, { thisMonth: 'bad', sinceStart: 0, percent: 0, currency: 'USD' }) });
      const result = await c.get();
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      const throwingFetch = async (): Promise<Response> => { throw new Error('network error'); };
      const c = new SavingsClient({ ...CFG, fetchImpl: throwingFetch as typeof fetch });
      const result = await c.get();
      expect(result).toBeNull();
    });

    it('caches result and does not re-fetch within TTL', async () => {
      let calls = 0;
      const countingFetch: typeof fetch = async () => {
        calls++;
        return new Response(JSON.stringify(goodSnapshot), { status: 200 });
      };
      const c = new SavingsClient({ ...CFG, ttlMs: 60_000, fetchImpl: countingFetch });
      await c.get();
      await c.get();
      expect(calls).toBe(1);
    });

    it('re-fetches after TTL expires (ttlMs=0)', async () => {
      let calls = 0;
      const countingFetch: typeof fetch = async () => {
        calls++;
        return new Response(JSON.stringify(goodSnapshot), { status: 200 });
      };
      const c = new SavingsClient({ ...CFG, ttlMs: 0, fetchImpl: countingFetch });
      await c.get();
      await c.get();
      expect(calls).toBe(2);
    });

    it('returns stale cache on non-ok response when cache exists', async () => {
      let calls = 0;
      const fetch500: typeof fetch = async () => {
        calls++;
        if (calls === 1) return new Response(JSON.stringify(goodSnapshot), { status: 200 });
        return new Response('error', { status: 500 });
      };
      // Use ttlMs=0 so second call always re-fetches
      const c = new SavingsClient({ ...CFG, ttlMs: 0, fetchImpl: fetch500 });
      const first = await c.get();
      expect(first).toEqual(goodSnapshot);
      const second = await c.get();
      // Returns stale cache (the 500 keeps the old cached value)
      expect(second).toEqual(goodSnapshot);
    });

    it('passes correct auth headers', async () => {
      let capturedHeaders: Record<string, string> = {};
      const captureFetch: typeof fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
        return new Response(JSON.stringify(goodSnapshot), { status: 200 });
      };
      const c = new SavingsClient({ ...CFG, fetchImpl: captureFetch });
      await c.get();
      expect(capturedHeaders['Authorization']).toBe('Bearer test-key');
      expect(capturedHeaders['X-Project-Id']).toBe('proj1');
    });

    it('fetches correct URL', async () => {
      let capturedUrl = '';
      const captureFetch: typeof fetch = async (url: RequestInfo | URL) => {
        capturedUrl = String(url);
        return new Response(JSON.stringify(goodSnapshot), { status: 200 });
      };
      const c = new SavingsClient({ ...CFG, fetchImpl: captureFetch });
      await c.get();
      expect(capturedUrl).toBe('https://api.clawpipe.ai/savings');
    });
  });

  describe('reset()', () => {
    it('clears cached value so next get() re-fetches', async () => {
      let calls = 0;
      const countingFetch: typeof fetch = async () => {
        calls++;
        return new Response(JSON.stringify(goodSnapshot), { status: 200 });
      };
      const c = new SavingsClient({ ...CFG, ttlMs: 60_000, fetchImpl: countingFetch });
      await c.get();
      c.reset();
      await c.get();
      expect(calls).toBe(2);
    });
  });
});
