import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requestLog } from './request-log.js';
import type { Env, Variables } from '../types.js';

interface FakeKV {
  store: Map<string, string>;
  get: (k: string) => Promise<string | null>;
  put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void>;
  _puts: Array<{ k: string; v: string; ttl?: number }>;
}

function makeKV(): FakeKV {
  const store = new Map<string, string>();
  const puts: Array<{ k: string; v: string; ttl?: number }> = [];
  return {
    store, _puts: puts,
    get: async (k) => store.get(k) ?? null,
    put: async (k, v, opts) => { store.set(k, v); puts.push({ k, v, ttl: opts?.expirationTtl }); },
  };
}

const ctx = {
  waitUntil: vi.fn(async (p: Promise<unknown>) => { await p; }),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

function appWith(tenantId?: string, routeHandler?: (c: { json: (b: unknown, s?: number) => Response; text: (s: string) => Response }) => Response) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => {
    if (tenantId !== undefined) c.set('tenantId', tenantId);
    await next();
  });
  app.use('*', requestLog);
  app.get('/x', routeHandler ?? ((c) => c.text('ok')));
  return app;
}

let kv: FakeKV;
let consoleSpy: ReturnType<typeof vi.spyOn>;
const env = () => ({ CACHE: kv as unknown as KVNamespace }) as unknown as Env;

beforeEach(() => {
  kv = makeKV();
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function fetchWith(app: ReturnType<typeof appWith>, headers: Record<string, string> = {}): Promise<Response> {
  return app.fetch(new Request('http://localhost/x', { headers }), env(), ctx);
}

describe('requestLog middleware', () => {
  it('console.logs a JSON entry with method/path/status/latency/tenantId/ip/country', async () => {
    await fetchWith(appWith('t_acme'), {
      'cf-connecting-ip': '1.2.3.4', 'cf-ipcountry': 'US',
    });
    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(logged.method).toBe('GET');
    expect(logged.path).toBe('/x');
    expect(logged.status).toBe(200);
    expect(logged.tenantId).toBe('t_acme');
    expect(logged.ip).toBe('1.2.3.4');
    expect(logged.country).toBe('US');
    expect(typeof logged.latency).toBe('number');
    expect(typeof logged.ts).toBe('string');
  });

  it('records tenantId="anonymous" when no tenantId is set in context', async () => {
    await fetchWith(appWith()); // no tenantId
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { tenantId: string };
    expect(logged.tenantId).toBe('anonymous');
  });

  it('records ip="" and country="" when CF headers are absent (non-Cloudflare runtime)', async () => {
    await fetchWith(appWith('t_x'));
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { ip: string; country: string };
    expect(logged.ip).toBe('');
    expect(logged.country).toBe('');
  });

  it('persists the entry to KV with `log:` prefix and 7-day TTL', async () => {
    await fetchWith(appWith('t_acme'), { 'cf-connecting-ip': '1.2.3.4' });
    expect(kv._puts).toHaveLength(1);
    const put = kv._puts[0]!;
    expect(put.k.startsWith('log:')).toBe(true);
    expect(put.ttl).toBe(604800); // 7 days in seconds
    const persisted = JSON.parse(put.v) as { tenantId: string };
    expect(persisted.tenantId).toBe('t_acme');
  });

  it('records the response status code (downstream handler 404 ⇒ logged 404)', async () => {
    const app = appWith('t_x', (c) => c.text('not found') as never);
    // Override route to return 404 by intercepting after middleware
    const app2 = new Hono<{ Bindings: Env; Variables: Variables }>();
    app2.use('*', requestLog);
    app2.get('/x', (c) => c.text('not found', 404));
    await app2.fetch(new Request('http://localhost/x'), env(), ctx);
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { status: number };
    expect(logged.status).toBe(404);
    void app;
  });

  it('measures latency as a non-negative integer (ms)', async () => {
    await fetchWith(appWith('t_x'));
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { latency: number };
    expect(logged.latency).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(logged.latency)).toBe(true);
  });

  it('keys are unique per request (timestamp + uuid prefix)', async () => {
    await fetchWith(appWith('t_x'));
    await fetchWith(appWith('t_x'));
    expect(kv._puts).toHaveLength(2);
    expect(kv._puts[0]!.k).not.toBe(kv._puts[1]!.k);
  });

  it('ts field is an ISO 8601 string (parseable by Date)', async () => {
    await fetchWith(appWith('t_x'));
    const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { ts: string };
    expect(logged.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Number.isFinite(new Date(logged.ts).getTime())).toBe(true);
  });
});
