import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerCustomHostname,
  deleteCustomHostname,
  getDnsInstructions,
} from './custom-hostname.js';

interface FetchCall { url: string; method: string; body: string | null }

function captureFetch(): { calls: FetchCall[]; respond: (body: unknown, init?: ResponseInit) => void; respondInOrder: (responses: Array<{ body: unknown; init?: ResponseInit }>) => void } {
  const calls: FetchCall[] = [];
  let queue: Array<{ body: unknown; init?: ResponseInit }> = [];
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : null;
    calls.push({ url, method, body });
    const next = queue.shift();
    if (next) return new Response(JSON.stringify(next.body), next.init ?? {});
    return new Response(JSON.stringify({ success: true, result: {} }));
  });
  vi.stubGlobal('fetch', fetchSpy);
  return {
    calls,
    respond: (body, init) => { queue = [{ body, init }]; },
    respondInOrder: (rs) => { queue = rs; },
  };
}

describe('registerCustomHostname', () => {
  let f: ReturnType<typeof captureFetch>;

  beforeEach(() => { f = captureFetch(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns success + verificationTxt when CF API returns txt_name + txt_value', async () => {
    f.respond({
      success: true,
      result: {
        id: 'cf_123', hostname: 'app.example.com', status: 'pending_validation',
        ssl: { txt_name: '_acme-challenge.app', txt_value: 'tf-v=abc', status: 'pending' },
      },
    });
    const r = await registerCustomHostname('app.example.com', 'cf_token', 'zone_x');
    expect(r.success).toBe(true);
    expect(r.hostname).toBe('app.example.com');
    expect(r.status).toBe('pending_validation');
    expect(r.verificationTxt).toBe('_acme-challenge.app TXT tf-v=abc');
  });

  it('omits verificationTxt when ssl.txt_name or txt_value is missing', async () => {
    f.respond({
      success: true,
      result: {
        id: 'cf_123', hostname: 'app.example.com', status: 'active',
        ssl: { status: 'active' },
      },
    });
    const r = await registerCustomHostname('app.example.com', 'cf_token', 'zone_x');
    expect(r.success).toBe(true);
    expect(r.verificationTxt).toBeUndefined();
  });

  it('returns success=false with errors[0].message when CF rejects', async () => {
    f.respond({
      success: false,
      errors: [{ message: 'Hostname already in use' }],
    });
    const r = await registerCustomHostname('taken.example.com', 'cf_token', 'zone_x');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Hostname already in use');
  });

  it('returns generic fallback error when CF rejects without errors array', async () => {
    f.respond({ success: false });
    const r = await registerCustomHostname('x.example.com', 'cf_token', 'zone_x');
    expect(r.success).toBe(false);
    expect(r.error).toBe('Failed to register hostname');
  });

  it('POSTs to /zones/{zoneId}/custom_hostnames with TLS 1.2 minimum + dv method', async () => {
    f.respond({ success: true, result: { id: 'cf_1', hostname: 'x', status: 'pending', ssl: { status: 'pending' } } });
    await registerCustomHostname('x.example.com', 'cf_token', 'zone_x');
    const call = f.calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.cloudflare.com/client/v4/zones/zone_x/custom_hostnames');
    const body = JSON.parse(call.body!);
    expect(body.hostname).toBe('x.example.com');
    expect(body.ssl.method).toBe('txt');
    expect(body.ssl.type).toBe('dv');
    expect(body.ssl.settings.min_tls_version).toBe('1.2');
  });
});

describe('deleteCustomHostname', () => {
  let f: ReturnType<typeof captureFetch>;

  beforeEach(() => { f = captureFetch(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('returns early without DELETE when CF list returns no matching hostname', async () => {
    f.respondInOrder([
      { body: { result: [] } }, // list returns empty
    ]);
    await deleteCustomHostname('missing.example.com', 'cf_token', 'zone_x');
    // Only the list fetch — no DELETE
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.method).toBe('GET');
  });

  it('issues DELETE to /custom_hostnames/{id} when list returns a match', async () => {
    f.respondInOrder([
      { body: { result: [{ id: 'cf_existing_42' }] } },
      { body: { success: true } },
    ]);
    await deleteCustomHostname('app.example.com', 'cf_token', 'zone_x');
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1]!.method).toBe('DELETE');
    expect(f.calls[1]!.url).toBe('https://api.cloudflare.com/client/v4/zones/zone_x/custom_hostnames/cf_existing_42');
  });
});

describe('getDnsInstructions', () => {
  it('returns the canonical CNAME line with the proxy worker target', () => {
    const out = getDnsInstructions('app.example.com');
    expect(out.cname).toBe('app.example.com CNAME tokenforge-proxy.broad-dew-49ad.workers.dev');
  });

  it('provides instructions for all 5 supported DNS providers', () => {
    const out = getDnsInstructions('app.example.com');
    const names = out.providers.map((p) => p.name).sort();
    expect(names).toEqual(['AWS Route53', 'Cloudflare', 'GoDaddy', 'Namecheap', 'Vercel']);
    // Each instruction string mentions the target
    for (const p of out.providers) {
      expect(p.instructions).toContain('tokenforge-proxy.broad-dew-49ad.workers.dev');
    }
  });
});
