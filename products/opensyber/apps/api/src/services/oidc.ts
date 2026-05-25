import type { OidcUserInfo } from '@opensyber/shared';

interface OidcEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  jwksUri: string;
}

/**
 * Reject URLs that resolve (or textually point) at private / loopback /
 * link-local / cloud-metadata hosts, and reject anything that is not HTTPS.
 * DNS rebinding is not handled here — callers must re-validate after any
 * redirect. This is best-effort SSRF prevention at the syntactic layer.
 */
function assertSafeExternalHttps(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid OIDC issuer URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('OIDC issuer must use HTTPS');
  }
  const host = url.hostname.toLowerCase();
  // Literal IPs / special hostnames that point at the local machine or
  // internal networks. Hostname-based matches only; DNS lookup is handled
  // by the runtime.
  const forbidden = [
    '127.', '10.', '192.168.', '169.254.',
    '0.0.0.0', 'localhost', 'metadata.google.internal',
    '::1', 'fe80:', 'fc00:', 'fd00:',
  ];
  for (const prefix of forbidden) {
    if (host === prefix || host.startsWith(prefix)) {
      throw new Error(`Refusing OIDC discovery against restricted host: ${host}`);
    }
  }
  // 172.16.0.0/12 — check the first two octets
  if (host.startsWith('172.')) {
    const second = parseInt(host.split('.')[1] ?? '', 10);
    if (second >= 16 && second <= 31) {
      throw new Error(`Refusing OIDC discovery against restricted host: ${host}`);
    }
  }
  return url;
}

/** Fetch OIDC provider endpoints from .well-known/openid-configuration. */
export async function discoverEndpoints(issuerUrl: string): Promise<OidcEndpoints> {
  assertSafeExternalHttps(issuerUrl);
  const url = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
  // Final URL is re-validated to catch trailing slash edge cases.
  assertSafeExternalHttps(url);
  const res = await fetch(url, { redirect: 'error' });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const config = await res.json() as Record<string, string>;
  const authorizationEndpoint = config.authorization_endpoint;
  const tokenEndpoint = config.token_endpoint;
  const userinfoEndpoint = config.userinfo_endpoint;
  const jwksUri = config.jwks_uri;
  if (!authorizationEndpoint || !tokenEndpoint || !userinfoEndpoint || !jwksUri) {
    throw new Error('OIDC discovery response missing required endpoints');
  }
  return { authorizationEndpoint, tokenEndpoint, userinfoEndpoint, jwksUri };
}

/** Generate a random PKCE code verifier (43-128 chars, URL-safe). */
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/** Compute SHA-256 code challenge from verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/** Build the authorization URL with PKCE params. */
export function buildAuthUrl(
  authorizationEndpoint: string,
  clientId: string,
  redirectUri: string,
  state: string,
  codeChallenge: string,
  scopes: string[] = ['openid', 'email', 'profile'],
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: scopes.join(' '),
  });
  return `${authorizationEndpoint}?${params.toString()}`;
}

interface TokenResponse {
  accessToken: string;
  idToken: string | null;
  tokenType: string;
  expiresIn: number;
}

/** Exchange authorization code for tokens. */
export async function exchangeCode(
  tokenEndpoint: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json() as Record<string, unknown>;
  return {
    accessToken: data.access_token as string,
    idToken: (data.id_token as string) ?? null,
    tokenType: data.token_type as string,
    expiresIn: data.expires_in as number,
  };
}

/** Fetch user info from the OIDC provider's userinfo endpoint. */
export async function fetchUserInfo(
  accessToken: string,
  userinfoEndpoint: string,
): Promise<OidcUserInfo> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo fetch failed: ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  return {
    email: data.email as string,
    name: (data.name as string) ?? null,
    groups: Array.isArray(data.groups) ? data.groups as string[] : [],
    sub: data.sub as string,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
