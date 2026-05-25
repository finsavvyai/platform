/** Shared types for all four baselines. */

export interface BenchRequest {
  id: string;
  prompt: string;
  bucket: 'a' | 'b' | 'c';
  /** Source dataset identifier (e.g. 'cais/mmlu', 'synthetic'). Tracked through to JSONL outputs so summarize can compute real-vs-synthetic split. */
  source: string;
  expected_kind?: string;
}

export interface ProviderCallResult {
  /** Identifier of the baseline that produced this result. */
  baseline: 'A' | 'B' | 'C' | 'D';
  /** Provider + model used (or 'booster-skip' if D resolved locally). */
  provider: string;
  model: string;
  /** Token counts as reported by the provider, or 0 for skipped. */
  prompt_tokens: number;
  completion_tokens: number;
  /** USD cost computed from provider's published rate at run time. */
  cost_usd: number;
  /** True if a cache (prompt-cache, semantic, or local) returned the response. */
  cached: boolean;
  /** True if the Booster (Baseline D only) skipped the provider call entirely. */
  skipped: boolean;
  /** End-to-end latency in milliseconds. */
  latency_ms: number;
  /** The text the application would have seen. */
  output: string;
  /** Optional per-baseline diagnostic blob. */
  meta?: Record<string, unknown>;
  /** Error string when the call failed; output is "" in that case. */
  error?: string;
}

export interface Baseline {
  name: 'A' | 'B' | 'C' | 'D';
  description: string;
  call(req: BenchRequest, model: ModelChoice): Promise<ProviderCallResult>;
}

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'deepseek';

export interface ModelChoice {
  provider: ProviderName;
  model: string;
}

/** Model menu for the benchmark — eight models, four providers. */
export const MODELS: ModelChoice[] = [
  { provider: 'openai',    model: 'gpt-5' },
  { provider: 'openai',    model: 'gpt-5-mini' },
  { provider: 'anthropic', model: 'claude-opus-4-7' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  { provider: 'anthropic', model: 'claude-haiku-4-5' },
  { provider: 'google',    model: 'gemini-2.5-pro' },
  { provider: 'google',    model: 'gemini-2.5-flash' },
  { provider: 'deepseek',  model: 'deepseek-v3' },
];

/** Pricing $/1M tokens, retail rate as of benchmark run date. */
export const PRICING: Record<string, { input: number; output: number; cached_input?: number }> = {
  'gpt-5':              { input:  10.00, output: 30.00, cached_input:  5.00 },
  'gpt-5-mini':         { input:   2.00, output:  8.00, cached_input:  1.00 },
  'claude-opus-4-7':    { input:  15.00, output: 75.00, cached_input:  1.50 },
  'claude-sonnet-4-6':  { input:   3.00, output: 15.00, cached_input:  0.30 },
  'claude-haiku-4-5':   { input:   1.00, output:  5.00, cached_input:  0.10 },
  'gemini-2.5-pro':     { input:   2.50, output: 10.00 },
  'gemini-2.5-flash':   { input:   0.30, output:  2.50 },
  'deepseek-v3':        { input:   0.27, output:  1.10, cached_input:  0.07 },
};

export function computeCost(model: string, inputTokens: number, outputTokens: number, cachedInput: boolean): number {
  const p = PRICING[model];
  if (!p) throw new Error(`pricing missing for ${model}`);
  const inRate = cachedInput && p.cached_input != null ? p.cached_input : p.input;
  return (inputTokens * inRate + outputTokens * p.output) / 1_000_000;
}
