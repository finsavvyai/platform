/**
 * Hash-chain primitives.
 *
 * `chainAppend(prevHash, record)` returns a `ChainedRecord`:
 *   hash = sha256(canonicalJson({ prev_hash, record }))
 *
 * `canonicalJson` produces a stable, key-order-independent JSON serialisation
 * so two semantically-equal records always hash to the same value.
 *
 * Pure functions only. No I/O. No throws on well-formed input.
 */

import { createHash } from "node:crypto";
import type { AuditRecord } from "../audit-log.js";
import type { ChainedRecord, Hash } from "./types.js";

/**
 * Deterministic JSON: object keys are emitted in sorted order at every depth.
 * Arrays keep their order (semantically meaningful). Primitives via JSON.stringify.
 * `undefined` properties are dropped (matches JSON.stringify semantics).
 */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    const parts = value.map((v) => canonicalJson(v));
    return `[${parts.join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    parts.push(`${JSON.stringify(k)}:${canonicalJson(v)}`);
  }
  return `{${parts.join(",")}}`;
};

/** sha256 hex of a UTF-8 string. */
export const sha256Hex = (input: string): Hash =>
  createHash("sha256").update(input, "utf8").digest("hex");

/**
 * Append a record to the chain.
 *
 * @param prevHash    Hash of the previous chained record. `null` for genesis.
 * @param record      The (already-redacted) audit record.
 * @param sequenceId  Monotonic counter. Defaults to 0 for genesis; callers
 *                    typically pass `prevSequenceId + 1`.
 */
export const chainAppend = (
  prevHash: Hash | null,
  record: AuditRecord,
  sequenceId = 0,
): ChainedRecord => {
  const payload = canonicalJson({
    prev_hash: prevHash,
    record,
    sequence_id: sequenceId,
  });
  const hash = sha256Hex(payload);
  return {
    record,
    prev_hash: prevHash,
    hash,
    sequence_id: sequenceId,
  };
};

/**
 * Re-derive the hash for an existing ChainedRecord. Used by the verifier.
 * Returns the recomputed hash; caller compares to `chained.hash`.
 */
export const recomputeHash = (chained: ChainedRecord): Hash =>
  sha256Hex(
    canonicalJson({
      prev_hash: chained.prev_hash,
      record: chained.record,
      sequence_id: chained.sequence_id,
    }),
  );
