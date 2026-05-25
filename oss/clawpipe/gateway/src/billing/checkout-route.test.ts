/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleCheckout } from './checkout-route';
import type { Env } from '../types';

interface FetchCall {
  url: string;
  init: RequestInit;
}

const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls: FetchCall[] = [];

function mockLSResponse(status: number, body: unknown): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    });
  }) as typeof fetch;
}

function makeEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return {
    DB: {} as D1Database,
    CACHE: {} as KVNamespace,
    ENVIRONMENT: 'test',
    LEMONSQUEEZY_API_KEY: 'ls_test_key',
    LEMONSQUEEZY_STORE_ID: '12345',
    LEMONSQUEEZY_VARIANT_DEV: '111',
    LEMONSQUEEZY_VARIANT_GROWTH: '222',
    LEMONSQUEEZY_VARIANT_SCALE: '333',
    ...overrides,
  } as unknown as Env;
}

function makeReq(body: unknown): Request {
  return new Request('https://api.clawpipe.ai/v1/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('handleCheckout', () => {
  it('returns 400 on missing variant', async () => {
    const res = await handleCheckout(makeReq({}), makeEnv(), 'proj_1');
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_variant');
  });

  it('returns 400 on unknown variant', async () => {
    const res = await handleCheckout(makeReq({ variant: 'enterprise' }), makeEnv(), 'proj_1');
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('invalid_variant');
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('https://api.clawpipe.ai/v1/billing/checkout', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleCheckout(req, makeEnv(), 'proj_1');
    expect(res.status).toBe(400);
  });

  it('returns 503 when env variant ID is unset', async () => {
    const env = makeEnv({ LEMONSQUEEZY_VARIANT_GROWTH: undefined });
    const res = await handleCheckout(makeReq({ variant: 'growth' }), env, 'proj_1');
    expect(res.status).toBe(503);
    const json = await res.json() as { error: string; variant: string };
    expect(json.error).toBe('billing_not_configured');
    expect(json.variant).toBe('growth');
  });

  it('returns 200 with {url, expiresAt} on happy path', async () => {
    mockLSResponse(201, {
      data: {
        attributes: {
          url: 'https://store.lemonsqueezy.com/checkout/abc',
          expires_at: '2026-04-26T00:00:00Z',
        },
      },
    });

    const res = await handleCheckout(makeReq({ variant: 'dev' }), makeEnv(), 'proj_1');
    expect(res.status).toBe(200);
    const json = await res.json() as { url: string; expiresAt: string };
    expect(json.url).toBe('https://store.lemonsqueezy.com/checkout/abc');
    expect(json.expiresAt).toBe('2026-04-26T00:00:00Z');
  });

  it('forwards email and projectId into the LS call', async () => {
    mockLSResponse(201, {
      data: { attributes: { url: 'https://x', expires_at: 'now' } },
    });

    const res = await handleCheckout(
      makeReq({ variant: 'scale', email: 'user@example.com' }),
      makeEnv(),
      'proj_xyz',
    );
    expect(res.status).toBe(200);
    expect(fetchCalls).toHaveLength(1);
    const sent = JSON.parse(fetchCalls[0].init.body as string);
    expect(sent.data.attributes.checkout_data.email).toBe('user@example.com');
    expect(sent.data.attributes.checkout_data.custom.project_id).toBe('proj_xyz');
    expect(sent.data.relationships.variant.data.id).toBe('333');
  });

  it('returns 502 if LS responds non-2xx', async () => {
    mockLSResponse(500, { errors: [{ detail: 'boom' }] });
    const res = await handleCheckout(makeReq({ variant: 'dev' }), makeEnv(), 'proj_1');
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string; detail: string };
    expect(json.error).toBe('lemonsqueezy_unavailable');
    expect(json.detail).toMatch(/500/);
  });
});
