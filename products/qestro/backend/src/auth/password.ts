/**
 * Workers-compatible password hashing using PBKDF2 (crypto.subtle).
 * Format: "hex-salt:hex-hash"
 * 100k iterations, SHA-256, 256-bit derived key.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const SALT_LENGTH = 16; // bytes

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    KEY_LENGTH,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const derived = await deriveKey(password, salt);
  return `${toHex(salt)}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = fromHex(saltHex);
  const derived = await deriveKey(password, salt);
  return toHex(derived) === hashHex;
}
