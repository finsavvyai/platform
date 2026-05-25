/**
 * AES-GCM + HKDF encryption with per-context key separation and AAD.
 *
 * Ciphertext formats:
 *   v2:<base64(iv(12) || ciphertext+tag)>  — AAD-bound, context-derived key
 *   <base64(iv(12) || ciphertext+tag)>     — legacy, global key, no AAD
 *
 * When a context string (`aad`) is supplied, both the HKDF `info` field
 * (so different contexts derive different AES keys) AND the GCM
 * `additionalData` (so ciphertexts cannot be moved between contexts)
 * are bound to it. Tenants should pass a context like
 * `vault:{userId}:{instanceId}:{key}` so that leaking one ciphertext or
 * one derived subkey does not weaken any other tenant's data.
 */

const ALGO = 'AES-GCM';
const IV_LENGTH = 12;
const V2_PREFIX = 'v2:';
const LEGACY_SALT = new TextEncoder().encode('opensyber-vault-v1');
const LEGACY_INFO = new TextEncoder().encode('aes-gcm-key');

async function importKeyMaterial(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );
}

async function deriveContextKey(secret: string, context: string): Promise<CryptoKey> {
  const material = await importKeyMaterial(secret);
  const encoder = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`opensyber-vault-v2:${context}`),
      info: encoder.encode(context),
    },
    material,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function deriveLegacyKey(secret: string): Promise<CryptoKey> {
  const material = await importKeyMaterial(secret);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: LEGACY_SALT, info: LEGACY_INFO },
    material,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encrypt(plaintext: string, secret: string, aad?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const pt = new TextEncoder().encode(plaintext);

  if (aad) {
    const key = await deriveContextKey(secret, aad);
    const additionalData = new TextEncoder().encode(aad);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv, additionalData }, key, pt));
    const combined = new Uint8Array(IV_LENGTH + ct.byteLength);
    combined.set(iv, 0);
    combined.set(ct, IV_LENGTH);
    return `${V2_PREFIX}${bytesToBase64(combined)}`;
  }

  const key = await deriveLegacyKey(secret);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, key, pt));
  const combined = new Uint8Array(IV_LENGTH + ct.byteLength);
  combined.set(iv, 0);
  combined.set(ct, IV_LENGTH);
  return bytesToBase64(combined);
}

export async function decrypt(ciphertext: string, secret: string, aad?: string): Promise<string> {
  if (ciphertext.startsWith(V2_PREFIX)) {
    if (!aad) throw new Error('AAD required to decrypt v2 ciphertext');
    const data = base64ToBytes(ciphertext.slice(V2_PREFIX.length));
    const iv = data.slice(0, IV_LENGTH);
    const body = data.slice(IV_LENGTH);
    const key = await deriveContextKey(secret, aad);
    const additionalData = new TextEncoder().encode(aad);
    const pt = await crypto.subtle.decrypt({ name: ALGO, iv, additionalData }, key, body);
    return new TextDecoder().decode(pt);
  }

  const data = base64ToBytes(ciphertext);
  const iv = data.slice(0, IV_LENGTH);
  const body = data.slice(IV_LENGTH);
  const key = await deriveLegacyKey(secret);
  const pt = await crypto.subtle.decrypt({ name: ALGO, iv }, key, body);
  return new TextDecoder().decode(pt);
}

/** Build a canonical AAD string for vault entries bound to (user, instance, key). */
export function vaultAad(userId: string, instanceId: string, key: string): string {
  return `vault:${userId}:${instanceId}:${key}`;
}
