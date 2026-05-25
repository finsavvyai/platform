/** Password hashing using PBKDF2 via Web Crypto API (Workers-compatible). */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/** Hash a password with a random salt. Returns "salt:hash" in hex. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const hash = await crypto.subtle.exportKey('raw', key);
  return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`;
}

/** Verify a password against a stored "salt:hash" string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const key = await deriveKey(password, salt);
  const hash = await crypto.subtle.exportKey('raw', key);
  return toHex(new Uint8Array(hash)) === hashHex;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(password);
  const baseKey = await crypto.subtle.importKey('raw', encoded as BufferSource, 'PBKDF2', false, ['deriveBits', 'deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true,
    ['encrypt'],
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
