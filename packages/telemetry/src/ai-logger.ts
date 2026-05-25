import { redact } from "./redact.js";
import type { AiExecutionEvent, AiExecutionLogger } from "./types.js";

export type AiLoggerOptions = {
  readonly redactKeys?: readonly string[];
};

/**
 * In-memory AI execution logger.
 *
 * Every recorded event is run through the redactor so that token-shaped
 * substrings (sk-*, AKIA*, JWTs, etc.) never land in metrics dashboards
 * or replay tooling. Numeric / boolean fields pass through untouched.
 */
export class InMemoryAiLogger implements AiExecutionLogger {
  readonly events: AiExecutionEvent[] = [];
  private readonly redactKeys: readonly string[] | undefined;

  constructor(options: AiLoggerOptions = {}) {
    this.redactKeys = options.redactKeys;
  }

  record(event: AiExecutionEvent): void {
    const safe = this.redactKeys
      ? redact(event, { keys: this.redactKeys })
      : redact(event);
    this.events.push(safe);
  }

  totals(): {
    promptTokens: number;
    completionTokens: number;
    cost: number;
    cacheHits: number;
  } {
    return this.events.reduce(
      (acc, e) => ({
        promptTokens: acc.promptTokens + e.promptTokens,
        completionTokens: acc.completionTokens + e.completionTokens,
        cost: acc.cost + e.cost,
        cacheHits: acc.cacheHits + (e.cacheHit ? 1 : 0),
      }),
      { promptTokens: 0, completionTokens: 0, cost: 0, cacheHits: 0 },
    );
  }
}
