/**
 * createProductionAuditEmitter — composition, DI, tenant scoping,
 * failure-mode isolation.
 */

import { describe, expect, it, vi } from "vitest";
import { createProductionAuditEmitter } from "./factory.js";
import type { SignedRecord, Signer } from "./factory.js";
import {
  baseOpts,
  captureFactory,
  fakeSignedRecord,
  failingD1,
} from "./factory.test-helpers.js";

describe("createProductionAuditEmitter — tenant scoping", () => {
  it("rejects malformed tenant id", async () => {
    await expect(
      createProductionAuditEmitter(baseOpts({ tenantId: "BAD!" })),
    ).rejects.toThrow("audit_prod.tenant.unknown");
  });

  it("primes state store before returning", async () => {
    const { factory, captured } = captureFactory();
    const res = await createProductionAuditEmitter(
      baseOpts({ tamperFactory: factory }),
    );
    expect(() => res.state.load()).not.toThrow();
    expect(captured.opts).not.toBeNull();
  });
});

describe("createProductionAuditEmitter — composition", () => {
  it("passes signer through DI (not bundled)", async () => {
    const { factory, captured } = captureFactory();
    const custom: Signer = { algo: "ed25519", sign: () => "x" };
    await createProductionAuditEmitter(
      baseOpts({ tamperFactory: factory, signer: custom }),
    );
    expect(captured.opts!.signer).toBe(custom);
  });

  it("wires the caller signedSink", async () => {
    const { factory, captured } = captureFactory();
    const sink = vi.fn<[SignedRecord], void>();
    await createProductionAuditEmitter(
      baseOpts({ tamperFactory: factory, signedSink: sink }),
    );
    captured.opts!.signedSink(fakeSignedRecord);
    expect(sink).toHaveBeenCalledWith(fakeSignedRecord);
  });

  it("wires the D1-backed ChainStateStore", async () => {
    const { factory, captured } = captureFactory();
    await createProductionAuditEmitter(baseOpts({ tamperFactory: factory }));
    expect(captured.opts!.state).toBeDefined();
    expect(captured.opts!.state!.load()).toBeNull();
  });
});

describe("createProductionAuditEmitter — failure isolation", () => {
  it("D1 save failure surfaces via onError after next signedSink call", async () => {
    const { factory, captured } = captureFactory();
    const onError = vi.fn();
    const res = await createProductionAuditEmitter(
      baseOpts({ d1: failingD1(), tamperFactory: factory, onError }),
    );
    res.state.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    captured.opts!.signedSink(fakeSignedRecord);
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toBe("d1.write.fail");
  });

  it("user signedSink throws → propagates (sink owner concern)", async () => {
    const { factory, captured } = captureFactory();
    const sink = (): void => {
      throw new Error("r2.put.fail");
    };
    await createProductionAuditEmitter(
      baseOpts({ tamperFactory: factory, signedSink: sink }),
    );
    expect(() => captured.opts!.signedSink(fakeSignedRecord)).toThrow(
      "r2.put.fail",
    );
  });

  it("onError swallows secondary errors (audit-never-throws invariant)", async () => {
    const { factory, captured } = captureFactory();
    const flakyOnError = (): void => {
      throw new Error("user.onerror.fail");
    };
    const res = await createProductionAuditEmitter(
      baseOpts({
        d1: failingD1(),
        tamperFactory: factory,
        onError: flakyOnError,
      }),
    );
    res.state.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(() => captured.opts!.signedSink(fakeSignedRecord)).not.toThrow();
  });

  it("clock option threads through to the state store", async () => {
    const { factory } = captureFactory();
    const clock = vi.fn(() => 42);
    const res = await createProductionAuditEmitter(
      baseOpts({ tamperFactory: factory, clock }),
    );
    res.state.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    expect(clock).toHaveBeenCalled();
  });
});
