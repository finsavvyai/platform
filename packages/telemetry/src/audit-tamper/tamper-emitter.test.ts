import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmacSigner, createHmacVerifier } from "./sign.js";
import { createTamperEvidentEmitter } from "./tamper-emitter.js";
import type { ChainStateStore, SignedRecord } from "./types.js";
import { verifyChain } from "./verifier.js";

const KEY = "tamper-emitter-tests";
const fixedClock = () => new Date("2026-01-01T00:00:00.000Z");

const sampleInput = (i: number) =>
  ({
    actorId: `u${i}`,
    event: `e${i}`,
    resource: `r${i}`,
    decision: "allow" as const,
  });

describe("TamperEvidentEmitter — base contract", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("emits redacted record and signed record", () => {
    const baseSink = vi.fn();
    const signedSink = vi.fn();
    const e = createTamperEvidentEmitter({
      sink: baseSink,
      signedSink,
      signer: createHmacSigner(KEY),
      clock: fixedClock,
    });
    const rec = e.emit(sampleInput(0));
    expect(rec.actor_id).toBe("u0");
    expect(baseSink).toHaveBeenCalledWith(rec);
    expect(signedSink).toHaveBeenCalledOnce();
    const signed = signedSink.mock.calls[0][0] as SignedRecord;
    expect(signed.chained.record).toEqual(rec);
    expect(signed.chained.prev_hash).toBeNull();
    expect(signed.chained.sequence_id).toBe(0);
    expect(signed.sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("builds a valid chain across multiple emits", () => {
    const collected: SignedRecord[] = [];
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: (s) => collected.push(s),
      signer: createHmacSigner(KEY),
      clock: fixedClock,
    });
    for (let i = 0; i < 5; i++) e.emit(sampleInput(i));
    expect(collected).toHaveLength(5);
    const res = verifyChain(collected, createHmacVerifier(KEY));
    expect(res).toEqual({ ok: true });
    expect(e.head().sequence_id).toBe(4);
  });

  it("never throws when the base sink throws", () => {
    const signedSink = vi.fn();
    const e = createTamperEvidentEmitter({
      sink: () => {
        throw new Error("base broken");
      },
      signedSink,
      signer: createHmacSigner(KEY),
      clock: fixedClock,
    });
    expect(() => e.emit(sampleInput(0))).not.toThrow();
    // Base sink failure still allows tamper layer to run.
    expect(signedSink).toHaveBeenCalledOnce();
  });

  it("never throws when the signed sink throws — routes to onError", () => {
    const onError = vi.fn();
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: () => {
        throw new Error("signed broken");
      },
      signer: createHmacSigner(KEY),
      clock: fixedClock,
      onError,
    });
    expect(() => e.emit(sampleInput(0))).not.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("swallows tamper-layer errors silently when no onError supplied", () => {
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: () => {
        throw new Error("boom");
      },
      signer: createHmacSigner(KEY),
      clock: fixedClock,
    });
    expect(() => e.emit(sampleInput(0))).not.toThrow();
  });
});

describe("TamperEvidentEmitter — persistence", () => {
  it("persists chain state to the injected store", () => {
    const state: Record<string, unknown> = {};
    const store: ChainStateStore = {
      load: () =>
        state.s as { prev_hash: string | null; sequence_id: number } | null,
      save: (s) => {
        state.s = s;
      },
    };
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: () => {},
      signer: createHmacSigner(KEY),
      state: store,
      clock: fixedClock,
    });
    e.emit(sampleInput(0));
    e.emit(sampleInput(1));
    expect(state.s).toMatchObject({ sequence_id: 1 });
  });

  it("restores chain state and continues the sequence on restart", () => {
    let saved: { prev_hash: string | null; sequence_id: number } | null = null;
    const store: ChainStateStore = {
      load: () => saved,
      save: (s) => {
        saved = s;
      },
    };
    const collected: SignedRecord[] = [];
    const e1 = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: (s) => collected.push(s),
      signer: createHmacSigner(KEY),
      state: store,
      clock: fixedClock,
    });
    e1.emit(sampleInput(0));
    e1.emit(sampleInput(1));

    // Restart with the same store.
    const e2 = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: (s) => collected.push(s),
      signer: createHmacSigner(KEY),
      state: store,
      clock: fixedClock,
    });
    e2.emit(sampleInput(2));

    const res = verifyChain(collected, createHmacVerifier(KEY));
    expect(res).toEqual({ ok: true });
    expect(collected.map((r) => r.chained.sequence_id)).toEqual([0, 1, 2]);
  });

  it("does not throw if load/save throws — falls back to in-memory genesis", () => {
    const onError = vi.fn();
    const flakyStore: ChainStateStore = {
      load: () => {
        throw new Error("load fail");
      },
      save: () => {
        throw new Error("save fail");
      },
    };
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: () => {},
      signer: createHmacSigner(KEY),
      state: flakyStore,
      onError,
      clock: fixedClock,
    });
    expect(() => e.emit(sampleInput(0))).not.toThrow();
    // Both load and save error were reported.
    expect(onError).toHaveBeenCalled();
    expect(e.head().sequence_id).toBe(0);
  });

  it("head() reports -1 sequence before any emit", () => {
    const e = createTamperEvidentEmitter({
      sink: () => {},
      signedSink: () => {},
      signer: createHmacSigner(KEY),
      clock: fixedClock,
    });
    expect(e.head()).toEqual({ prev_hash: null, sequence_id: -1 });
  });
});
