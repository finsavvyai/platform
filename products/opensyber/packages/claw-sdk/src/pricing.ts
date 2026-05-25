import type { ClawProvider } from './types.js'

/**
 * Per-1M-token pricing in USD (input, output). Snapshot 2026-05.
 * Update when contracts change. Used by routing logic to pick the cheapest
 * viable model for a given task.
 *
 * llamafile and openrouter are 0 because cost depends on the underlying
 * model — llamafile runs locally (no per-token charge), openrouter routes
 * to whichever upstream provider was selected.
 */
export const PROVIDER_PRICING: Record<ClawProvider, { in: number; out: number }> = {
  anthropic: { in: 3.00, out: 15.00 },   // claude-sonnet-4-6
  openai: { in: 2.50, out: 10.00 },      // gpt-4o
  'workers-ai': { in: 0.45, out: 0.45 }, // llama-3.3-70b-fp8-fast
  llamafile: { in: 0, out: 0 },          // local
  gemini: { in: 0.075, out: 0.30 },      // gemini-2.0-flash — cheapest hosted
  deepseek: { in: 0.14, out: 0.28 },     // deepseek-v3
  openrouter: { in: 0, out: 0 },         // routes — cost depends on selected model
  groq: { in: 0.59, out: 0.79 },         // llama-3.3-70b-versatile
  mistral: { in: 0.20, out: 0.60 },      // mistral-small-3
  together: { in: 0.88, out: 0.88 },     // llama-3.3-70b-turbo
  fireworks: { in: 0.90, out: 0.90 },    // llama-3.3-70b-instruct
  perplexity: { in: 1.00, out: 1.00 },   // sonar-large
  xai: { in: 2.00, out: 10.00 },         // grok-2
  cerebras: { in: 0.85, out: 1.20 },     // llama-3.3-70b — fastest TPS in market
  cohere: { in: 2.50, out: 10.00 },      // command-r-plus
  ai21: { in: 2.00, out: 8.00 },         // jamba-1.5-large
  replicate: { in: 0, out: 0 },          // pay-per-second compute, not per-token
  huggingface: { in: 0, out: 0 },        // varies by inference endpoint plan
  writer: { in: 5.00, out: 12.00 },      // palmyra-x-004 — enterprise tier
  databricks: { in: 0, out: 0 },         // pay-per-DBU compute
  'azure-openai': { in: 2.50, out: 10.00 }, // matches OpenAI gpt-4o pricing
  bedrock: { in: 0, out: 0 },            // varies by underlying model
  vertex: { in: 0, out: 0 },             // varies by underlying model
}

/**
 * Recommended cheapest provider per use case. Routing layers can read this
 * to default to the lowest-cost model that still meets the task's quality
 * bar. "frontier" stays on a premium provider because cheap models lose
 * meaningfully on hard reasoning + long-context coherence.
 */
export const CHEAPEST_BY_USE_CASE: Record<string, ClawProvider> = {
  'classification': 'gemini',     // cheapest hosted, multi-modal
  'summarization': 'gemini',
  'simple-rewrite': 'gemini',
  'reasoning': 'deepseek',        // V3 matches GPT-4o on many benchmarks
  'code-generation': 'deepseek',
  'tool-use': 'gemini',
  'long-context': 'gemini',       // 1M-token context window
  'low-latency': 'groq',          // fastest TPS in market
  'frontier': 'anthropic',        // hard reasoning, agentic loops
  'air-gap': 'llamafile',         // no network egress
}

/** Estimate USD cost of a request given input + output token counts. */
export function estimateCost(
  provider: ClawProvider,
  inputTokens: number,
  outputTokens: number
): number {
  const p = PROVIDER_PRICING[provider]
  if (!p) return 0
  return (inputTokens * p.in + outputTokens * p.out) / 1_000_000
}

/** Return the cheapest non-zero-priced provider for the given use case. */
export function cheapestFor(useCase: string): ClawProvider {
  return CHEAPEST_BY_USE_CASE[useCase] ?? 'gemini'
}
