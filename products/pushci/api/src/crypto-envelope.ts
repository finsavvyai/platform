// AES-256-GCM envelope encryption for credentials stored in KV.
// Fixes L-003: AWS credentials were written to KV as plain JSON. With
// this helper, the wire format in KV becomes:
//
//   { v: 1, iv: <base64url>, ct: <base64url> }
//
// where `ct` is AES-GCM(plaintext) bound to a 12-byte random nonce.
//
// Key management:
// - 32-byte master key supplied via Cloudflare Worker secret
//   `PUSHCI_CRED_ENCRYPTION_KEY` (base64-encoded).
// - Key is never logged and never leaves the worker.
// - Authenticated data ("AAD") is pinned to "pushci:creds:v1" so that
//   re-using a ciphertext blob against a different namespace fails the
//   GCM authentication tag.
//
// Rotation: write a new secret, redeploy. Legacy plain-JSON values are
// accepted on read via tryDecrypt(); the next write re-encrypts.

const enc = new TextEncoder();
const dec = new TextDecoder();
const AAD_CREDS_V1 = enc.encode("pushci:creds:v1");

export interface EncryptedBlob {
  v: 1;
  iv: string;
  ct: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function importKey(rawKeyB64: string): Promise<CryptoKey> {
  const raw = b64urlDecode(rawKeyB64);
  if (raw.length !== 32) {
    throw new Error(
      `PUSHCI_CRED_ENCRYPTION_KEY must decode to 32 bytes, got ${raw.length}`
    );
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a UTF-8 plaintext string. Returns a JSON envelope string. */
export async function encryptCreds(plain: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD_CREDS_V1 },
    key,
    enc.encode(plain)
  );
  const blob: EncryptedBlob = {
    v: 1,
    iv: b64urlEncode(iv),
    ct: b64urlEncode(new Uint8Array(ctBuf)),
  };
  return JSON.stringify(blob);
}

/** Decrypt a JSON envelope produced by encryptCreds. Throws on tamper. */
export async function decryptCreds(cipher: string, keyB64: string): Promise<string> {
  const parsed = JSON.parse(cipher) as Partial<EncryptedBlob>;
  if (parsed.v !== 1 || typeof parsed.iv !== "string" || typeof parsed.ct !== "string") {
    throw new Error("envelope: unsupported format");
  }
  const key = await importKey(keyB64);
  const iv = b64urlDecode(parsed.iv);
  const ct = b64urlDecode(parsed.ct);
  const ptBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: AAD_CREDS_V1 },
    key,
    ct
  );
  return dec.decode(ptBuf);
}

/** Returns true iff `raw` parses as an EncryptedBlob v1 envelope. */
export function isEnvelope(raw: string): boolean {
  try {
    const p = JSON.parse(raw) as Partial<EncryptedBlob>;
    return p?.v === 1 && typeof p.iv === "string" && typeof p.ct === "string";
  } catch {
    return false;
  }
}

/**
 * Read a KV value that may be either legacy plain JSON or an envelope.
 * Returns the plaintext JSON string on success. Missing key → null.
 * Missing master secret with an envelope payload → throws (we cannot
 * decrypt without the key; returning null would silently mask the
 * broken config).
 */
export async function tryDecrypt(
  raw: string | null,
  keyB64: string | undefined
): Promise<string | null> {
  if (raw == null) return null;
  if (!isEnvelope(raw)) return raw; // legacy plaintext — migrated on next write
  if (!keyB64) throw new Error("PUSHCI_CRED_ENCRYPTION_KEY required to decrypt stored creds");
  return decryptCreds(raw, keyB64);
}
