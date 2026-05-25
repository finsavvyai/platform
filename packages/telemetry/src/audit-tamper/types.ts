/**
 * Tamper-evident audit log — shared types.
 *
 * Layered on top of the existing `AuditRecord` in audit-log.ts:
 *   AuditRecord -> ChainedRecord -> SignedRecord
 *
 * Each ChainedRecord links to the previous record's hash, so any tampering
 * (mutation, insertion, deletion, reordering) breaks the chain.
 */

import type { AuditRecord } from "../audit-log.js";

/** SHA-256 hex string (64 chars, lowercase). */
export type Hash = string;

/** Hex-encoded signature (HMAC-SHA256 default = 64 chars). */
export type Signature = string;

/**
 * A record after it has been linked into the chain.
 * `prev_hash` is `null` for the genesis record.
 * `hash` is sha256(canonicalJson(prev_hash + record)).
 * `sequence_id` starts at 0 and increments by 1.
 */
export type ChainedRecord = {
  readonly record: AuditRecord;
  readonly prev_hash: Hash | null;
  readonly hash: Hash;
  readonly sequence_id: number;
};

/** A chained record plus its signature over `hash`. */
export type SignedRecord = {
  readonly chained: ChainedRecord;
  readonly sig: Signature;
};

/**
 * Signer abstraction. Default impl is HMAC-SHA256.
 * Pluggable so callers can swap in Ed25519, KMS, HSM, etc.
 * Implementations MUST be deterministic for a given (hash, key).
 * `algo` is a stable identifier exposed for verifier matching.
 */
export type Signer = {
  readonly algo: string;
  sign(hash: Hash): Signature;
};

/**
 * Verifier counterpart of Signer. Constant-time compare required.
 * Returns true iff `sig` is a valid signature for `hash`.
 */
export type Verifier = {
  readonly algo: string;
  verify(hash: Hash, sig: Signature): boolean;
};

/** Pluggable persistence for the last-seen chain state. */
export type ChainStateStore = {
  load(): { prev_hash: Hash | null; sequence_id: number } | null;
  save(state: { prev_hash: Hash | null; sequence_id: number }): void;
};

/** Result returned by `verifyChain`. */
export type VerifyResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly breakIndex: number;
      readonly reason: VerifyBreakReason;
    };

export type VerifyBreakReason =
  | "bad_signature"
  | "hash_mismatch"
  | "prev_hash_mismatch"
  | "sequence_gap"
  | "algo_mismatch";
