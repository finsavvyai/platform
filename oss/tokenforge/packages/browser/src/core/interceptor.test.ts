import { describe, it, expect, vi } from 'vitest';
import { makeInterceptingFetch } from './interceptor.js';
import { MemoryBindingStorage } from './storage.js';
import type { BoundSessionRecord, TokenForgeEvent } from '../types.js';

async function makeRecord(): Promise<BoundSessionRecord> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )) as CryptoKeyPair;
  return {
    sessionId: 'tf_sess_int',
    refreshUrl: 'https://api.test/v1/sessions/refresh',
    lastChallenge: 'first',
    publicKeyJwk: {} as JsonWebKey,
    privateKey: pair.privateKey,
    bindingClass: 'webcrypto',
    createdAt: new Date().toISOString(),
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('makeInterceptingFetch', () => {
  it('passes through non-401 responses unchanged', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    const baseFetch = vi.fn(async () => new Response('ok'));
    const intercept = makeInterceptingFetch({
      storage,
      emit: () => {},
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    const r = await intercept('/api/data');
    expect(r.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('on 401 + Sec-Session-Challenge: refreshes, then replays original', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    let calls = 0;
    const baseFetch = vi.fn(async (url: string | URL | Request) => {
      calls++;
      const u = String(url);
      if (calls === 1) {
        return new Response('expired', {
          status: 401,
          headers: { 'Sec-Session-Challenge': 'fresh-nonce' },
        });
      }
      if (u === 'https://api.test/v1/sessions/refresh') {
        return jsonResponse({ challenge: 'next', action: 'allow' });
      }
      return new Response('ok-replayed');
    });
    const events: TokenForgeEvent[] = [];
    const intercept = makeInterceptingFetch({
      storage,
      emit: (e) => events.push(e),
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });

    const r = await intercept('/api/protected');
    expect(await r.text()).toBe('ok-replayed');
    expect(events.find((e) => e.type === 'refreshed')).toBeTruthy();
    const stored = await storage.getSession();
    expect(stored?.lastChallenge).toBe('next');
  });

  it('emits step_up_required when server returns action: step_up', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    let calls = 0;
    const baseFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response('expired', {
          status: 401,
          headers: { 'Sec-Session-Challenge': 'n' },
        });
      }
      return jsonResponse({ challenge: 'next', action: 'step_up', signals: ['geo_drift'] });
    });
    const events: TokenForgeEvent[] = [];
    const intercept = makeInterceptingFetch({
      storage,
      emit: (e) => events.push(e),
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    const r = await intercept('/api/x');
    expect(r.status).toBe(401);
    const stepUp = events.find((e) => e.type === 'step_up_required') as
      | { type: 'step_up_required'; signals: string[] }
      | undefined;
    expect(stepUp?.signals).toEqual(['geo_drift']);
  });

  it('emits session_revoked when refresh response says action: block', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    let calls = 0;
    const baseFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response('', {
          status: 401,
          headers: { 'Sec-Session-Challenge': 'n' },
        });
      }
      return jsonResponse({ action: 'block', signals: [] });
    });
    const events: TokenForgeEvent[] = [];
    const intercept = makeInterceptingFetch({
      storage,
      emit: (e) => events.push(e),
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    await intercept('/api/x');
    expect(events.find((e) => e.type === 'session_revoked')).toBeTruthy();
  });

  it('skips refresh when no Sec-Session-Challenge header is present', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    const baseFetch = vi.fn(async () => new Response('', { status: 401 }));
    const intercept = makeInterceptingFetch({
      storage,
      emit: () => {},
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    const r = await intercept('/api/x');
    expect(r.status).toBe(401);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('emits session_revoked on 403 from refresh', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    let calls = 0;
    const baseFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response('', {
          status: 401,
          headers: { 'Sec-Session-Challenge': 'n' },
        });
      }
      return new Response('forbidden', { status: 403 });
    });
    const events: TokenForgeEvent[] = [];
    const intercept = makeInterceptingFetch({
      storage,
      emit: (e) => events.push(e),
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    await intercept('/api/x');
    expect(events.find((e) => e.type === 'session_revoked')).toBeTruthy();
  });

  it('passes through 401 when no bound session exists', async () => {
    const storage = new MemoryBindingStorage();
    const baseFetch = vi.fn(async () => new Response('', {
      status: 401,
      headers: { 'Sec-Session-Challenge': 'n' },
    }));
    const intercept = makeInterceptingFetch({
      storage,
      emit: () => {},
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    const r = await intercept('/api/x');
    expect(r.status).toBe(401);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it('emits binding_lost when refresh fetch throws', async () => {
    const storage = new MemoryBindingStorage();
    await storage.putSession(await makeRecord());
    let calls = 0;
    const baseFetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response('', {
          status: 401,
          headers: { 'Sec-Session-Challenge': 'n' },
        });
      }
      throw new Error('network down');
    });
    const events: TokenForgeEvent[] = [];
    const intercept = makeInterceptingFetch({
      storage,
      emit: (e) => events.push(e),
      baseFetch: baseFetch as unknown as typeof globalThis.fetch,
    });
    await intercept('/api/x');
    expect(events.find((e) => e.type === 'binding_lost')).toBeTruthy();
  });
});
