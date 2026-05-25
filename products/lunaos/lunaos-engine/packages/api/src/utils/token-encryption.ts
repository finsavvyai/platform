/**
 * Token encryption utilities using AES-GCM (Web Crypto API)
 * Encrypts OAuth tokens before storage, decrypts on retrieval.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM
const ALGORITHM = 'AES-GCM';

/**
 * Derive a CryptoKey from a string secret using PBKDF2 -> AES-GCM
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('lunaos-token-encryption-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt a plaintext token using AES-GCM.
 * Returns `iv:ciphertext` in base64.
 *
 * @param token - The plaintext token to encrypt
 * @param secret - Encryption key (OAUTH_ENCRYPTION_KEY or JWT_SECRET)
 * @returns Encrypted string in format `base64(iv):base64(ciphertext)`
 */
export async function encryptToken(
  token: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(token),
  );

  const ivB64 = bufferToBase64(iv.buffer);
  const ctB64 = bufferToBase64(ciphertext);

  return `${ivB64}:${ctB64}`;
}

/**
 * Decrypt an encrypted token (format: `base64(iv):base64(ciphertext)`).
 *
 * @param encrypted - The encrypted string from encryptToken
 * @param secret - Same secret used for encryption
 * @returns Decrypted plaintext token
 * @throws Error if decryption fails (wrong key, tampered data)
 */
export async function decryptToken(
  encrypted: string,
  secret: string,
): Promise<string> {
  const colonIndex = encrypted.indexOf(':');
  if (colonIndex === -1) {
    throw new Error('Invalid encrypted token format');
  }

  const ivB64 = encrypted.substring(0, colonIndex);
  const ctB64 = encrypted.substring(colonIndex + 1);

  const key = await deriveKey(secret);
  const iv = new Uint8Array(base64ToBuffer(ivB64));
  const ciphertext = base64ToBuffer(ctB64);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return decoder.decode(plaintext);
}
