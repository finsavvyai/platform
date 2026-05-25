/**
 * Stdout sink — JSON-line writer. Default for dev.
 *
 * Contract:
 *  - Writes one valid JSON record per line, newline-terminated.
 *  - Never throws.
 *  - Works in Node (process.stdout.write) and in Cloudflare Workers
 *    (falls back to console.log when process.stdout is not available).
 */

import type { AuditRecord, AuditSink } from "../types.js";

export type StdoutSinkOptions = {
  /** Override the writer (used in tests). */
  readonly writer?: (line: string) => void;
};

const isWritableStreamLike = (
  v: unknown,
): v is { write: (chunk: string) => boolean } => {
  if (v === null || typeof v !== "object") return false;
  return typeof (v as { write?: unknown }).write === "function";
};

const resolveDefaultWriter = (): ((line: string) => void) => {
  // Node-like envs expose process.stdout.write.
  const proc = (globalThis as { process?: { stdout?: unknown } }).process;
  const stdout = proc?.stdout;
  if (isWritableStreamLike(stdout)) {
    return (line: string) => {
      stdout.write(line);
    };
  }
  // Cloudflare Workers / browsers — console.log appends its own newline.
  return (line: string) => {
    // eslint-disable-next-line no-console
    console.log(line.endsWith("\n") ? line.slice(0, -1) : line);
  };
};

const safeSerialize = (record: unknown): string | null => {
  try {
    return JSON.stringify(record);
  } catch {
    return null;
  }
};

export const createStdoutSink = (
  options: StdoutSinkOptions = {},
): AuditSink => {
  const write = options.writer ?? resolveDefaultWriter();
  return (record: AuditRecord) => {
    const serialized = safeSerialize(record);
    if (serialized === null) return; // serialization failure: swallow.
    try {
      write(`${serialized}\n`);
    } catch {
      // Per audit-log convention: sinks must never throw.
    }
  };
};
