/**
 * Minimal HS256 JWT utilities for Cloudflare Workers.
 */

const encoder = new TextEncoder();

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(secret) {
  if (!secret) {
    throw new Error('JWT secret not configured');
  }

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJWT(payload, secret, options = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresIn || 3600;

  const body = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(body)));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

export async function verifyJWT(token, secret) {
  try {
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    const key = await importKey(secret);
    const signatureBytes = base64UrlDecode(signature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(data)
    );

    if (!isValid) {
      return null;
    }

    const payloadBytes = base64UrlDecode(payload);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const parsed = JSON.parse(payloadJson);

    if (parsed.exp && parsed.exp < Date.now() / 1000) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}
