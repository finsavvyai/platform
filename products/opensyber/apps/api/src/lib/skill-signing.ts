/**
 * Ed25519 signing / verification for skill packages.
 *
 * The Worker holds an Ed25519 private key as a JWK string in the
 * SKILL_SIGNING_PRIVATE_KEY env secret. The public half is distributed
 * to agents (hardcoded in agent constants at build time). Signatures
 * are computed over the raw tarball bytes — not over any metadata —
 * so tamper detection covers the full payload.
 *
 * Signature format: hex-encoded 64-byte Ed25519 output.
 * Public-key format: base64url-encoded JWK for distribution.
 */

const ALG: EcdsaParams | { name: 'Ed25519' } = { name: 'Ed25519' };

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) throw new Error('Signature hex has odd length');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importPrivateJwk(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, ALG as AlgorithmIdentifier, true, ['sign']);
}

async function importPublicJwk(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString) as JsonWebKey;
  return crypto.subtle.importKey('jwk', jwk, ALG as AlgorithmIdentifier, true, ['verify']);
}

export async function signSkillTarball(tarball: ArrayBuffer, jwkString: string): Promise<string> {
  const key = await importPrivateJwk(jwkString);
  const sig = new Uint8Array(await crypto.subtle.sign(ALG as AlgorithmIdentifier, key, tarball));
  return bytesToHex(sig);
}

export async function verifySkillTarball(
  tarball: ArrayBuffer,
  signatureHex: string,
  publicJwkString: string,
): Promise<boolean> {
  try {
    const key = await importPublicJwk(publicJwkString);
    const sigBytes = hexToBytes(signatureHex);
    // Copy into a fresh ArrayBuffer so the Web Crypto typings stop
    // complaining about potential SharedArrayBuffer backing.
    const sigBuffer = new ArrayBuffer(sigBytes.length);
    new Uint8Array(sigBuffer).set(sigBytes);
    return await crypto.subtle.verify(ALG as AlgorithmIdentifier, key, sigBuffer, tarball);
  } catch {
    return false;
  }
}

/**
 * Extract the matching public JWK from an Ed25519 private JWK so callers
 * can distribute it to agents during provisioning. The input JWK should
 * contain the `x` (public) coordinate alongside the private `d` value.
 */
export function extractPublicJwk(privateJwkString: string): string {
  const jwk = JSON.parse(privateJwkString) as JsonWebKey;
  const { d: _d, ...publicOnly } = jwk as JsonWebKey & { d?: string };
  return JSON.stringify({ ...publicOnly, key_ops: ['verify'] });
}
