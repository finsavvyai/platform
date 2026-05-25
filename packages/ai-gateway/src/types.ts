export type Provider = "anthropic" | "openai" | "google" | "azure" | "local";

export type ModelTier = "fast" | "balanced" | "frontier";

export type ModelRef = {
  readonly provider: Provider;
  readonly model: string;
  readonly tier: ModelTier;
  /** USD per 1K input tokens, used by RoutePolicy.maxCostPer1kInput. */
  readonly costPer1kInput?: number;
  /** USD per 1K output tokens. */
  readonly costPer1kOutput?: number;
  /** Observed/declared p50 latency in ms, used by RoutePolicy.maxLatencyMs. */
  readonly latencyMsP50?: number;
};

export type GatewayRequest = {
  readonly tenantId: string;
  readonly prompt: string;
  readonly tier: ModelTier;
  readonly maxTokens: number;
  /** Optional explicit model name. If set, must match a provider exactly. */
  readonly model?: string;
  /** Optional pre-computed cache key. Otherwise gateway derives from prompt. */
  readonly cacheKey?: string;
  /** Idempotency token forwarded to provider; preserved across retries. */
  readonly idempotencyKey?: string;
};

export type ProviderCallResult = {
  readonly text: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
};

export type GatewayResponse = ProviderCallResult & {
  readonly model: ModelRef;
  readonly cached: boolean;
  readonly attempts: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export interface ProviderAdapter {
  readonly ref: ModelRef;
  complete(req: GatewayRequest): Promise<ProviderCallResult>;
}

export interface SemanticCache {
  get(key: string): Promise<GatewayResponse | undefined>;
  set(key: string, value: GatewayResponse): Promise<void>;
  size(): number;
}

export type RoutePolicy = {
  /** Reject providers with `costPer1kInput` above this. */
  readonly maxCostPer1kInput?: number;
  /** Reject providers with declared `latencyMsP50` above this. */
  readonly maxLatencyMs?: number;
  /** Restrict to a specific provider id. */
  readonly preferProvider?: Provider;
};

export type RetryConfig = {
  /** Max total attempts, including the first. Default 3. */
  readonly maxAttempts?: number;
  /** Base delay in ms for exponential backoff. Default 50. */
  readonly baseDelayMs?: number;
  /** Cap on delay between attempts. Default 2000. */
  readonly maxDelayMs?: number;
  /** Jitter source 0..1; defaults to Math.random. Injected for tests. */
  readonly jitter?: () => number;
  /** Sleep impl, injected for tests to avoid real timers. */
  readonly sleep?: (ms: number) => Promise<void>;
};

export type TokenCounterSnapshot = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedCalls: number;
  readonly billedCalls: number;
};
