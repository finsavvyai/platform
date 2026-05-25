/**
 * TokenForge React Native SDK — Software key path.
 *
 * Fallback ECDSA P-256 implementation using the `elliptic` JS library with
 * `react-native-keychain` for persistence. Used when native hardware modules
 * (Secure Enclave / Android KeyStore) are not available.
 */

import * as Keychain from "react-native-keychain";
import { ec as EC } from "elliptic";
import { sha256 } from "@noble/hashes/sha256";

const KEYCHAIN_SERVICE = "cloud.opensyber.tokenforge";

/**
 * Secure random bytes via Web Crypto. Throws if the host environment has
 * not polyfilled `crypto.getRandomValues` — never falls back to
 * `Math.random()` because that would make nonces predictable.
 */
export function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.getRandomValues) {
    throw new Error(
      "TokenForge requires crypto.getRandomValues. " +
        "Install and import 'react-native-get-random-values' before loading the SDK.",
    );
  }
  c.getRandomValues(bytes);
  return bytes;
}

/** Convert bytes to hex string. */
export function bytesToHexString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
}

/** Generate a 128-bit random hex identifier. */
export function generateId(): string {
  return bytesToHexString(secureRandomBytes(16));
}

/**
 * Load an existing P-256 key from Keychain or generate a new one.
 * The private key is stored as a hex string — this is the software-only path.
 */
export async function loadOrGenerateSoftwareKey(): Promise<EC.KeyPair> {
  const curve = new EC("p256");
  try {
    const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (stored && stored.password) {
      return curve.keyFromPrivate(stored.password, "hex");
    }
  } catch {
    /* no stored key */
  }
  const key = curve.genKeyPair({ entropy: Array.from(secureRandomBytes(32)) });
  const hex = key.getPrivate("hex");
  await Keychain.setGenericPassword("tokenforge", hex, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

/** Sign a payload string with the software key. Returns base64 DER signature. */
export function signWithSoftwareKey(key: EC.KeyPair, payload: string): string {
  const hash = sha256(new TextEncoder().encode(payload));
  const sig = key.sign(hash);
  const derBytes = sig.toDER();
  const binary = String.fromCharCode(...derBytes);
  return btoa(binary);
}

/** Return the public key as a PEM string (for the bind payload). */
export function softwarePublicKeyPem(key: EC.KeyPair): string {
  const pub = key.getPublic("hex");
  return `-----BEGIN PUBLIC KEY-----\n${btoa(pub)}\n-----END PUBLIC KEY-----`;
}
