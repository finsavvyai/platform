/**
 * OIDC discovery + JWKS fetcher.
 *
 * Pure HTTP — caller injects the fetch impl so dev / tests run
 * without hitting the network. The JWKS fetch is intentionally
 * cache-friendly: callers re-use the returned object until its TTL
 * expires; we don't ship a built-in cache because Workers KV is
 * better suited to that than a module-level Map.
 */

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
  response_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

export interface DiscoveryDeps {
  fetchImpl?: typeof globalThis.fetch;
}

export async function fetchDiscovery(
  issuer: string,
  deps: DiscoveryDeps = {},
): Promise<OidcDiscovery> {
  const fetchFn = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const url = `${stripTrailingSlash(issuer)}/.well-known/openid-configuration`;
  const res = await fetchFn(url, { method: 'GET' });
  if (!res.ok) throw new DiscoveryError(`discovery_${res.status}`, res.status);
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.issuer || !doc.jwks_uri) {
    throw new DiscoveryError('discovery_missing_fields', 502);
  }
  if (doc.issuer !== issuer && doc.issuer !== stripTrailingSlash(issuer)) {
    throw new DiscoveryError('discovery_issuer_mismatch', 502);
  }
  return doc;
}

export async function fetchJwks(
  jwksUri: string,
  deps: DiscoveryDeps = {},
): Promise<{ keys: unknown[] }> {
  const fetchFn = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const res = await fetchFn(jwksUri, { method: 'GET' });
  if (!res.ok) throw new DiscoveryError(`jwks_${res.status}`, res.status);
  const doc = (await res.json()) as { keys?: unknown[] };
  if (!Array.isArray(doc.keys)) throw new DiscoveryError('jwks_missing_keys', 502);
  return { keys: doc.keys };
}

export class DiscoveryError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}
