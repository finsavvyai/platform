/**
 * Production audit emitter factory — tenant-scoped composition of the
 * tamper-evident emitter (`auditTamper.createTamperEvidentEmitter` from
 * `@finsavvyai/telemetry`) with the `D1ChainStateStore` and a
 * caller-provided signed sink (R2 binding lives in the deploy manifest).
 *
 * The tamper-emitter factory is INJECTED rather than imported directly so
 * the brain package stays workspace-independent (round-2 rule + brain's
 * package.json carries no `@finsavvyai/telemetry` dep). Production wiring
 * supplies `auditTamper.createTamperEvidentEmitter` at composition time;
 * tests supply a fake implementing the same shape.
 *
 * Each call returns a fresh emitter scoped to a single tenant. The signer
 * is injected (DI) — never bundled.
 *
 * 100% line + branch coverage required on composition + tenant scoping.
 */

import { TENANT_ID_REGEX } from "../tenant/types.js";
import {
  D1ChainStateStore,
  type ChainStateStore,
  type D1Client,
  type Hash,
} from "./state-store.js";

/** Mirrors `auditTamper.Signer`. HMAC-SHA256 by default in production. */
export interface Signer {
  readonly algo: string;
  sign(hash: Hash): string;
}

/** Mirrors `auditTamper.ChainedRecord`. */
export interface ChainedRecord {
  readonly record: Readonly<Record<string, unknown>>;
  readonly prev_hash: Hash | null;
  readonly hash: Hash;
  readonly sequence_id: number;
}

/** Mirrors `auditTamper.SignedRecord`. */
export interface SignedRecord {
  readonly chained: ChainedRecord;
  readonly sig: string;
}

/** Mirrors `auditTamper.AuditInput` (base AuditEmitter input). */
export interface AuditInput {
  readonly actorId: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: "allow" | "deny" | "error";
  readonly reason?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Mirrors `auditTamper.TamperEvidentEmitter` surface used here. */
export interface TamperEvidentEmitter {
  emit(input: AuditInput): Readonly<Record<string, unknown>>;
  head(): { prev_hash: Hash | null; sequence_id: number };
}

/** Mirrors `auditTamper.TamperEmitterOptions`. */
export interface TamperEmitterOptions {
  readonly sink: (record: Readonly<Record<string, unknown>>) => void;
  readonly signer: Signer;
  readonly signedSink: (signed: SignedRecord) => void;
  readonly state?: ChainStateStore;
  readonly onError?: (err: unknown) => void;
}

/** DI shape: `auditTamper.createTamperEvidentEmitter`. */
export type TamperEmitterFactory = (
  opts: TamperEmitterOptions,
) => TamperEvidentEmitter;

export interface ProductionAuditEmitterOptions {
  readonly d1: D1Client;
  /** R2 bucket binding handle — opaque; surfaced only via `signedSink`. */
  readonly r2Bucket: unknown;
  readonly signer: Signer;
  readonly tenantId: string;
  /**
   * Caller-provided sink that writes the SignedRecord to the R2 bucket.
   * Passed through unchanged so the deploy manifest controls keying
   * (`audit/<tenant>/<sequence>-<hash>.json`).
   */
  readonly signedSink: (signed: SignedRecord) => void;
  /**
   * Tamper-emitter constructor. Inject
   * `auditTamper.createTamperEvidentEmitter` in production; a fake in tests.
   */
  readonly tamperFactory: TamperEmitterFactory;
  readonly onError?: (err: unknown) => void;
  readonly clock?: () => number;
}

export interface ProductionAuditEmitter {
  readonly emitter: TamperEvidentEmitter;
  readonly state: D1ChainStateStore;
}

const assertTenant = (tenant_id: string): void => {
  if (!TENANT_ID_REGEX.test(tenant_id)) {
    throw new Error("audit_prod.tenant.unknown");
  }
};

/**
 * Build a tenant-scoped production audit emitter. Primes the D1-backed
 * state store before composing the tamper-emitter so the chain HEAD is
 * available synchronously to `load()`.
 */
export const createProductionAuditEmitter = async (
  opts: ProductionAuditEmitterOptions,
): Promise<ProductionAuditEmitter> => {
  assertTenant(opts.tenantId);

  const state = new D1ChainStateStore({
    d1: opts.d1,
    tenantId: opts.tenantId,
    ...(opts.clock !== undefined ? { clock: opts.clock } : {}),
  });
  await state.prime();

  const onError = (err: unknown): void => {
    try {
      opts.onError?.(err);
    } catch {
      /* swallow — audit never throws */
    }
  };

  const signedSink = (signed: SignedRecord): void => {
    try {
      opts.signedSink(signed);
    } finally {
      // Drain any D1 save error left from a previous emit.
      const drained = state.peekSaveError();
      if (drained !== null) onError(drained);
    }
  };

  const emitter = opts.tamperFactory({
    sink: () => undefined, // base sink unused — host wires request sink in audit.ts
    signer: opts.signer,
    signedSink,
    state,
    onError,
  });

  return { emitter, state };
};
