/**
 * Client-side cryptographic key generation and export.
 * Uses Web Crypto API with NON-EXTRACTABLE private keys.
 */

const KEY_ALGORITHM: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };

/**
 * Generate a new ECDSA P-256 keypair.
 * The private key is NON-EXTRACTABLE — it can never be read as raw bytes,
 * only used for signing operations within the browser's crypto engine.
 */
export async function generateDeviceKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    KEY_ALGORITHM,
    false, // NON-EXTRACTABLE
    ['sign', 'verify'],
  );
}

/**
 * Export the public key as JWK for sending to server during binding.
 * Only the PUBLIC key is exportable. Private key stays locked.
 */
export async function exportPublicKey(
  keyPair: CryptoKeyPair,
): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey('jwk', keyPair.publicKey);
}
