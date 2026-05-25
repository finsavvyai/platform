/**
 * Signing primitives for the tamper-evident audit log.
 *
 * Default signer: HMAC-SHA256 with a key from `FINSAVVY_AUDIT_HMAC_KEY` env
 * (or explicit). Constant-time comparison on verify (Node `timingSafeEqual`).
 *
 * Custom signers (Ed25519, KMS, etc.) implement the `Signer` / `Verifier`
 * interfaces and are injected.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  ChainedRecord,
  SignedRecord,
  Signature,
  Signer,
  Verifier,
  Hash,
} from "./types.js";

export const HMAC_SHA256_ALGO = "hmac-sha256";

const toBuffer = (hex: string): Buffer => {
  // Accept lowercase hex only. Caller is responsible for hex shape.
  return Buffer.from(hex, "hex");
};

/**
 * Constant-time compare for two hex strings. Falls back to false on length
 * mismatch — but the length check itself is done after building equal-size
 * buffers padded with zeros, so we still pay the timingSafeEqual cost
 * (avoids early-return side channel).
 */
export const constantTimeHexEqual = (a: string, b: string): boolean => {
  const ab = toBuffer(a);
  const bb = toBuffer(b);
  const len = Math.max(ab.length, bb.length, 1);
  const ap = Buffer.alloc(len);
  const bp = Buffer.alloc(len);
  ab.copy(ap);
  bb.copy(bp);
  const eq = timingSafeEqual(ap, bp);
  // Combine timing-safe equality with the length-equality flag.
  return eq && ab.length === bb.length;
};

/** Build an HMAC-SHA256 signer/verifier pair from a shared secret. */
export const createHmacSigner = (key: string | Buffer): Signer => {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  return {
    algo: HMAC_SHA256_ALGO,
    sign(hash: Hash): Signature {
      return createHmac("sha256", keyBuf).update(hash, "utf8").digest("hex");
    },
  };
};

export const createHmacVerifier = (key: string | Buffer): Verifier => {
  const keyBuf = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  return {
    algo: HMAC_SHA256_ALGO,
    verify(hash: Hash, sig: Signature): boolean {
      const expected = createHmac("sha256", keyBuf)
        .update(hash, "utf8")
        .digest("hex");
      return constantTimeHexEqual(expected, sig);
    },
  };
};

/**
 * Pull an HMAC signer from the FINSAVVY_AUDIT_HMAC_KEY env var.
 * Returns null if unset (caller decides fallback behaviour).
 */
export const hmacSignerFromEnv = (): Signer | null => {
  const key = process.env.FINSAVVY_AUDIT_HMAC_KEY;
  if (!key || key.length === 0) return null;
  return createHmacSigner(key);
};

/** Wrap a ChainedRecord with a signature over its `hash` field. */
export const signRecord = (
  chained: ChainedRecord,
  signer: Signer,
): SignedRecord => ({
  chained,
  sig: signer.sign(chained.hash),
});
