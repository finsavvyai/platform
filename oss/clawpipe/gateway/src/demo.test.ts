/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleDemo } from './demo';
import type { Env } from './types';

vi.mock('./providers/groq', () => ({
  groqAdapter: {
    name: 'groq',
    call: vi.fn(),
  },
}));

import { groqAdapter } from './providers/groq';

class MemKV {
  store = new Map<string, string>();
  ttls = new Map<string, number>();
  async get(k: string): Promise<string | null> { return this.store.get(k) ?? null; }
  async put(k: string, v: string, opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(k, v);
    if (opts?.expirationTtl) this.ttls.set(k, opts.expirationTtl);
  }
}

function mkEnv(opts: { kv?: MemKV; groqKey?: string } = {}): Env {
  return {
    CACHE: (opts.kv ?? new MemKV()) as unknown as KVNamespace,
    GROQ_API_KEY: opts.groqKey ?? 'sk-groq',
  } as Env;
}

function jsonReq(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('https://api.clawpipe.ai/v1/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('handleDemo', () => {
  beforeEach(() => {
    vi.mocked(groqAdapter.call).mockResolvedValue({
      text: 'demo-response', tokensIn: 5, tokensOut: 10, latencyMs: 100,
    });
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('returns 200 + result on happy path', async () => {
    const res = await handleDemo(jsonReq({ prompt: 'hi' }), mkEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { text: string; remaining: number };
    expect(body.text).toBe('demo-response');
    expect(body.remaining).toBe(4);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
  });

  it('429 when per-IP hourly limit hit', async () => {
    const kv = new MemKV();
    const hour = Math.floor(Date.now() / 3_600_000);
    await kv.put(`demo:1.2.3.4:${hour}`, '5');
    const res = await handleDemo(jsonReq({ prompt: 'hi' }), mkEnv({ kv }));
    expect(res.status).toBe(429);
  });

  it('429 when global daily cap hit', async () => {
    const kv = new MemKV();
    const day = new Date().toISOString().slice(0, 10);
    await kv.put(`demo:global:${day}`, '2000');
    const res = await handleDemo(jsonReq({ prompt: 'hi' }), mkEnv({ kv }));
    expect(res.status).toBe(429);
  });

  it('400 on invalid JSON', async () => {
    const res = await handleDemo(jsonReq('not json'), mkEnv());
    expect(res.status).toBe(400);
  });

  it('400 on missing prompt', async () => {
    const res = await handleDemo(jsonReq({}), mkEnv());
    expect(res.status).toBe(400);
  });

  it('400 when prompt exceeds 500 chars', async () => {
    const res = await handleDemo(jsonReq({ prompt: 'a'.repeat(501) }), mkEnv());
    expect(res.status).toBe(400);
  });

  it('503 when GROQ_API_KEY missing', async () => {
    const res = await handleDemo(jsonReq({ prompt: 'hi' }), { ...mkEnv(), GROQ_API_KEY: undefined } as Env);
    expect(res.status).toBe(503);
  });

  it('502 when adapter throws', async () => {
    vi.mocked(groqAdapter.call).mockRejectedValueOnce(new Error('upstream down'));
    const res = await handleDemo(jsonReq({ prompt: 'hi' }), mkEnv());
    expect(res.status).toBe(502);
  });

  it('falls back to x-forwarded-for when cf-connecting-ip absent', async () => {
    const req = new Request('https://x.test/v1/demo', {
      method: 'POST',
      headers: { 'x-forwarded-for': '5.6.7.8, 9.9.9.9' },
      body: JSON.stringify({ prompt: 'hi' }),
    });
    const res = await handleDemo(req, mkEnv());
    expect(res.status).toBe(200);
  });

  it('uses "unknown" ip when no headers present', async () => {
    const req = new Request('https://x.test/v1/demo', {
      method: 'POST', body: JSON.stringify({ prompt: 'hi' }),
    });
    const res = await handleDemo(req, mkEnv());
    expect(res.status).toBe(200);
  });
});
