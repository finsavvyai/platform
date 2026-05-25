import { vi } from 'vitest';
import type { Env } from '../types.js';

// Re-export createMockDb for backward compatibility
export { createMockDb } from './mock-db.js';

/**
 * Create a mock Env bindings object for tests
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ 1: 1 }) }),
    } as unknown as D1Database,
    CREDENTIAL_VAULT: createMockKV(),
    CACHE: createMockKV(),
    STORAGE: { head: vi.fn().mockResolvedValue(null) } as unknown as R2Bucket,
    ENVIRONMENT: 'test',
    AUTH_SECRET: 'test-auth-secret-for-hmac-verification',
    LEMONSQUEEZY_API_KEY: 'ls_test_fake',
    LEMONSQUEEZY_WEBHOOK_SECRET: 'ls-webhook-secret',
    LEMONSQUEEZY_STORE_ID: '12345',
    OPENSYBER_LS_PRODUCT_ID: '100',
    OPENSYBER_LS_VARIANT_PERSONAL: '200',
    OPENSYBER_LS_VARIANT_PRO: '201',
    OPENSYBER_LS_VARIANT_TEAM: '202',
    CLOUDFLARE_ACCOUNT_ID: 'cf-test-account-id',
    CLOUDFLARE_API_TOKEN: 'cf-test-api-token',
    ENCRYPTION_KEY: 'test-encryption-key',
    RESEND_API_KEY: 'resend-test-key',
    ...overrides,
  };
}

/**
 * Create a mock KV namespace
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string, format?: 'json' | 'text' | 'arrayBuffer' | 'stream') => {
      const value = store.get(key);
      if (value === undefined) return null;
      if (format === 'json') {
        return JSON.parse(value);
      }
      return value;
    }),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
  } as unknown as KVNamespace;
}

/**
 * Generate a valid HMAC-SHA256 signature for webhook testing
 */
export async function generateHmacSignature(
  secret: string,
  payload: string,
  encoding: 'hex' | 'base64' = 'hex',
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  if (encoding === 'hex') {
    return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

/**
 * Create a valid HMAC-SHA256 signed JWT for testing Auth.js token verification.
 */
export async function createTestJwt(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const b64url = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
  const sigB64 = btoa(String.fromCharCode(...sig)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${sigB64}`;
}

/**
 * Create a mock fetch function for route tests.
 * Returns a no-op fetch stub for welcome emails and other background fetches.
 *
 * IMPORTANT: Route tests using this must also mock the auth middleware
 * (see vi.mock('../middleware/auth.js') pattern in newer tests).
 */
export function mockAuthFetch(userId = 'user_test123') {
  return vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
}
