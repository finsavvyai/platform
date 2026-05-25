/**
 * Test-only helpers for factory specs. Excluded from build via
 * `*.test-helpers.ts` pattern in tsconfig.json + vitest config.
 */

import type {
  ProductionAuditEmitterOptions,
  SignedRecord,
  Signer,
  TamperEmitterFactory,
  TamperEmitterOptions,
  TamperEvidentEmitter,
} from "./factory.js";
import type { D1Client, D1PreparedStatement } from "./state-store.js";

export const fakeD1: () => D1Client = () => ({
  prepare(_sql: string): D1PreparedStatement {
    let bound: readonly (string | number | null)[] = [];
    const stmt: D1PreparedStatement = {
      bind(...v) {
        bound = v;
        return stmt;
      },
      async first() {
        void bound;
        return null;
      },
      async run() {
        return { success: true };
      },
    };
    return stmt;
  },
});

export const failingD1 = (): D1Client => ({
  prepare(_sql: string): D1PreparedStatement {
    let bound: readonly (string | number | null)[] = [];
    const stmt: D1PreparedStatement = {
      bind(...v) {
        bound = v;
        return stmt;
      },
      async first() {
        void bound;
        return null;
      },
      async run() {
        throw new Error("d1.write.fail");
      },
    };
    return stmt;
  },
});

export const fakeSigner: Signer = {
  algo: "hmac-sha256",
  sign: (hash) => `sig:${hash}`,
};

export const captureFactory = (): {
  factory: TamperEmitterFactory;
  captured: { opts: TamperEmitterOptions | null };
  fakeEmitter: TamperEvidentEmitter;
} => {
  const captured: { opts: TamperEmitterOptions | null } = { opts: null };
  const fakeEmitter: TamperEvidentEmitter = {
    emit: (input) => ({ ok: true, input }),
    head: () => ({ prev_hash: null, sequence_id: -1 }),
  };
  const factory: TamperEmitterFactory = (opts) => {
    captured.opts = opts;
    return fakeEmitter;
  };
  return { factory, captured, fakeEmitter };
};

export const baseOpts = (
  overrides: Partial<ProductionAuditEmitterOptions> = {},
): ProductionAuditEmitterOptions => {
  const { factory } = captureFactory();
  return {
    d1: fakeD1(),
    r2Bucket: { mock: true },
    signer: fakeSigner,
    tenantId: "acme",
    signedSink: () => undefined,
    tamperFactory: factory,
    ...overrides,
  };
};

export const fakeSignedRecord: SignedRecord = {
  chained: {
    record: {},
    prev_hash: null,
    hash: "ab".repeat(32),
    sequence_id: 0,
  },
  sig: "sig",
};
