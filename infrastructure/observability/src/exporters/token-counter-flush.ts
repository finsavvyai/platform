/**
 * Periodic token-counter flush exporter.
 *
 * Reads a TokenCounter snapshot on an interval and emits an audit-shaped
 * record via the supplied emitter:
 *   { event: "token_usage", resource: tenantId, decision: "metered",
 *     reason: <snapshot summary>, meta: <snapshot> }
 *
 * Contract:
 *  - Never throws (emitter errors are swallowed; counter errors are swallowed).
 *  - Returns a `stop()` handle that cancels the interval AND emits a final
 *    snapshot synchronously so nothing is dropped on shutdown.
 *  - Caller may opt to `reset()` the counter after each flush (default: false).
 */

import type {
  AuditEmitterPort,
  TokenCounterPort,
  TokenCounterSnapshotLike,
} from "../types.js";

export type TokenFlushOptions = {
  readonly counter: TokenCounterPort;
  readonly emitter: AuditEmitterPort;
  readonly tenantId: string;
  /** Interval in ms. Default 60_000. */
  readonly intervalMs?: number;
  /** Reset counter after each emit. Default false. */
  readonly resetOnFlush?: boolean;
  /** Override scheduler — defaults to setInterval. */
  readonly schedule?: (cb: () => void, ms: number) => unknown;
  /** Override canceller — defaults to clearInterval. */
  readonly cancel?: (handle: unknown) => void;
  /** Emit a final flush during stop(). Default true. */
  readonly flushOnStop?: boolean;
};

export interface TokenFlushHandle {
  /** Stop the periodic flush. Idempotent. */
  stop(): void;
  /** Force a flush right now. Returns the snapshot that was emitted (or null). */
  flushNow(): TokenCounterSnapshotLike | null;
}

const summarize = (s: TokenCounterSnapshotLike): string =>
  `in=${s.inputTokens} out=${s.outputTokens} billed=${s.billedCalls} cached=${s.cachedCalls}`;

export const startTokenCounterFlush = (
  options: TokenFlushOptions,
): TokenFlushHandle => {
  const intervalMs = options.intervalMs ?? 60_000;
  const schedule =
    options.schedule ?? ((cb, ms) => setInterval(cb, ms));
  const cancel =
    options.cancel ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
  const flushOnStop = options.flushOnStop ?? true;

  const doFlush = (): TokenCounterSnapshotLike | null => {
    let snapshot: TokenCounterSnapshotLike;
    try {
      snapshot = options.counter.snapshot();
    } catch {
      return null;
    }
    try {
      options.emitter.emit({
        actorId: "system",
        event: "token_usage",
        resource: options.tenantId,
        decision: "metered",
        reason: summarize(snapshot),
        meta: {
          inputTokens: snapshot.inputTokens,
          outputTokens: snapshot.outputTokens,
          billedCalls: snapshot.billedCalls,
          cachedCalls: snapshot.cachedCalls,
        },
      });
    } catch {
      // swallow — never crash the flush loop.
    }
    if (options.resetOnFlush && options.counter.reset) {
      try {
        options.counter.reset();
      } catch {
        // swallow.
      }
    }
    return snapshot;
  };

  let stopped = false;
  const handle = schedule(() => {
    doFlush();
  }, intervalMs);

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      try {
        cancel(handle);
      } catch {
        // swallow.
      }
      if (flushOnStop) doFlush();
    },
    flushNow(): TokenCounterSnapshotLike | null {
      return doFlush();
    },
  };
};
