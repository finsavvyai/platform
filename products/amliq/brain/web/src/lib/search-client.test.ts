import { describe, expect, it } from 'vitest';
import { buildFixture, runSearch, sourceLabel } from './search-client.ts';

describe('runSearch', () => {
  it('returns missing_query error for empty/whitespace query', async () => {
    const r = await runSearch('   ', { tenantId: 't1' });
    expect(r).toEqual({ ok: false, error: 'missing_query' });
  });

  it('returns fixture when baseUrl is not provided', async () => {
    const r = await runSearch('beneficial owner', { tenantId: 't1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.query).toBe('beneficial owner');
      expect(r.results.length).toBeGreaterThan(0);
    }
  });

  it('calls the real endpoint when baseUrl is set, with bearer + tenant', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({
          ok: true,
          query: 'x',
          latencyMs: 5,
          results: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const r = await runSearch('x', {
      tenantId: 'tenant-7',
      baseUrl: 'https://brain.example',
      token: 'tok',
      fetchImpl,
    });
    expect(r.ok).toBe(true);
    const [url, init] = calls[0]!;
    expect(url).toBe('https://brain.example/v1/search');
    expect(init!.method).toBe('POST');
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    const body = JSON.parse(init!.body as string) as {
      q: string;
      tenant_id: string;
    };
    expect(body.q).toBe('x');
    expect(body.tenant_id).toBe('tenant-7');
  });

  it('omits Authorization header when no token provided', async () => {
    const calls: [string | URL | Request, RequestInit | undefined][] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(
        JSON.stringify({ ok: true, query: 'x', latencyMs: 1, results: [] }),
        { status: 200 },
      );
    };
    await runSearch('x', {
      tenantId: 't',
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    const headers = calls[0]![1]!.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('returns network_error when fetch throws', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('boom');
    };
    const r = await runSearch('x', {
      tenantId: 't',
      baseUrl: 'https://brain.example',
      fetchImpl,
    });
    expect(r).toEqual({ ok: false, error: 'network_error' });
  });
});

describe('sourceLabel', () => {
  it.each([
    ['fincen_rss', 'FinCEN'],
    ['ffiec_pdf', 'FFIEC'],
    ['ofac', 'OFAC'],
    ['ecb', 'ECB'],
    ['fca', 'FCA'],
    ['internal', 'Internal'],
    ['unknown_src', 'unknown_src'],
  ])('maps %s → %s', (src, expected) => {
    expect(sourceLabel(src)).toBe(expected);
  });
});

describe('buildFixture', () => {
  it('produces results referencing the query text in snippets', () => {
    const fx = buildFixture('beneficial owner');
    expect(fx.results).toHaveLength(2);
    expect(fx.results[0]!.snippet).toContain('beneficial owner');
  });
});
