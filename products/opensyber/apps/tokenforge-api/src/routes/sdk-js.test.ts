import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import { SDK_SCRIPT } from './sdk-script.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({
  guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

import worker from '../index.js';

async function getSdk(env: Env): Promise<Response> {
  return worker.fetch(
    new Request('http://localhost/sdk.js'),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

/** Replays the route's obfuscation to recover the embedded source. */
function decodeObfuscatedSdk(body: string): string {
  // The body shape is `(function(){...var _c=[[...],[...]];...})();`.
  // Extract the JSON array literal that follows `var _c=`.
  const match = body.match(/var _c=(\[\[.*?\]\]);/);
  if (!match) throw new Error('decode: var _c=… not found');
  const chunks = JSON.parse(match[1]!) as number[][];
  let out = '';
  for (const chunk of chunks) {
    for (const code of chunk) out += String.fromCharCode(code);
  }
  return out;
}

describe('GET /sdk.js', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    (globalThis as Record<string, unknown>).__mockDb = createMockDb();
  });

  it('returns 200 with JavaScript content type', async () => {
    const res = await getSdk(env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
  });

  it('sets Cache-Control public + max-age=3600', async () => {
    const res = await getSdk(env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('sets CORS Access-Control-Allow-Origin: *', async () => {
    const res = await getSdk(env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('body is wrapped in an IIFE so it does not pollute global scope', async () => {
    const body = await (await getSdk(env)).text();
    expect(body.startsWith('(function(){')).toBe(true);
    expect(body.endsWith('})();')).toBe(true);
  });

  it('embedded chunks decode back to the original SDK_SCRIPT (round-trip integrity)', async () => {
    const body = await (await getSdk(env)).text();
    const decoded = decodeObfuscatedSdk(body);
    expect(decoded).toBe(SDK_SCRIPT);
  });

  it('contains the domain-lock guard so it refuses to run on unauthorized origins', async () => {
    const body = await (await getSdk(env)).text();
    expect(body).toContain('var _h=location.hostname;');
    expect(body).toContain('"localhost"');
    expect(body).toContain('"127.0.0.1"');
    expect(body).toContain('_h.indexOf(".")>0');
  });

  it('forwards data-api-key and data-api-base from the outer <script> to the inner script element', async () => {
    const body = await (await getSdk(env)).text();
    expect(body).toContain('data-api-key');
    expect(body).toContain('data-api-base');
    expect(body).toContain('document.currentScript');
  });

  it('chunks have at most 64 chars each (chunkSize invariant)', async () => {
    const body = await (await getSdk(env)).text();
    const match = body.match(/var _c=(\[\[.*?\]\]);/);
    expect(match).not.toBeNull();
    const chunks = JSON.parse(match![1]!) as number[][];
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(64);
    }
  });

  it('embeds an integrity check that aborts when decoded length differs from expected', async () => {
    const body = await (await getSdk(env)).text();
    expect(body).toContain(`if(_s.length!==${SDK_SCRIPT.length})return;`);
  });

  it('embeds Date.now() timestamp probe (anti-cache / replay marker)', async () => {
    const body = await (await getSdk(env)).text();
    expect(body).toContain('Date.now()');
  });

  it('uses createElement+textContent+appendChild+removeChild for inner-script attach (no eval/Function)', async () => {
    const body = await (await getSdk(env)).text();
    expect(body).toContain('document.createElement("script")');
    expect(body).toContain('document.head.appendChild');
    expect(body).toContain('document.head.removeChild');
    // Defensive: must NOT use eval or Function constructor (CSP-hostile + slower)
    expect(body).not.toContain('eval(');
    expect(body).not.toContain('new Function(');
  });
});
