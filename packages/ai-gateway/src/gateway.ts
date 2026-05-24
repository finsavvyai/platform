import type {
  GatewayRequest,
  GatewayResponse,
  ProviderAdapter,
  SemanticCache,
} from "./types.js";

export type GatewayConfig = {
  readonly adapters: readonly ProviderAdapter[];
  readonly cache?: SemanticCache;
  readonly maxAttempts?: number;
};

export class AiGateway {
  private readonly adapters: readonly ProviderAdapter[];
  private readonly cache: SemanticCache | undefined;
  private readonly maxAttempts: number;

  constructor(config: GatewayConfig) {
    if (config.adapters.length === 0) {
      throw new Error("AiGateway requires at least one adapter.");
    }
    this.adapters = config.adapters;
    this.cache = config.cache;
    this.maxAttempts = config.maxAttempts ?? 3;
  }

  async complete(req: GatewayRequest): Promise<GatewayResponse> {
    if (this.cache && req.cacheKey) {
      const hit = await this.cache.get(req.cacheKey);
      if (hit) return { ...hit, cached: true };
    }
    const adapter = this.pick(req);
    const result = await this.withRetry(adapter, req);
    if (this.cache && req.cacheKey) await this.cache.set(req.cacheKey, result);
    return result;
  }

  private pick(req: GatewayRequest): ProviderAdapter {
    const match = this.adapters.find((a) => a.ref.tier === req.tier);
    return match ?? this.adapters[0]!;
  }

  private async withRetry(
    adapter: ProviderAdapter,
    req: GatewayRequest,
  ): Promise<GatewayResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const out = await adapter.complete(req);
        return { ...out, model: adapter.ref, cached: false, attempts: attempt };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }
}
