/**
 * D1-backed tenant-scoped ChainStateStore.
 *
 * Implements the `ChainStateStore` contract from
 * `@finsavvyai/telemetry/audit-tamper` on top of Cloudflare D1. One instance
 * per (D1 binding, tenant_id) pair.
 *
 * Per round-2 rule the brain package does NOT directly link
 * `@finsavvyai/telemetry`. The carve-out in the Month-2 swarm conventions
 * grants permission but `products/*` is not in the pnpm workspace, so the
 * type is interface-mirrored here (same pattern as `src/types.ts`). The
 * runtime composition lives in `factory.ts` where the caller passes the
 * real `auditTamper.createTamperEvidentEmitter` through DI.
 *
 * SQL is fully parameterised — zero string concat. `tenant_id` is
 * validated against `TENANT_ID_REGEX` at construction AND before each
 * binding call as defence in depth.
 *
 * 100% line + branch coverage required (tenant isolation + SQL injection
 * are security-critical).
 */

import { TENANT_ID_REGEX } from "../tenant/types.js";

/** Mirrors `auditTamper.Hash`. SHA-256 hex (64 lowercase chars). */
export type Hash = string;

/** Mirrors `auditTamper.ChainStateStore` (synchronous contract). */
export interface ChainStateStore {
  load(): { prev_hash: Hash | null; sequence_id: number } | null;
  save(state: { prev_hash: Hash | null; sequence_id: number }): void;
}

/**
 * Narrow structural D1 interface. Cloudflare's `D1Database` is structurally
 * assignable — we avoid pulling in `@cloudflare/workers-types` as a hard
 * dep here.
 */
export interface D1PreparedStatement {
  bind(...values: readonly (string | number | null)[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Client {
  prepare(sql: string): D1PreparedStatement;
}

type Row = { last_hash: string; sequence_id: number };

const SELECT_SQL =
  "SELECT last_hash, sequence_id FROM audit_chain_state WHERE tenant_id = ?";

const UPSERT_SQL =
  "INSERT INTO audit_chain_state (tenant_id, last_hash, sequence_id, updated_ms) " +
  "VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(tenant_id) DO UPDATE SET " +
  "  last_hash = excluded.last_hash, " +
  "  sequence_id = excluded.sequence_id, " +
  "  updated_ms = excluded.updated_ms";

const GENESIS_HASH = "0".repeat(64);

const assertTenant = (tenant_id: string): void => {
  if (!TENANT_ID_REGEX.test(tenant_id)) {
    throw new Error("audit_prod.tenant.unknown");
  }
};

export interface D1ChainStateStoreOptions {
  readonly d1: D1Client;
  readonly tenantId: string;
  readonly clock?: () => number;
}

/**
 * Note: the `ChainStateStore` contract in audit-tamper is *synchronous*
 * (`load(): ... | null`, `save(): void`). D1 calls are async. We adapt by
 * caching the loaded state in-memory and fire-and-forget on save with
 * error reporting via `peekSaveError`.
 *
 * To keep boot-time correctness, callers MUST `await store.prime()` once
 * before constructing the emitter. After that, `load()` returns the
 * primed value synchronously and `save()` enqueues the D1 write.
 */
export class D1ChainStateStore implements ChainStateStore {
  private readonly d1: D1Client;
  private readonly tenantId: string;
  private readonly clock: () => number;
  private cache: { prev_hash: Hash | null; sequence_id: number } | null = null;
  private primed = false;
  private lastSaveError: unknown = null;

  constructor(opts: D1ChainStateStoreOptions) {
    assertTenant(opts.tenantId);
    this.d1 = opts.d1;
    this.tenantId = opts.tenantId;
    this.clock = opts.clock ?? (() => Date.now());
  }

  /** Boot-time hydrate from D1. Idempotent. */
  async prime(): Promise<void> {
    assertTenant(this.tenantId);
    const row = await this.d1
      .prepare(SELECT_SQL)
      .bind(this.tenantId)
      .first<Row>();
    if (row) {
      this.cache = { prev_hash: row.last_hash, sequence_id: row.sequence_id };
    } else {
      this.cache = null;
    }
    this.primed = true;
  }

  load(): { prev_hash: Hash | null; sequence_id: number } | null {
    if (!this.primed) {
      throw new Error("audit_prod.state_store.not_primed");
    }
    return this.cache;
  }

  save(state: { prev_hash: Hash | null; sequence_id: number }): void {
    this.cache = state;
    const hash = state.prev_hash ?? GENESIS_HASH;
    const ts = this.clock();
    assertTenant(this.tenantId);
    // Fire-and-forget — we surface errors via lastSaveError; the emitter's
    // onError hook polls via `peekSaveError` after each emit.
    void this.d1
      .prepare(UPSERT_SQL)
      .bind(this.tenantId, hash, state.sequence_id, ts)
      .run()
      .then(() => {
        this.lastSaveError = null;
      })
      .catch((err: unknown) => {
        this.lastSaveError = err;
      });
  }

  /** Diagnostic: read and clear the last save error, if any. */
  peekSaveError(): unknown {
    const e = this.lastSaveError;
    this.lastSaveError = null;
    return e;
  }
}
