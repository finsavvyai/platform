/** Default model catalog for the Smart Router.
 *
 * Extracted from router.ts to keep that file under the 200-line cap.
 * Each entry sets cost/latency/quality priors that the router uses for the
 * first request before learned weights take over.
 */

export interface ModelProfile {
  provider: string;
  model: string;
  costPer1kTokens: number;
  avgLatencyMs: number;
  qualityScore: number;
  maxTokens: number;
}

export const DEFAULT_MODELS: ModelProfile[] = [
  { provider: 'groq',      model: 'llama-3.1-8b-instant',                                    costPer1kTokens: 0,    avgLatencyMs: 200,  qualityScore: 0.78, maxTokens: 128000 },
  { provider: 'gemini',    model: 'gemini-2.5-flash',                                         costPer1kTokens: 0,    avgLatencyMs: 600,  qualityScore: 0.88, maxTokens: 1000000 },
  { provider: 'deepseek',  model: 'deepseek-chat',                                            costPer1kTokens: 0.14, avgLatencyMs: 800,  qualityScore: 0.82, maxTokens: 64000 },
  { provider: 'openai',    model: 'gpt-4o-mini',                                              costPer1kTokens: 0.15, avgLatencyMs: 600,  qualityScore: 0.85, maxTokens: 128000 },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001',                                costPer1kTokens: 0.25, avgLatencyMs: 500,  qualityScore: 0.88, maxTokens: 200000 },
  { provider: 'openai',    model: 'gpt-4o',                                                   costPer1kTokens: 2.5,  avgLatencyMs: 1200, qualityScore: 0.94, maxTokens: 128000 },
  { provider: 'anthropic', model: 'claude-sonnet-4-6',                                        costPer1kTokens: 3.0,  avgLatencyMs: 1000, qualityScore: 0.95, maxTokens: 200000 },
  { provider: 'anthropic', model: 'claude-opus-4-6',                                          costPer1kTokens: 15.0, avgLatencyMs: 2000, qualityScore: 0.99, maxTokens: 200000 },
  { provider: 'groq',      model: 'llama-3.3-70b-versatile',                                  costPer1kTokens: 0.59, avgLatencyMs: 300,  qualityScore: 0.87, maxTokens: 32000 },
  { provider: 'mistral',   model: 'mistral-large',                                            costPer1kTokens: 2.0,  avgLatencyMs: 900,  qualityScore: 0.90, maxTokens: 128000 },
  { provider: 'together',  model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',                  costPer1kTokens: 0.88, avgLatencyMs: 700,  qualityScore: 0.89, maxTokens: 128000 },
  { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',        costPer1kTokens: 0.90, avgLatencyMs: 600,  qualityScore: 0.89, maxTokens: 128000 },
  { provider: 'openrouter',model: 'auto',                                                     costPer1kTokens: 1.0,  avgLatencyMs: 800,  qualityScore: 0.85, maxTokens: 128000 },
  { provider: 'perplexity',model: 'llama-3.1-sonar-large-128k-online',                        costPer1kTokens: 1.0,  avgLatencyMs: 1500, qualityScore: 0.88, maxTokens: 128000 },
  { provider: 'xai',       model: 'grok-2-latest',                                            costPer1kTokens: 2.0,  avgLatencyMs: 900,  qualityScore: 0.92, maxTokens: 128000 },
];
