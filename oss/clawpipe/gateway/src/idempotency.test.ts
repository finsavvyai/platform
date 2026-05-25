/** Tests for Idempotency-Key middleware. */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isValidKey, readKey, getIdempotent, saveIdempotent, MAX_KEY_LEN,
} from './idempotency';
import type { Env } from './types';

class MemKV {
  store = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    if (opts?.expirationTtl) this.ttls.set(key, opts.expirationTtl);
  }
}

function mkEnv(): { env: Env; kv: MemKV } {
  const kv = new MemKV();
  return { env: { CACHE: kv as unknown as KVNamespace } as Env, kv };
}

describe('isValidKey', () => {
  it('accepts alnum + . _ - up to 200 chars', () => {
    expect(isValidKey('abc')).toBe(true);
    expect(isValidKey('a-b.c_d')).toBe(true);
    expect(isValidKey('A'.repeat(MAX_KEY_LEN))).toBe(true);
  });
  it('rejects empty + null + over-length + bad chars', () => {
    expect(isValidKey(null)).toBe(false);
    expect(isValidKey('')).toBe(false);
    expect(isValidKey('A'.repeat(MAX_KEY_LEN + 1))).toBe(false);
    expect(isValidKey('has space')).toBe(false);
    expect(isValidKey('has/slash')).toBe(false);
  });
});

describe('readKey', () => {
  it('returns null when header absent', () => {
    const req = new Request('https://x.test', { method: 'POST' });
    expect(readKey(req)).toBeNull();
  });
  it('returns the key when valid', () => {
    const req = new Request('https://x.test', {
      method: 'POST', headers: { 'Idempotency-Key': 'abc-123' },
    });
    expect(readKey(req)).toBe('abc-123');
  });
  it('returns Response(400) when malformed', async () => {
    const req = new Request('https://x.test', {
      method: 'POST', headers: { 'Idempotency-Key': 'has space' },
    });
    const res = readKey(req);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(400);
  });
});

describe('getIdempotent + saveIdempotent', () => {
  let envBag: ReturnType<typeof mkEnv>;
  beforeEach(() => { envBag = mkEnv(); });

  it('returns null on miss', async () => {
    const out = await getIdempotent(envBag.env, 'p1', 'k1');
    expect(out).toBeNull();
  });

  it('round-trips a 200 response with body + headers + Idempotency-Replay tag', async () => {
    const original = new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
    });
    await saveIdempotent(envBag.env, 'p1', 'k1', original);
    const replay = await getIdempotent(envBag.env, 'p1', 'k1');
    expect(replay).not.toBeNull();
    expect(replay!.status).toBe(200);
    expect(replay!.headers.get('content-type')).toBe('application/json');
    expect(replay!.headers.get('x-trace')).toBe('abc');
    expect(replay!.headers.get('Idempotency-Replay')).toBe('HIT');
    expect(await replay!.json()).toEqual({ ok: true });
  });

  it('does not store non-2xx responses', async () => {
    const err = new Response('boom', { status: 502 });
    await saveIdempotent(envBag.env, 'p1', 'k1', err);
    expect(await getIdempotent(envBag.env, 'p1', 'k1')).toBeNull();
  });

  it('keys are project-scoped', async () => {
    const r = new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    await saveIdempotent(envBag.env, 'p1', 'k', r);
    expect(await getIdempotent(envBag.env, 'p2', 'k')).toBeNull();
  });

  it('returns the original response (not the clone) so the caller can stream it', async () => {
    const r = new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    const out = await saveIdempotent(envBag.env, 'p1', 'k1', r);
    expect(out).toBe(r);
    // Original still readable.
    expect(await r.json()).toEqual({ ok: 1 });
  });

  it('TTL set to 24 h', async () => {
    const r = new Response('{}', { status: 200 });
    await saveIdempotent(envBag.env, 'p1', 'k1', r);
    expect(envBag.kv.ttls.get('idem:p1:k1')).toBe(86_400);
  });

  it('returns null when stored body is malformed JSON', async () => {
    await envBag.kv.put('idem:p1:k1', 'not json{');
    expect(await getIdempotent(envBag.env, 'p1', 'k1')).toBeNull();
  });
});
