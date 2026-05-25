import { describe, it, expect, vi } from 'vitest';
import { fetchDiscovery, fetchJwks, DiscoveryError } from './oidc-discovery.js';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('fetchDiscovery', () => {
  it('fetches the well-known doc', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        issuer: 'https://idp.test',
        authorization_endpoint: 'https://idp.test/auth',
        token_endpoint: 'https://idp.test/token',
        jwks_uri: 'https://idp.test/jwks',
      }),
    ) as unknown as typeof globalThis.fetch;
    const d = await fetchDiscovery('https://idp.test', { fetchImpl });
    expect(d.jwks_uri).toBe('https://idp.test/jwks');
  });

  it('rejects when issuer in doc does not match the input', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        issuer: 'https://other.test',
        authorization_endpoint: 'https://idp.test/auth',
        token_endpoint: 'https://idp.test/token',
        jwks_uri: 'https://idp.test/jwks',
      }),
    ) as unknown as typeof globalThis.fetch;
    await expect(fetchDiscovery('https://idp.test', { fetchImpl })).rejects.toBeInstanceOf(DiscoveryError);
  });

  it('rejects when required fields are missing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({})) as unknown as typeof globalThis.fetch;
    await expect(fetchDiscovery('https://idp.test', { fetchImpl })).rejects.toBeInstanceOf(DiscoveryError);
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof globalThis.fetch;
    await expect(fetchDiscovery('https://idp.test', { fetchImpl })).rejects.toBeInstanceOf(DiscoveryError);
  });

  it('strips trailing slash from issuer when comparing', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        issuer: 'https://idp.test',
        authorization_endpoint: 'https://idp.test/auth',
        token_endpoint: 'https://idp.test/token',
        jwks_uri: 'https://idp.test/jwks',
      }),
    ) as unknown as typeof globalThis.fetch;
    const d = await fetchDiscovery('https://idp.test/', { fetchImpl });
    expect(d.issuer).toBe('https://idp.test');
  });
});

describe('fetchJwks', () => {
  it('returns the keys array', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ keys: [{ kty: 'RSA', kid: 'k1' }] }),
    ) as unknown as typeof globalThis.fetch;
    const r = await fetchJwks('https://idp.test/jwks', { fetchImpl });
    expect(r.keys).toHaveLength(1);
  });

  it('throws on missing keys array', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({})) as unknown as typeof globalThis.fetch;
    await expect(fetchJwks('https://idp.test/jwks', { fetchImpl })).rejects.toBeInstanceOf(DiscoveryError);
  });

  it('throws on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof globalThis.fetch;
    await expect(fetchJwks('https://idp.test/jwks', { fetchImpl })).rejects.toBeInstanceOf(DiscoveryError);
  });
});
