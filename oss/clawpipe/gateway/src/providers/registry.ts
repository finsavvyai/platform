/** Provider registry — maps provider names to adapters and API keys. */

import type { Env, ProviderAdapter } from '../types';
import { readProviderKey } from '../auth/provider-keys';
import { openaiAdapter } from './openai';
import { anthropicAdapter } from './anthropic';
import { deepseekAdapter } from './deepseek';
import { groqAdapter } from './groq';
import { mistralAdapter } from './mistral';
import { togetherAdapter } from './together';
import { fireworksAdapter } from './fireworks';
import { openrouterAdapter } from './openrouter';
import { perplexityAdapter } from './perplexity';
import { cohereAdapter } from './cohere';
import { ai21Adapter } from './ai21';
import { cerebrasAdapter } from './cerebras';
import { replicateAdapter } from './replicate';
import { huggingfaceAdapter } from './huggingface';
import { writerAdapter } from './writer';
import { databricksAdapter } from './databricks';
import { azureOpenaiAdapter } from './azure-openai';
import { bedrockAdapter } from './bedrock';
import { vertexAdapter } from './vertex';
import { xaiAdapter } from './xai';
import { geminiAdapter } from './gemini';

const ADAPTERS: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  deepseek: deepseekAdapter,
  groq: groqAdapter,
  gemini: geminiAdapter,
  mistral: mistralAdapter,
  together: togetherAdapter,
  fireworks: fireworksAdapter,
  openrouter: openrouterAdapter,
  perplexity: perplexityAdapter,
  cohere: cohereAdapter,
  ai21: ai21Adapter,
  cerebras: cerebrasAdapter,
  replicate: replicateAdapter,
  huggingface: huggingfaceAdapter,
  writer: writerAdapter,
  databricks: databricksAdapter,
  'azure-openai': azureOpenaiAdapter,
  bedrock: bedrockAdapter,
  vertex: vertexAdapter,
  xai: xaiAdapter,
};

/** Get the adapter for a provider name. */
export function getAdapter(provider: string): ProviderAdapter | undefined {
  return ADAPTERS[provider];
}

function getEnvKey(provider: string, env: Env): string | undefined {
  const keyMap: Record<string, string | undefined> = {
    openai: env.OPENAI_API_KEY,
    anthropic: env.ANTHROPIC_API_KEY,
    deepseek: env.DEEPSEEK_API_KEY,
    groq: env.GROQ_API_KEY,
    gemini: env.GEMINI_API_KEY,
    mistral: env.MISTRAL_API_KEY,
    together: env.TOGETHER_API_KEY,
    fireworks: env.FIREWORKS_API_KEY,
    openrouter: env.OPENROUTER_API_KEY,
    perplexity: env.PERPLEXITY_API_KEY,
    cohere: env.COHERE_API_KEY,
    ai21: env.AI21_API_KEY,
    cerebras: env.CEREBRAS_API_KEY,
    replicate: env.REPLICATE_API_KEY,
    huggingface: env.HUGGINGFACE_API_KEY,
    writer: env.WRITER_API_KEY,
    databricks: env.DATABRICKS_API_KEY,
    'azure-openai': env.AZURE_OPENAI_API_KEY,
    bedrock: env.BEDROCK_API_KEY,
    vertex: env.VERTEX_API_KEY,
    xai: env.XAI_API_KEY,
  };
  return keyMap[provider];
}

/**
 * Get the API key for a provider.
 * If projectId is supplied and a per-project encrypted key exists in D1, that key
 * takes priority. Otherwise falls back to the global env var.
 */
export async function getApiKey(
  provider: string,
  env: Env,
  projectId?: string,
): Promise<string | undefined> {
  if (projectId) {
    const perProject = await readProviderKey(env, projectId, provider);
    if (perProject) return perProject;
  }
  return getEnvKey(provider, env);
}

/** List all available providers (those with a global env key configured). */
export function listAvailable(env: Env): string[] {
  return Object.keys(ADAPTERS).filter((p) => getEnvKey(p, env));
}
