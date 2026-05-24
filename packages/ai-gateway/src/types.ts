export type Provider = "anthropic" | "openai" | "google" | "azure" | "local";

export type ModelTier = "fast" | "balanced" | "frontier";

export type ModelRef = {
  readonly provider: Provider;
  readonly model: string;
  readonly tier: ModelTier;
};

export type GatewayRequest = {
  readonly tenantId: string;
  readonly prompt: string;
  readonly tier: ModelTier;
  readonly maxTokens: number;
  readonly cacheKey?: string;
};

export type GatewayResponse = {
  readonly model: ModelRef;
  readonly text: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly cached: boolean;
  readonly attempts: number;
};

export interface ProviderAdapter {
  readonly ref: ModelRef;
  complete(req: GatewayRequest): Promise<Omit<GatewayResponse, "model" | "cached" | "attempts">>;
}

export interface SemanticCache {
  get(key: string): Promise<GatewayResponse | undefined>;
  set(key: string, value: GatewayResponse): Promise<void>;
}
