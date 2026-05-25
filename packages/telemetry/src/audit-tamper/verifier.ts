/**
 * Chain verifier.
 *
 * Walks an ordered list of SignedRecords and confirms:
 *   1. Each record's `hash` matches its recomputed sha256.
 *   2. Each record's `prev_hash` matches the previous record's `hash`
 *      (genesis must have `prev_hash === null`).
 *   3. `sequence_id` is monotonic and starts at the first record's id
 *      (no gaps, no duplicates, no reorder).
 *   4. The signature is valid for `hash` under the supplied verifier.
 *
 * Returns the first break only — that's enough to flag tampering and points
 * the operator at the precise index to investigate.
 */

import { recomputeHash } from "./chain.js";
import type {
  SignedRecord,
  VerifyBreakReason,
  VerifyResult,
  Verifier,
} from "./types.js";

const fail = (
  breakIndex: number,
  reason: VerifyBreakReason,
): VerifyResult => ({ ok: false, breakIndex, reason });

export const verifyChain = (
  records: readonly SignedRecord[],
  verifier: Verifier,
): VerifyResult => {
  // Empty chain is vacuously ok.
  if (records.length === 0) return { ok: true };

  const first = records[0];
  if (first === undefined) return { ok: true };

  let prevHash: string | null = null;
  let expectedSeq = first.chained.sequence_id;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r === undefined) return fail(i, "sequence_gap");
    const c = r.chained;

    if (c.sequence_id !== expectedSeq) {
      return fail(i, "sequence_gap");
    }
    if (c.prev_hash !== prevHash) {
      return fail(i, "prev_hash_mismatch");
    }
    if (recomputeHash(c) !== c.hash) {
      return fail(i, "hash_mismatch");
    }
    if (!verifier.verify(c.hash, r.sig)) {
      return fail(i, "bad_signature");
    }

    prevHash = c.hash;
    expectedSeq = c.sequence_id + 1;
  }

  return { ok: true };
};
