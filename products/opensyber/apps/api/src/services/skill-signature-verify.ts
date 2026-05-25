/**
 * Skill Signature Verification Service
 *
 * Verifies ECDSA P-256 signatures stored in the transparency log.
 * Uses the Web Crypto API for portable signature verification.
 */

/** A single transparency-log entry stored in KV. */
export interface SignatureEntry {
  id: string;
  skillSlug: string;
  version: string;
  sha256: string;
  signatureB64: string;
  sbomUrl: string | null;
  reviewedAt: string;
  reviewerId: string;
  publishedAt: string;
}

export interface VerifyResult {
  verified: boolean;
  entry: SignatureEntry | null;
}

/** Build the KV key for a skill signature entry. */
export function signatureKvKey(slug: string, version: string): string {
  return `skill-sig:${slug}:${version}`;
}

/** Build the KV prefix used to list all versions of a skill. */
export function signatureKvPrefix(slug: string): string {
  return `skill-sig:${slug}:`;
}

/**
 * Import a raw ECDSA P-256 public key (SPKI, base64-encoded) via Web Crypto.
 */
async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(spkiB64), (ch) => ch.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    raw.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

/**
 * Verify an ECDSA P-256 signature against a SHA-256 package hash.
 *
 * @param kv - Cloudflare KV namespace where signature entries are stored
 * @param slug - Skill slug
 * @param version - Skill version
 * @param packageHash - SHA-256 hex digest of the skill package
 * @param publicKeyB64 - Base64-encoded SPKI public key (optional, skips crypto if absent)
 * @returns Verification result with the entry if found
 */
export async function verifySkillSignature(
  kv: KVNamespace,
  slug: string,
  version: string,
  packageHash: string,
  publicKeyB64?: string,
): Promise<VerifyResult> {
  const key = signatureKvKey(slug, version);
  const raw = await kv.get(key);

  if (!raw) {
    return { verified: false, entry: null };
  }

  const entry: SignatureEntry = JSON.parse(raw);

  // Hash mismatch means the package has been tampered with
  if (entry.sha256 !== packageHash) {
    return { verified: false, entry };
  }

  // If no public key is configured, we can only confirm the entry exists
  if (!publicKeyB64) {
    return { verified: false, entry };
  }

  const isValid = await verifyCryptoSignature(
    publicKeyB64,
    entry.signatureB64,
    packageHash,
  );

  return { verified: isValid, entry };
}

/**
 * Perform raw ECDSA P-256 verification using Web Crypto.
 */
async function verifyCryptoSignature(
  publicKeyB64: string,
  signatureB64: string,
  hexHash: string,
): Promise<boolean> {
  try {
    const pubKey = await importPublicKey(publicKeyB64);
    const sigBytes = Uint8Array.from(atob(signatureB64), (ch) => ch.charCodeAt(0));
    const hashBytes = new TextEncoder().encode(hexHash);

    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pubKey,
      sigBytes,
      hashBytes,
    );
  } catch {
    return false;
  }
}
