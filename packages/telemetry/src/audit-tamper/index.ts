/**
 * Tamper-evident audit log surface.
 * Re-exports kept minimal; consumers import named symbols.
 */

export type {
  ChainedRecord,
  ChainStateStore,
  Hash,
  Signature,
  SignedRecord,
  Signer,
  Verifier,
  VerifyBreakReason,
  VerifyResult,
} from "./types.js";

export { canonicalJson, chainAppend, recomputeHash, sha256Hex } from "./chain.js";

export {
  HMAC_SHA256_ALGO,
  constantTimeHexEqual,
  createHmacSigner,
  createHmacVerifier,
  hmacSignerFromEnv,
  signRecord,
} from "./sign.js";

export { verifyChain } from "./verifier.js";

export {
  TamperEvidentEmitter,
  createTamperEvidentEmitter,
  type TamperEmitterOptions,
} from "./tamper-emitter.js";
