/**
 * Tamper-evident chain integration for BrainAuditEmitter.
 * (Sink/fallback tests live in audit.test.ts.)
 */

import { describe, expect, it } from "vitest";
import { BrainAuditEmitter } from "./audit.js";
import type {
  AuditChain,
  AuditInput,
  AuditRecord,
  AuditSink,
  ChainAppendResult,
} from "./types.js";

const fixedClock = (): Date => new Date("2026-05-25T10:00:00.000Z");

const baseInput: AuditInput = {
  actorId: "alice",
  event: "brain.ping",
  resource: "brain:ping",
  decision: "allow",
  reason: "heartbeat",
};

describe("BrainAuditEmitter — AuditChain integration", () => {
  it("chains records and advances the head hash deterministically", async () => {
    const captured: AuditRecord[] = [];
    let counter = 0;
    const chain: AuditChain = {
      chainAppend: (prevHash): ChainAppendResult => {
        counter += 1;
        return { hash: `h${counter}`, sig: `sig${counter}:${prevHash}` };
      },
    };
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const e = new BrainAuditEmitter({ sink, chain, clock: fixedClock });
    expect(e.headHash()).toBe("0".repeat(64));
    await e.emit(baseInput);
    await e.emit(baseInput);
    expect(captured[0]!.chain).toStrictEqual({
      prevHash: "0".repeat(64),
      hash: "h1",
      sig: `sig1:${"0".repeat(64)}`,
    });
    expect(captured[1]!.chain).toStrictEqual({
      prevHash: "h1",
      hash: "h2",
      sig: "sig2:h1",
    });
    expect(e.headHash()).toBe("h2");
  });

  it("supports async chainAppend implementations", async () => {
    const captured: AuditRecord[] = [];
    const chain: AuditChain = {
      chainAppend: async () => ({ hash: "async-h", sig: "async-sig" }),
    };
    const sink: AuditSink = (r) => {
      captured.push(r);
    };
    const e = new BrainAuditEmitter({ sink, chain, clock: fixedClock });
    await e.emit(baseInput);
    expect(captured[0]!.chain?.hash).toBe("async-h");
  });
});
