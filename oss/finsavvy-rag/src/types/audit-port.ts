/**
 * AuditPort — tamper-evident audit-log integration contract for finsavvy-rag.
 *
 * Implementations live OUTSIDE this package. Callers (e.g. AMLIQ Brain) inject
 * a concrete `AuditPort` at composition time via dependency injection. The
 * port keeps finsavvy-rag independent of any specific hash-chain or signing
 * library.
 *
 * Mirrors the AUDIT-TAMPER contract:
 *   chainAppend(prevHash, record) -> {hash, sig}
 *   verifyChain(records) -> {ok, breakIndex?}
 *
 * License: Apache-2.0
 */

/**
 * A record-shaped payload appended to the audit chain.
 * Free-form; consumers SHOULD adopt a `kind` discriminator (e.g.
 * "rag.search", "rag.ingest") and keep the rest JSON-serialisable.
 */
export type AuditRecord = Record<string, unknown>;

/**
 * Result of a `chainAppend` call.
 * - `hash`: lowercase hex digest of `(prevHash || record)`; algorithm is
 *   implementation-defined (SHA-256 recommended). Length depends on hash.
 * - `sig`: detached signature over `hash` (algorithm and key custody are
 *   implementation-defined; e.g. Ed25519 over hash bytes).
 */
export interface AuditAppendResult {
  hash: string;
  sig: string;
}

/**
 * A previously persisted chain entry. Implementations must be able to
 * reconstruct one of these from durable storage to verify integrity.
 */
export interface AuditChainEntry {
  prevHash: string;
  record: AuditRecord;
  hash: string;
  sig: string;
}

/**
 * Result of `verifyChain`. `ok` is true iff every entry's hash matches the
 * recomputed hash AND every signature is valid. When `ok` is false,
 * `breakIndex` identifies the FIRST tampered or missing entry (0-based).
 */
export interface AuditVerifyResult {
  ok: boolean;
  breakIndex?: number;
}

/**
 * The injectable port. Consumers depend on this interface only — never on a
 * concrete implementation. Implementations MUST:
 *
 * 1. Be deterministic given identical inputs.
 * 2. Never throw on well-formed input; return values communicate failure.
 * 3. Treat `prevHash === ""` as the genesis case.
 * 4. Hold signing keys outside of any data passed to `chainAppend`. The port
 *    does NOT accept keys as parameters by design.
 */
export interface AuditPort {
  /**
   * Append a record to the chain. The returned `{hash, sig}` is the new tip.
   * For the very first entry, pass `prevHash = ""`.
   */
  chainAppend(
    prevHash: string,
    record: AuditRecord,
  ): Promise<AuditAppendResult>;

  /**
   * Re-verify a sequence of entries end-to-end. Order matters; entries MUST
   * be in append order.
   */
  verifyChain(records: AuditChainEntry[]): Promise<AuditVerifyResult>;
}

/**
 * A no-op implementation useful for tests and bootstrapping. It returns
 * stable but cryptographically meaningless values. DO NOT use in production.
 */
export const noopAuditPort: AuditPort = {
  async chainAppend(prevHash, record) {
    return {
      hash: `noop:${prevHash.length}:${Object.keys(record).length}`,
      sig: "noop",
    };
  },
  async verifyChain() {
    return { ok: true };
  },
};
