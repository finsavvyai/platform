/**
 * D1ChainStateStore tests — tenant isolation, SQL parameterisation, and
 * concurrency safety. 100% line + branch coverage on the security path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { D1ChainStateStore } from "./state-store.js";
import { makeFakeD1 } from "./state-store.test-helpers.js";

describe("D1ChainStateStore — construction validation", () => {
  it("rejects malformed tenant ids", () => {
    const { d1 } = makeFakeD1();
    expect(() => new D1ChainStateStore({ d1, tenantId: "BAD" })).toThrow(
      "audit_prod.tenant.unknown",
    );
    expect(() => new D1ChainStateStore({ d1, tenantId: "a" })).toThrow();
    expect(
      () => new D1ChainStateStore({ d1, tenantId: "x".repeat(65) }),
    ).toThrow();
    expect(() => new D1ChainStateStore({ d1, tenantId: "'; DROP" })).toThrow();
  });

  it("accepts valid tenant ids", () => {
    const { d1 } = makeFakeD1();
    expect(
      () => new D1ChainStateStore({ d1, tenantId: "acme_co-1" }),
    ).not.toThrow();
  });
});

describe("D1ChainStateStore — prime + load", () => {
  it("load() throws if prime not called", () => {
    const { d1 } = makeFakeD1();
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    expect(() => s.load()).toThrow("audit_prod.state_store.not_primed");
  });

  it("returns null when no row exists", async () => {
    const { d1, calls } = makeFakeD1({});
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    expect(s.load()).toBeNull();
    expect(calls[0]!.bindings).toEqual(["acme"]);
    expect(calls[0]!.sql).toContain("SELECT");
    expect(calls[0]!.sql).not.toContain("acme"); // tenant goes through bind, never concat
  });

  it("returns the row when present", async () => {
    const { d1 } = makeFakeD1({
      acme: { last_hash: "ab".repeat(32), sequence_id: 5 },
    });
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    expect(s.load()).toEqual({ prev_hash: "ab".repeat(32), sequence_id: 5 });
  });

  it("isolates tenants — store A never sees store B's row", async () => {
    const { d1 } = makeFakeD1({
      acme: { last_hash: "aa".repeat(32), sequence_id: 7 },
      other: { last_hash: "bb".repeat(32), sequence_id: 2 },
    });
    const a = new D1ChainStateStore({ d1, tenantId: "acme" });
    const b = new D1ChainStateStore({ d1, tenantId: "other" });
    await a.prime();
    await b.prime();
    expect(a.load()!.prev_hash).toBe("aa".repeat(32));
    expect(b.load()!.prev_hash).toBe("bb".repeat(32));
  });
});

describe("D1ChainStateStore — save", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes via parameterised UPSERT — tenant_id always bound", async () => {
    const { d1, calls } = makeFakeD1({});
    const s = new D1ChainStateStore({ d1, tenantId: "acme", clock: () => 1234 });
    await s.prime();
    s.save({ prev_hash: "cc".repeat(32), sequence_id: 1 });
    // Wait microtask drain for the void Promise.
    await Promise.resolve();
    await Promise.resolve();
    const upsert = calls.find((c) => c.sql.startsWith("INSERT"));
    expect(upsert).toBeDefined();
    expect(upsert!.bindings).toEqual(["acme", "cc".repeat(32), 1, 1234]);
    // Cache updated synchronously.
    expect(s.load()).toEqual({ prev_hash: "cc".repeat(32), sequence_id: 1 });
  });

  it("translates null prev_hash to genesis on persist", async () => {
    const { d1, calls } = makeFakeD1({});
    const s = new D1ChainStateStore({ d1, tenantId: "acme", clock: () => 1 });
    await s.prime();
    s.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    await Promise.resolve();
    const upsert = calls.find((c) => c.sql.startsWith("INSERT"));
    expect(upsert!.bindings[1]).toBe("0".repeat(64));
  });

  it("surfaces D1 errors via peekSaveError, then clears", async () => {
    const { d1, runShouldFailAfter } = makeFakeD1({});
    runShouldFailAfter(0); // first run() fails
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    s.save({ prev_hash: null, sequence_id: 0 });
    // let the fire-and-forget catch run
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const err = s.peekSaveError();
    expect((err as Error).message).toBe("d1.run.fail");
    expect(s.peekSaveError()).toBeNull(); // cleared
  });

  it("clears save error after a subsequent successful save", async () => {
    const { d1, runShouldFailAfter } = makeFakeD1({});
    runShouldFailAfter(0);
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    s.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    await Promise.resolve();
    // Reset fake to allow next run().
    runShouldFailAfter(99);
    s.save({ prev_hash: "dd".repeat(32), sequence_id: 1 });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(s.peekSaveError()).toBeNull();
  });

  it("uses default clock when not provided", async () => {
    const { d1, calls } = makeFakeD1({});
    vi.setSystemTime(new Date(99_000));
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    s.save({ prev_hash: null, sequence_id: 0 });
    await Promise.resolve();
    await Promise.resolve();
    const upsert = calls.find((c) => c.sql.startsWith("INSERT"));
    expect(upsert!.bindings[3]).toBe(99_000);
  });

  it("concurrent saves: last-write-wins on cache (sequential awaits)", async () => {
    const { d1 } = makeFakeD1({});
    const s = new D1ChainStateStore({ d1, tenantId: "acme" });
    await s.prime();
    s.save({ prev_hash: "11".repeat(32), sequence_id: 1 });
    s.save({ prev_hash: "22".repeat(32), sequence_id: 2 });
    s.save({ prev_hash: "33".repeat(32), sequence_id: 3 });
    await Promise.resolve();
    await Promise.resolve();
    expect(s.load()).toEqual({ prev_hash: "33".repeat(32), sequence_id: 3 });
  });
});
