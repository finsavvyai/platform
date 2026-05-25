import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billingApi } from './billing';

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  localStorage.setItem('pushci_token', 'tok');
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('billingApi.checkout', () => {
  it('POSTs the plan and includes an Idempotency-Key header', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ url: 'https://ls/co' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await billingApi.checkout({ plan: 'pro' }, 'idem-123');
    expect(result.url).toBe('https://ls/co');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ plan: 'pro' }));
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('idem-123');
  });

  it('forwards a discount_code when provided', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ url: 'https://ls/co' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await billingApi.checkout({ plan: 'team', discount_code: 'AMISRAEL2026' });
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(JSON.parse(body)).toEqual({ plan: 'team', discount_code: 'AMISRAEL2026' });
  });

  it('generates a unique key when none is provided', () => {
    const a = billingApi.newIdempotencyKey();
    const b = billingApi.newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('billingApi.portal', () => {
  it('GETs the portal URL', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ url: 'https://ls/portal' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const out = await billingApi.portal();
    expect(out.url).toBe('https://ls/portal');
  });
});
