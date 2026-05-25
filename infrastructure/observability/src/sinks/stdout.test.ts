import { describe, it, expect, vi } from "vitest";

import { createStdoutSink } from "./stdout.js";
import type { AuditRecord } from "../types.js";

const sample = (overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  ts: "2026-05-25T00:00:00.000Z",
  actor_id: "user_1",
  event: "login",
  resource: "auth/session",
  decision: "allow",
  reason: "ok",
  ...overrides,
});

describe("stdout sink", () => {
  it("writes one JSON line terminated by \\n", () => {
    const writer = vi.fn();
    const sink = createStdoutSink({ writer });
    const rec = sample();
    sink(rec);
    expect(writer).toHaveBeenCalledTimes(1);
    const line = writer.mock.calls[0]?.[0] ?? "";
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual(rec);
  });

  it("never throws when writer throws", () => {
    const sink = createStdoutSink({
      writer: () => {
        throw new Error("disk full");
      },
    });
    expect(() => sink(sample())).not.toThrow();
  });

  it("never throws on circular references (serialize failure)", () => {
    const writer = vi.fn();
    const sink = createStdoutSink({ writer });
    const circular: Record<string, unknown> = { ts: "x" };
    circular["self"] = circular;
    // Cast: our type is strict; the sink must still survive bad input.
    expect(() => sink(circular as unknown as AuditRecord)).not.toThrow();
    expect(writer).not.toHaveBeenCalled();
  });

  it("default writer uses process.stdout when available", () => {
    // process.stdout.write returns boolean; we spy and assert it was called.
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    try {
      const sink = createStdoutSink();
      sink(sample({ event: "default-writer" }));
      expect(stdoutWrite).toHaveBeenCalledTimes(1);
      const arg = stdoutWrite.mock.calls[0]?.[0] as string;
      expect(arg.endsWith("\n")).toBe(true);
    } finally {
      stdoutWrite.mockRestore();
    }
  });

  it("default writer falls back to console.log when process.stdout is missing", () => {
    const realStdout = process.stdout;
    Object.defineProperty(process, "stdout", {
      configurable: true,
      get: () => undefined,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const sink = createStdoutSink();
      sink(sample({ event: "worker-writer" }));
      expect(logSpy).toHaveBeenCalledTimes(1);
      const arg = logSpy.mock.calls[0]?.[0] as string;
      // console.log path strips trailing \n.
      expect(arg.endsWith("\n")).toBe(false);
      expect(JSON.parse(arg).event).toBe("worker-writer");
    } finally {
      Object.defineProperty(process, "stdout", {
        configurable: true,
        value: realStdout,
      });
      logSpy.mockRestore();
    }
  });

  it("default writer falls back when process is missing entirely", () => {
    const realProcess = (globalThis as { process?: unknown }).process;
    Object.defineProperty(globalThis, "process", {
      configurable: true,
      get: () => undefined,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const sink = createStdoutSink();
      sink(sample({ event: "no-process" }));
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, "process", {
        configurable: true,
        value: realProcess,
      });
      logSpy.mockRestore();
    }
  });
});
