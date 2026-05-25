/** Per-project provider key storage — AES-256-GCM encryption via Web Crypto. */

import type { Env } from '../types';

const ENC = 'AES-GCM';
const KEY_LEN = 256;
const NONCE_LEN = 12;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = enc.encode(secret);
  const base = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode('provider-keys-v1') },
    base,
    { name: ENC, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt'],
  );
}

function b64enc(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64dec(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Encrypt plaintext with AES-256-GCM. Returns base64 ciphertext + nonce. */
export async function encryptValue(
  plaintext: string,
  secret: string,
): Promise<{ ciphertextB64: string; nonceB64: string }> {
  if (!secret || secret.length < 32) {
    throw new Error('PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  }
  const key = await deriveKey(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: ENC, iv: nonce }, key, enc.encode(plaintext));
  return { ciphertextB64: b64enc(ciphertext), nonceB64: b64enc(nonce.buffer) };
}

/** Decrypt AES-256-GCM ciphertext. Throws if tampered or wrong secret. */
export async function decryptValue(
  ciphertextB64: string,
  nonceB64: string,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error('PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  }
  const key = await deriveKey(secret);
  const nonce = b64dec(nonceB64);
  const ciphertext = b64dec(ciphertextB64);
  const plain = await crypto.subtle.decrypt({ name: ENC, iv: nonce }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

/** Store (upsert) an encrypted provider key for a project. */
export async function storeProviderKey(
  env: Env,
  projectId: string,
  provider: string,
  plaintext: string,
): Promise<void> {
  const secret = env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('PROVIDER_KEY_ENCRYPTION_SECRET is not configured');
  const { ciphertextB64, nonceB64 } = await encryptValue(plaintext, secret);
  await env.DB.prepare(
    `INSERT INTO provider_keys (project_id, provider, ciphertext_b64, nonce_b64, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(project_id, provider) DO UPDATE SET
       ciphertext_b64 = excluded.ciphertext_b64,
       nonce_b64      = excluded.nonce_b64,
       created_at     = excluded.created_at`,
  ).bind(projectId, provider, ciphertextB64, nonceB64).run();
}

/** Read and decrypt a provider key for a project. Returns null if not stored. */
export async function readProviderKey(
  env: Env,
  projectId: string,
  provider: string,
): Promise<string | null> {
  const secret = env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;
  const row = await env.DB.prepare(
    'SELECT ciphertext_b64, nonce_b64 FROM provider_keys WHERE project_id = ? AND provider = ?',
  ).bind(projectId, provider).first<{ ciphertext_b64: string; nonce_b64: string }>();
  if (!row) return null;
  return decryptValue(row.ciphertext_b64, row.nonce_b64, secret);
}

/** Delete a provider key row for a project. */
export async function deleteProviderKey(
  env: Env,
  projectId: string,
  provider: string,
): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM provider_keys WHERE project_id = ? AND provider = ?',
  ).bind(projectId, provider).run();
}
