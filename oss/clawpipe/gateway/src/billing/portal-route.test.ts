/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handlePortal } from './portal-route';
import type { Env } from '../types';

const ORIGINAL_FETCH = globalThis.fetch;

function mockLSResponse(status: number, body: unknown): void {
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    });
  }) as typeof fetch;
}

function makeEnv(customerId: string | null): Env {
  const prepare = (_sql: string) => ({
    bind: (_id: string) => ({
      first: async <T>(): Promise<T> => {
        return { ls_customer_id: customerId } as unknown as T;
      },
    }),
  });
  return {
    DB: { prepare } as unknown as D1Database,
    CACHE: {} as KVNamespace,
    ENVIRONMENT: 'test',
    LEMONSQUEEZY_API_KEY: 'ls_test_key',
  } as unknown as Env;
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('handlePortal', () => {
  it('returns 404 when ls_customer_id is null', async () => {
    const res = await handlePortal(makeEnv(null), 'proj_1');
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('no_active_subscription');
  });

  it('returns 200 with {url} on happy path', async () => {
    mockLSResponse(200, {
      data: {
        attributes: {
          urls: {
            customer_portal: 'https://store.lemonsqueezy.com/billing?token=abc',
          },
        },
      },
    });
    const res = await handlePortal(makeEnv('cust_123'), 'proj_1');
    expect(res.status).toBe(200);
    const json = await res.json() as { url: string };
    expect(json.url).toBe('https://store.lemonsqueezy.com/billing?token=abc');
  });

  it('returns 502 when LS errors', async () => {
    mockLSResponse(500, { errors: [{ detail: 'down' }] });
    const res = await handlePortal(makeEnv('cust_123'), 'proj_1');
    expect(res.status).toBe(502);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('lemonsqueezy_unavailable');
  });
});
