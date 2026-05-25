import type { TokenCounterSnapshot } from "./types.js";

/**
 * Aggregates token usage across gateway calls. Cached calls do NOT count
 * against the input/output token budget (per package contract).
 */
export class TokenCounter {
  private inputTokens = 0;
  private outputTokens = 0;
  private cachedCalls = 0;
  private billedCalls = 0;

  recordBilled(inputTokens: number, outputTokens: number): void {
    if (inputTokens < 0 || outputTokens < 0) {
      throw new Error("Token counts must be non-negative.");
    }
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    this.billedCalls += 1;
  }

  recordCached(): void {
    this.cachedCalls += 1;
  }

  snapshot(): TokenCounterSnapshot {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedCalls: this.cachedCalls,
      billedCalls: this.billedCalls,
    };
  }

  reset(): void {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.cachedCalls = 0;
    this.billedCalls = 0;
  }
}
