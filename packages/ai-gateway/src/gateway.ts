import { TokenCounter } from "./accounting.js";
import { deriveCacheKey } from "./cache.js";
import { selectAdapter } from "./routing.js";
import { runWithRetry } from "./retry.js";
import type {
  GatewayRequest,
  GatewayResponse,
  ProviderAdapter,
  RetryConfig,
  RoutePolicy,
  SemanticCache,
  TokenCounterSnapshot,
} from "./types.js";

export type GatewayConfig = {
  readonly adapters: readonly ProviderAdapter[];
  readonly cache?: SemanticCache;
  readonly policy?: RoutePolicy;
  readonly retry?: RetryConfig;
};

/**
 * AI gateway orchestrator.
 *
 * Responsibilities (critical paths, 100% covered):
 *   - Route: explicit (model match) > tier match > policy filters > NoRouteError.
 *   - Retry: exponential backoff with jitter; non-retryable 4xx short-circuits;
 *     idempotency token preserved across retries.
 *   - Cache: bounded LRU+TTL keyed by (model, normalized_prompt_hash); cache hits
 *     do NOT increment input/output token counters.
 *   - Token accounting: every billed call increments counters; cached calls don't.
 */
export class AiGateway {
  private readonly adapters: readonly ProviderAdapter[];
  private readonly cache: SemanticCache | undefined;
  private readonly policy: RoutePolicy;
  private readonly retry: RetryConfig;
  private readonly counter = new TokenCounter();

  constructor(config: GatewayConfig) {
    if (config.adapters.length === 0) {
      throw new Error("AiGateway requires at least one adapter.");
    }
    this.adapters = config.adapters;
    this.cache = config.cache;
    this.policy = config.policy ?? {};
    this.retry = config.retry ?? {};
  }

  async complete(req: GatewayRequest): Promise<GatewayResponse> {
    const adapter = selectAdapter(this.adapters, req, this.policy);
    const key = this.resolveCacheKey(req, adapter);

    if (this.cache && key !== undefined) {
      const hit = await this.cache.get(key);
      if (hit !== undefined) {
        this.counter.recordCached();
        return { ...hit, cached: true };
      }
    }

    // Preserve idempotency key across retry attempts so providers can dedupe.
    const idempotent: GatewayRequest = req.idempotencyKey
      ? req
      : { ...req, idempotencyKey: cryptoRandomId() };

    const { value, attempts } = await runWithRetry(
      () => adapter.complete(idempotent),
      this.retry,
    );

    const response: GatewayResponse = {
      ...value,
      model: adapter.ref,
      cached: false,
      attempts,
      inputTokens: value.promptTokens,
      outputTokens: value.completionTokens,
    };

    this.counter.recordBilled(response.inputTokens, response.outputTokens);

    if (this.cache && key !== undefined) {
      await this.cache.set(key, response);
    }
    return response;
  }

  usage(): TokenCounterSnapshot {
    return this.counter.snapshot();
  }

  resetUsage(): void {
    this.counter.reset();
  }

  private resolveCacheKey(
    req: GatewayRequest,
    adapter: ProviderAdapter,
  ): string | undefined {
    if (!this.cache) return undefined;
    if (req.cacheKey !== undefined) return req.cacheKey;
    return deriveCacheKey(adapter.ref.model, req.prompt);
  }
}

function cryptoRandomId(): string {
  // Node 20+ guarantees globalThis.crypto.randomUUID per platform contract.
  return globalThis.crypto.randomUUID();
}
