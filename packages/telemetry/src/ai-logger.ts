import type { AiExecutionEvent, AiExecutionLogger } from "./types.js";

export class InMemoryAiLogger implements AiExecutionLogger {
  readonly events: AiExecutionEvent[] = [];

  record(event: AiExecutionEvent): void {
    this.events.push(event);
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
