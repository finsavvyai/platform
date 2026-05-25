import { describe, it, expect, vi } from 'vitest';
import { TokenForge } from './tokenforge.js';
import { MemoryBindingStorage } from './storage.js';
import type { BoundSessionRecord } from '../types.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('TokenForge.bind', () => {
  it('registers with the customer endpoint and stores the bound record', async () => {
    const storage = new MemoryBindingStorage();
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        session_id: 'tf_sess_x',
        refresh_url: 'https://api.test/v1/sessions/refresh',
        challenge: 'first-nonce',
      }),
    ) as unknown as typeof globalThis.fetch;

    const tf = new TokenForge({
      registerUrl: '/__tokenforge/register',
      storage,
      fetch: fetchImpl,
      installInterceptor: false,
    });

    const events: string[] = [];
    tf.on((e) => events.push(e.type));

    const rec = await tf.bind({ subject: 'user_1' });
    expect(rec.sessionId).toBe('tf_sess_x');
    expect(rec.bindingClass).toBe('webcrypto');
    expect(events).toContain('bound');
    const stored = await storage.getSession();
    expect(stored?.sessionId).toBe('tf_sess_x');
  });

  it('surfaces a register failure', async () => {
    const storage = new MemoryBindingStorage();
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof globalThis.fetch;
    const tf = new TokenForge({
      registerUrl: '/__tokenforge/register',
      storage,
      fetch: fetchImpl,
      installInterceptor: false,
    });
    await expect(tf.bind({ subject: 'u' })).rejects.toThrow(/register_failed_500/);
  });
});

describe('TokenForge.refreshIfNeeded', () => {
  it('returns false when no session is bound', async () => {
    const tf = new TokenForge({
      registerUrl: '/r',
      storage: new MemoryBindingStorage(),
      fetch: (async () => new Response('', { status: 204 })) as unknown as typeof globalThis.fetch,
      installInterceptor: false,
    });
    expect(await tf.refreshIfNeeded()).toBe(false);
  });

  it('signs DPoP, posts to refresh_url, rotates the challenge', async () => {
    const storage = new MemoryBindingStorage();
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )) as CryptoKeyPair;
    const record: BoundSessionRecord = {
      sessionId: 'tf_sess_r',
      refreshUrl: 'https://api.test/refresh',
      lastChallenge: 'first-nonce',
      publicKeyJwk: {} as JsonWebKey,
      privateKey: pair.privateKey,
      bindingClass: 'webcrypto',
      createdAt: new Date().toISOString(),
    };
    await storage.putSession(record);

    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ challenge: 'next-nonce', action: 'allow' });
    }) as unknown as typeof globalThis.fetch;

    const tf = new TokenForge({
      registerUrl: '/r',
      storage,
      fetch: fetchImpl,
      installInterceptor: false,
    });

    const ok = await tf.refreshIfNeeded();
    expect(ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.test/refresh');
    expect((calls[0]?.init?.headers as Record<string, string>)?.DPoP).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const stored = await storage.getSession();
    expect(stored?.lastChallenge).toBe('next-nonce');
  });

  it('emits binding_lost on a non-2xx refresh', async () => {
    const storage = new MemoryBindingStorage();
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )) as CryptoKeyPair;
    await storage.putSession({
      sessionId: 's', refreshUrl: 'https://x', lastChallenge: 'n',
      publicKeyJwk: {} as JsonWebKey, privateKey: pair.privateKey,
      bindingClass: 'webcrypto', createdAt: new Date().toISOString(),
    });
    const fetchImpl = (async () => new Response('', { status: 401 })) as unknown as typeof globalThis.fetch;
    const tf = new TokenForge({
      registerUrl: '/r',
      storage,
      fetch: fetchImpl,
      installInterceptor: false,
    });
    const events: string[] = [];
    tf.on((e) => events.push(e.type));
    expect(await tf.refreshIfNeeded()).toBe(false);
    expect(events).toContain('binding_lost');
  });
});

describe('TokenForge.unbind', () => {
  it('clears the storage', async () => {
    const storage = new MemoryBindingStorage();
    const tf = new TokenForge({
      registerUrl: '/r',
      storage,
      fetch: (async () =>
        jsonResponse({
          session_id: 'tf_sess', refresh_url: 'https://api.test/refresh', challenge: 'n',
        })) as unknown as typeof globalThis.fetch,
      installInterceptor: false,
    });
    await tf.bind({ subject: 'u' });
    await tf.unbind();
    expect(await storage.getSession()).toBeNull();
  });
});

describe('default constructor installs interceptor', () => {
  it('replaces globalThis.fetch when installInterceptor is not false', () => {
    const original = globalThis.fetch;
    const tf = new TokenForge({
      registerUrl: '/r',
      storage: new MemoryBindingStorage(),
      fetch: original,
    });
    expect(globalThis.fetch).not.toBe(original);
    tf.uninstallFetch();
  });
});

describe('installFetch / uninstallFetch', () => {
  it('replaces and restores globalThis.fetch', async () => {
    const original = globalThis.fetch;
    const tf = new TokenForge({
      registerUrl: '/r',
      storage: new MemoryBindingStorage(),
      fetch: original,
      installInterceptor: false,
    });
    expect(globalThis.fetch).toBe(original);
    tf.installFetch();
    expect(globalThis.fetch).not.toBe(original);
    tf.installFetch(); // idempotent
    tf.uninstallFetch();
    expect(globalThis.fetch).toBe(original);
    tf.uninstallFetch(); // idempotent
  });
});

describe('listener unsubscribe', () => {
  it('returns an unsubscribe function', async () => {
    const tf = new TokenForge({
      registerUrl: '/r',
      storage: new MemoryBindingStorage(),
      fetch: (async () =>
        jsonResponse({ session_id: 's', refresh_url: 'r', challenge: 'n' })) as unknown as typeof globalThis.fetch,
      installInterceptor: false,
    });
    const seen: string[] = [];
    const off = tf.on((e) => seen.push(e.type));
    await tf.bind({ subject: 'u1' });
    off();
    await tf.bind({ subject: 'u2' });
    expect(seen.filter((t) => t === 'bound')).toHaveLength(1);
  });

  it('swallows listener errors', async () => {
    const tf = new TokenForge({
      registerUrl: '/r',
      storage: new MemoryBindingStorage(),
      fetch: (async () =>
        jsonResponse({ session_id: 's', refresh_url: 'r', challenge: 'n' })) as unknown as typeof globalThis.fetch,
      installInterceptor: false,
    });
    tf.on(() => { throw new Error('listener boom'); });
    await expect(tf.bind({ subject: 'u' })).resolves.toBeTruthy();
  });
});
