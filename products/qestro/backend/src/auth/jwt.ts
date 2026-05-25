/**
 * Workers-compatible JWT implementation using crypto.subtle (HMAC-SHA256).
 * No Node.js dependencies -- runs on Cloudflare Workers and in tests.
 */

// ---------- helpers ----------

function base64urlEncode(data: Uint8Array): string {
  const binStr = Array.from(data, (b) => String.fromCharCode(b)).join('');
  return btoa(binStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binStr = atob(padded);
  return Uint8Array.from(binStr, (c) => c.charCodeAt(0));
}

function textEncode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

// ---------- HMAC key ----------

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(textEncode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// ---------- sign ----------

export interface JWTPayload {
  [key: string]: unknown;
  iat?: number;
  exp?: number;
}

export async function signJWT(
  payload: JWTPayload,
  secret: string,
  expiresInSecs = 86400,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSecs };

  const header = base64urlEncode(textEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64urlEncode(textEncode(JSON.stringify(fullPayload)));
  const signingInput = `${header}.${body}`;

  const key = await getKey(secret);
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, toArrayBuffer(textEncode(signingInput))),
  );

  return `${signingInput}.${base64urlEncode(sig)}`;
}

// ---------- verify ----------

export async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }

  const [header, body, signature] = parts;
  const signingInput = `${header}.${body}`;

  const key = await getKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(base64urlDecode(signature)),
    toArrayBuffer(textEncode(signingInput)),
  );

  if (!valid) {
    throw new Error('Invalid signature');
  }

  const payload: JWTPayload = JSON.parse(
    new TextDecoder().decode(base64urlDecode(body)),
  );

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}
