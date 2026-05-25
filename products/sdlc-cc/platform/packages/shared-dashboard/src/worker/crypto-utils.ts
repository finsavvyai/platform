/**
 * Cryptography Utilities for Dashboard
 * Password hashing (PBKDF2) and API key hashing (SHA-256)
 *
 * JWT signing/verification is handled by @finsavvyai/auth.
 */

// Module-level JWT secret, set from environment at startup
let JWT_SECRET_KEY = '';

/** Set the JWT secret from environment. Must be >= 32 characters. */
export function setJWTSecret(secret: string) {
  if (!secret || secret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters');
  }
  JWT_SECRET_KEY = secret;
}

/** Get the current JWT secret. Throws if not set. */
export function getJWTSecret(): string {
  if (!JWT_SECRET_KEY) {
    throw new Error('JWT secret not initialized. Call setJWTSecret() first.');
  }
  return JWT_SECRET_KEY;
}

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', data, 'PBKDF2', false, ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  const hashArray = new Uint8Array(derivedBits);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(hash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const keyMaterial = await crypto.subtle.importKey(
      'raw', data, 'PBKDF2', false, ['deriveBits'],
    );

    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256,
    );

    const newHash = new Uint8Array(derivedBits);

    if (newHash.length !== storedHash.length) {
      return false;
    }

    for (let i = 0; i < newHash.length; i++) {
      if (newHash[i] !== storedHash[i]) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// ── API Key utilities ───────────────────────────────────────

/**
 * Base64 URL encode
 */
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a secure API key
 */
export function generateAPIKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `dk_${base64UrlEncode(array)}`;
}

/**
 * Hash an API key for storage using SHA-256
 */
export async function hashAPIKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  return base64UrlEncode(hashArray);
}
