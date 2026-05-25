/**
 * GCP Authentication
 *
 * Creates a JWT from a GCP service account key, signs it with RS256
 * using Web Crypto API, and exchanges it for an access token via
 * Google's OAuth2 token endpoint.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const TOKEN_LIFETIME_SECONDS = 3600;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/**
 * Get a GCP access token from a service account JSON key
 */
export async function getGcpAccessToken(serviceAccountKey: string): Promise<string> {
  const key: ServiceAccountKey = JSON.parse(serviceAccountKey);
  if (!key.client_email || !key.private_key) {
    throw new Error('Invalid service account key: missing client_email or private_key');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri ?? TOKEN_URL,
    iat: now,
    exp: now + TOKEN_LIFETIME_SECONDS,
  };

  const jwt = await createSignedJwt(payload, key.private_key);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function createSignedJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${arrayBufferToBase64url(signature)}`;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', binaryDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
